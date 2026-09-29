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
import { REFRESH_THRESHOLDS, allGatesPass, prGatesPass, type GateResult } from './refresh-gates';
import { SOURCE_IDS, SOURCE_LABELS, SOURCE_RESTRICTIONS, accessOf, classifyAccess, type SourceAccess, type SourceCheck, type SourceId } from './refresh-probe';

interface DatasetReport<D> {
  readonly check: SourceCheck;
  readonly diff: D | null;
}

export interface RefreshReportInput {
  readonly market: DatasetReport<MarketDiff>;
  readonly zones: DatasetReport<ZoneDiff>;
  readonly gates: readonly GateResult[];
}

const TOP = 10;

/** Η γραμμή πρόσβασης μιας πηγής (ADR-889 §11.11) — `null` όταν δεν υπάρχει τίποτα να πει. */
export function accessLine(id: SourceId, check: SourceCheck): string | null {
  const restriction = SOURCE_RESTRICTIONS[id];
  const reason = check.reachable ? '' : check.reason;
  switch (classifyAccess(check, restriction)) {
    case 'ok':
      return null;
    case 'unexpected':
      return `🔴 **Απρόσιτη πηγή** — ${reason}. Το run είναι **κόκκινο** γι’ αυτό (ADR-889 §11.10).`;
    case 'expected-restriction':
      return `⚠️ **Γνωστός περιορισμός πρόσβασης** (γεωφραγή, μόνο από ${restriction?.allowedRegion}: ${restriction?.evidence}) — ${reason}. ` +
        `Ανανέωση από ελληνική IP: runbook ADR-889 §11.8· το κόκκινο «πάλιωσαν» το δίνει η πύλη Ε8.`;
    case 'restriction-lifted':
      return `⚠️ **Η πηγή απάντησε, παρότι δηλωμένη ως περιορισμένη** (${restriction?.adr}). Αν αυτό το run τρέχει **εκτός** ${restriction?.allowedRegion}, ο περιορισμός δεν ισχύει πια — αφαίρεσε τη δήλωση.`;
  }
}

/**
 * Η κοινή αρχή κάθε ενότητας πηγής: η γραμμή πρόσβασης (αν υπάρχει)· απρόσιτη ή αμετάβλητη ⇒ μία γραμμή·
 * αλλιώς οι λόγοι της αλλαγής και η διαφορά (η ενότητα συνεχίζει με αυτήν).
 */
function sourceHead<D>(id: SourceId, input: DatasetReport<D>): { lines: string[]; diff: D | null } {
  const access = accessLine(id, input.check);
  const lines = [`## ${SOURCE_LABELS[id]}`, '', ...(access === null ? [] : [access, ''])];
  const { check } = input;
  if (!check.reachable) return { lines: [...lines, 'Δεν ξαναπαράχθηκαν· τα αρχεία του `main` μένουν ως έχουν.', ''], diff: null };
  if (input.diff === null) return { lines: [...lines, 'Χωρίς αλλαγή στην πηγή — δεν ξαναπαράχθηκαν.', ''], diff: null };
  return { lines: [...lines, ...check.decision.reasons.map((reason) => `- ${reason}`), ''], diff: input.diff };
}

const nf = new Intl.NumberFormat('el-GR');
const num = (value: number | null): string => (value === null ? '—' : nf.format(value));
const signedPct = (ratio: number): string => `${ratio >= 1 ? '+' : ''}${((ratio - 1) * 100).toFixed(1)}%`;
const shortSha = (sha: string | undefined): string => (sha === undefined ? '—' : `\`${sha.slice(0, 12)}\``);

function gateTable(gates: readonly GateResult[]): string[] {
  const rows = gates.map((g) => `| ${g.ok ? (g.overridden || g.warning ? '⚠️' : '✅') : '❌'} | ${g.id} | ${g.title} | ${g.detail}${g.overridden ? ' — **παράκαμψη με ανθρώπινη απόφαση** (`accept_drop`)' : ''} |`);
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
  const { lines, diff: d } = sourceHead('market', input);
  if (d === null) return lines;
  return [
    ...lines,
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
  const { lines, diff: d } = sourceHead('zones', input);
  if (d === null) return lines;
  return [
    ...lines,
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

/**
 * Πύλη που απέτυχε ⇒ κανένα PR. Αδήλωτα απρόσιτη πηγή ⇒ 🔴 πρώτη γραμμή (οι **άλλες** πηγές προχωρούν). Δηλωμένος
 * περιορισμός ⇒ ⚠️ πρώτη γραμμή, όχι κόκκινο (ADR-889 §11.11).
 */
function verdictLines(input: RefreshReportInput): string[] {
  const access = accessOf({ market: input.market.check, zones: input.zones.check });
  const named = (kinds: readonly SourceAccess[]): string => SOURCE_IDS.filter((id) => kinds.includes(access[id])).map((id) => SOURCE_LABELS[id]).join(', ');
  const lines: string[] = [];
  const red = named(['unexpected']);
  const known = named(['expected-restriction', 'restriction-lifted']);
  if (red !== '') lines.push(`🔴 **Απρόσιτη πηγή**: ${red} — το run είναι κόκκινο`, '');
  if (known !== '') lines.push(`⚠️ **Δηλωμένος περιορισμός πρόσβασης**: ${known} — δες την ενότητα της πηγής`, '');
  if (!prGatesPass(input.gates)) lines.push('❌ Πύλη απέτυχε — **κανένα PR**');
  else if (!allGatesPass(input.gates)) lines.push('❌ Τα δεδομένα του `main` είναι **μπαγιάτικα** (Ε8) — το run είναι κόκκινο');
  else lines.push('✅ Όλες οι πύλες πέρασαν');
  return lines;
}

/** Όλη η αναφορά, Markdown. */
export function renderRefreshReport(input: RefreshReportInput): string {
  return [
    '# Ανανέωση δεδομένων αγοράς (ADR-889 Φ4)',
    '',
    ...verdictLines(input),
    '',
    ...gateTable(input.gates),
    ...marketSection(input.market),
    ...zonesSection(input.zones),
    ...attribution(),
    '',
  ].join('\n');
}
