import { strictEqual } from "node:assert/strict";
import { describe, it } from "node:test";

import {
  type ClientComponent,
  type FunctionComponent,
  CLIENT_SYMBOL,
  createElement,
} from "../src/joe-dom.js";
import { deserialize, render, serialize } from "../src/joe-dom.server.js";
import { fallbackRuntime } from "../src/utils.js";

describe("wire format", () => {
  it("should render div", async () => {
    const serialized = serialize(<div>Hello, World!</div>);
    const [deserialized] = await deserialize(serialized);
    const rendered = render(deserialized);
    const html = await new Response(rendered).text();
    strictEqual(html, "<div>Hello, World!</div>");
  });

  it("should render nested tags", async () => {
    const serialized = serialize(
      <div>
        Hello
        <span>,</span>
        World!
      </div>
    );
    const [deserialized] = await deserialize(serialized);
    const rendered = render(deserialized);
    const html = await new Response(rendered).text();
    strictEqual(html, "<div>Hello<span>,</span>World!</div>");
  });

  it("should render self closing tags", async () => {
    const serialized = serialize(
      <>
        <area />
        <base />
        <br />
        <col />
        <embed />
        <hr />
        <img />
        <input />
        <link />
        <meta />
        <param />
        <source />
        <track />
        <wbr />
      </>
    );
    const [deserialized] = await deserialize(serialized);
    const rendered = render(deserialized);
    const html = await new Response(rendered).text();
    strictEqual(
      html,
      "<area><base><br><col><embed><hr><img><input><link><meta><param><source><track><wbr>"
    );
  });

  it("should render attributes", async () => {
    const serialized = serialize(
      <div id="foo" className="bar" data-foo="bar" data-bar={1}>
        <input type="text" defaultValue="foo" />
        <div style={{ backgroundColor: "pink" }} />
        <select defaultValue="test">
          <option value="test">Test</option>
        </select>
        <textarea defaultValue="foo" />
      </div>
    );
    const [deserialized] = await deserialize(serialized);
    const rendered = render(deserialized);
    const html = await new Response(rendered).text();
    strictEqual(
      html,
      '<div id="foo" class="bar" data-foo="bar" data-bar="1">' +
        '<input type="text" value="foo">' +
        '<div style="background-color:pink;"></div>' +
        '<select><option selected value="test">Test</option></select>' +
        "<textarea>foo</textarea>" +
        "</div>"
    );
  });

  it("should render svg", async () => {
    const serialized = serialize(
      <svg>
        <image xlinkHref="#" />
        <foreignObject>
          {/* @ts-expect-error */}
          <div xlinkHref="#" />
        </foreignObject>
        <g>
          <image xlinkHref="#" />
        </g>
      </svg>
    );
    const [deserialized] = await deserialize(serialized);
    const rendered = render(deserialized);
    const html = await new Response(rendered).text();
    strictEqual(
      html,
      '<svg><image xlink:href="#"></image><foreignObject><div xlinkHref="#"></div></foreignObject><g><image xlink:href="#"></image></g></svg>'
    );
  });

  it("should render component", async () => {
    const SayHello = ({ name }: { name: string }) => `Hello, ${name}!`;

    const serialized = serialize(
      <div>
        <SayHello name="World" />
      </div>
    );
    const [deserialized] = await deserialize(serialized);
    const rendered = render(deserialized);
    const html = await new Response(rendered).text();
    strictEqual(html, "<div>Hello, World!</div>");
  });

  it("should render async component", async () => {
    const SayHello = async ({ name }: { name: string }) => `Hello, ${name}!`;

    const serialized = serialize(
      <div>
        <SayHello name="World" />
      </div>
    );
    const [deserialized] = await deserialize(serialized);
    const rendered = render(deserialized);
    const html = await new Response(rendered).text();
    strictEqual(html, "<div>Hello, World!</div>");
  });

  it("should render multiple async components", async () => {
    const SayHello = async ({
      name,
      timeout,
    }: {
      name: string;
      timeout: number;
    }) => {
      await new Promise((resolve) => setTimeout(resolve, timeout));
      return <div>Hello, {name}!</div>;
    };

    const serialized = serialize(
      <>
        <SayHello name="1" timeout={10} />
        <SayHello name="2" timeout={5} />
      </>
    );
    const [deserialized] = await deserialize(serialized);
    const rendered = render(deserialized);
    const html = await new Response(rendered).text();
    strictEqual(html, "<div>Hello, 1!</div><div>Hello, 2!</div>");
  });

  it("should render fallback", async () => {
    const SayHello: FunctionComponent<{ name: string }> = async ({ name }) => (
      <div>Hello, {name}!</div>
    );
    SayHello.fallback = () => <div>Loading...</div>;

    const serialized = serialize(<SayHello name="World" />);
    const [deserialized] = await deserialize(serialized);
    const rendered = render(deserialized);
    const html = await new Response(rendered).text();
    strictEqual(
      html,
      `<!--joe:0--><div>Loading...</div><!--/joe:0-->${fallbackRuntime}<joe-fb hidden data-id="0"><div>Hello, World!</div></joe-fb>`
    );
  });

  it("should render multiple fallbacks", async () => {
    const SayHello: FunctionComponent<{
      name: string;
      timeout: number;
    }> = async ({ name, timeout }) => {
      await new Promise((resolve) => setTimeout(resolve, timeout));
      return <div>Hello, {name}!</div>;
    };
    SayHello.fallback = ({ name }) => <div>Loading {name}...</div>;

    const serialized = serialize(
      <>
        <SayHello name="1" timeout={10} />
        <SayHello name="2" timeout={5} />
      </>
    );
    const [deserialized] = await deserialize(serialized);
    const rendered = render(deserialized);
    const html = await new Response(rendered).text();
    strictEqual(
      html,
      `<!--joe:0--><div>Loading 1...</div><!--/joe:0--><!--joe:1--><div>Loading 2...</div><!--/joe:1-->${fallbackRuntime}<joe-fb hidden data-id="1"><div>Hello, 2!</div></joe-fb><joe-fb hidden data-id="0"><div>Hello, 1!</div></joe-fb>`
    );
  });

  it("should render fallback caused by child", async () => {
    const Boundary: FunctionComponent = ({ children }) => {
      return children;
    };
    Boundary.fallback = () => <div>Loading...</div>;

    const SayHello: FunctionComponent<{ name: string }> = async ({ name }) => (
      <div>Hello, {name}!</div>
    );

    const serialized = serialize(
      <Boundary>
        <SayHello name="World" />
      </Boundary>
    );
    const [deserialized] = await deserialize(serialized);
    const rendered = render(deserialized);
    const html = await new Response(rendered).text();
    strictEqual(
      html,
      `<!--joe:1--><div>Loading...</div><!--/joe:1-->${fallbackRuntime}<joe-fb hidden data-id="1"><div>Hello, World!</div></joe-fb>`
    );
  });

  it("should render fallback caused by descendant", async () => {
    const Boundary: FunctionComponent = ({ children }) => {
      return <SayHello name="World" />;
    };
    Boundary.fallback = () => <div>Loading...</div>;

    const SayHello: FunctionComponent<{ name: string }> = async ({ name }) => (
      <div>Hello, {name}!</div>
    );

    const serialized = serialize(<Boundary />);
    const [deserialized] = await deserialize(serialized);
    const rendered = render(deserialized);
    const html = await new Response(rendered).text();
    strictEqual(
      html,
      `<!--joe:1--><div>Loading...</div><!--/joe:1-->${fallbackRuntime}<joe-fb hidden data-id="1"><div>Hello, World!</div></joe-fb>`
    );
  });

  it("works with createElement", async () => {
    const SayHello: FunctionComponent<{
      name: string;
      timeout: number;
    }> = async ({ name, timeout }) => {
      await new Promise((resolve) => setTimeout(resolve, timeout));
      return createElement("div", undefined, "Hello, ", name, "!");
    };
    SayHello.fallback = ({ name }) =>
      createElement("div", undefined, ["Loading ", name, "..."]);

    const serialized = serialize([
      createElement(SayHello, { name: "1", timeout: 10 }),
      createElement(SayHello, { name: "2", timeout: 5 }),
    ]);
    const [deserialized] = await deserialize(serialized);
    const rendered = render(deserialized);
    const html = await new Response(rendered).text();
    strictEqual(
      html,
      `<!--joe:0--><div>Loading 1...</div><!--/joe:0--><!--joe:1--><div>Loading 2...</div><!--/joe:1-->${fallbackRuntime}<joe-fb hidden data-id="1"><div>Hello, 2!</div></joe-fb><joe-fb hidden data-id="0"><div>Hello, 1!</div></joe-fb>`
    );
  });

  it("should render client component", async () => {
    const SayHelloClient = {
      $$typeof: CLIENT_SYMBOL,
      $$id: "say-hello",
    } as ClientComponent<{ name: string }>;
    const serialized = serialize(
      <div>
        <SayHelloClient name="World" />
      </div>
    );
    const [deserialized] = await deserialize(serialized, async (id) => {
      if (id === "say-hello") {
        return async ({ name }: { name: string }) => `Hello, ${name}!`;
      }
      throw new Error("Unknown client component '" + id + "'");
    });
    const rendered = render(deserialized);
    const html = await new Response(rendered).text();
    strictEqual(html, "<div>Hello, World!</div>");
  });

  it("should render multiple client component instances", async () => {
    const SayHelloClient = {
      $$typeof: CLIENT_SYMBOL,
      $$id: "say-hello",
    } as ClientComponent<{ name: string }>;
    const serialized = serialize(
      <>
        <SayHelloClient name="Foo" />
        <SayHelloClient name="Bar" />
      </>
    );
    const [deserialized] = await deserialize(serialized, async (id) => {
      if (id === "say-hello") {
        return async ({ name }: { name: string }) => <div>Hello, {name}!</div>;
      }
      throw new Error("Unknown client component '" + id + "'");
    });
    const rendered = render(deserialized);
    const html = await new Response(rendered).text();
    strictEqual(html, "<div>Hello, Foo!</div><div>Hello, Bar!</div>");
  });
});
