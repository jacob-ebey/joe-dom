const fallbackSource = `
window.$_JOE_INIT = {};
window.$_JOE_INIT.promise = new Promise((resolve,reject) => {
  window.$_JOE_INIT.resolve = resolve;
  window.$_JOE_INIT.reject = reject;
});
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

const minifiedFallback = `window.$_JOE_INIT={},window.$_JOE_INIT.promise=new Promise(((e,o)=>{window.$_JOE_INIT.resolve=e,window.$_JOE_INIT.reject=o})),customElements.define("joe-fb",class extends HTMLElement{connectedCallback(){let e,o,t,i,d=this,r=document.createNodeIterator(document,128);d.isConnected&&setTimeout((()=>{if(e=d.getAttribute("data-id"),e){for(;r.nextNode()&&(o=r.referenceNode,o.data=="joe:"+e?t=o:o.data=="/joe:"+e&&(i=o),!t||!i););if(t&&i){for(e=i.previousSibling;e!=t&&e&&e!=t;)i.parentNode.removeChild(e),e=i.previousSibling;for(;d.firstChild;)i.parentNode.insertBefore(d.firstChild,i);d.parentNode.removeChild(d)}}}),0)}});`;

export const fallbackRuntime = `<script>` + minifiedFallback + "</script>";

const islandSource = `
window.$_JOE = window.$_JOE || function(i, runtimeId, referenceId, props) {
  if (i == null) return;

  let iterator = document.createNodeIterator(document, 128),
    j,
    s,
    e;

  while (iterator.nextNode()) {
    j = iterator.referenceNode;
    if (j.data == "joec:" + i) s = j;
    else if (j.data == "/joec:" + i) e = j;
    if (s && e) break;
  }
  if (s && e) {
    window.$_JOEI = window.$_JOEI || (async (p) => {
      let [a,b] = p.split("#");
      const mod = await import(a);
      if (b == "*") return mod;
      return mod[b];
    });
    Promise.all([
      window.$_JOEI(runtimeId),
      window.$_JOEI(referenceId)
    ])
      .then(([runtime,Island]) => {
        j = document.createElement("div");
        i = s.nextSibling;
        while (i != s) {
          if (!i || i == e) break;

          s.parentNode.removeChild(i);
          j.appendChild(i);
          i = e.nextSibling;
        }
        runtime.hydrate(runtime.h(Island, props), j);
        while (j.firstChild) {
          e.parentNode.insertBefore(j.firstChild, e);
        }
      }).catch(reason => {
        console.error("Failed to hydrate island " + i, reason);
      });
  }
};
window.$_JOE_INIT.resolve();
`;

const minifiedIsland = `window.$_JOE=window.$_JOE||function(e,o,t,n){if(null==e)return;let r,d,i,a=document.createNodeIterator(document,128);for(;a.nextNode()&&(r=a.referenceNode,r.data=="joec:"+e?d=r:r.data=="/joec:"+e&&(i=r),!d||!i););d&&i&&(window.$_JOEI=window.$_JOEI||(async e=>{let[o,t]=e.split("#");const n=await import(o);return"*"==t?n:n[t]}),Promise.all([window.$_JOEI(o),window.$_JOEI(t)]).then((([o,t])=>{for(r=document.createElement("div"),e=d.nextSibling;e!=d&&e&&e!=i;)d.parentNode.removeChild(e),r.appendChild(e),e=i.nextSibling;for(o.hydrate(o.h(t,n),r);r.firstChild;)i.parentNode.insertBefore(r.firstChild,i)})).catch((o=>{console.error("Failed to hydrate island "+e,o)})))},window.$_JOE_INIT.resolve();`;

export const islandRuntime =
  `<script async type="module">` + minifiedIsland + "</script>";
