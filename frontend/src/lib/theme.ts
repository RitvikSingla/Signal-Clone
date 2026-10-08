"use client";

/**
 * Theme preference.
 *
 * The browser owns this, not React: the value lives in localStorage and the
 * data-theme attribute on the document element. useSyncExternalStore is the
 * right way to read an external source like that, and it avoids the
 * cascading render that reading it inside an effect would cause.
 *
 * Three states, not two. "system" removes the attribute entirely and lets
 * prefers-color-scheme decide, which is what most people want.
 */

import { useSyncExternalStore } from "react";

export type Theme = "system" | "light" | "dark";

const STORAGE_KEY = "signal-theme";
const listeners = new Set<() => void>();

let cached: Theme | null = null;

function readStored(): Theme {
  if (cached !== null) return cached;
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    cached = value === "light" || value === "dark" ? value : "system";
  } catch {
    // Private browsing can throw on access. The system default is fine.
    cached = "system";
  }
  return cached;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Server render and first hydration agree on "system", so nothing flashes. */
function serverSnapshot(): Theme {
  return "system";
}

export function applyTheme(next: Theme): void {
  cached = next;
  const root = document.documentElement;
  if (next === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", next);

  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Not worth surfacing: the choice still applies for this session.
  }

  for (const listener of listeners) listener();
}

/** Called once on boot so a saved choice survives a refresh. */
export function restoreTheme(): void {
  const stored = readStored();
  if (stored !== "system") {
    document.documentElement.setAttribute("data-theme", stored);
  }
}

export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, readStored, serverSnapshot);
}
