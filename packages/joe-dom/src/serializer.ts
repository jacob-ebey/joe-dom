// Adapted from https://github.com/Rich-Harris/devalue
import {
  type FunctionComponent,
  CLIENT_SYMBOL,
  createElement,
} from "./joe-dom.js";

const UNDEFINED = -1,
  HOLE = -2,
  NAN = -3,
  POSITIVE_INFINITY = -4,
  NEGATIVE_INFINITY = -5,
  NEGATIVE_ZERO = -6;

export function serialize(value: unknown) {
  const pending = new Set<Promise<unknown>>();

  let promiseCount = 0;
  function queuePromise(promise: Promise<unknown>) {
    const id = promiseCount++;
    pending.add(
      promise
        .then((value) => {
          return [id, { value }];
        })
        .catch((error) => {
          let value = { message: "Unknown error", stack: undefined };
          if (error && error instanceof Error) {
            value = { message: error.message, stack: error.stack };
          } else if (error && error.message) {
            value = { message: error.message, stack: undefined };
          } else if (typeof error === "string") {
            value = { message: error, stack: undefined };
          }
          return [id, { error: value }];
        })
    );
    return id;
  }

  const ids = new Map<unknown, string>();
  function flatten(value: unknown, stringified: string[], depth = 0) {
    let count = 0;
    const keys = [];

    function flattenRecursive(value: unknown): number | string {
      switch (typeof value) {
        case "function":
          throw new DevalueError("Cannot serialize functions", keys);
        case "undefined":
          return UNDEFINED;
        case "number":
          if (Number.isNaN(value)) return NAN;
          if (value === Infinity) return POSITIVE_INFINITY;
          if (value === -Infinity) return NEGATIVE_INFINITY;
          if (value === 0 && 1 / value === -Infinity) return NEGATIVE_ZERO;
      }

      if (ids.has(value)) return ids.get(value);

      const index = stringified.length;
      stringified.length += 1;
      const id = `"${depth}:${index}"`;
      ids.set(value, id);

      stringified[index] = serializeValue(
        value,
        keys,
        flattenRecursive,
        queuePromise
      );

      return id;
    }

    return flattenRecursive(value);
  }

  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const stringified: string[] = [];
      const id = flatten(value, stringified);

      const line =
        typeof id === "number" && id < 0
          ? `${id}`
          : `[${stringified.join(",")}]`;
      controller.enqueue(encoder.encode(line + "\n"));

      let sentLines = 1;
      while (pending.size > 0) {
        const promises = [...pending];
        pending.clear();

        await Promise.all(
          promises.map((promise) =>
            promise.then(([promiseId, result]) => {
              const stringified: string[] = [];
              const id = flatten(result, stringified, sentLines++);

              const line =
                typeof id === "number" && id < 0
                  ? `${id}`
                  : `[${stringified.join(",")}]`;

              controller.enqueue(encoder.encode(`$${promiseId}:${line}\n`));
            })
          )
        );
      }

      controller.close();
    },
  });
}

