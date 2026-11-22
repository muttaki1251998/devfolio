"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * False during prerender and hydration, true after. Lets a client component read
 * browser-only values (like the current time) without a hydration mismatch and
 * without setting state inside an effect.
 */
export function useMounted(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
