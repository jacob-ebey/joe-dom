const fallbackSource = `
customElements.define(
  "joe-fb",
  class extends HTMLElement {
    connectedCallback() {
      let self = this,
        iterator = document.createNodeIterator(document, 128),
        i,
        j,
        s,
        e;

      if (!self.isConnected) return;

      setTimeout(() => {
        i = self.getAttribute("data-id");
        if (!i) return;

        while (iterator.nextNode()) {
          j = iterator.referenceNode;
          if (j.data == "joe:" + i) s = j;
          else if (j.data == "/joe:" + i) e = j;
          if (s && e) break;
        }
        if (s && e) {
          i = e.previousSibling;
          while (i != s) {
            if (!i || i == s) break;

            e.parentNode.removeChild(i);
            i = e.previousSibling;
          }
          
          while (self.firstChild) {
            e.parentNode.insertBefore(self.firstChild, e);
          }
          self.parentNode.removeChild(self);
        }
      }, 0);
    }
  }
);
`;

const minifiedFallback = `customElements.define("joe-fb",class extends HTMLElement{connectedCallback(){let e,t,o,i,d=this,r=document.createNodeIterator(document,128);d.isConnected&&setTimeout((()=>{if(e=d.getAttribute("data-id"),e){for(;r.nextNode()&&(t=r.referenceNode,t.data=="joe:"+e?o=t:t.data=="/joe:"+e&&(i=t),!o||!i););if(o&&i){for(e=i.previousSibling;e!=o&&e&&e!=o;)i.parentNode.removeChild(e),e=i.previousSibling;for(;d.firstChild;)i.parentNode.insertBefore(d.firstChild,i);d.parentNode.removeChild(d)}}}),0)}});`;

export const fallbackRuntime = "<script>" + minifiedFallback + "</script>";

export function isPromise(obj): obj is Promise<any> {
  return (
    obj && typeof obj.then === "function" && typeof obj.catch === "function"
  );
}

// Adapted from https://github.com/preactjs/preact-render-to-string

export const VOID_ELEMENTS =
  /^(?:area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)$/;
export const UNSAFE_NAME = /[\s\n\\/='"\0<>]/;
export const XLINK = /^xlink:?./;
export const XLINK_REPLACE_REGEX = /^xlink:?/;
// DOM properties that should NOT have "px" added when numeric
const ENCODED_ENTITIES = /["&<]/;
export function encodeEntities(str) {
  // Skip all work for strings with no entities needing encoding:
  if (str.length === 0 || ENCODED_ENTITIES.test(str) === false) return str;

  let last = 0,
    i = 0,
    out = "",
    ch = "";

  // Seek forward in str until the next entity char:
  for (; i < str.length; i++) {
    switch (str.charCodeAt(i)) {
      case 34:
        ch = "&quot;";
        break;
      case 38:
        ch = "&amp;";
        break;
      case 60:
        ch = "&lt;";
        break;
      default:
        continue;
    }
    // Append skipped/buffered characters and the encoded entity:
    if (i !== last) out += str.slice(last, i);
    out += ch;
    // Start the next seek/buffer after the entity's offset:
    last = i + 1;
  }
  if (i !== last) out += str.slice(last, i);
  return out;
}

const CSS_REGEX = /[A-Z]/g;
const IS_NON_DIMENSIONAL = new Set([
  "animation-iteration-count",
  "border-image-outset",
  "border-image-slice",
  "border-image-width",
  "box-flex",
  "box-flex-group",
  "box-ordinal-group",
  "column-count",
  "fill-opacity",
  "flex",
  "flex-grow",
  "flex-negative",
  "flex-order",
  "flex-positive",
  "flex-shrink",
  "flood-opacity",
  "font-weight",
  "grid-column",
  "grid-row",
  "line-clamp",
  "line-height",
  "opacity",
  "order",
  "orphans",
  "stop-opacity",
  "stroke-dasharray",
  "stroke-dashoffset",
  "stroke-miterlimit",
  "stroke-opacity",
  "stroke-width",
  "tab-size",
  "widows",
  "z-index",
  "zoom",
]);

const JS_TO_CSS = {};
export function styleObjToCss(s) {
  let str = "";
  for (let prop in s) {
    let val = s[prop];
    if (val != null && val !== "") {
      const name =
        prop[0] == "-"
          ? prop
          : JS_TO_CSS[prop] ||
            (JS_TO_CSS[prop] = prop.replace(CSS_REGEX, "-$&").toLowerCase());

      let suffix = ";";
      if (
        typeof val === "number" &&
        // Exclude custom-attributes
        !name.startsWith("--") &&
        !IS_NON_DIMENSIONAL.has(name)
      ) {
        suffix = "px;";
      }
      str = str + name + ":" + val + suffix;
    }
  }
  return str || undefined;
}
