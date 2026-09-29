/**
 * @fileoverview **Η ΑΝΑΓΝΩΣΙΜΗ ΑΝΑΦΟΡΑ ΑΛΛΑΓΩΝ** — το σώμα του PR της αυτόματης ανανέωσης (ADR-889 §11, απόφαση 3).
 * @related `refresh-diff.ts` · `refresh-gates.ts` · `.github/workflows/market-data-refresh.yml` (`gh pr … --body-file`)
 *
 * 🔑 Ο άνθρωπος που πατά «merge» πρέπει να ξέρει **τι** δέχεται χωρίς να ανοίξει 2.500 JSON: ποια έκδοση της πηγής,
 * ποιες πύλες πέρασαν, ποιες περιοχές κινήθηκαν και πόσο. Κανένα portal (Zillow, Rightmove, Idealista) δεν δημοσιεύει
 * τέτοιο changelog δεδομένων· εδώ είναι η πύλη του merge.
 *
 * **Ντετερμινιστική**: καμία ώρα, ταξινομημένοι πίνακες ⇒ ίδια αναφορά για ίδια δεδομένα (και το PR δεν «αλλάζει»
 * χωρίς λόγο σε κάθε εκτέλεση).
 */

import { OPEN_DATA_SOURCES } from '../../../src/config/open-data-sources';
import type { MedianMove, MarketDiff, ZoneDiff, ZonePriceChange } from './refresh-diff';
import { REFRESH_THRESHOLDS, allGatesPass, type GateResult } from './refresh-gates';
import type { ProbeDecision } from './refresh-probe';

export interface RefreshReportInput {
  readonly market: { readonly probe: ProbeDecision; readonly diff: MarketDiff | null };
  readonly zones: { readonly probe: ProbeDecision; readonly diff: ZoneDiff | null };
  readonly gates: readonly GateResult[];
}

const TOP = 10;
const nf = new Intl.NumberFormat('el-GR');
const num = (value: number | null): string => (value === null ? '—' : nf.format(value));
const signedPct = (ratio: number): string => `${ratio >= 1 ? '+' : ''}${((ratio - 1) * 100).toFixed(1)}%`;
const shortSha = (sha: string | undefined): string => (sha === undefined ? '—' : `\`${sha.slice(0, 12)}\``);

function gateTable(gates: readonly GateResult[]): string[] {
  const rows = gates.map((g) => `| ${g.ok ? (g.overridden ? '⚠️' : '✅') : '❌'} | ${g.id} | ${g.title} | ${g.detail}${g.overridden ? ' — **παράκαμψη με ανθρώπινη απόφαση** (`accept_drop`)' : ''} |`);
  return ['## Πύλες', '', '| | # | Πύλη | Αποτέλεσμα |', '|---|---|---|---|', ...rows, ''];
}

function sourceTable(diff: MarketDiff): string[] {
  const rows = diff.years.map((y) => {
    const changed = y.before?.sha256 !== y.after?.sha256;
    return `| ${y.year} | ${y.before?.lastModified ?? '—'} → ${y.after?.lastModified ?? '—'} | ${num(y.before?.rows ?? null)} → ${num(y.after?.rows ?? null)} | ${shortSha(y.after?.sha256)}${changed ? ' 🆕' : ''} |`;
  });
  return ['| Έτος | Last-Modified | Γραμμές | sha256 |', '|---|---|---|---|', ...rows, ''];
}

function moveRows(moves: readonly MedianMove[]): string[] {
  return moves.map((m) => `| \`${m.areaId}\` | ${m.segment} | ${num(m.before)} → ${num(m.after)} | **${signedPct(m.ratio)}** | ${m.nBefore} → ${m.nAfter} |`);
}

function movesSection(diff: MarketDiff): string[] {
  const floor = REFRESH_THRESHOLDS.massShiftMinSample;
  const solid = diff.moves.filter((m) => Math.min(m.nBefore, m.nAfter) >= floor && m.ratio !== 1);
  const byRatio = [...solid].sort((a, b) => b.ratio - a.ratio || (a.areaId < b.areaId ? -1 : 1));
  const header = ['| Περιοχή | Τμήμα | Διάμεσος 12μήνου | Μεταβολή | n |', '|---|---|---|---|---|'];
  const up = byRatio.filter((m) => m.ratio > 1).slice(0, TOP);
  const down = byRatio.filter((m) => m.ratio < 1).reverse().slice(0, TOP);
  return [
    `Κελιά (περιοχή × τμήμα) με διάμεσο πριν **και** μετά: **${num(diff.moves.length)}** · άλλαξαν: **${num(diff.moves.filter((m) => m.ratio !== 1).length)}**` +
      ` · εμφανίστηκαν ${num(diff.cellsAppeared.length)} · χάθηκαν ${num(diff.cellsDisappeared.length)} (κατώφλι εμφάνισης, ADR-889 §5.4).`,
    '',
    `### Μεγαλύτερες άνοδοι (n ≥ ${floor})`, '', ...(up.length === 0 ? ['—'] : [...header, ...moveRows(up)]), '',
    `### Μεγαλύτερες κάθοδοι (n ≥ ${floor})`, '', ...(down.length === 0 ? ['—'] : [...header, ...moveRows(down)]), '',
  ];
}

