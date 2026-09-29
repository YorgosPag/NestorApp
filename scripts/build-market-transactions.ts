/**
 * @fileoverview **Ο ΓΕΝΝΗΤΟΡΑΣ ΤΙΜΩΝ ΣΥΜΒΟΛΑΙΩΝ** — αρχεία ΜΑΜΑ → στατιστικά + γραμμές ανά περιοχή Καλλικράτη (ADR-889 Φ1–Φ2).
 * @related ADR-889 · ADR-883 (ίδιο σχήμα: στατικό αρχείο ανά οντότητα) · `scripts/lib/market-transactions/*`
 *
 * ```
 * gsis.gr .xlsx (ανά έτος)  →  cache + Last-Modified + sha256        (mama-download)
 *                           →  κεφαλίδα κατά θέση ΚΑΙ όνομα            (mama-source)
 *                           →  (νομαρχία, δήμος) → Δ.Ε. / δήμος       (mama-area-resolver)
 *                           →  τμήμα + συγκρίσιμη τιμή μονάδας         (mama-vocabulary · market-statistics)
 *                           →  public/data/market-transactions/{summary,rows}/<id>.json + index.json
 *                              (Δ.Ε. ΚΑΙ ο Δήμος τους, αθροισμένος — η αναγωγή της οθόνης, ADR-890 §10.4)
 *                           →  docs/…/reports/adr-889-area-match.md   (ό,τι ΔΕΝ δέθηκε ακριβώς)
 * ```
 *
 * **Εκτέλεση**: `npm run build:market-transactions` · επιλογές `--from=2022 --to=2026 --refresh`
 * (χωρίς `--to`: το τελευταίο **δημοσιευμένο** έτος — `resolveMamaWindow`, ADR-889 §11)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔑 Η Φ2 ΔΗΜΟΣΙΕΥΕΙ — ΜΕ ΑΔΕΙΑ CC-BY 4.0 (ADR-889 §2.1, απάντηση ΥΠΕΘΟΟ 2026-09-28)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Ως τη Φ1 η έξοδος έμενε στην cache, γιατί ό,τι είναι κάτω από `public/` το σερβίρει το Netcup στο επόμενο
 * push. Με την άδεια λυμένη, γράφεται στο `public/data/market-transactions/`. Η αναφορά πηγής ταξιδεύει μέσα
 * στο ευρετήριο από το ΕΝΑ `config/open-data-sources.ts`.
 */

import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import ExcelJS from 'exceljs';

import { REPO_ROOT, readHierarchyRows } from './lib/admin-boundaries/admin-boundary-source';
import { createMamaAreaResolver, type MamaAreaResolver } from './lib/market-transactions/mama-area-resolver';
import {
  MAMA_RUN_SUMMARY_PATH,
  type MamaRunSummary,
  MARKET_TRANSACTIONS_CACHE_DIR,
  loadMamaYear,
  resolveMamaWindow,
  type MamaSourceMeta,
} from './lib/market-transactions/mama-download';
import { coverageOf, renderMatchReport, type PairTally } from './lib/market-transactions/mama-match-report';
import { assertMamaHeader, parseMamaRow, type MamaRecord } from './lib/market-transactions/mama-source';
import {
  MAMA_APAA,
  MAMA_CATEGORIES,
  MAMA_RIGHTS,
  MAMA_SPECIAL_CONDITIONS,
} from './lib/market-transactions/mama-vocabulary';
import { buildAreaSummaryFile } from './lib/market-transactions/area-summary';
import { buildContractPriceMapFile } from './lib/market-transactions/price-map-file';
import { comparableUnitPrice } from './lib/market-transactions/market-statistics';
import { OPEN_DATA_SOURCES } from '../src/config/open-data-sources';
import { SEGMENT_METRIC, SEGMENT_PROPERTY_TYPES } from '../src/lib/market/market-segments';
import { MARKET_STAT_MIN_SAMPLE } from '../src/lib/market/market-statistics';
import { CATEGORY_ORDER, buildAreaRowsFile, type ClassifiedRecord } from './lib/market-transactions/market-transactions-file';
import {
  MARKET_TRANSACTIONS_DIR,
  MARKET_TRANSACTIONS_FORMAT_VERSION,
  MARKET_TRANSACTIONS_PRICE_MAP_PUBLIC_PATH,
  ROW_FIELDS,
  marketTransactionsPublicPath,
  type AreaSummaryFile,
  type MarketTransactionsKind,
} from '../src/lib/market/market-transactions-file';

const PUBLIC_DIR = join(REPO_ROOT, 'public');
const OUTPUT_DIR = join(PUBLIC_DIR, ...MARKET_TRANSACTIONS_DIR.split('/'));
/** Η έξοδος της Φ1 (ADR-889 §5.1α) — σβήνεται, για να μη μείνει δεύτερο, μπαγιάτικο αντίγραφο. */
const LEGACY_OUTPUT_DIR = join(MARKET_TRANSACTIONS_CACHE_DIR, 'out');
const MUNICIPALITY_LEVEL = 5;
const REPORT_PATH = join(REPO_ROOT, 'docs', 'centralized-systems', 'reference', 'reports', 'adr-889-area-match.md');

