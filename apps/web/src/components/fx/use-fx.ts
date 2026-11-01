"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

const reducedMotionQuery = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(onChange: () => void) {
  const query = window.matchMedia(reducedMotionQuery);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/**
 * Tracks the user's `prefers-reduced-motion` setting reactively.
 * All FX components treat `true` as "render the final state, animate nothing".
 */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(reducedMotionQuery).matches,
    () => false,
  );
}

/**
 * Fires once when the observed element enters the viewport.
 * Returns a ref to attach and a boolean that flips to `true` (and stays).
 * An element scrolled PAST (above the viewport) before its first observation
 * — instant jumps, anchor links — also counts as seen, so content can never
 * remain stuck invisible.
 */
export function useInViewOnce<T extends Element>(threshold = 0.25) {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!element || inView) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const seen = entries.some(
          (entry) =>
            entry.isIntersecting || entry.boundingClientRect.bottom < 0,
        );
        if (seen) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [inView, threshold]);
  return { ref, inView };
}
