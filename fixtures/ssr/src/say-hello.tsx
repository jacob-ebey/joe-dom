"use client";

import { Blink } from "./blink";

export function SayHello({ name }: { name: string }) {
  return (
    <button onClick={() => alert(`Hello, ${name}!`)}>
      <Blink>Say Hello</Blink>
    </button>
  );
}
