import type { ComponentChildren, Key, Ref, VNode } from "./types.js";

export type * from "./types.js";

export const VNODE_SYMBOL = Symbol.for("joe-dom.vnode");
export const CLIENT_SYMBOL = Symbol.for("joe-dom.client");

export const Fragment = ({ children }) => children;

export function createElement(
  type: VNode["type"],
  props?: Record<any, any> | null | undefined,
  ...children: ComponentChildren[]
): VNode {
  let normalizedProps: { children: ComponentChildren } = {
      children: undefined,
    },
    key,
    ref,
    i;
  for (i in props) {
    if (i == "key") key = props[i];
    else if (i == "ref") ref = props[i];
    else normalizedProps[i] = props[i];
  }
  if (arguments.length > 2) {
    normalizedProps.children = children;
  }
  if (Array.isArray(normalizedProps.children)) {
    normalizedProps.children = normalizedProps.children.flat(Infinity);
  }

  return createVNode(type, normalizedProps, key, ref);
}

/**
 * Create a VNode (used internally by Preact)
 * @param {import('./internal').VNode["type"]} type The node name or Component
 * Constructor for this virtual node
 * @param {object | string | number | null} props The properties of this virtual node.
 * If this virtual node represents a text node, this is the text of the node (string or number).
 * @param {string | number | null} key The key for this virtual node, used when
 * diffing it against its children
 * @param {import('./internal').VNode["ref"]} ref The ref property that will
 * receive a reference to its created child
 * @returns {import('./internal').VNode}
 */
export function createVNode(
  type: VNode["type"],
  props: { children: ComponentChildren },
  key?: Key,
  ref?: Ref<any> | null | undefined
) {
  // V8 seems to be better at detecting type shapes if the object is allocated from the same call site
  // Do not inline into createElement and coerceToVNode!
  const vnode: VNode = {
    $$typeof: VNODE_SYMBOL,
    type,
    props,
    key,
    ref,
  };

  return vnode;
}
