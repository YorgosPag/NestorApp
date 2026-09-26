/**
 * @fileoverview **Ο ΓΕΝΝΗΤΟΡΑΣ ΤΙΜΩΝ ΣΥΜΒΟΛΑΙΩΝ** — αρχεία ΜΑΜΑ → ένα JSON ανά περιοχή Καλλικράτη (ADR-889 Φ1).
 * @related ADR-889 · ADR-883 (ίδιο σχήμα: στατικό αρχείο ανά οντότητα) · `scripts/lib/market-transactions/*`
 *
 * ```
 * gsis.gr .xlsx (ανά έτος)  →  cache + Last-Modified + sha256        (mama-download)
 *                           →  κεφαλίδα κατά θέση ΚΑΙ όνομα            (mama-source)
 *                           →  (νομαρχία, δήμος) → Δ.Ε. / δήμος       (mama-area-resolver)
 *                           →  τμήμα + συγκρίσιμη τιμή μονάδας         (mama-vocabulary · market-statistics)
 *                           →  <out>/areas/<id>.json + <out>/index.json
 *                           →  docs/…/reports/adr-889-area-match.md   (ό,τι ΔΕΝ δέθηκε ακριβώς)
 * ```
 *
 * **Εκτέλεση**: `npm run build:market-transactions` · επιλογές `--from=2022 --to=2026 --refresh`
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 Η Φ1 ΔΕΝ ΔΗΜΟΣΙΕΥΕΙ — ΚΑΙ ΑΥΤΟ ΕΙΝΑΙ ΔΟΜΙΚΟ, ΟΧΙ ΥΠΟΣΧΕΣΗ
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Η άδεια επαναχρησιμοποίησης είναι **ανοιχτή** (§2.1). Ό,τι γράφεται κάτω από `public/` το σερβίρει το
 * Netcup στο επόμενο push, δηλαδή **δημοσιεύεται**. Γι' αυτό η έξοδος της Φ1 γράφεται στην cache
 * (`node_modules/.cache/market-transactions/out`), που **δεν** μπαίνει στο git και **δεν** σερβίρεται. Ο
 * προορισμός `public/data/market-transactions` προστίθεται στη Φ2, **αφού** απαντήσει η ΓΓΠΣΨΔ. Στο git
 * μπαίνει μόνο η αναφορά αντιστοίχισης, που δεν περιέχει καμία συναλλαγή.
 */

import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import ExcelJS from 'exceljs';

import { adminBoundaryFileName } from '../src/lib/geo/admin-boundary-file';
import { REPO_ROOT, readHierarchyRows } from './lib/admin-boundaries/admin-boundary-source';
import { createMamaAreaResolver, type MamaAreaResolver } from './lib/market-transactions/mama-area-resolver';
import { MARKET_TRANSACTIONS_CACHE_DIR, loadMamaYear, type MamaSourceMeta } from './lib/market-transactions/mama-download';
import { coverageOf, renderMatchReport, type PairTally } from './lib/market-transactions/mama-match-report';
import { assertMamaHeader, parseMamaRow, type MamaRecord } from './lib/market-transactions/mama-source';
import {
  MAMA_APAA,
  MAMA_CATEGORIES,
  MAMA_RIGHTS,
  MAMA_SPECIAL_CONDITIONS,
} from './lib/market-transactions/mama-vocabulary';
import { comparableUnitPrice } from './lib/market-transactions/market-statistics';
import { SEGMENT_METRIC, SEGMENT_PROPERTY_TYPES } from '../src/lib/market/market-segments';
import { MARKET_STAT_MIN_SAMPLE } from '../src/lib/market/market-statistics';
import {
  CATEGORY_ORDER,
  MARKET_TRANSACTIONS_FORMAT_VERSION,
  ROW_FIELDS,
  buildAreaFile,
  type ClassifiedRecord,
} from './lib/market-transactions/market-transactions-file';

const OUTPUT_DIR = join(MARKET_TRANSACTIONS_CACHE_DIR, 'out');
const AREAS_DIR = join(OUTPUT_DIR, 'areas');
const REPORT_PATH = join(REPO_ROOT, 'docs', 'centralized-systems', 'reference', 'reports', 'adr-889-area-match.md');

