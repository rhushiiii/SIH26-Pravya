"use client";

import { useRef, type PointerEvent, type ReactNode } from "react";

/**
 * Public-preview-inspired spotlight. Move the decorative overlay directly
 * rather than recalculating inherited CSS properties on every card child.
 * Touch, pen and reduced-motion users receive the static card.
 */
export function SpotlightCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const glowRef = useRef<HTMLSpanElement>(null);

  const onPointerMove = (event: PointerEvent<HTMLElement>) => {
    if (
      event.pointerType !== "mouse" ||
      !window.matchMedia("(hover: hover) and (pointer: fine)").matches ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    const glow = glowRef.current;
    if (!glow) return;
    const rect = event.currentTarget.getBoundingClientRect();
    glow.style.transform = `translate(${event.clientX - rect.left - 160}px, ${event.clientY - rect.top - 160}px)`;
  };

  return (
    <article
      className={`fx-spotlight ${className}`.trim()}
      onPointerMove={onPointerMove}
    >
      {children}
      <span ref={glowRef} className="spotlight-glow" aria-hidden="true" />
    </article>
  );
}
