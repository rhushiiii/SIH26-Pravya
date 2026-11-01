"use client";

import { useEffect, useRef, type PointerEvent } from "react";

import "./cipher-reveal.css";

const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const lowercase = "abcdefghijklmnopqrstuvwxyz";
const digits = "0123456789";

/** Original visual implementation based on the supplied recording. */
export function CipherReveal({
  text,
  delay = 0,
  duration = 1050,
}: {
  text: string;
  delay?: number;
  duration?: number;
}) {
  const root = useRef<HTMLSpanElement>(null);
  const trail = useRef<(x: number, y: number) => void>(() => {});

  useEffect(() => {
    const element = root.current;
    if (!element) return;

    const letters = Array.from(text);
    const glyphs = Array.from(
      element.querySelectorAll<HTMLElement>(".cipher-glyph"),
    );
    const slots = glyphs.map((glyph) => glyph.parentElement!);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const pointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    const scrambleTime = Math.min(350, duration);
    let starts = letters.map(() => -Infinity);
    let frame = 0;
    let lastPaint = -Infinity;
    let revealed = false;
    let disposed = false;

    const restore = () => {
      glyphs.forEach((glyph, index) => {
        glyph.textContent = letters[index];
        glyph.style.opacity = "1";
        glyph.style.transform = "translateX(-50%)";
      });
    };

    const paint = (now: number) => {
      frame = 0;
      if (disposed || reduced.matches) return;
      let running = false;
      const update = now - lastPaint >= 1000 / 14;
      if (update) lastPaint = now;

      glyphs.forEach((glyph, index) => {
        const elapsed = now - starts[index];
        if (elapsed >= scrambleTime) {
          if (update) {
            glyph.textContent = letters[index];
            glyph.style.opacity = "1";
            glyph.style.transform = "translateX(-50%)";
          }
          return;
        }

        running = true;
        if (!update) return;
        if (elapsed < 0) {
          glyph.style.opacity = "0";
          return;
        }

        const original = letters[index];
        const charset = /[A-Z]/.test(original)
          ? uppercase
          : /[a-z]/.test(original)
            ? lowercase
            : /[0-9]/.test(original)
              ? digits
              : original;
        glyph.textContent = charset[Math.floor(Math.random() * charset.length)];
        glyph.style.opacity = String(0.42 + 0.58 * (elapsed / scrambleTime));
        // The original glyph reserves the slot; fit wide cipher glyphs inside it.
        const scale = Math.min(
          1,
          slots[index].offsetWidth / (glyph.offsetWidth || 1),
        );
        glyph.style.transform = `translateX(-50%) scaleX(${scale})`;
      });

      if (running) frame = requestAnimationFrame(paint);
      else {
        revealed = true;
        restore();
      }
    };

    const onMotionChange = () => {
      if (!reduced.matches) return;
      cancelAnimationFrame(frame);
      frame = 0;
      starts = letters.map(() => -Infinity);
      revealed = true;

      restore();
    };

    trail.current = (x, y) => {
      if (!revealed || reduced.matches || !pointer.matches) return;
      const now = performance.now();
      const radius = parseFloat(getComputedStyle(element).fontSize) * 0.6;
      slots.forEach((slot, index) => {
        const box = slot.getBoundingClientRect();
        if (
          Math.abs(box.x + box.width / 2 - x) <= radius &&
          y >= box.top &&
          y <= box.bottom &&
          letters[index].trim()
        ) {
          starts[index] = now;
        }
      });
      if (!frame) frame = requestAnimationFrame(paint);
    };

    reduced.addEventListener("change", onMotionChange);
    if (reduced.matches) revealed = true;
    else {
      const start = performance.now() + delay;
      starts = letters.map(
        (_, index) =>
          start +
          (index / Math.max(1, letters.length - 1)) * (duration - scrambleTime),
      );
      glyphs.forEach((glyph) => {
        glyph.style.opacity = "0";
      });
      frame = requestAnimationFrame(paint);
    }

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);

      reduced.removeEventListener("change", onMotionChange);
      trail.current = () => {};
      restore();
    };
  }, [text, delay, duration]);

  const onPointerMove = (event: PointerEvent<HTMLSpanElement>) => {
    if (event.pointerType === "mouse")
      trail.current(event.clientX, event.clientY);
  };

  return (
    <span ref={root} className="cipher-reveal" onPointerMove={onPointerMove}>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {Array.from(text).map((letter, index) => (
          <span className="cipher-letter" key={index}>
            <span className="cipher-measure">{letter}</span>
            <span className="cipher-glyph">{letter}</span>
          </span>
        ))}
      </span>
    </span>
  );
}