export async function deserialize(
  stream: ReadableStream<Uint8Array>,
  loadClientComponent?: (id: string | number) => Promise<unknown>
): Promise<[any, Promise<void>]> {
  const hydrated = {};
  const promises: Record<number, Deferred<unknown>> = {};
  function unflatten(parsed, line) {
    if (typeof parsed === "number") return hydrate(parsed, true);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error("Invalid input");
    }

    const values = parsed.reduce(
      (p, value, i) => Object.assign(p, { [`${line}:${i}`]: value }),
      {}
    );

    /**
     * @param {string} index
     * @returns {any}
     */
    function hydrate(index, standalone = false) {
      if (index === UNDEFINED) return undefined;
      if (index === NAN) return NaN;
      if (index === POSITIVE_INFINITY) return Infinity;
      if (index === NEGATIVE_INFINITY) return -Infinity;
      if (index === NEGATIVE_ZERO) return -0;

      if (standalone) throw new Error(`Invalid input`);

      if (index in hydrated) return hydrated[index];

      const value = values[index];

      if (!value || typeof value !== "object") {
        hydrated[index] = value;
      } else if (Array.isArray(value)) {
        if (typeof value[0] === "string") {
          const type = value[0];

          switch (type) {
            case "Symbol":
              hydrated[index] = Symbol.for(value[1]);
              break;

            case "Promise":
              const deferred = new Deferred();
              promises[value[1]] = deferred;
              hydrated[index] = deferred.promise;
              break;

            case "V":
              const vnode = hydrate(value[1]);
              const Component: FunctionComponent = () => vnode;
              if (value.length > 2) {
                const fvnode = hydrate(value[2]);
                Component.fallback = () => fvnode;
              }
              hydrated[index] = createElement(Component);
              break;

            case "C":
              if (!loadClientComponent)
                throw new Error("loadClientComponent not provided");

              const id = hydrate(value[1]);
              const componentPromise = loadClientComponent(id);
              const props = hydrate(value[2]);
              const ClientComponent: FunctionComponent = async () => {
                const Component = (await componentPromise) as FunctionComponent;
                return createElement(Component, props);
              };
              hydrated[index] = createElement(ClientComponent);
              break;

            case "Date":
              hydrated[index] = new Date(value[1]);
              break;

            case "Set":
              const set = new Set();
              hydrated[index] = set;
              for (let i = 1; i < value.length; i += 1) {
                set.add(hydrate(value[i]));
              }
              break;

            case "Map":
              const map = new Map();
              hydrated[index] = map;
              for (let i = 1; i < value.length; i += 2) {
                map.set(hydrate(value[i]), hydrate(value[i + 1]));
              }
              break;

            case "RegExp":
              hydrated[index] = new RegExp(value[1], value[2]);
              break;

            case "Object":
              hydrated[index] = Object(value[1]);
              break;

            case "BigInt":
              hydrated[index] = BigInt(value[1]);
              break;

            case "null":
              const obj = Object.create(null);
              hydrated[index] = obj;
              for (let i = 1; i < value.length; i += 2) {
                obj[value[i]] = hydrate(value[i + 1]);
              }
              break;

            default:
              const array = new Array(value.length);
              hydrated[index] = array;

              for (let i = 0; i < value.length; i += 1) {
                const n = value[i];
                if (n === HOLE) continue;

                array[i] = hydrate(n);
              }
          }
        } else {
          const array = new Array(value.length);
          hydrated[index] = array;

          for (let i = 0; i < value.length; i += 1) {
            const n = value[i];
            if (n === HOLE) continue;

            array[i] = hydrate(n);
          }
        }
      } else {
        /** @type {Record<string, any>} */
        const object = {};
        hydrated[index] = object;

        for (const key in value) {
          const n = value[key];
          object[key] = hydrate(n);
        }
      }

      return hydrated[index];
    }

    return hydrate(`${line}:0`);
  }

  const reader = stream.getReader();
  const lines = lineIterator(reader);

  const line = await lines.next();
  if (line.done || !line.value) {
    throw new Error("Unexpected end of input");
  }
  let lineCount = 0;
  const initialValue = unflatten(JSON.parse(line.value), lineCount++);

  const allReadyPromise = (async () => {
    for await (const line of lines) {
      if (line[0] !== "$") {
        throw new Error("Unexpected input");
      }
      const match = line.match(/^\$(\d+):/);
      let promiseId: number;
      let deferred: Deferred<unknown>;
      if (
        !match ||
        !match[1] ||
        !Number.isSafeInteger((promiseId = Number.parseInt(match[1], 10))) ||
        !(deferred = promises[promiseId])
      ) {
        throw new Error("Unexpected input");
      }
      const promiseResult = unflatten(
        JSON.parse(line.slice(match[0].length)),
        lineCount++
      );
      if ("error" in promiseResult) {
        deferred.reject(promiseResult.error);
      } else {
        deferred.resolve(promiseResult.value);
      }
    }
  })();
  allReadyPromise.catch(() => {});

  return [initialValue, allReadyPromise];
}

