import { CLIENT_SYMBOL } from "./joe-dom.js";

import type {
  ClientComponent,
  ComponentChild,
  ComponentChildren,
  ComponentProps,
  FunctionComponent,
  VNode,
} from "./types.js";
import type { JSXInternal } from "./jsx.js";
import { fallbackRuntime, islandRuntime } from "./runtime.js";
export { deserialize, serialize } from "./serializer.js";
import {
  UNSAFE_NAME,
  VOID_ELEMENTS,
  XLINK,
  XLINK_REPLACE_REGEX,
  encodeEntities,
  isPromise,
  styleObjToCss,
} from "./utils.js";

interface IDIncrementor {
  (): number;
  previous: number;
}

export type AllReadyReadableStream<ReadableStreamType = ReadableStream> =
  ReadableStreamType & {
    allReady: Promise<void>;
  };

export interface RenderOptions {
  signal?: AbortSignal;
  getClientReferenceId?: (
    id: string | number
  ) => string | number | Promise<string | number>;
}

export function render<ReadableStreamType = ReadableStream>(
  children: ComponentChildren,
  options?: RenderOptions
): AllReadyReadableStream<ReadableStreamType> {
  const { signal } = options || {};

  let allReady: () => void,
    cancel: (reason?: unknown) => void,
    removeSignalListener: undefined | (() => void);
  const allReadyPromise = new Promise<void>((resolve, reject) => {
    allReady = () => {
      if (removeSignalListener) removeSignalListener();
      resolve();
    };
    cancel = (reason) => {
      if (removeSignalListener) removeSignalListener();
      reason = reason || new Error("Render cancelled");
      reject(reason);
    };
  });
  allReadyPromise.catch(() => {});

  let fallbackIdIncrementor = -1;
  const nextFallbackId = (() => ++fallbackIdIncrementor) as IDIncrementor;
  Object.defineProperties(nextFallbackId, {
    previous: { enumerable: true, get: () => fallbackIdIncrementor },
  });
  let islandIdIncrementor = -1;
  const nextIslandId = (() => ++islandIdIncrementor) as IDIncrementor;
  Object.defineProperties(nextIslandId, {
    previous: { enumerable: true, get: () => islandIdIncrementor },
  });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        let queuedPromises = [];
        const queueChunk = (promise) => {
          queuedPromises.push(promise);
        };
        const html = await renderChildren(
          children,
          nextFallbackId,
          nextIslandId,
          queueChunk,
          options,
          null,
          false,
          false
        );
        controller.enqueue(encoder.encode(html));

        if (queuedPromises.length > 0) {
          controller.enqueue(encoder.encode(fallbackRuntime));
          // TODO: Make this runtime optional
          controller.enqueue(encoder.encode(islandRuntime));
        }
        while (queuedPromises.length > 0) {
          const processQueuedPromises = [];
          for (const promise of queuedPromises) {
            processQueuedPromises.push(
              promise.then((chunk) => {
                controller.enqueue(encoder.encode(chunk));
              })
            );
          }
          queuedPromises = [];
          queuedPromises.length = 0;
          await Promise.all(processQueuedPromises);
        }

        controller.close();
        allReady();
      } catch (reason) {
        cancel(reason);
        throw reason;
      }
    },
    cancel(reason) {
      cancel(reason);
    },
  });

  if (signal) {
    const onAbort = () => {
      stream.cancel(signal.reason);
    };
    signal.addEventListener("abort", onAbort);
    removeSignalListener = () => signal.removeEventListener("abort", onAbort);
  }

  return Object.defineProperties(
    stream as unknown as AllReadyReadableStream<ReadableStreamType>,
    {
      allReady: { enumerable: true, value: allReadyPromise },
    }
  );
}

