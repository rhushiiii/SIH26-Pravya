"use client";

import { useEffect, useRef } from "react";
import { animate } from "animejs";
import { useInViewOnce, usePrefersReducedMotion } from "./use-fx";

/**
 * Parses a display value like `"1,248"` or `"6 / 6"` into a numeric target
 * plus a static suffix. Returns `null` when the value does not start with a
 * number (then the raw string should be rendered as-is).
 */
export function parseMetricValue(
  value: string | number,
): { value: number; suffix: string } | null {
  if (typeof value === "number") return { value, suffix: "" };
  const match = value.match(/^\s*([\d,]+(?:\.\d+)?)\s*(.*)$/);
  if (!match) return null;
  const parsed = Number(match[1].replace(/,/g, ""));
  if (!Number.isFinite(parsed)) return null;
  return { value: parsed, suffix: match[2] };
}

/**
 * anime.js count-up. The final formatted value is rendered immediately (SSR
 * safe, no layout shift); when motion is allowed the text animates 0 → value
 * the first time it enters the viewport. Under `prefers-reduced-motion` the
 * final value is left untouched.
 */
export function CountUp({
  value,
  prefix = "",
  suffix = "",
  duration = 1400,
  className,
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const { ref: viewRef, inView } = useInViewOnce<HTMLSpanElement>(0.4);
  const reduce = usePrefersReducedMotion();

  useEffect(() => {
    const element = ref.current;
    if (!element || !inView || reduce) return;
    const counter = { v: 0 };
    const animation = animate(counter, {
      v: value,
      duration,
      ease: "out(3)",
      onUpdate: () => {
        element.textContent = `${prefix}${Math.round(counter.v).toLocaleString()}${suffix}`;
      },
    });
    return () => {
      animation.cancel();
      element.textContent = `${prefix}${value.toLocaleString()}${suffix}`;
    };
  }, [inView, reduce, value, duration, prefix, suffix]);

  return (
    <span
      ref={(node) => {
        ref.current = node;
        viewRef.current = node;
      }}
      className={className}
    >
      {prefix}
      {value.toLocaleString()}
      {suffix}
    </span>
  );
}
