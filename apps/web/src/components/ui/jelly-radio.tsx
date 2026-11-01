"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from "react";
import {
  animate,
  motion,
  useMotionValue,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { usePrefersReducedMotion } from "@/components/fx/use-fx";

import "./jelly-radio.css";

type Item = {
  value: string;
  label: ReactNode;
  icon?: ReactNode;
  disabled?: boolean;
  href?: string;
};
type Values = {
  x: MotionValue<number>;
  sx: MotionValue<number>;
  sy: MotionValue<number>;
};
const DEFAULT_ITEMS = ["Off", "Low", "Medium", "High", "Max"];
const SIZES = { sm: [28, 12, 12], md: [36, 13, 16], lg: [44, 14, 20] };
const spring = (stiffness: number, mass: number, bounce: number) => ({
  type: "spring" as const,
  stiffness,
  mass,
  damping: 2 * Math.sqrt(stiffness * mass) * (1 - bounce),
});

function Chip({
  item,
  selected,
  register,
  commit,
  onKeyDown,
}: {
  item: Item;
  selected: boolean;
  register: (node: HTMLElement | null, values: Values) => void;
  commit: (event: MouseEvent<HTMLElement>) => void;
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
}) {
  const x = useMotionValue(0);
  const sx = useMotionValue(1);
  const sy = useMotionValue(1);
  const transform = useTransform(
    () => `translateX(${x.get()}px) scale(${sx.get()}, ${sy.get()})`,
  );
  useEffect(
    () => () => {
      x.stop();
      sx.stop();
      sy.stop();
    },
    [x, sx, sy],
  );
  const contents = (
    <span className="jelly-radio__skin">
      {item.icon && <span className="jelly-radio__icon">{item.icon}</span>}
      <span className="jelly-radio__label">{item.label}</span>
    </span>
  );
  const common = {
    style: { transform },
    className: "jelly-radio__chip",
    "data-on": selected ? "true" : "false",
    onClick: commit,
    onKeyDown,
  };
  if (item.href)
    return (
      <motion.a
        {...common}
        ref={(node) => {
          register(node, { x, sx, sy });
        }}
        href={item.href}
        aria-current={selected ? "location" : undefined}
        aria-disabled={item.disabled || undefined}
        tabIndex={item.disabled ? -1 : 0}
      >
        {contents}
      </motion.a>
    );
  return (
    <motion.button
      {...common}
      ref={(node) => {
        register(node, { x, sx, sy });
      }}
      type="button"
      role="radio"
      aria-checked={selected}
      tabIndex={selected ? 0 : -1}
      disabled={item.disabled}
    >
      {contents}
    </motion.button>
  );
}

/** React Bits JellyRadio, adapted from the supplied JS/CSS for typed navigation links. */
export default function JellyRadio({
  items = DEFAULT_ITEMS,
  value,
  defaultValue,
  onChange,
  chipColor = "#27272a",
  activeColor = "#f5f5f5",
  textColor = "#f5f5f5",
  activeTextColor = "#18181b",
  size = "md",
  gap = 8,
  radius = 18,
  swell = 0.2,
  barge = 6,
  shrink = 0.05,
  jelly = 1,
  bounce = 0.25,
  stagger = 22,
  stiffness = 580,
  disabled = false,
  ariaLabel = "Options",
  className = "",
}: {
  items?: (string | Item)[];
  value?: string;
  defaultValue?: string;
  onChange?: (value: string, index: number) => void;
  chipColor?: string;
  activeColor?: string;
  textColor?: string;
  activeTextColor?: string;
  size?: "sm" | "md" | "lg";
  gap?: number;
  radius?: number;
  swell?: number;
  barge?: number;
  shrink?: number;
  jelly?: number;
  bounce?: number;
  stagger?: number;
  stiffness?: number;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
}) {
  const list = items.map((item) =>
    typeof item === "string" ? ({ value: item, label: item } as Item) : item,
  );
  const [inner, setInner] = useState(
    () => defaultValue ?? list.find((item) => !item.disabled)?.value,
  );
  const current = value ?? inner;
  const at = list.findIndex((item) => item.value === current);
  const reduce = usePrefersReducedMotion();
  const groupRef = useRef<HTMLDivElement>(null);
  const chipRefs = useRef<(HTMLElement | null)[]>([]);
  const widths = useRef<number[]>([]);
  const mvs = useRef<Values[]>([]);
  const applied = useRef(at);
  const [h, font, px] = SIZES[size];
  const itemsKey = JSON.stringify(
    list.map((item) => [item.value, item.disabled]),
  );
  const navigation = list.some((item) => item.href);
  const count = list.length;

  const apply = useCallback(
    (selected: number, instant: boolean) => {
      const rtl =
        groupRef.current &&
        getComputedStyle(groupRef.current).direction === "rtl";
      const push =
        selected < 0 || reduce
          ? 0
          : ((widths.current[selected] ?? 0) * swell) / 2 + barge;
      for (let i = 0; i < count; i++) {
        const mv = mvs.current[i];
        if (!mv) continue;
        const far = Math.abs(i - selected);
        const dir = selected < 0 ? 0 : Math.sign(i - selected) * (rtl ? -1 : 1);
        const scale =
          selected < 0 || reduce ? 1 : i === selected ? 1 + swell : 1 - shrink;
        if (instant || reduce) {
          mv.x.jump(dir * push);
          mv.sx.jump(scale);
          mv.sy.jump(scale);
          continue;
        }
        const k = stiffness * (1 - 0.12 * Math.min(far, 3));
        const inFlight =
          mv.x.isAnimating() || mv.sx.isAnimating() || mv.sy.isAnimating();
        const delay = inFlight ? 0 : (far * stagger) / 1000;
        animate(mv.x, dir * push, { ...spring(k, 0.9, bounce), delay });
        animate(mv.sx, scale, {
          ...spring(
            k * (1 + 0.24 * jelly),
            0.9 - 0.1 * jelly,
            Math.min(0.85, bounce + 0.3 * jelly),
          ),
          delay,
        });
        animate(mv.sy, scale, {
          ...spring(k * (1 - 0.14 * jelly), 0.9 + 0.05 * jelly, bounce),
          delay: delay + 0.05 * jelly,
        });
      }
    },
    [count, swell, barge, shrink, jelly, bounce, stagger, stiffness, reduce],
  );

  useLayoutEffect(() => {
    const group = groupRef.current;
    if (!group) return;
    let disposed = false;
    const settle = () => {
      if (disposed) return;
      widths.current = chipRefs.current
        .slice(0, count)
        .map((el) => el?.offsetWidth ?? 0);
      const chipH = chipRefs.current[0]?.offsetHeight ?? 0;
      const maxW = Math.max(0, ...widths.current);
      group.style.setProperty(
        "--jr-pad-x",
        `${Math.ceil((maxW * swell * 1.3) / 2 + barge) + 2}px`,
      );
      group.style.setProperty(
        "--jr-pad-y",
        `${Math.ceil((chipH * swell) / 2) + 2}px`,
      );
      apply(applied.current, true);
    };
    settle();
    const observer = new ResizeObserver(settle);
    observer.observe(group);
    document.fonts.ready.then(settle);
    return () => {
      disposed = true;
      observer.disconnect();
    };
  }, [itemsKey, size, gap, swell, barge, count, apply]);

  useEffect(() => {
    if (applied.current === at) return;
    applied.current = at;
    apply(at, true);
  }, [at, apply]);

  const commit = (i: number, instant: boolean) => {
    if (disabled || i === at || !list[i] || list[i].disabled) return;
    applied.current = i;
    apply(i, instant);
    if (value === undefined) setInner(list[i].value);
    onChange?.(list[i].value, i);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLElement>, i: number) => {
    // Navigation links keep native Tab, Enter, modifier-click and browser history behavior.
    if (navigation) return;
    let start = i;
    let dir = 0;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") dir = 1;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") dir = -1;
    else if (event.key === "Home") {
      start = -1;
      dir = 1;
    } else if (event.key === "End") {
      start = count;
      dir = -1;
    } else return;
    event.preventDefault();
    for (let tries = 0; tries < count; tries++) {
      start = (start + dir + count) % count;
      if (!list[start].disabled) {
        commit(start, true);
        chipRefs.current[start]?.focus();
        break;
      }
    }
  };

  return (
    <div
      ref={groupRef}
      role={navigation ? undefined : "radiogroup"}
      aria-label={navigation ? undefined : ariaLabel}
      data-disabled={disabled || undefined}
      className={`jelly-radio ${className}`}
      style={
        {
          "--jr-chip": chipColor,
          "--jr-active": activeColor,
          "--jr-text": textColor,
          "--jr-active-text": activeTextColor,
          "--jr-gap": `${gap}px`,
          "--jr-radius": `${radius}px`,
          "--jr-h": `${h}px`,
          "--jr-font": `var(--jr-font-override, ${font}px)`,
          "--jr-px": `var(--jr-px-override, ${px}px)`,
        } as CSSProperties
      }
    >
      {list.map((item, i) => (
        <Chip
          key={item.value}
          item={{ ...item, disabled: disabled || item.disabled }}
          selected={i === at}
          register={(node, values) => {
            chipRefs.current[i] = node;
            mvs.current[i] = values;
          }}
          commit={(event) => {
            if (disabled || item.disabled) {
              event.preventDefault();
              return;
            }
            if (
              item.href &&
              (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey)
            )
              return;
            commit(i, event.detail === 0);
          }}
          onKeyDown={(event) => onKeyDown(event, i)}
        />
      ))}
    </div>
  );
}