async function renderChildren(
  children: ComponentChildren,
  nextFallbackId: IDIncrementor,
  nextIslandId: IDIncrementor,
  queueChunk: (chunk: Promise<string>) => void,
  options: RenderOptions,
  selectedValue: string | null,
  svgMode: boolean,
  clientMode: boolean
) {
  if (children == null) return "";
  const childrenToRender = Array.isArray(children) ? children : [children];

  const childPromises = [];
  for (let child of childrenToRender) {
    const promise = (async () => {
      if (isPromise(child)) child = await child;
      const type = !!child && child.type;
      let childSvgMode =
        type === "svg" || (type !== "foreignObject" && svgMode);
      let html = "";
      for await (const chunk of renderChild(
        child,
        nextFallbackId,
        nextIslandId,
        queueChunk,
        options,
        selectedValue,
        childSvgMode,
        clientMode
      )) {
        html += chunk;
      }
      return html;
    })();
    promise.catch(() => {});
    childPromises.push(promise);
  }
  await Promise.all(childPromises);

  return (await Promise.all(childPromises)).join("");
}

async function* renderChild(
  child: ComponentChild,
  nextFallbackId: IDIncrementor,
  nextIslandId: IDIncrementor,
  queueChunk: (chunk: Promise<string>) => void,
  options: RenderOptions,
  selectedValue: string | null,
  svgMode: boolean,
  clientMode: boolean
): AsyncGenerator<string> {
  if (isPromise(child)) {
    child = await child;
  }

  switch (typeof child) {
    case "string":
    case "number":
    case "bigint":
      return yield "" + child;
    case "undefined":
    case "boolean":
      return yield child ? "true" : "";
    case "function":
    case "symbol":
      throw new Error("Invalid child '" + typeof child + "'");
    default:
      if (!child) return yield "";
      let { $$typeof, type, props } = (child as VNode) || {};
      if (typeof type !== "string" && typeof type !== "function") {
        throw new Error("Invalid child type '" + typeof type + "'");
      }

      if (typeof type !== "string") {
        type = type as FunctionComponent;
        let children = type(props, {});

        // options._commit, we don't schedule any effects in this library right now,
        // so we can pass an empty queue to this hook.

        const prom = isPromise(children);
        let id = prom ? nextFallbackId() : nextFallbackId.previous;
        let clientComponent = type.$$typeof === CLIENT_SYMBOL;
        let fellback = false;

        const renderedChildren = renderChildren(
          children,
          nextFallbackId,
          nextIslandId,
          queueChunk,
          options,
          selectedValue,
          svgMode,
          clientComponent
        ).then(async (rendered) => {
          let r = "";
          let islandId =
            (fellback && clientComponent) || (clientComponent && !clientMode)
              ? nextIslandId()
              : undefined;
          if (typeof islandId === "number") {
            r += `<!--joec:${islandId}-->`;
          }
          r += rendered;
          if (typeof islandId === "number") {
            r += `<!--/joec:${islandId}-->`;
            if (!options.getClientReferenceId) {
              throw new Error(
                "Missing getClientReferenceId option for client component"
              );
            }
            queueChunk(
              Promise.resolve(
                `<script>window.$_JOE_INIT.promise.then(() => $_JOE(${JSON.stringify(
                  islandId
                )}, ${JSON.stringify(
                  await options.getClientReferenceId("joe-dom")
                )}, ${JSON.stringify(
                  await options.getClientReferenceId(
                    (type as ClientComponent<any>).$$id
                  )
                )}, ${JSON.stringify(props)}))</script>`
              )
            );
          }
          return r;
        });
        if ((prom || id !== nextFallbackId.previous) && type.fallback) {
          fellback = true;
          if (!prom) {
            id = nextFallbackId();
          }
          const fallback = type.fallback(props);

          const chunkPromise = renderedChildren.then((chunk) => {
            return `<joe-fb hidden data-id="${id}">${chunk}</joe-fb>`;
          });
          // TODO: catch errors from chunkPromise

          queueChunk(chunkPromise);

          // TODO: queue children to render after fallback
          const fallbackHTML = await renderChildren(
            fallback,
            nextFallbackId,
            nextIslandId,
            queueChunk,
            options,
            selectedValue,
            svgMode,
            clientMode
          );

          return yield `<!--joe:${id}-->${fallbackHTML}<!--/joe:${id}-->`;
        }

        return yield renderedChildren;
      }
      return yield renderDOMNode(
        child as VNode,
        nextFallbackId,
        nextIslandId,
        queueChunk,
        options,
        selectedValue,
        svgMode,
        clientMode
      );
  }
}

