"use client";

import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";

/**
 * Staggers direct children marked with [data-reveal] on mount.
 * Kept short on purpose: this plays every morning.
 */
export default function Reveal({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const targets = el.querySelectorAll("[data-reveal]");
    if (!targets.length) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        targets,
        { y: 14, autoAlpha: 0 },
        { y: 0, autoAlpha: 1, duration: 0.5, stagger: 0.07, ease: "power2.out" },
      );
    }, el);
    return () => ctx.revert();
  }, []);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