async function* lineIterator(reader: ReadableStreamDefaultReader<Uint8Array>) {
  const utf8Decoder = new TextDecoder("utf-8");

  let { value: binaryChunk, done: readerDone } = await reader.read();
  let chunk = binaryChunk
    ? utf8Decoder.decode(binaryChunk, { stream: true })
    : "";

  const re = /\r\n|\n|\r/gm;
  let startIndex = 0;

  for (;;) {
    const result = re.exec(chunk);
    if (!result) {
      if (readerDone) {
        break;
      }
      let remainder = chunk.substr(startIndex);
      ({ value: binaryChunk, done: readerDone } = await reader.read());
      chunk =
        remainder +
        (chunk ? utf8Decoder.decode(binaryChunk, { stream: true }) : "");
      startIndex = re.lastIndex = 0;
      continue;
    }
    yield chunk.substring(startIndex, result.index);
    startIndex = re.lastIndex;
  }
  if (startIndex < chunk.length) {
    // last line didn't end in a newline char
    yield chunk.slice(startIndex);
  }
}

function serializeValue(
  thing: any,
  keys: string[],
  flatten: (value: any) => number | string,
  queuePromise: (promise: Promise<any>) => number
) {
  let str = "";

  if (typeof thing === "symbol") {
    const keyFor = Symbol.keyFor(thing);
    if (!keyFor) {
      throw new DevalueError(
        "Cannot symbols unless created with Symbol.for()",
        keys
      );
    }
    str = `["Symbol",${stringify_primitive(keyFor)}]`;
  } else if (is_primitive(thing)) {
    str = stringify_primitive(thing);
  } else {
    const type = get_type(thing);

    switch (type) {
      case "Boolean":
      case "Number":
      case "String":
        str = `["Object",${stringify_primitive(thing)}]`;
        break;

      case "BigInt":
        str = `["BigInt",${thing}]`;
        break;

      case "Date":
        str = `["Date","${thing.toISOString()}"]`;
        break;

      case "RegExp":
        const { source, flags } = thing;
        str = flags
          ? `["RegExp",${stringify_string(source)},"${flags}"]`
          : `["RegExp",${stringify_string(source)}]`;
        break;

      case "Array":
        str = "[";

        for (let i = 0; i < thing.length; i += 1) {
          if (i > 0) str += ",";

          if (i in thing) {
            keys.push(`[${i}]`);
            str += flatten(thing[i]);
            keys.pop();
          } else {
            str += HOLE;
          }
        }

        str += "]";

        break;

      case "Set":
        str = '["Set"';

        for (const value of thing) {
          str += `,${flatten(value)}`;
        }

        str += "]";
        break;

      case "Map":
        str = '["Map"';

        for (const [key, value] of thing) {
          keys.push(
            `.get(${is_primitive(key) ? stringify_primitive(key) : "..."})`
          );
          str += `,${flatten(key)},${flatten(value)}`;
        }

        str += "]";
        break;

      default:
        if (thing) {
          if (thing instanceof Promise) {
            str = `["Promise",${queuePromise(thing)}]`;
            break;
          }

          if (thing && "__c" in thing && thing.type) {
            if (thing.type.$$typeof === CLIENT_SYMBOL) {
              str = `["C",${flatten(thing.type.$$id)},${flatten(thing.props)}]`;
              break;
            }

            if (typeof thing.type === "function") {
              let children = thing.type(thing.props);

              let fallback = undefined;
              if (typeof thing.type.fallback === "function") {
                fallback = thing.type.fallback(thing.props);
              }
              str = `["V",${flatten(children)}`;
              if (fallback) {
                str += `,${flatten(fallback)}`;
              }
              str += "]";
              break;
            }

            const rest: Record<string, unknown> = {};
            if (thing.__source) {
              rest.__source = thing.__source;
            }
            if (thing.__self) {
              rest.__self = thing.__self;
            }
            thing = {
              type: thing.type,
              props: thing.props,
              ...rest,
            };
          }
        }

        if (!is_plain_object(thing)) {
          throw new DevalueError(`Cannot stringify arbitrary non-POJOs`, keys);
        }

        if (Object.getOwnPropertySymbols(thing).length > 0) {
          throw new DevalueError(
            `Cannot stringify POJOs with symbolic keys`,
            keys
          );
        }

        if (Object.getPrototypeOf(thing) === null) {
          str = '["null"';
          for (const key in thing) {
            keys.push(`.${key}`);
            str += `,${stringify_string(key)},${flatten(thing[key])}`;
            keys.pop();
          }
          str += "]";
        } else {
          str = "{";
          let started = false;
          for (const key in thing) {
            if (started) str += ",";
            started = true;
            keys.push(`.${key}`);
            str += `${stringify_string(key)}:${flatten(thing[key])}`;
            keys.pop();
          }
          str += "}";
        }
    }
  }

  return str;
}

