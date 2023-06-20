import type { FunctionComponent, ComponentChildren, VNode } from "./types.js";
import {
  hydrate as pHydrate,
  createElement as pCreateElement,
  Fragment as PFragment,
} from "preact";

import {
  useCallback as pUseCallback,
  useEffect as pUseEffect,
  useLayoutEffect as pUseLayoutEffect,
  useMemo as pUseMemo,
  useReducer as pUseReducer,
  useRef as pUseRef,
  useState as pUseState,
} from "preact/hooks";

export type * from "./types.js";

export const CLIENT_SYMBOL = Symbol.for("joe-dom.client");
export const SERVER_SYMBOL = Symbol.for("joe-dom.server");

export const Fragment = PFragment as FunctionComponent;

export const createElement = pCreateElement as (
  type: VNode["type"],
  props?: Record<any, any> | null | undefined,
  ...children: ComponentChildren[]
) => VNode;
export { createElement as h };

export const hydrate = pHydrate as (v: VNode, c: Element) => void;

// is server check that works in Bun, Deno and Node
const IS_SERVER =
  typeof document === "undefined" ||
  // @ts-expect-error
  typeof Deno !== "undefined" ||
  typeof window === "undefined";

export const useCallback = ((...args) => {
  if (IS_SERVER) {
    return args[0];
  }
  return pUseCallback(...args);
}) as typeof pUseCallback;

export const useEffect = ((...args) => {
  if (IS_SERVER) {
    return;
  }
  return pUseEffect(...args);
}) as typeof pUseEffect;

export const useLayoutEffect = ((...args) => {
  if (IS_SERVER) {
    return;
  }
  return pUseLayoutEffect(...args);
}) as typeof pUseLayoutEffect;

export const useMemo = ((...args) => {
  if (IS_SERVER) {
    return args[0]();
  }
  return pUseMemo(...args);
}) as typeof pUseMemo;

export const useReducer = ((...args: any) => {
  if (IS_SERVER) {
    return [
      args[1],
      () => {
        throw new Error("useReducer dispatch not supported on server");
      },
    ];
  }
  // @ts-expect-error
  return pUseReducer(...args);
}) as typeof pUseReducer;

export const useRef = ((...args) => {
  if (IS_SERVER) {
    return { current: args[0] };
  }
  // @ts-expect-error
  return pUseRef(...args);
}) as typeof pUseRef;

export const useState = ((...args) => {
  if (IS_SERVER) {
    return [
      args[0],
      () => {
        throw new Error("useState setter not supported on server");
      },
    ];
  }
  // @ts-expect-error
  return pUseState(...args);
}) as typeof pUseState;

// export const Fragment = ({ children }) => children;

// export function createElement(
//   type: VNode["type"],
//   props?: Record<any, any> | null | undefined,
//   ...children: ComponentChildren[]
// ): VNode {
//   let normalizedProps: { children: ComponentChildren } = {
//       children: undefined,
//     },
//     key,
//     ref,
//     i;
//   for (i in props) {
//     if (i == "key") key = props[i];
//     else if (i == "ref") ref = props[i];
//     else normalizedProps[i] = props[i];
//   }
//   if (arguments.length > 2) {
//     normalizedProps.children = children;
//   }
//   if (Array.isArray(normalizedProps.children)) {
//     normalizedProps.children = normalizedProps.children.flat(Infinity);
//   }

//   return createVNode(type, normalizedProps, key, ref);
// }

// /**
//  * Create a VNode (used internally by Preact)
//  * @param {import('./internal').VNode["type"]} type The node name or Component
//  * Constructor for this virtual node
//  * @param {object | string | number | null} props The properties of this virtual node.
//  * If this virtual node represents a text node, this is the text of the node (string or number).
//  * @param {string | number | null} key The key for this virtual node, used when
//  * diffing it against its children
//  * @param {import('./internal').VNode["ref"]} ref The ref property that will
//  * receive a reference to its created child
//  * @returns {import('./internal').VNode}
//  */
// export function createVNode(
//   type: VNode["type"],
//   props: { children: ComponentChildren },
//   key?: Key,
//   ref?: Ref<any> | null | undefined
// ) {
//   // V8 seems to be better at detecting type shapes if the object is allocated from the same call site
//   // Do not inline into createElement and coerceToVNode!
//   const vnode: VNode = {
//     $$typeof: VNODE_SYMBOL,
//     type,
//     props,
//     key,
//     ref,
//   };

//   return vnode;
// }
