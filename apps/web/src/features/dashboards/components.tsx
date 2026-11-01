import { motion } from "framer-motion";
import { usePrefersReducedMotion as useReducedMotion } from "@/components/fx/use-fx";

export { valueObject, countValue, displayCount } from "@/lib/format";

import { categoryLabel } from "@/features/intake/shared";

export const prettyLabel = categoryLabel;

export function MetricCard({
  label,
  value,
  note,
}: {
  label: string;
  value: string | number;
  note: string;
}) {
  return (
    <article className="dashboard-metric">
      <span>{label}</span>
      <strong>
        {typeof value === "number" ? value.toLocaleString() : value}
      </strong>
      <small>{note}</small>
    </article>
  );
}

export function CategoryBars({
  categories,
  emptyLabel = "No current declared records to chart.",
}: {
  categories: Array<{ label: string; value: number | null }>;
  emptyLabel?: string;
}) {
  const max = Math.max(0, ...categories.map((item) => item.value ?? 0));
  if (categories.length === 0) {
    return <p className="chart-empty">{emptyLabel}</p>;
  }
  return (
    <div
      className="category-bars"
      aria-label="Current declared records by category"
    >
      {categories.map((item) => {
        const value = item.value;
        const width = max > 0 && value !== null ? (value / max) * 100 : 0;
        return (
          <div className="category-bar-row" key={item.label}>
            <span>{item.label}</span>
            <div
              className="category-bar-track"
              role="img"
              aria-label={`${item.label}: ${value === null ? "unavailable classification" : value.toLocaleString()}`}
            >
              <span style={{ width: `${width}%` }} />
            </div>
            <strong>{value === null ? "—" : value.toLocaleString()}</strong>
          </div>
        );
      })}
    </div>
  );
}

const statusTone: Record<string, string> = {
  ACTIVE: "#536239",
  INACTIVE: "#926c30",
  UNSUPPORTED: "#9a978c",
};
const donutPalette = ["#d95720", "#3976a8", "#b77a2f", "#765b9b", "#858078"];

export function StatusDonut({
  statuses,
  total,
}: {
  statuses: Array<{ label: string; value: number }>;
  total: number;
}) {
  const reduceMotion = useReducedMotion();
  const nonZero = statuses.filter((item) => item.value > 0);
  if (total <= 0 || nonZero.length === 0)
    return <p className="chart-empty">No current records to chart.</p>;
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const lengths = nonZero.map((item) => (item.value / total) * circumference);
  const offsets = lengths.map((_, index) =>
    lengths.slice(0, index).reduce((sum, value) => sum + value, 0),
  );
  const segments = nonZero.map((item, index) => ({
    ...item,
    length: lengths[index],
    offset: offsets[index],
    color:
      statusTone[item.label.toUpperCase()] ??
      donutPalette[index % donutPalette.length],
  }));
  // Segments draw in once when the chart scrolls into view; reduced motion
  // renders the finished donut immediately (no draw animation).
  return (
    <div className="status-donut">
      <svg
        viewBox="0 0 140 140"
        width="140"
        height="140"
        role="img"
        aria-label="Current records by status"
      >
        <circle
          cx="70"
          cy="70"
          r={radius}
          fill="none"
          stroke="#eceae3"
          strokeWidth="16"
        />
        {segments.map((segment, index) => (
          <motion.circle
            key={segment.label}
            cx="70"
            cy="70"
            r={radius}
            fill="none"
            stroke={segment.color}
            strokeWidth="16"
            strokeDasharray={`${segment.length} ${circumference - segment.length}`}
            initial={
              reduceMotion
                ? false
                : { strokeDashoffset: circumference, opacity: 0 }
            }
            whileInView={
              reduceMotion
                ? undefined
                : {
                    strokeDashoffset: circumference - segment.offset,
                    opacity: 1,
                  }
            }
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.7, ease: "easeOut", delay: index * 0.08 }}
            transform="rotate(-90 70 70)"
            strokeLinecap="butt"
          />
        ))}
        <text x="70" y="66" textAnchor="middle" className="status-donut-total">
          {total.toLocaleString()}
        </text>
        <text x="70" y="82" textAnchor="middle" className="status-donut-label">
          records
        </text>
      </svg>
      <ul className="status-donut-legend">
        {segments.map((segment) => (
          <li key={segment.label}>
            <span style={{ background: segment.color }} aria-hidden="true" />
            {prettyLabel(segment.label)} · {segment.value.toLocaleString()}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CoverageBadge({ status }: { status: string }) {
  const tone =
    status === "COMPLETE"
      ? "active"
      : status === "PARTIAL"
        ? "warning"
        : "neutral";
  const text = status === "NONE" ? "No declarations" : prettyLabel(status);
  return <span className={`status-badge ${tone}`}>{text}</span>;
}

export function DashboardFilters({
  year,
  setYear,
  onApply,
  children,
}: {
  year: string;
  setYear: (value: string) => void;
  onApply: () => void;
  children?: React.ReactNode;
}) {
  return (
    <form
      className="dashboard-filters"
      onSubmit={(event) => {
        event.preventDefault();
        onApply();
      }}
    >
      <label>
        Academic year
        <input
          value={year}
          onChange={(event) => setYear(event.target.value)}
          aria-label="Academic year"
          placeholder="2026-27"
          inputMode="numeric"
          pattern="[0-9]{4}-[0-9]{2}"
        />
      </label>
      {children}
      <button className="button secondary" type="submit">
        Apply filters
      </button>
    </form>
  );
}

export function DashboardTable({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`table-scroll dashboard-table${className ? ` ${className}` : ""}`}
      role="region"
      tabIndex={0}
      aria-label={label}
    >
      <table>{children}</table>
    </div>
  );
}
