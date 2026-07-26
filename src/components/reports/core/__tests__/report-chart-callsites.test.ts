/**
 * ADR-710 Φάση Γ, Βήμα 4 — the gate that keeps the colour decision out of the call sites.
 *
 * ## Why a scan and not a review note
 *
 * Before this migration, 30 of the 34 charts in this domain wrote
 * `'hsl(var(--report-chart-N))'` and chose N by hand. Two energy classes were handed the
 * same slot and became indistinguishable; three other charts colored by row position, so
 * a category dropping to zero repainted the ones below it. None of that could fail:
 * every render was individually correct.
 *
 * The palette itself has been gated since ADR-710 §10.5 (CHECK 3.32). That gate proves
 * the eight steps are separable; it says nothing about whether a chart uses two of them
 * for one meaning. This file gates the **use**.
 *
 * ## What it asserts, and the canary that guards it
 *
 * A file that renders `<ReportChart>` must not name a palette slot, and must hand the
 * shell the two things that cannot be defaulted without lying to the reader — a
 * translated category label and a value formatter. `"building"` as a column header and
 * `1234.5678` as a cell are what "sensible defaults" look like here.
 *
 * The list of files is derived from the tree, never hand-written, so a 35th chart is
 * covered the day it is added. That is also the failure mode this repo has paid for
 * twice — a scan reporting "clean" because its file list was silently empty — so the
 * first assertion is that the scan found the charts at all.
 *
 * Scope is deliberately the `<ReportChart>` call sites and not the whole folder:
 * `ReportFunnel`, `ReportSparkline` and `sections/cash-flow` still draw their own
 * recharts compositions and are Φάση Δ. Widening the glob now would block work that has
 * not been done yet, which turns a gate into an obstacle.
 *
 * @see ADR-710 §11.6 — colour follows the declared category, never the row rank
 * @see ADR-710 §10.5 — CHECK 3.32, the gate on the palette itself
 */

import * as fs from 'fs';
import * as path from 'path';

const REPORTS_ROOT = path.join(process.cwd(), 'src', 'components', 'reports');

/** A hand-picked step of the categorical palette, in either spelling. */
const PALETTE_SLOT = /--(?:report-)?chart-\d/;

/** How many charts this domain had when the gate was written (ADR-710 §3.1). */
const KNOWN_CALL_SITE_COUNT = 34;

function collectTsx(dir: string, found: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== '__tests__') collectTsx(full, found);
    } else if (entry.name.endsWith('.tsx')) {
      found.push(full);
    }
  }
  return found;
}

interface CallSite {
  readonly file: string;
  readonly source: string;
}

const callSites: CallSite[] = collectTsx(REPORTS_ROOT)
  .map((file) => ({ file: path.relative(REPORTS_ROOT, file), source: fs.readFileSync(file, 'utf8') }))
  .filter((entry) => entry.source.includes('<ReportChart'));

describe('ADR-710 Βήμα 4 — the reports charts do not choose colours', () => {
  it('finds the charts at all — an empty scan is a broken gate, not a clean one', () => {
    expect(callSites.length).toBeGreaterThanOrEqual(KNOWN_CALL_SITE_COUNT);
  });

  it('names no palette slot in any chart', () => {
    const offenders = callSites
      .filter((entry) =>
        entry.source
          .split('\n')
          .some((line) => PALETTE_SLOT.test(line) && !line.trimStart().startsWith('*')),
      )
      .map((entry) => entry.file);

    expect(offenders).toEqual([]);
  });

  it('declares a translated category label on every chart, never a silent default', () => {
    const offenders = callSites
      .filter((entry) => !entry.source.includes('categoryLabel={t('))
      .map((entry) => entry.file);

    expect(offenders).toEqual([]);
  });

  it('declares a value formatter on every chart, so no raw float reaches a reader', () => {
    const offenders = callSites
      .filter((entry) => !entry.source.includes('formatValue='))
      .map((entry) => entry.file);

    expect(offenders).toEqual([]);
  });
});