// Adapted from https://github.com/preactjs/preact-render-to-string
async function renderDOMNode(
  vnode: VNode<ComponentProps<keyof JSXInternal.IntrinsicElements>>,
  nextFallbackId: IDIncrementor,
  nextIslandId: IDIncrementor,
  queueChunk: (chunk: Promise<string>) => void,
  options: RenderOptions,
  selectedValue: string | null,
  svgMode: boolean,
  clientMode: boolean
) {
  const { type, props } = vnode as Omit<
    VNode<ComponentProps<keyof JSXInternal.IntrinsicElements>>,
    "type"
  > & { type: string };

  let html = "<" + type;

  const seenKeys = new Set();
  for (let key of Object.keys(props)) {
    if (key.startsWith("on")) continue;
    let v = props[key];

    switch (key) {
      case "key":
      case "ref":
      case "__self":
      case "__source":
      case "children":
        continue;
      case "checked":
      case "defaultChecked":
        key = "checked";
        if (seenKeys.has(key)) {
          // TODO: surface warning about duplicate key with line position
          console.warn("Duplicate key 'checked' and 'defaultChecked' found");
          continue;
        }
        break;
      case "class":
      case "className":
        key = "class";
        if (seenKeys.has(key)) {
          // TODO: surface warning about duplicate key with line position
          console.warn("Duplicate key 'class' and 'className' found");
          continue;
        }
        seenKeys.add(key);
        break;
      case "dangerouslySetInnerHTML":
        throw new Error("TODO: implement dangerouslySetInnerHTML");
      case "html":
      case "htmlFor":
        key = "for";
        if (seenKeys.has(key)) {
          // TODO: surface warning about duplicate key with line position
          console.warn("Duplicate key 'for' and 'htmlFor' found");
          continue;
        }
        break;
      case "selected":
      case "defaultSelected":
        key = "selected";
        if (seenKeys.has(key)) {
          // TODO: surface warning about duplicate key with line position
          console.warn("Duplicate key 'selected' and 'defaultSelected' found");
          continue;
        }
        break;
      case "style":
        v = styleObjToCss(v);
        break;
      case "value":
      case "defaultValue":
        key = "value";
        if (seenKeys.has(key)) {
          // TODO: surface warning about duplicate key with line position
          console.warn("Duplicate key 'value' and 'defaultValue' found");
          continue;
        }
        switch (type) {
          case "textarea":
            props.children = v;
            continue;
          case "select":
            selectedValue = v;
            continue;
          case "option":
            if (v == selectedValue) {
              html += " selected";
            }
        }
        break;
      default:
        if (svgMode && XLINK.test(key)) {
          key = key.toLowerCase().replace(XLINK_REPLACE_REGEX, "xlink:");
        } else if (UNSAFE_NAME.test(key)) {
          continue;
        } else if ((key[4] === "-" || key === "draggable") && v != null) {
          // serialize boolean aria-xyz or draggable attribute values as strings
          // `draggable` is an enumerated attribute and not Boolean. A value of `true` or `false` is mandatory
          // https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/draggable
          v += "";
        }
    }

    if (v != null && v !== false && typeof v !== "function") {
      if (v === true || v === "") {
        html += " " + key;
      } else {
        html += " " + key + '="' + encodeEntities(v + "") + '"';
      }
    }
  }
  const children = props.children;
  const selfClosed = VOID_ELEMENTS.test(type) && children == null;
  html += ">";

  if (!selfClosed && children != null) {
    html += await renderChildren(
      children,
      nextFallbackId,
      nextIslandId,
      queueChunk,
      options,
      selectedValue,
      svgMode,
      clientMode
    );
  }

  if (!selfClosed) {
    html += "</" + type + ">";
  }

  return html;
}
