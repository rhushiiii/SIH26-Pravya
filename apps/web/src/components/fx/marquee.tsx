"use client";

import type { ReactNode } from "react";

/**
 * Accessible infinite marquee. The content track is rendered twice; the
 * duplicate is `aria-hidden`. The CSS animation pauses on hover and is
 * disabled globally under `prefers-reduced-motion` (the first group simply
 * stays static).
 */
export function Marquee({
  children,
  ariaLabel,
  duration = 38,
}: {
  children: ReactNode;
  /** Announced name for the strip; the duplicated track is hidden from AT. */
  ariaLabel: string;
  /** Full loop duration in seconds. */
  duration?: number;
}) {
  return (
    <div className="fx-marquee" role="group" aria-label={ariaLabel}>
      <div
        className="fx-marquee-track"
        style={{ animationDuration: `${duration}s` }}
      >
        <div className="fx-marquee-group">{children}</div>
        <div className="fx-marquee-group" aria-hidden="true">
          {children}
        </div>
      </div>
    </div>
  );
}
