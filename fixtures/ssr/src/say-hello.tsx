"use client";

export function SayHello({ name }: { name: string }) {
  return <button onClick={() => alert(`Hello, ${name}!`)}>Say Hello</button>;
}
