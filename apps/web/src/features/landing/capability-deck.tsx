"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { motion } from "framer-motion";
import { usePrefersReducedMotion } from "@/components/fx/use-fx";
import { Icon } from "@/components/ui/icon";

import "./capability-deck.css";

type Capability = { title: string; body: string };
const covers = [
  { label: "Local validation", title: "Format, not identity.", color: "paper" },
  { label: "Record management", title: "Every version stays.", color: "ink" },
  { label: "Intake rules", title: "Capacity in context.", color: "sage" },
  {
    label: "Evidence-linked review",
    title: "Follow the finding.",
    color: "blue",
  },
  { label: "Exception tracking", title: "A clear next step.", color: "sand" },
  { label: "Audit history", title: "Decisions leave a trail.", color: "stone" },
] as const;

/** Small original cover illustrations; no invented student records or metrics. */
function CoverArt({ index }: { index: number }) {
  return (
    <svg
      className="capability-cover-art"
      viewBox="0 0 180 128"
      fill="none"
      aria-hidden="true"
    >
      {index === 0 && (
        <>
          <rect
            x="24"
            y="22"
            width="132"
            height="84"
            rx="12"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <circle
            cx="52"
            cy="48"
            r="10"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path
            d="M76 43h52M76 53h30M44 80h92"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path
            d="m110 91 8 8 20-21"
            stroke="var(--ui-accent-action)"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      )}
      {index === 1 && (
        <>
          <rect
            x="65"
            y="10"
            width="80"
            height="94"
            rx="8"
            stroke="currentColor"
            strokeOpacity=".3"
            transform="rotate(10 105 57)"
          />
          <rect
            x="48"
            y="18"
            width="80"
            height="94"
            rx="8"
            stroke="currentColor"
            strokeOpacity=".6"
          />
          <rect
            x="30"
            y="26"
            width="80"
            height="94"
            rx="8"
            fill="var(--cover-ground)"
            stroke="currentColor"
            strokeWidth="1.5"
            transform="rotate(-8 70 73)"
          />
          <path
            d="m46 53 43-6m-41 20 32-4m-30 19 39-5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </>
      )}
      {index === 2 && (
        <>
          <path
            d="M26 104h128M26 28v76"
            stroke="currentColor"
            strokeOpacity=".4"
          />
          <rect
            x="40"
            y="66"
            width="20"
            height="38"
            rx="3"
            fill="currentColor"
            fillOpacity=".3"
          />
          <rect
            x="78"
            y="40"
            width="20"
            height="64"
            rx="3"
            fill="currentColor"
          />
          <rect
            x="116"
            y="54"
            width="20"
            height="50"
            rx="3"
            fill="currentColor"
            fillOpacity=".5"
          />
          <path d="M26 30h128" stroke="currentColor" strokeDasharray="4 5" />
        </>
      )}
      {index === 3 && (
        <>
          <path
            d="m46 38 44 27 46-27M90 65v39"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <rect
            x="24"
            y="17"
            width="44"
            height="42"
            rx="10"
            fill="var(--cover-ground)"
            stroke="currentColor"
          />
          <rect
            x="114"
            y="17"
            width="44"
            height="42"
            rx="10"
            fill="var(--cover-ground)"
            stroke="currentColor"
          />
          <circle
            cx="90"
            cy="91"
            r="23"
            fill="var(--cover-ground)"
            stroke="currentColor"
          />
          <path
            d="M38 32h16m-16 10h10m72-10h20m-20 10h12m-49 49 5 5 11-12"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </>
      )}
      {index === 4 && (
        <>
          <path
            d="M35 30v68"
            stroke="currentColor"
            strokeOpacity=".4"
            strokeWidth="1.5"
          />
          {[30, 64, 98].map((y, i) => (
            <g key={y}>
              <circle
                cx="35"
                cy={y}
                r="6"
                fill="var(--cover-ground)"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <path
                d={`M56 ${y}h${i === 1 ? 54 : 78}`}
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
              />
            </g>
          ))}
          <path
            d="m125 87 12 11-12 11m-18-11h30"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      )}
      {index === 5 && (
        <>
          <circle
            cx="90"
            cy="64"
            r="40"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeDasharray="2 6"
          />
          <circle
            cx="90"
            cy="64"
            r="28"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path
            d="M90 45v21l14 9"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path
            d="m130 28 10 8-10 8"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      )}
    </svg>
  );
}

