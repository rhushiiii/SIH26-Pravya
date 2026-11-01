"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { usePrefersReducedMotion } from "./use-fx";

/**
 * Pointer-magnetic wrapper for primary CTAs: the child drifts a few pixels
 * toward the cursor (lerped) and springs back on leave. Disabled on touch
 * devices (`hover: none`) and under `prefers-reduced-motion`.
 */
export function MagneticButton({
  children,
  /** Maximum drift in px from the center toward the cursor. */
  strength = 6,
  className,
}: {
  children: ReactNode;
  strength?: number;
  className?: string;
}) {
  const wrapRef = useRef<HTMLSpanElement>(null);
  const innerRef = useRef<HTMLSpanElement>(null);
  const reduce = usePrefersReducedMotion();

  useEffect(() => {
    const wrap = wrapRef.current;
    const inner = innerRef.current;
    if (!wrap || !inner || reduce) return;
    if (window.matchMedia("(hover: none)").matches) return;

    let raf = 0;
    let running = false;
    let targetX = 0;
    let targetY = 0;
    let x = 0;
    let y = 0;

    const tick = () => {
      x += (targetX - x) * 0.18;
      y += (targetY - y) * 0.18;
      if (
        targetX === 0 &&
        targetY === 0 &&
        Math.abs(targetX - x) < 0.05 &&
        Math.abs(targetY - y) < 0.05
      ) {
        running = false;
        x = 0;
        y = 0;
        inner.style.transform = "";
        return;
      }
      inner.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`;
      raf = requestAnimationFrame(tick);
    };
    const start = () => {
      if (running) return;
      running = true;
      raf = requestAnimationFrame(tick);
    };
    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      const rect = wrap.getBoundingClientRect();
      targetX = ((event.clientX - rect.left) / rect.width - 0.5) * strength * 2;
      targetY = ((event.clientY - rect.top) / rect.height - 0.5) * strength * 2;
      start();
    };
    const onPointerLeave = () => {
      targetX = 0;
      targetY = 0;
      start();
    };

    wrap.addEventListener("pointermove", onPointerMove);
    wrap.addEventListener("pointerleave", onPointerLeave);
    return () => {
      cancelAnimationFrame(raf);
      wrap.removeEventListener("pointermove", onPointerMove);
      wrap.removeEventListener("pointerleave", onPointerLeave);
      inner.style.transform = "";
    };
  }, [reduce, strength]);

  return (
    <span
      ref={wrapRef}
      className={`fx-magnetic ${className ?? ""}`.trim()}
      style={{ display: "inline-flex" }}
    >
      <span
        ref={innerRef}
        className="fx-magnetic-inner"
        style={{ display: "inline-flex", willChange: "transform" }}
      >
        {children}
      </span>
    </span>
  );
}
