/**
 * @fileoverview **Η ΑΝΑΦΟΡΑ ΑΝΤΙΣΤΟΙΧΙΣΗΣ** — κάθε ζεύγος (νομαρχία, δήμος) που ΔΕΝ δέθηκε με ακριβές όνομα (ADR-889 §4, §5.2).
 * @related ADR-889 · `mama-area-resolver.ts`
 *
 * 🔑 **Η ΑΝΑΦΟΡΑ ΕΙΝΑΙ ΤΟ ΣΗΜΕΙΟ ΕΛΕΓΧΟΥ ΤΟΥ ΑΝΘΡΩΠΟΥ.** Κάθε ανεκτική απόδοση (απόσταση 1, κλίση,
 * κοινότητα, ψευδώνυμο) γράφεται εδώ **ονομαστικά**. Η αναφορά είναι αρχείο στο git και είναι ντετερμινιστική,
 * οπότε μια νέα ανεκτική απόδοση σε επόμενη εκτέλεση εμφανίζεται ως **γραμμή στο diff**, όχι ως σιωπηλή
 * αλλαγή σε έναν αριθμό.
 */

import type { AreaResolution, MamaAreaResolver } from './mama-area-resolver';

export interface PairTally {
  readonly prefecture: string;
  readonly label: string;
  readonly resolution: AreaResolution;
  rows: number;
}

export interface CoverageTotals {
  readonly rows: number;
  readonly resolved: number;
  readonly withheld: number;
  readonly unmatched: number;
  readonly comparable: number;
  readonly areas: number;
}

export function coverageOf(pairs: Iterable<PairTally>, comparable: number, areas: number): CoverageTotals {
  let rows = 0;
  let resolved = 0;
  let withheld = 0;
  for (const pair of pairs) {
    rows += pair.rows;
    if (pair.resolution.kind === 'resolved') resolved += pair.rows;
    if (pair.resolution.kind === 'withheld') withheld += pair.rows;
  }
  return { rows, resolved, withheld, unmatched: rows - resolved - withheld, comparable, areas };
}

function percent(part: number, whole: number): string {
  return whole === 0 ? '—' : `${((part / whole) * 100).toFixed(2)}%`;
}

function byLabel(a: PairTally, b: PairTally): number {
  const left = `${a.prefecture}|${a.label}`;
  const right = `${b.prefecture}|${b.label}`;
  return left < right ? -1 : left > right ? 1 : 0;
}

function tolerantLines(pairs: readonly PairTally[], resolver: MamaAreaResolver): string[] {
  return pairs
    .filter((p) => p.resolution.kind === 'resolved' && p.resolution.via !== 'exact')
    .sort(byLabel)
    .map((p) => {
      const r = p.resolution as Extract<AreaResolution, { kind: 'resolved' }>;
      return `| ${p.prefecture} | ${p.label} | ${r.via} | ${resolver.area(r.areaId).name} (\`${r.areaId}\`) | ${p.rows} |`;
    });
}

function simpleLines(pairs: readonly PairTally[], kind: 'withheld' | 'unmatched'): string[] {
  return pairs
    .filter((p) => p.resolution.kind === kind)
    .sort(byLabel)
    .map((p) => {
      const candidates = p.resolution.kind === 'unmatched' && p.resolution.candidates.length > 0 ? ` (υποψήφιοι: ${p.resolution.candidates.join(', ')})` : '';
      return `| ${p.prefecture} | ${p.label}${candidates} | ${p.rows} |`;
    });
}

function summaryLines(totals: CoverageTotals): string[] {
  const attributable = totals.rows - totals.withheld;
  return [
    '| Μέγεθος | Τιμή |',
    '|---|---|',
    `| Γραμμές | ${totals.rows} |`,
    `| Αποδόθηκαν σε περιοχή | ${totals.resolved} (${percent(totals.resolved, totals.rows)}· ${percent(totals.resolved, attributable)} όσων δεν είναι ανωνυμοποιημένες) |`,
    `| Ανωνυμοποιημένες από την πηγή | ${totals.withheld} |`,
    `| Χωρίς απόδοση | ${totals.unmatched} |`,
    `| Συγκρίσιμες (μπαίνουν στα στατιστικά) | ${totals.comparable} |`,
    `| Περιοχές με αρχείο | ${totals.areas} |`,
  ];
}

/** Η αναφορά σε Markdown. Καμία χρονοσφραγίδα εκτέλεσης: το παράθυρο ετών την ορίζει. */
export function renderMatchReport(
  window: { from: number; to: number },
  pairs: readonly PairTally[],
  totals: CoverageTotals,
  resolver: MamaAreaResolver,
): string {
  return [
    `# ADR-889 — Αναφορά αντιστοίχισης περιοχών ΜΑΜΑ (${window.from}–${window.to})`,
    '',
    '> Παραγόμενο από `npm run build:market-transactions`. **Μην το επεξεργαστείς με το χέρι.**',
    '',
    ...summaryLines(totals),
    '',
    '## Ανεκτικές αποδόσεις (έλεγξέ τες)',
    '',
    '| Νομαρχία | Δήμος (πηγή) | Τρόπος | Περιοχή | Γραμμές |',
    '|---|---|---|---|---|',
    ...tolerantLines(pairs, resolver),
    '',
    '## Χωρίς απόδοση',
    '',
    '| Νομαρχία | Δήμος (πηγή) | Γραμμές |',
    '|---|---|---|',
    ...simpleLines(pairs, 'unmatched'),
    '',
    '## Ανωνυμοποιημένες (η πηγή έγραψε τη νομαρχία στη θέση του δήμου)',
    '',
    '| Νομαρχία | Δήμος (πηγή) | Γραμμές |',
    '|---|---|---|',
    ...simpleLines(pairs, 'withheld'),
    '',
  ].join('\n');
}
