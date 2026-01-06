import { useEffect, useState, useSyncExternalStore } from "react"

const MOBILE_BREAKPOINT = 768;

// Get the current mobile state
function getSnapshot(): boolean {
  return window.innerWidth < MOBILE_BREAKPOINT;
}

// Server-side fallback (always returns false)
function getServerSnapshot(): boolean {
  return false;
}

// Subscribe to window resize events
function subscribe(callback: () => void): () => void {
  const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
  mql.addEventListener("change", callback);
  window.addEventListener("resize", callback);
  return () => {
    mql.removeEventListener("change", callback);
    window.removeEventListener("resize", callback);
  };
}

export function useIsMobile(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
