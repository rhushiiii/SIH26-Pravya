/** Minimal RFC4180-style CSV parser matching Python's csv module quoting
 * (quotes doubled inside quoted fields), used only to preview a report this
 * app itself generated via /reports/{kind}?format=csv. */
function parseRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let index = 0;
  const push = () => {
    row.push(field);
    field = "";
  };
  const endRow = () => {
    push();
    rows.push(row);
    row = [];
  };
  while (index < text.length) {
    const char = text[index];
    if (inQuotes) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 2;
          continue;
        }
        inQuotes = false;
        index += 1;
        continue;
      }
      field += char;
      index += 1;
      continue;
    }
    if (char === '"') {
      inQuotes = true;
      index += 1;
      continue;
    }
    if (char === ",") {
      push();
      index += 1;
      continue;
    }
    if (char === "\r") {
      index += 1;
      continue;
    }
    if (char === "\n") {
      endRow();
      index += 1;
      continue;
    }
    field += char;
    index += 1;
  }
  if (field !== "" || row.length > 0) endRow();
  return rows.filter((r) => !(r.length === 1 && r[0] === ""));
}

export type ReportTable = {
  title: string;
  columns: string[];
  rows: string[][];
};
export type ParsedReport = {
  metadata: [string, string][];
  tables: ReportTable[];
};

/** Mirrors services/api/app/modules/reports/renderers.py's CSV layout:
 * leading "# key,value" metadata rows, then per table a "# title" row, a
 * header row, data rows, and a blank line between tables. */
export function parseReportCsv(text: string): ParsedReport {
  const rows = parseRows(text);
  const metadata: [string, string][] = [];
  const tables: ReportTable[] = [];
  let index = 0;
  while (index < rows.length) {
    const row = rows[index];
    index += 1;
    if (!row || row.length === 0 || (row.length === 1 && row[0] === ""))
      continue;
    if (!row[0].startsWith("# ")) continue;
    if (row.length === 2) {
      metadata.push([row[0].slice(2), row[1]]);
      continue;
    }
    const title = row[0].slice(2);
    const columns = rows[index] ?? [];
    index += 1;
    const body: string[][] = [];
    while (index < rows.length && rows[index] && rows[index].length > 0) {
      body.push(rows[index]);
      index += 1;
    }
    tables.push({ title, columns, rows: body });
  }
  return { metadata, tables };
}
