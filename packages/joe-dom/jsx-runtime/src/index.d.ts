export { Fragment } from "../../src/joe-dom.js";
import {
  ComponentType,
  ComponentChild,
  ComponentChildren,
  VNode,
  Attributes,
} from "../../src/types.js";
import { JSXInternal } from "../../src/jsx.js";

export function jsx(
  type: string,
  props: JSXInternal.HTMLAttributes &
    JSXInternal.SVGAttributes &
    Record<string, any> & { children?: ComponentChild },
  key?: string
): VNode<any>;
export function jsx<P>(
  type: ComponentType<P>,
  props: Attributes & P & { children?: ComponentChild },
  key?: string
): VNode<any>;

export function jsxs(
  type: string,
  props: JSXInternal.HTMLAttributes &
    JSXInternal.SVGAttributes &
    Record<string, any> & { children?: ComponentChild[] },
  key?: string
): VNode<any>;
export function jsxs<P>(
  type: ComponentType<P>,
  props: Attributes & P & { children?: ComponentChild[] },
  key?: string
): VNode<any>;

export function jsxDEV(
  type: string,
  props: JSXInternal.HTMLAttributes &
    JSXInternal.SVGAttributes &
    Record<string, any> & { children?: ComponentChildren },
  key?: string
): VNode<any>;
export function jsxDEV<P>(
  type: ComponentType<P>,
  props: Attributes & P & { children?: ComponentChildren },
  key?: string
): VNode<any>;

export { JSXInternal as JSX };
