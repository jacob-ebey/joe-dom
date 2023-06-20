import * as http from "node:http";
import * as path from "node:path";
import * as stream from "node:stream";
import * as webStream from "node:stream/web";

import { deserialize, render } from "joe-dom/server";

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

const cwd = process.cwd();
async function loadClientComponent(id: string | number) {
  const [filepath, exp] = String(id).split("#", 2);

  if (!filepath || !exp) {
    throw new Error(`Invalid client component: ${id}`);
  }

  const resolved = path.resolve(cwd, filepath);
  if (!resolved.startsWith(cwd + path.sep)) {
    throw new Error(`Invalid client component: ${id}`);
  }

  const mod = await import(resolved);

  return mod[exp];
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
      }
      const response = await fetch("http://localhost:3001");
      const [deserialized] = await deserialize(
        response.body,
        loadClientComponent
      );
      const rendered = render<webStream.ReadableStream>(deserialized, {
        getClientReferenceId,
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
