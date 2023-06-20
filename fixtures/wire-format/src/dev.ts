import * as path from "node:path";

import * as esbuild from "esbuild";
import * as mime from "mime-types";

import * as metadata from "joe-dom/metadata";

export async function watch() {
  let clientModules = Array.from(metadata.clientModules).map((m) =>
    path.join(process.cwd(), String(m))
  );
  clientModules.push("joe-dom");
  let size = metadata.clientModules.size;
  let buildResult = await esbuild.build({
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
    minify: true,
    sourcemap: true,
  });

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

  return {
    async getAsset(url: URL) {
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
      if (typeof id !== "string") throw new Error("Expected non-string id");
      let [pathname, exp] = id.split("#", 2);

      if (size !== metadata.clientModules.size) {
        clientModules = Array.from(metadata.clientModules).map((m) =>
          path.join(process.cwd(), String(m))
        );
        clientModules.push("joe-dom");
        buildResult = await esbuild.build({
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
          minify: true,
          sourcemap: true,
        });

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
      }

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
