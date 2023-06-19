import * as http from "node:http";
import * as stream from "node:stream";
import * as webStream from "node:stream/web";

import { render } from "joe-dom/server";

import { App } from "./app";

http
  .createServer((_, res) => {
    const rendered = render<webStream.ReadableStream>(<App />);
    stream.Readable.fromWeb(rendered).pipe(res, { end: true });
  })
  .listen(3000, () => {
    console.log("Listening at http://localhost:3000");
  });
