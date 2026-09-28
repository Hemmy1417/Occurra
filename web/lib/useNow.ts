"use client";

/**
 * One clock for every page, ticking every fifteen seconds, read through
 * React's external-store hook so rendering stays pure. Windows and deadlines
 * compare against it; the server renders with no clock at all.
 */
import { useSyncExternalStore } from "react";

let current = Date.now();
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (!timer) {
    current = Date.now();
    timer = setInterval(() => {
      current = Date.now();
      for (const l of listeners) l();
    }, 15_000);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

export function useNow(): number {
  return useSyncExternalStore(subscribe, () => current, () => 0);
}