/**
 * @param {any} thing
 * @returns {string}
 */
function stringify_primitive(thing) {
  const type = typeof thing;
  if (type === "string") return stringify_string(thing);
  if (thing instanceof String) return stringify_string(thing.toString());
  if (thing === void 0) return UNDEFINED.toString();
  if (thing === 0 && 1 / thing < 0) return NEGATIVE_ZERO.toString();
  if (type === "bigint") return `["BigInt","${thing}"]`;
  return String(thing);
}

/** @type {Record<string, string>} */
export const escaped = {
  "<": "\\u003C",
  "\\": "\\\\",
  "\b": "\\b",
  "\f": "\\f",
  "\n": "\\n",
  "\r": "\\r",
  "\t": "\\t",
  "\u2028": "\\u2028",
  "\u2029": "\\u2029",
};

export class DevalueError extends Error {
  path: string;
  /**
   * @param {string} message
   * @param {string[]} keys
   */
  constructor(message, keys) {
    super(message);
    this.name = "DevalueError";
    this.path = keys.join("");
  }
}

/** @param {any} thing */
function is_primitive(thing) {
  return Object(thing) !== thing;
}

const object_proto_names = /* @__PURE__ */ Object.getOwnPropertyNames(
  Object.prototype
)
  .sort()
  .join("\0");

/** @param {any} thing */
function is_plain_object(thing) {
  const proto = Object.getPrototypeOf(thing);

  return (
    proto === Object.prototype ||
    proto === null ||
    Object.getOwnPropertyNames(proto).sort().join("\0") === object_proto_names
  );
}

/** @param {any} thing */
function get_type(thing) {
  return Object.prototype.toString.call(thing).slice(8, -1);
}

/** @param {string} char */
function get_escaped_char(char) {
  switch (char) {
    case '"':
      return '\\"';
    case "<":
      return "\\u003C";
    case "\\":
      return "\\\\";
    case "\n":
      return "\\n";
    case "\r":
      return "\\r";
    case "\t":
      return "\\t";
    case "\b":
      return "\\b";
    case "\f":
      return "\\f";
    case "\u2028":
      return "\\u2028";
    case "\u2029":
      return "\\u2029";
    default:
      return char < " "
        ? `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`
        : "";
  }
}

/** @param {string} str */
function stringify_string(str) {
  let result = "";
  let last_pos = 0;
  const len = str.length;

  for (let i = 0; i < len; i += 1) {
    const char = str[i];
    const replacement = get_escaped_char(char);
    if (replacement) {
      result += str.slice(last_pos, i) + replacement;
      last_pos = i + 1;
    }
  }

  return `"${last_pos === 0 ? str : result + str.slice(last_pos)}"`;
}

class Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: any) => void;
  constructor() {
    this.promise = new Promise((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
    });
  }
}