/** Η άδεια ζητά αναφορά κυρίου και αλλαγών (§2.1). Ταξιδεύει μέσα στο ευρετήριο, όπως το `ATTRIBUTION` των ορίων. */
const ATTRIBUTION = {
  owner: 'ΥΠΕΘΟΟ — Μητρώο Αξιών Μεταβιβάσεων Ακινήτων',
  dataset: OPEN_DATA_SOURCES.transferValues.datasetUrl,
  license: OPEN_DATA_SOURCES.transferValues.license,
  legalBasis: 'ΠΟΛ.1040/2018',
  changes: 'συγκεντρωτικά στατιστικά μόνο συγκρίσιμων γραμμών (ADR-889 §5.3), αντιστοίχιση σε περιοχές Καλλικράτη (§4)',
  label: 'τιμή συμβολαίου — ΟΧΙ αγοραία αξία',
} as const;

interface Accumulator {
  readonly resolver: MamaAreaResolver;
  readonly pairs: Map<string, PairTally>;
  readonly byArea: Map<string, ClassifiedRecord[]>;
  comparable: number;
  /** Η τελευταία ημερομηνία συμβολαίου της πηγής — το «έως» κάθε 12μήνου (`area-summary.ts`). */
  latest: string;
}

function classify(record: MamaRecord): ClassifiedRecord {
  const segment = MAMA_CATEGORIES[record.category].segment;
  return { record, segment, unitPrice: comparableUnitPrice(record, segment) };
}

function accumulate(acc: Accumulator, record: MamaRecord): void {
  const key = `${record.prefecture}\u0000${record.municipality}`;
  let pair = acc.pairs.get(key);
  if (pair === undefined) {
    pair = { prefecture: record.prefecture, label: record.municipality, resolution: acc.resolver.resolve(record.prefecture, record.municipality), rows: 0 };
    acc.pairs.set(key, pair);
  }
  pair.rows += 1;
  if (pair.resolution.kind !== 'resolved') return;

  const item = classify(record);
  if (item.unitPrice !== null) acc.comparable += 1;
  if (record.contractDate > acc.latest) acc.latest = record.contractDate;
  const bucket = acc.byArea.get(pair.resolution.areaId);
  if (bucket === undefined) acc.byArea.set(pair.resolution.areaId, [item]);
  else bucket.push(item);
}

/** Ένα έτος: κεφαλίδα, και κάθε γραμμή μέσα στον συσσωρευτή. Σφάλμα γραμμής = σφάλμα με αριθμό γραμμής. */
async function readYear(path: string, year: number, acc: Accumulator): Promise<number> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(path);
  const sheet = workbook.worksheets[0];
  if (sheet === undefined) throw new Error(`ΜΑΜΑ ${year}: το αρχείο δεν έχει φύλλο`);

  let rows = 0;
  sheet.eachRow((row, number) => {
    const cells = (row.values as unknown[]).slice(1, 21);
    if (number === 1) return assertMamaHeader(cells);
    try {
      accumulate(acc, parseMamaRow(cells));
      rows += 1;
    } catch (error) {
      throw new Error(`ΜΑΜΑ ${year}, γραμμή ${number}: ${error instanceof Error ? error.message : String(error)}`);
    }
  });
  return rows;
}

/** Ό,τι χρειάζεται ο αναγνώστης για να αποκωδικοποιήσει τις πλειάδες — γραμμένο **μία** φορά. */
function vocabulary(): Record<string, unknown> {
  return {
    rowFields: ROW_FIELDS,
    categories: CATEGORY_ORDER.map((name) => ({ name, ...MAMA_CATEGORIES[name] })),
    segments: Object.fromEntries(Object.entries(SEGMENT_METRIC).map(([segment, metric]) => [segment, { metric, propertyTypes: SEGMENT_PROPERTY_TYPES[segment as keyof typeof SEGMENT_METRIC] }])),
    rights: MAMA_RIGHTS,
    specialConditions: MAMA_SPECIAL_CONDITIONS,
    insideApaa: MAMA_APAA[0],
    minSample: MARKET_STAT_MIN_SAMPLE,
  };
}

type AreaIndexRow = readonly [string, string, number, number, number];

/**
 * **Οι Δ.Ε. ΚΑΙ ο Δήμος τους.** Η πηγή μιλά σε βαθμίδα Δ.Ε. (§4)· η σελίδα περιοχής όμως ανάγει στον Δήμο όταν η
 * Δ.Ε. έχει λίγα δεδομένα (ADR-890 §10.4), και ο Δήμος έχει δική του σελίδα. Χωρίς αυτή την άθροιση, ο Δήμος
 * Θεσσαλονίκης (6 Δ.Ε.) δεν θα είχε αρχείο. Οι δήμοι **χωρίς** Δ.Ε. είναι ήδη βαθμίδα 5 και μένουν ως έχουν.
 */
