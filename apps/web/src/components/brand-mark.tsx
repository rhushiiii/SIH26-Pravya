import { useId } from "react";

export function BrandMark({
  tagline,
  mark = "letter",
}: {
  tagline?: string;
  mark?: "letter" | "lightning";
}) {
  const glassId = `lightning-glass-${useId().replaceAll(":", "")}`;
  return (
    <span className="brand">
      <span
        className={`brand-mark${mark === "lightning" ? " brand-mark-lightning" : ""}`}
        aria-hidden="true"
      >
        {mark === "lightning" ? (
          <svg
            viewBox="0 0 36 46"
            width="36"
            height="46"
            fill="none"
            focusable="false"
          >
            <defs>
              <linearGradient
                id={glassId}
                x1="6"
                y1="4"
                x2="31"
                y2="42"
                gradientUnits="userSpaceOnUse"
              >
                <stop stopColor="#ffffff" stopOpacity="0.98" />
                <stop offset="0.38" stopColor="#fff2e8" stopOpacity="0.42" />
                <stop offset="0.56" stopColor="#ffffff" stopOpacity="0.9" />
                <stop offset="1" stopColor="#e9ae89" stopOpacity="0.45" />
              </linearGradient>
            </defs>
            <path
              d="M22 2 4 25h12l-5 19 21-27H20l2-15Z"
              fill={`url(#${glassId})`}
              stroke="var(--ui-accent-hover)"
              strokeOpacity="0.68"
              strokeWidth="1.25"
              strokeLinejoin="round"
            />
            <path
              d="M21 4 6 24h12l-5 17 17-23H19l2-14Z"
              stroke="#ffffff"
              strokeOpacity="0.9"
              strokeWidth="1.1"
              strokeLinejoin="round"
            />
            <path
              d="m12 42 19-24M5 25h10"
              stroke="var(--ui-accent-action)"
              strokeOpacity="0.6"
              strokeWidth="0.8"
              strokeLinecap="round"
            />
          </svg>
        ) : (
          "P"
        )}
      </span>
      <span className="brand-name">
        PRAVYA
        {tagline && <small>{tagline}</small>}
      </span>
    </span>
  );
}
