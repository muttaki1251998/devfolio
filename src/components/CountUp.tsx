"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";

export default function CountUp({ value, className }: { value: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obj = { n: 0 };
    const tween = gsap.to(obj, {
      n: value,
      duration: 0.8,
      ease: "power2.out",
      onUpdate: () => {
        el.textContent = String(Math.round(obj.n));
      },
    });
    return () => {
      tween.kill();
    };
  }, [value]);

  return (
    <span ref={ref} className={className}>
      0
    </span>
  );
}
