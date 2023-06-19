"use client";

import { type ClientComponent, CLIENT_SYMBOL } from "joe-dom";

// export function SayHello({ name }: { name: string }) {
//   return <button onClick={() => alert(`Hello, ${name}!`)}>Say Hello</button>;
// }

export const SayHello = {
  $$typeof: CLIENT_SYMBOL,
  $$id: "SayHello",
} as ClientComponent<{ name: string }>;
