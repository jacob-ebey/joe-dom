import * as path from "node:path";

import * as esbuild from "esbuild";
import * as mime from "mime-types";

import * as metadata from "joe-dom/metadata";

let buildPromise: Promise<esbuild.BuildResult> | null = null;
let buildDone: (result: esbuild.BuildResult) => void;

async function createContext() {
  const clientModules = Array.from(metadata.clientModules).map((m) =>
    path.join(process.cwd(), String(m))
  );
  clientModules.push("joe-dom");
  return await esbuild.context({
    absWorkingDir: process.cwd(),
    entryPoints: clientModules,
    format: "esm",
    target: "es2020",
    outdir: path.join(process.cwd(), "public/build"),
    publicPath: "/build/",
    splitting: true,
    bundle: true,
    metafile: true,
    write: false,
    logLevel: "info",
    plugins: [
      {
        name: "dev-plugin",
        setup(build) {
          build.onStart(() => {
            buildPromise = new Promise<esbuild.BuildResult>((resolve) => {
              buildDone = resolve;
            });
          });
          build.onEnd((result) => {
            buildDone(result);
          });
        },
      },
    ],
  });
}

export async function watch() {
  let context = await createContext();
  let buildResult = await context.rebuild();
  if (buildResult.errors.length > 0) {
    throw new Error(
      (
        await esbuild.formatMessages(buildResult.errors, {
          kind: "error",
          color: true,
        })
      ).join("\n")
    );
  }

  context.watch({});

  let clientModulesSize = metadata.clientModules.size;
  return {
    async getAsset(url: URL) {
      if (clientModulesSize !== metadata.clientModules.size) {
        clientModulesSize = metadata.clientModules.size;
        await context.dispose();
        context = await createContext();
        buildResult = await context.rebuild();
        context.watch({});
      } else {
        buildResult = (await buildPromise) || buildResult;
      }

      const map = new Map(
        buildResult.outputFiles.map((o) => [
          "/" +
            path
              .relative(path.join(process.cwd(), "public"), o.path)
              .replace(/\\/g, "/"),
          o.contents,
        ])
      );

      const contents = map.get(url.pathname);
      if (contents) {
        return {
          contentType:
            ((mime.lookup(url.pathname) as string | false) || "text/plain") +
            "; charset=utf-8",
          contents,
        };
      }
    },
    async getClientReferenceId(id: string | number) {
      if (clientModulesSize !== metadata.clientModules.size) {
        clientModulesSize = metadata.clientModules.size;
        await context.dispose();
        context = await createContext();
        buildResult = await context.rebuild();
        context.watch({});
      } else {
        buildResult = (await buildPromise) || buildResult;
      }

      if (typeof id !== "string") throw new Error("Expected non-string id");
      let [pathname, exp] = id.split("#", 2);

      for (const [key, value] of Object.entries(buildResult.metafile.outputs)) {
        if (id === "joe-dom") {
          if (value.entryPoint?.endsWith("joe-dom/dist/src/joe-dom.js")) {
            pathname =
              "/" + key.replace(/\\/g, "/").replace(/^\/?public\//, "");
            exp = "*";
            return `${pathname}#${exp}`;
          }
        } else if (value.entryPoint === pathname) {
          pathname = "/" + key.replace(/\\/g, "/").replace(/^\/?public\//, "");
          return `${pathname}#${exp}`;
        }
      }

      throw new Error(`Could not find client reference for ${id}`);
    },
  };
}
