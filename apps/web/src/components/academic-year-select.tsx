"use client";

import { academicYearChoices } from "@/lib/academic-year";

export function AcademicYearSelect({
  value,
  onChange,
  allowEmpty = false,
  emptyLabel = "Select academic year",
  describedBy,
}: {
  value: string;
  onChange: (value: string) => void;
  allowEmpty?: boolean;
  emptyLabel?: string;
  describedBy?: string;
}) {
  const years = academicYearChoices();
  const extra = value !== "" && !years.includes(value) ? value : null;
  return (
    <select
      value={value}
      aria-describedby={describedBy}
      onChange={(event) => onChange(event.target.value)}
    >
      {(allowEmpty || value === "") && <option value="">{emptyLabel}</option>}
      {extra && <option value={extra}>{extra}</option>}
      {years.map((year) => (
        <option key={year} value={year}>
          {year}
        </option>
      ))}
    </select>
  );
}
