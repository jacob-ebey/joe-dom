import * as http from "node:http";
import * as stream from "node:stream";
import * as webStream from "node:stream/web";

import { deserialize, render } from "joe-dom/server";

async function loadClientComponent(id: string | number) {
  if (id === "SayHello") {
    return ({ name }) => {
      return (
        <button onClick={() => alert(`Hello, ${name}!`)}>Say Hello</button>
      );
    };
  }

  throw new Error(`Unknown component: ${id}`);
}

http
  .createServer(async (_, res) => {
    const response = await fetch("http://localhost:3001");
    const [deserialized] = await deserialize(
      response.body,
      loadClientComponent
    );
    const rendered = render<webStream.ReadableStream>(deserialized);
    stream.Readable.fromWeb(rendered).pipe(res, { end: true });
  })
  .listen(3000, () => {
    console.log("Listening at http://localhost:3000");
  });