function withMunicipalities(acc: Accumulator): Map<string, ClassifiedRecord[]> {
  const groups = new Map<string, ClassifiedRecord[]>();
  const add = (id: string, items: readonly ClassifiedRecord[]): void => {
    const group = groups.get(id);
    if (group === undefined) groups.set(id, [...items]);
    else group.push(...items);
  };
  for (const [areaId, items] of acc.byArea) {
    add(areaId, items);
    const { parentId } = acc.resolver.area(areaId);
    if (parentId !== null && acc.resolver.area(parentId).level === MUNICIPALITY_LEVEL) add(parentId, items);
  }
  return groups;
}

function writeFile(kind: MarketTransactionsKind, areaId: string, content: unknown): void {
  writeFileSync(join(PUBLIC_DIR, ...marketTransactionsPublicPath(kind, areaId)), JSON.stringify(content));
}

interface WrittenAreas {
  readonly rows: AreaIndexRow[];
  /** Τα `summary` που γράφτηκαν — η πρώτη ύλη του συγκεντρωτικού του χάρτη τιμών (ADR-890 §14.4). */
  readonly summaries: AreaSummaryFile[];
}

function writeAreas(acc: Accumulator): WrittenAreas {
  rmSync(OUTPUT_DIR, { recursive: true, force: true });
  rmSync(LEGACY_OUTPUT_DIR, { recursive: true, force: true });
  for (const kind of ['summary', 'rows'] as const) mkdirSync(join(OUTPUT_DIR, kind), { recursive: true });

  const groups = withMunicipalities(acc);
  const rows: AreaIndexRow[] = [];
  const summaries: AreaSummaryFile[] = [];
  for (const areaId of [...groups.keys()].sort()) {
    const items = groups.get(areaId) as ClassifiedRecord[];
    const summary = buildAreaSummaryFile(areaId, items, acc.latest);
    summaries.push(summary);
    writeFile('summary', areaId, summary);
    writeFile('rows', areaId, buildAreaRowsFile(areaId, items));
    const { name, level } = acc.resolver.area(areaId);
    rows.push([areaId, name, level, items.length, items.filter((i) => i.unitPrice !== null).length]);
  }
  return { rows, summaries };
}

function writeIndex(
  window: { from: number; to: number },
  asOf: string,
  inputs: ReadonlyArray<MamaSourceMeta & { rows: number }>,
  areas: readonly AreaIndexRow[],
): void {
  const index = { v: MARKET_TRANSACTIONS_FORMAT_VERSION, attribution: ATTRIBUTION, window, asOf, inputs, vocab: vocabulary(), areas };
  writeFileSync(join(OUTPUT_DIR, 'index.json'), `${JSON.stringify(index)}
`);
}

async function main(): Promise<void> {
  const started = Date.now();
  const argv = process.argv.slice(2);
  const window = await resolveMamaWindow(argv);
  const refresh = argv.includes('--refresh');
  const acc: Accumulator = { resolver: createMamaAreaResolver(readHierarchyRows()), pairs: new Map(), byArea: new Map(), comparable: 0, latest: '' };

  const inputs: Array<MamaSourceMeta & { rows: number }> = [];
  for (let year = window.from; year <= window.to; year += 1) {
    const source = await loadMamaYear(year, refresh);
    inputs.push({ ...source.meta, rows: await readYear(source.path, year, acc) });
  }

  const { rows: areas, summaries } = writeAreas(acc);
  writeIndex(window, acc.latest, inputs, areas);
  writeFileSync(
    join(PUBLIC_DIR, ...MARKET_TRANSACTIONS_PRICE_MAP_PUBLIC_PATH),
    JSON.stringify(buildContractPriceMapFile(summaries, acc.latest)),
  );
  const pairs = [...acc.pairs.values()];
  // Η αναφορά μετρά τις περιοχές όπου **έδεσε** η πηγή — όχι τους αθροισμένους Δήμους.
  const totals = coverageOf(pairs, acc.comparable, acc.byArea.size);
  mkdirSync(join(REPORT_PATH, '..'), { recursive: true });
  writeFileSync(REPORT_PATH, renderMatchReport(window, pairs, totals, acc.resolver));
  // Η σύνοψη για την πύλη της ανανέωσης (ADR-889 §11) — στην cache, ΟΧΙ στο `public/` (δεν σερβίρεται, δεν μπαίνει στο git).
  const runSummary: MamaRunSummary = { window, asOf: acc.latest, totals };
  writeFileSync(MAMA_RUN_SUMMARY_PATH, `${JSON.stringify(runSummary, null, 2)}\n`);

  console.table([{ ...totals, seconds: Math.round((Date.now() - started) / 1000) }]);
  console.log(`✅ ${areas.length} περιοχές (${acc.byArea.size} από την πηγή + Δήμοι) → ${OUTPUT_DIR}\n📄 αναφορά → ${REPORT_PATH}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
