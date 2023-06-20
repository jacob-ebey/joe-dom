import { deepStrictEqual, strictEqual } from "node:assert/strict";
import { describe, it } from "node:test";

import { serverModuleTransform } from "../loader.js";

describe("loader", () => {
  it("should ignore non use client or user server modules", () => {
    const input = `
      // "use client";
      // "use server";
    `;
    deepStrictEqual(serverModuleTransform(input), {
      useClient: false,
      useServer: false,
      source: input,
    });
  });

  it("should transform use client modules", () => {
    const input = `
      "use client";
      import { a } from "./foo.js";
      export const foo = () => {};
      export let bar = () => {};
      export var baz = () => {};
      const qux = () => {};
      export { a, qux };
      const def = () => {};
      export default def;
    `;
    deepStrictEqual(serverModuleTransform(input, "/foo.js"), {
      useClient: true,
      useServer: false,
      exportNames: ["foo", "bar", "baz", "a", "qux", "default"],
      defaultName: "def",
      source:
        'import {CLIENT_SYMBOL} from "joe-dom";\nexport const foo = {$$typeof:CLIENT_SYMBOL,$$id:"/foo.js#foo"};\nexport const bar = {$$typeof:CLIENT_SYMBOL,$$id:"/foo.js#bar"};\nexport const baz = {$$typeof:CLIENT_SYMBOL,$$id:"/foo.js#baz"};\nexport const a = {$$typeof:CLIENT_SYMBOL,$$id:"/foo.js#a"};\nexport const qux = {$$typeof:CLIENT_SYMBOL,$$id:"/foo.js#qux"};\nexport default {$$typeof:CLIENT_SYMBOL,$$id:"/foo.js#default"};\n',
    });
  });

  it("should error on direct re-exports", () => {
    const input = `
      "use client";
      export { error } from "./foo.js";
    `;
    try {
      serverModuleTransform(input);
    } catch (error) {
      strictEqual(error.message, "Export from not supported");
      return;
    }
    throw new Error("Expected error to be thrown.");
  });

  it("should error on export all", () => {
    const input = `
      "use client";
      export * from "./foo.js";
    `;
    try {
      serverModuleTransform(input);
    } catch (error) {
      strictEqual(error.message, "Export all not supported");
      return;
    }
    throw new Error("Expected error to be thrown.");
  });
});