function marketSection(input: RefreshReportInput['market']): string[] {
  const head = ['## Συμβόλαια (ΜΑΜΑ)', ''];
  if (input.diff === null) return [...head, `Χωρίς αλλαγή στην πηγή — δεν ξαναπαράχθηκαν.`, ''];
  const d = input.diff;
  return [
    ...head,
    ...input.probe.reasons.map((reason) => `- ${reason}`), '',
    `Τελευταίο συμβόλαιο της πηγής (\`asOf\`): **${d.asOf.before ?? '—'} → ${d.asOf.after}** · περιοχές: ${num(d.areaCount.before)} → ${num(d.areaCount.after)}`, '',
    ...sourceTable(d),
    ...movesSection(d),
  ];
}

function zoneRows(changes: readonly ZonePriceChange[]): string[] {
  const top = [...changes].sort((a, b) => Math.abs(b.after - b.before) - Math.abs(a.after - a.before) || (a.key < b.key ? -1 : 1)).slice(0, TOP);
  return top.map((c) => `| \`${c.key}\` | ${num(c.before)} → ${num(c.after)} €/m² | ${signedPct(c.after / c.before)} |`);
}

function zonesSection(input: RefreshReportInput['zones']): string[] {
  const head = ['## Ζώνες αντικειμενικών αξιών', ''];
  if (input.diff === null) return [...head, 'Χωρίς αλλαγή στην πηγή — δεν ξαναπαράχθηκαν.', ''];
  const d = input.diff;
  return [
    ...head,
    ...input.probe.reasons.map((reason) => `- ${reason}`), '',
    `Ζώνες + μέτωπα: ${num(d.zoneCount.before)} → ${num(d.zoneCount.after)} · περιοχές: ${num(d.areaCount.before)} → ${num(d.areaCount.after)}` +
      ` · νέα τιμή: **${num(d.priceChanges.length)}** · νέες ${num(d.added)} · καταργημένες ${num(d.removed)}`,
    d.newValidFrom.length === 0 ? '' : `\n🆕 Νέες ημερομηνίες έναρξης ισχύος (**αναπροσαρμογή**): ${d.newValidFrom.join(', ')}`,
    '',
    ...(d.priceChanges.length === 0 ? [] : ['| Ζώνη (περιοχή\\|id\\|γράμμα) | Τιμή | Μεταβολή |', '|---|---|---|', ...zoneRows(d.priceChanges), '']),
  ];
}

function attribution(): string[] {
  const { transferValues, valueZones } = OPEN_DATA_SOURCES;
  return [
    '---',
    `Πηγές: ΥΠΕΘΟΟ — [Μητρώο Αξιών Μεταβιβάσεων Ακινήτων](${transferValues.datasetUrl}) · [Ζώνες αντικειμενικών αξιών](${valueZones.datasetUrl})` +
      ` — άδεια [${transferValues.license.spdx}](${transferValues.license.url}). Επεξεργασία: ADR-889 §5.3 · §4 · §10.`,
    '',
    '⚠️ Αυτό το PR το άνοιξε η αυτόματη ανανέωση (ADR-889 §11). **Δεν** συγχωνεύεται αυτόματα: το merge στο `main` = ανάπτυξη στο nestorconstruct.gr.',
  ];
}

/** Όλη η αναφορά, Markdown. */
export function renderRefreshReport(input: RefreshReportInput): string {
  const verdict = allGatesPass(input.gates) ? '✅ Όλες οι πύλες πέρασαν' : '❌ Πύλη απέτυχε — **κανένα PR**';
  return [
    '# Ανανέωση δεδομένων αγοράς (ADR-889 Φ4)',
    '',
    verdict,
    '',
    ...gateTable(input.gates),
    ...marketSection(input.market),
    ...zonesSection(input.zones),
    ...attribution(),
    '',
  ].join('\n');
}
