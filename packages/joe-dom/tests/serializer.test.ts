import { strictEqual, deepEqual } from "node:assert/strict";
import { describe, it } from "node:test";

import { serialize, deserialize } from "../src/serializer.js";

describe("serializer", () => {
  it("should serialize primitives", async () => {
    const value = [
      undefined,
      null,
      true,
      false,
      0,
      1,
      -1,
      1.2,
      -1.2,
      NaN,
      Infinity,
      -Infinity,
    ];
    const stream = serialize(value);
    const [a, b] = stream.tee();
    const serialized = await new Response(a).text();
    strictEqual(
      serialized,
      '[[-1,"0:1","0:2","0:3","0:4","0:5","0:6","0:7","0:8",-3,-4,-5],null,true,false,0,1,-1,1.2,-1.2]\n'
    );
    const [deserialized] = await deserialize(b);
    deepEqual(deserialized, value);
  });

  it("should serialize strings", async () => {
    const stream = serialize(["", "foo", "bar", "baz"]);
    const [a, b] = stream.tee();
    const serialized = await new Response(a).text();
    strictEqual(
      serialized,
      '[["0:1","0:2","0:3","0:4"],"","foo","bar","baz"]\n'
    );
    const [deserialized] = await deserialize(b);
    deepEqual(deserialized, ["", "foo", "bar", "baz"]);
  });

  it("should dedupe strings", async () => {
    const stream = serialize(["foo", "bar", "foo", "bar"]);
    const [a, b] = stream.tee();
    const serialized = await new Response(a).text();
    strictEqual(serialized, '[["0:1","0:2","0:1","0:2"],"foo","bar"]\n');
    const [deserialized] = await deserialize(b);
    deepEqual(deserialized, ["foo", "bar", "foo", "bar"]);
  });

  it("should serialize objects", async () => {
    const stream = serialize([{ foo: "bar" }, { foo: "bar" }]);
    const [a, b] = stream.tee();
    const serialized = await new Response(a).text();
    strictEqual(
      serialized,
      '[["0:1","0:3"],{"foo":"0:2"},"bar",{"foo":"0:2"}]\n'
    );
    const [deserialized] = await deserialize(b);
    deepEqual(deserialized, [{ foo: "bar" }, { foo: "bar" }]);
  });

  it("should serialize circular objects", async () => {
    const a = { foo: "bar" };
    const b = { fiz: "bang" };
    (a as any).b = b;
    (b as any).a = a;
    const stream = serialize(a);
    const [sa, sb] = stream.tee();
    const serialized = await new Response(sa).text();
    strictEqual(
      serialized,
      '[{"foo":"0:1","b":"0:2"},"bar",{"fiz":"0:3","a":"0:0"},"bang"]\n'
    );
    const [deserialized] = await deserialize(sb);
    deepEqual(deserialized, a);
  });

  it("should serialize dates", async () => {
    const stream = serialize([new Date(0), new Date(1)]);
    const [a, b] = stream.tee();
    const serialized = await new Response(a).text();
    strictEqual(
      serialized,
      '[["0:1","0:2"],["Date","1970-01-01T00:00:00.000Z"],["Date","1970-01-01T00:00:00.001Z"]]\n'
    );
    const [deserialized] = await deserialize(b);
    deepEqual(deserialized, [new Date(0), new Date(1)]);
  });

  it("should serialize regexps", async () => {
    const stream = serialize([/foo/, /bar/g]);
    const [a, b] = stream.tee();
    const serialized = await new Response(a).text();
    strictEqual(
      serialized,
      '[["0:1","0:2"],["RegExp","foo"],["RegExp","bar","g"]]\n'
    );
    const [deserialized] = await deserialize(b);
    deepEqual(deserialized, [/foo/, /bar/g]);
  });

  it("should serialize bigints", async () => {
    const stream = serialize([BigInt(0), BigInt(1)]);
    const [a, b] = stream.tee();
    const serialized = await new Response(a).text();
    strictEqual(serialized, '[["0:1","0:2"],["BigInt","0"],["BigInt","1"]]\n');
    const [deserialized] = await deserialize(b);
    deepEqual(deserialized, [BigInt(0), BigInt(1)]);
  });

  it("should serialize symbols", async () => {
    const stream = serialize([Symbol.for("foo"), Symbol.for("bar")]);
    const [a, b] = stream.tee();
    const serialized = await new Response(a).text();
    strictEqual(
      serialized,
      '[["0:1","0:2"],["Symbol","foo"],["Symbol","bar"]]\n'
    );
    const [deserialized] = await deserialize(b);
    deepEqual(deserialized, [Symbol.for("foo"), Symbol.for("bar")]);
  });

  it("should serialize promise", async () => {
    const stream = serialize([0, 1, Promise.resolve(0), Promise.resolve(1)]);
    const [a, b] = stream.tee();
    const serialized = await new Response(a).text();
    strictEqual(
      serialized,
      '[["0:1","0:2","0:3","0:4"],0,1,["Promise",0],["Promise",1]]\n$0:[{"value":"0:1"}]\n$1:[{"value":"0:2"}]\n'
    );
    const [deserialized] = await deserialize(b);
    strictEqual(deserialized[0], 0);
    strictEqual(deserialized[1], 1);
    strictEqual(deserialized[2] instanceof Promise, true);
    strictEqual(deserialized[3] instanceof Promise, true);
    strictEqual(await deserialized[2], 0);
    strictEqual(await deserialized[3], 1);
  });

  it("should serialize promise that returns cyclic object in initial response", async () => {
    const a = { foo: "bar" };
    const b = { fiz: "bang" };
    (a as any).b = b;
    (b as any).a = a;
    const stream = serialize({ a, b: Promise.resolve(b) });
    const [sa, sb] = stream.tee();
    const serialized = await new Response(sa).text();
    strictEqual(
      serialized,
      '[{"a":"0:1","b":"0:5"},{"foo":"0:2","b":"0:3"},"bar",{"fiz":"0:4","a":"0:1"},"bang",["Promise",0]]\n$0:[{"value":"0:3"}]\n'
    );
    const [deserialized] = await deserialize(sb);
    strictEqual(deserialized.a.foo, "bar");
    strictEqual(deserialized.a.b, await deserialized.b);
    strictEqual((await deserialized.b).fiz, "bang");
    strictEqual((await deserialized.b).a, deserialized.a);
  });

  it("should allow for nested promises", async () => {
    const a = Promise.resolve({
      b: Promise.resolve({
        c: Promise.resolve("c"),
      }),
    });
    const stream = serialize(a);
    const [sa, sb] = stream.tee();
    const serialized = await new Response(sa).text();
    strictEqual(
      serialized,
      '[["Promise",0]]\n$0:[{"value":"1:1"},{"b":"1:2"},["Promise",1]]\n$1:[{"value":"2:1"},{"c":"2:2"},["Promise",2]]\n$2:[{"value":"3:1"},"c"]\n'
    );
    const [deserialized] = await deserialize(sb);
    strictEqual(deserialized instanceof Promise, true);
    strictEqual((await deserialized).b instanceof Promise, true);
    strictEqual((await (await deserialized).b).c instanceof Promise, true);
    strictEqual(await (await (await deserialized).b).c, "c");
  });
});
