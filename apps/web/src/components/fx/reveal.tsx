"use client";

import type { CSSProperties, ReactNode } from "react";
import { useInViewOnce, usePrefersReducedMotion } from "./use-fx";

/**
 * Generic scroll-reveal wrapper: fades and rises (optionally un-blurring)
 * once when it enters the viewport. The transition lives in CSS
 * (`.fx-reveal`); this component only flips the visibility class once.
 * Under `prefers-reduced-motion` the content is shown immediately.
 */
export function Reveal({
  children,
  className,
  delay = 0,
  blur = false,
  rise = 22,
}: {
  children: ReactNode;
  className?: string;
  /** Extra transition delay in ms (use for per-card stagger). */
  delay?: number;
  blur?: boolean;
  rise?: number;
}) {
  const { ref, inView } = useInViewOnce<HTMLDivElement>(0.2);
  const reduce = usePrefersReducedMotion();
  const visible = inView || reduce;
  const classes = [
    "fx-reveal",
    visible ? "fx-reveal-in" : "",
    blur ? "fx-reveal-blur" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  const style: CSSProperties = {
    transitionDelay: `${delay}ms`,
    "--fx-rise": `${rise}px`,
  } as CSSProperties;

  return (
    <div ref={ref} className={classes} style={style}>
      {children}
    </div>
  );
}
