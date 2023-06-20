"use client";

import { useEffect, useRef } from "joe-dom";

export function Blink({ children }) {
  const ref = useRef<HTMLSpanElement>();
  useEffect(() => {
    let dimmed = false;
    const interval = setInterval(() => {
      dimmed = !dimmed;
      ref.current.style.opacity = dimmed ? "0.5" : "1";
    }, 300);
    return () => clearInterval(interval);
  }, []);
  return <span ref={ref}>{children}</span>;
}