/** Η πηγή ζητά αναφορά (§2.1). Ταξιδεύει μέσα στο ευρετήριο, όπως το `ATTRIBUTION` των ορίων. */
const ATTRIBUTION = {
  source: 'ΑΑΔΕ / ΓΓΠΣΨΔ — Μητρώο Αξιών Μεταβιβάσεων Ακινήτων',
  legalBasis: 'ΠΟΛ.1040/2018',
  license: 'ΑΝΟΙΧΤΟ — ADR-889 §2.1 (όχι δημόσια χρήση πριν από γραπτή απάντηση)',
  label: 'τιμή συμβολαίου — ΟΧΙ αγοραία αξία',
} as const;

/** Το παράθυρο ετών: τα πέντε τελευταία (§5.2 βήμα 1), ή ό,τι δοθεί με `--from` / `--to`. */
function parseWindow(argv: readonly string[]): { from: number; to: number; refresh: boolean } {
  const value = (name: string): number | null => {
    const arg = argv.find((a) => a.startsWith(`--${name}=`));
    return arg === undefined ? null : Number(arg.slice(name.length + 3));
  };
  const to = value('to') ?? new Date().getFullYear();
  const from = value('from') ?? to - 4;
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 2017 || from > to) {
    throw new Error(`άκυρο παράθυρο ετών ${from}–${to} (το μητρώο αρχίζει το 2017)`);
  }
  return { from, to, refresh: argv.includes('--refresh') };
}

interface Accumulator {
  readonly resolver: MamaAreaResolver;
  readonly pairs: Map<string, PairTally>;
  readonly byArea: Map<string, ClassifiedRecord[]>;
  comparable: number;
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

function writeAreas(acc: Accumulator): Array<readonly [string, string, number, number, number]> {
  rmSync(OUTPUT_DIR, { recursive: true, force: true });
  mkdirSync(AREAS_DIR, { recursive: true });
  const rows: Array<readonly [string, string, number, number, number]> = [];
  for (const areaId of [...acc.byArea.keys()].sort()) {
    const items = acc.byArea.get(areaId) as ClassifiedRecord[];
    const file = buildAreaFile(acc.resolver.area(areaId), items);
    writeFileSync(join(AREAS_DIR, adminBoundaryFileName(areaId)), JSON.stringify(file));
    rows.push([areaId, file.name, file.level, items.length, items.filter((i) => i.unitPrice !== null).length]);
  }
  return rows;
}

function writeIndex(window: { from: number; to: number }, inputs: ReadonlyArray<MamaSourceMeta & { rows: number }>, areas: ReturnType<typeof writeAreas>): void {
  const index = { v: MARKET_TRANSACTIONS_FORMAT_VERSION, attribution: ATTRIBUTION, window, inputs, vocab: vocabulary(), areas };
  writeFileSync(join(OUTPUT_DIR, 'index.json'), `${JSON.stringify(index)}\n`);
}

async function main(): Promise<void> {
  const started = Date.now();
  const window = parseWindow(process.argv.slice(2));
  const acc: Accumulator = { resolver: createMamaAreaResolver(readHierarchyRows()), pairs: new Map(), byArea: new Map(), comparable: 0 };

  const inputs: Array<MamaSourceMeta & { rows: number }> = [];
  for (let year = window.from; year <= window.to; year += 1) {
    const source = await loadMamaYear(year, window.refresh);
    inputs.push({ ...source.meta, rows: await readYear(source.path, year, acc) });
  }

  const areas = writeAreas(acc);
  writeIndex(window, inputs, areas);
  const pairs = [...acc.pairs.values()];
  const totals = coverageOf(pairs, acc.comparable, areas.length);
  mkdirSync(join(REPORT_PATH, '..'), { recursive: true });
  writeFileSync(REPORT_PATH, renderMatchReport(window, pairs, totals, acc.resolver));

  console.table([{ ...totals, seconds: Math.round((Date.now() - started) / 1000) }]);
  console.log(`✅ ${areas.length} αρχεία περιοχών → ${AREAS_DIR}\n📄 αναφορά → ${REPORT_PATH}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
