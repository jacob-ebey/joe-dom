import * as http from "node:http";
import * as stream from "node:stream";
import * as webStream from "node:stream/web";

import { serialize } from "joe-dom/server";

import { App } from "./app";

http
  .createServer((_, res) => {
    const rendered = serialize(
      <App />
    ) as unknown as webStream.ReadableStream<Uint8Array>;

    stream.Readable.fromWeb(rendered).pipe(res, { end: true });
  })
  .listen(3001, () => {
    console.log("Listening at http://localhost:3001");
  });