/** Combines hover-fan and click-to-cycle stack motion from the supplied recordings. */
export function CapabilityDeck({ items }: { items: Capability[] }) {
  const [selected, setSelected] = useState(0);
  const [hovering, setHovering] = useState(false);
  const [keyboardFocus, setKeyboardFocus] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [hovered, setHovered] = useState<number | null>(null);
  const [width, setWidth] = useState(560);
  const stage = useRef<HTMLDivElement>(null);
  const choices = useRef<(HTMLButtonElement | null)[]>([]);
  const reduce = usePrefersReducedMotion();
  const detailId = `capability-detail-${useId()}`;
  const open = hovering || keyboardFocus || pinned;

  useEffect(() => {
    const element = stage.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(entry.contentRect.width),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  if (items.length === 0) return null;
  const current = items[selected];
  const spreadColumns = width < 480 ? 2 : 3;
  const spreadGap = width < 480 ? 18 : 24;
  const cardWidth = pinned
    ? Math.min(
        190,
        (width - 32 - spreadGap * (spreadColumns - 1)) / spreadColumns,
      )
    : Math.min(190, Math.max(132, width * 0.31));
  const spreadRows = Math.ceil(items.length / spreadColumns);
  const step = Math.max(
    0,
    (width - cardWidth - (width < 480 ? 64 : 12)) /
      Math.max(1, items.length - 1),
  );
  const middle = (items.length - 1) / 2;
  const select = (index: number) =>
    setSelected((index + items.length) % items.length);
  const onChoiceKey = (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    let next: number;
    if (event.key === "ArrowRight") next = (index + 1) % items.length;
    else if (event.key === "ArrowLeft")
      next = (index - 1 + items.length) % items.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = items.length - 1;
    else return;
    event.preventDefault();
    select(next);
    choices.current[next]?.focus();
  };

  return (
    <div className="capability-explorer">
      <div className="capability-deck-column">
        <div
          ref={stage}
          className="capability-deck-stage"
          style={
            pinned
              ? { height: spreadRows * (cardWidth * 1.44 + spreadGap) + 70 }
              : undefined
          }
          data-expanded={open}
          onPointerEnter={(event) => {
            if (
              event.pointerType === "mouse" &&
              window.matchMedia("(hover: hover) and (pointer: fine)").matches
            )
              setHovering(true);
          }}
          onPointerLeave={() => {
            setHovering(false);
            setHovered(null);
          }}
          onFocusCapture={(event) => {
            if (event.target.matches(":focus-visible")) setKeyboardFocus(true);
          }}
          onBlurCapture={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) {
              setKeyboardFocus(false);
              setHovered(null);
            }
          }}
          aria-label="Interactive capability card deck"
        >
          <div className="capability-deck-ground" aria-hidden="true" />
          {items.map((item, index) => {
            const depth = (index - selected + items.length) % items.length;
            const offset = index - middle;
            const cover = covers[index % covers.length];
            const lifted = open && hovered === index;
            return (
              <motion.button
                key={item.title}
                type="button"
                className={`capability-spread-card cover-${cover.color}`}
                style={{
                  width: cardWidth,
                  height: cardWidth * 1.44,
                  marginLeft: -cardWidth / 2,
                  zIndex: lifted
                    ? 30
                    : index === selected
                      ? 20
                      : items.length - depth,
                }}
                initial={false}
                animate={{
                  x: pinned
                    ? ((index % spreadColumns) - (spreadColumns - 1) / 2) *
                      (cardWidth + spreadGap)
                    : open
                      ? offset * step
                      : depth * 6 - 15,
                  y: pinned
                    ? Math.floor(index / spreadColumns) *
                        (cardWidth * 1.44 + spreadGap) -
                      (lifted ? 10 : 0)
                    : open
                      ? Math.abs(offset) * 15 - (lifted ? 36 : 0)
                      : -depth * 7,
                  rotate: pinned ? 0 : open ? offset * 6 : -4 + depth * 1.5,
                  scale: lifted
                    ? pinned
                      ? 1.02
                      : 1.06
                    : open
                      ? 1
                      : 1 - depth * 0.025,
                }}
                transition={
                  reduce
                    ? { duration: 0 }
                    : {
                        type: "spring",
                        stiffness: 280,
                        damping: 25,
                        mass: 0.85,
                      }
                }
                whileTap={reduce ? undefined : { scale: 0.98 }}
                aria-label={
                  index === selected && !open
                    ? `Next capability after ${item.title}`
                    : `Explore ${item.title}`
                }
                aria-controls={detailId}
                onPointerEnter={() => setHovered(index)}
                onFocus={() => setHovered(index)}
                onClick={() =>
                  select(index === selected && !open ? selected + 1 : index)
                }
              >
                <span className="capability-cover-top">
                  <span>PRAVYA</span>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                </span>
                <CoverArt index={index % covers.length} />
                <span className="capability-cover-label">{cover.label}</span>
                <span className="capability-cover-title">{cover.title}</span>
                <span className="capability-cover-footer">
                  Synthetic demo · illustrative
                </span>
              </motion.button>
            );
          })}
        </div>
        <div className="capability-deck-controls">
          <button
            type="button"
            className="capability-spread-toggle"
            aria-pressed={pinned}
            onClick={() => setPinned((value) => !value)}
          >
            {pinned ? "Stack cards" : "Spread cards"}
            <span aria-hidden="true">{pinned ? "−" : "+"}</span>
          </button>
          <span className="capability-deck-hint">
            Hover to fan. Tap to explore.
          </span>
        </div>
      </div>

      <div className="capability-detail-column">
        <div className="capability-detail-count">
          <span>Platform capabilities</span>
          <span>
            {String(selected + 1).padStart(2, "0")} /{" "}
            {String(items.length).padStart(2, "0")}
          </span>
        </div>
        <div
          id={detailId}
          className="capability-detail"
          role="region"
          aria-label="Selected capability"
          aria-live="polite"
          aria-atomic="true"
        >
          <h3>{current.title}</h3>
          <p>{current.body}</p>
        </div>
        <div
          className="capability-choices"
          role="group"
          aria-label="Choose a capability"
        >
          {items.map((item, index) => (
            <button
              key={item.title}
              type="button"
              ref={(element) => {
                choices.current[index] = element;
              }}
              aria-label={item.title}
              aria-pressed={selected === index}
              aria-controls={detailId}
              onKeyDown={(event) => onChoiceKey(event, index)}
              onClick={() => select(index)}
            >
              {String(index + 1).padStart(2, "0")}
            </button>
          ))}
        </div>
        <div className="capability-paging">
          <button
            type="button"
            aria-label="Previous capability"
            onClick={() => select(selected - 1)}
          >
            <span className="capability-prev">
              <Icon name="arrow" />
            </span>
          </button>
          <button
            type="button"
            aria-label="Next capability"
            onClick={() => select(selected + 1)}
          >
            <Icon name="arrow" />
          </button>
          <span>Explore all {items.length} capabilities</span>
        </div>
      </div>
    </div>
  );
}
