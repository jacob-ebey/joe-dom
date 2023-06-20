import * as fs from "node:fs";
import * as http from "node:http";
import * as path from "node:path";
import * as stream from "node:stream";
import * as webStream from "node:stream/web";
import * as url from "node:url";

import { render } from "joe-dom/server";

// import { App } from "./app";
let appPath = path.resolve(
  path.dirname(url.fileURLToPath(import.meta.url)),
  "app.tsx"
);
let lastAppTS = fs.statSync(appPath).mtimeMs;
let { App } = await import("./app");

// if (process.env.NODE_ENV === "development") {
let dev: Awaited<ReturnType<typeof import("./dev").watch>>;
if (true) {
  dev = await (await import("./dev")).watch();
}

function getClientReferenceId(id) {
  if (dev) {
    return dev.getClientReferenceId(id);
  }
  throw new Error("TODO: implement production client reference");
}

http
  .createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
      if (dev) {
        const asset = await dev.getAsset(url);
        if (asset) {
          res.writeHead(200, {
            "Content-Type": asset.contentType,
          });
          res.end(new TextDecoder().decode(asset.contents));
          return;
        }

        const ts = fs.statSync(appPath).mtimeMs;
        if (ts > lastAppTS) {
          lastAppTS = ts;
          ({ App } = await import("./app?" + ts));
        }
      }
      const rendered = render<webStream.ReadableStream>(<App />, {
        getClientReferenceId,
      });
      res.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
      });
      stream.Readable.fromWeb(rendered).pipe(res, { end: true });
    } catch (reason) {
      console.error(reason);
      if (!res.headersSent) res.writeHead(500);
      res.end();
    }
  })
  .listen(3000, () => {
    console.log("Listening at http://localhost:3000");
  });
