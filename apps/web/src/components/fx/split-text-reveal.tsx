"use client";

import { useEffect, useRef } from "react";
import { animate, stagger, type JSAnimation } from "animejs";
import { useInViewOnce, usePrefersReducedMotion } from "./use-fx";

type SplitTag = "h1" | "h2" | "h3" | "p" | "span" | "div";
type SplitMode = "words" | "chars";

const tagNames: Record<SplitTag, SplitTag> = {
  h1: "h1",
  h2: "h2",
  h3: "h3",
  p: "p",
  span: "span",
  div: "div",
};

function splitUnits(text: string, mode: SplitMode): string[] {
  if (mode === "chars") {
    return Array.from(text).map((char) => (char === " " ? "\u00A0" : char));
  }
  return text.split(/\s+/).filter(Boolean);
}

/**
 * anime.js v4 staggered text reveal. The full string is kept for screen
 * readers in an `.sr-only` span; the animated spans are `aria-hidden`.
 * Triggered once when the element enters the viewport (or immediately for
 * content already in view). `prefers-reduced-motion` renders the plain text.
 */
export function SplitTextReveal({
  text,
  as = "span",
  mode = "words",
  delay = 0,
  className,
}: {
  text: string;
  as?: SplitTag;
  mode?: SplitMode;
  /** Base delay in ms before the stagger begins. */
  delay?: number;
  className?: string;
}) {
  const Tag = tagNames[as];
  const containerRef = useRef<HTMLSpanElement>(null);
  const { ref: viewRef, inView } = useInViewOnce<HTMLSpanElement>(0.2);
  const reduce = usePrefersReducedMotion();
  const animationRef = useRef<JSAnimation | null>(null);

  useEffect(() => {
    if (!inView || reduce) return;
    const container = containerRef.current;
    if (!container) return;
    const units = container.querySelectorAll<HTMLElement>("[data-fx-unit]");
    animationRef.current = animate(units, {
      opacity: [0, 1],
      translateY: [12, 0],
      duration: 600,
      delay: stagger(mode === "chars" ? 16 : 45, { start: delay }),
      ease: "out(3)",
    });
    return () => {
      animationRef.current?.revert();
      animationRef.current = null;
    };
  }, [inView, reduce, mode, delay]);

  return (
    <Tag className={className}>
      <span className="sr-only">{text}</span>
      <span
        ref={(node) => {
          containerRef.current = node;
          viewRef.current = node;
        }}
        aria-hidden="true"
      >
        {splitUnits(text, mode).map((unit, index) => (
          <span key={`${unit}-${index}`}>
            {mode === "words" && index > 0 ? " " : null}
            <span data-fx-unit style={{ display: "inline-block" }}>
              {unit}
            </span>
          </span>
        ))}
      </span>
    </Tag>
  );
}
