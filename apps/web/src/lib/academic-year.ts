/** True for a consecutive academic year such as "2026-27". */
export function validAcademicYear(value: string): boolean {
  return (
    /^[0-9]{4}-[0-9]{2}$/.test(value) &&
    Number(value.slice(-2)) === (Number(value.slice(0, 4)) + 1) % 100
  );
}

/** Demo window, with the seeded year 2026-27 first. */
export function academicYearChoices(): string[] {
  return ["2026-27", "2024-25", "2025-26", "2027-28", "2028-29"];
}
