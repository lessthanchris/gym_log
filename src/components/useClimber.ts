"use client";

import { useSyncExternalStore } from "react";

const KEY = "gymlog.climber";
const listeners = new Set<() => void>();

function read(): string {
  try {
    return localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

/** The climber name this browser logs ascents as, remembered in localStorage. */
export function useClimber(): [string, (name: string) => void] {
  const name = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    read,
    () => "",
  );
  const setName = (value: string) => {
    try {
      localStorage.setItem(KEY, value.trim());
    } catch {
      // Storage unavailable (private mode): the name just won't persist.
    }
    listeners.forEach((l) => l());
  };
  return [name, setName];
}
