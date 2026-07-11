/**
 * 🏢 ENTERPRISE: DXF import diagnostics (ADR-635 Φ3)
 *
 * Revit-style "Import Warnings" SSoT. A professional CAD importer (Revit / Cinema 4D / Figma)
 * NEVER aborts a whole import because of one bad entity — it imports what it can and REPORTS
 * what it couldn't. This collector accumulates:
 *   - parsedByType  : entities successfully converted, per DXF type
 *   - skippedByType : unsupported entities the converter dropped, per DXF type (was silent)
 *   - errors        : per-entity failures caught by the fault-tolerant loop (import continues)
 *   - clamps        : expansion bounds hit (MINSERT array / nested-block budget)
 *
 * ONE collector shape, shared by buildScene (core), runDxfParse (wrapper) and the server
 * floorplan route — no twin. Detail lists are capped (counts stay exact) so a pathological
 * file cannot balloon memory; `truncated` records that a cap was hit (no silent truncation).
 *
 * @see dxf-scene-builder.ts   - fills it during the fault-tolerant entity loop
 * @see dxf-block-expander.ts  - records MINSERT/budget clamps
 * @see run-dxf-parse.ts       - threads it into DxfImportResult.warnings
 */

/** A single import issue (skipped/failed entity or an expansion clamp). */
export interface ImportIssue {
  /** DXF entity type or subsystem (e.g. 'LINE', 'INSERT', 'MINSERT'). */
  readonly kind: string;
  /** Human-readable, technical reason (not a localized UI label). */
  readonly reason: string;
  /** Optional locator — block name, entity index, etc. */
  readonly at?: string;
}

/** Accumulated import diagnostics for one buildScene run. */
export interface ImportDiagnostics {
  parsedByType: Record<string, number>;
  skippedByType: Record<string, number>;
  errors: ImportIssue[];
  clamps: ImportIssue[];
  /** True when a detail list hit its cap — counts stay exact, detail is partial. */
  truncated: boolean;
}

/** Detail-list cap. Counts (parsedByType/skippedByType) are never capped. */
const MAX_ISSUE_LIST = 200;

export function createImportDiagnostics(): ImportDiagnostics {
  return { parsedByType: {}, skippedByType: {}, errors: [], clamps: [], truncated: false };
}

export function recordParsed(d: ImportDiagnostics, type: string): void {
  const key = type || 'UNKNOWN';
  d.parsedByType[key] = (d.parsedByType[key] ?? 0) + 1;
}

export function recordSkipped(d: ImportDiagnostics, type: string): void {
  const key = type || 'UNKNOWN';
  d.skippedByType[key] = (d.skippedByType[key] ?? 0) + 1;
}

export function recordError(d: ImportDiagnostics, issue: ImportIssue): void {
  if (d.errors.length < MAX_ISSUE_LIST) d.errors.push(issue);
  else d.truncated = true;
}

export function recordClamp(d: ImportDiagnostics, issue: ImportIssue): void {
  if (d.clamps.length < MAX_ISSUE_LIST) d.clamps.push(issue);
  else d.truncated = true;
}

function sumValues(counts: Record<string, number>): number {
  let total = 0;
  for (const key in counts) total += counts[key];
  return total;
}

export function totalParsed(d: ImportDiagnostics): number {
  return sumValues(d.parsedByType);
}

export function totalSkipped(d: ImportDiagnostics): number {
  return sumValues(d.skippedByType);
}

/** True when the import was fully clean (nothing skipped, no errors, no clamps). */
export function isClean(d: ImportDiagnostics): boolean {
  return d.errors.length === 0 && d.clamps.length === 0 && totalSkipped(d) === 0;
}

/**
 * Technical, single-line summaries of the notable outcomes — for logs, the server API
 * `details` field, and the DxfImportResult.warnings channel. NOT localized UI labels
 * (the UI builds its own message from the structured counts). Returns [] when clean.
 */
export function summarizeDiagnostics(d: ImportDiagnostics): string[] {
  const lines: string[] = [];

  const skipped = totalSkipped(d);
  if (skipped > 0) {
    const byType = Object.entries(d.skippedByType)
      .sort((a, b) => b[1] - a[1])
      .map(([type, n]) => `${type}×${n}`)
      .join(', ');
    lines.push(`Skipped ${skipped} unsupported entit${skipped === 1 ? 'y' : 'ies'} (${byType})`);
  }

  if (d.errors.length > 0) {
    const sample = d.errors[0];
    lines.push(
      `${d.errors.length} entit${d.errors.length === 1 ? 'y' : 'ies'} failed to convert` +
        ` (e.g. ${sample.kind}${sample.at ? ` ${sample.at}` : ''}: ${sample.reason})`,
    );
  }

  for (const clamp of d.clamps) {
    lines.push(`Expansion limited: ${clamp.kind}${clamp.at ? ` ${clamp.at}` : ''} — ${clamp.reason}`);
  }

  if (d.truncated) {
    lines.push('Diagnostic detail truncated (too many issues); counts above are exact.');
  }

  return lines;
}
