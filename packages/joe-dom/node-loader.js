import * as url from "node:url";

import { clientModuleTransform, serverModuleTransform } from "./loader.js";

export async function resolve(specifier, ctx, defaultResolve) {
  if (specifier === "joe-dom/metadata") {
    return {
      shortCircuit: true,
      url: new URL("joe-dom:metadata").href,
    };
  }
  return defaultResolve(specifier, ctx, defaultResolve);
}

export async function load(file, ctx, nextLoad) {
  if (file === "joe-dom:metadata") {
    return {
      format: "module",
      shortCircuit: true,
      source: `
        export const clientModules = new Set();
        export const serverModules = new Set();
      `,
    };
  }

  const loaded = await nextLoad(file, ctx, nextLoad);

  if (loaded.format === "module") {
    const filepath = url.fileURLToPath(file);
    let moduleId = filepath.slice(process.cwd().length + 1);
    moduleId = moduleId.replace(/\\/g, "/");

    let loadedSource = loaded.source.toString();
    let { useClient, useServer, source } = process.env.JOE_CLIENT
      ? clientModuleTransform(loadedSource, moduleId)
      : serverModuleTransform(loadedSource, moduleId);

    if (useClient || useServer) {
      source += `\nawait import("joe-dom/metadata").then(m => {`;
      source += `m.${
        useClient ? "client" : "server"
      }Modules.add(${JSON.stringify(moduleId)});`;
      source += "})\n";
    }

    return {
      format: "module",
      source,
    };
  }

  return loaded;
}
