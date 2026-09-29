/**
 * @fileoverview **Η ΑΥΤΟΜΑΤΗ ΑΝΑΝΕΩΣΗ ΤΩΝ ΔΕΔΟΜΕΝΩΝ ΑΓΟΡΑΣ** — συμβόλαια ΜΑΜΑ + ζώνες αντικειμενικών αξιών (ADR-889 Φ4, §11).
 * @related `.github/workflows/market-data-refresh.yml` (ο χρονοπρογραμματισμός + το PR) · `scripts/lib/market-data-refresh/*`
 *
 * ```
 * 1. προβολή «πριν»       public/ → αριθμοί στη μνήμη                        (refresh-snapshot)
 * 2. «άλλαξε η πηγή;»      HEAD ανά αρχείο · κύλιση παραθύρου ετών          (refresh-probe)
 *    ⤷ όχι ⇒ τέλος, κανένα PR
 * 3. παραγωγή ×2          npm run build:… -- --refresh  ·  ξανά από cache  ⇒ sha256 ανά αρχείο πρέπει να συμπίπτει
 * 4. πύλες                κάλυψη · ντετερμινισμός · ζώνες χωρίς περιοχή · όγκος · μαζική μετατόπιση · jest πραγματικών
 * 5. αναφορά              Markdown (το σώμα του PR)                         (refresh-report)
 * ```
 *
 * **Εκτέλεση**: `npm run refresh:market-data` · `-- --probe-only` (μόνο ο έλεγχος, καμία εγγραφή) · `-- --force` (παραγωγή χωρίς έλεγχο κεφαλίδων) · `-- --accept-drop`
 * (ανθρώπινη αποδοχή πτώσης όγκου) · `-- --report=<αρχείο>` · `-- --github-output` (γράφει `changed=` στο `$GITHUB_OUTPUT`).
 *
 * 🔴 **Ποτέ git εδώ.** Το script γράφει μόνο ό,τι γράφουν οι γεννήτορες (`public/data/…`). Το commit, ο κλάδος και το PR
 * ανήκουν στο workflow — και το merge στο `main` στον άνθρωπο (N.(-1)). Τοπικά: με τον dev server **κλειστό** (EBUSY).
 */

import { spawnSync } from 'node:child_process';
import { appendFileSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';

import { MARKET_TRANSACTIONS_DIR } from '../src/lib/market/market-transactions-file';
import { VALUE_ZONES_DIR } from '../src/lib/market/value-zone-file';
import { REPO_ROOT } from './lib/admin-boundaries/admin-boundary-source';
import { fileSha256, probeSource } from './lib/cached-download';
import { MAMA_RUN_SUMMARY_PATH, resolveMamaWindow, type MamaRunSummary } from './lib/market-transactions/mama-download';
import { VALUE_ZONES_RUN_SUMMARY_PATH, type ValueZonesRunSummary } from './lib/value-zones/zone-download';
import { diffMarket, diffZones, type MarketDiff, type ZoneDiff } from './lib/market-data-refresh/refresh-diff';
import {
  coverageGate,
  determinismGate,
  freshnessGate,
  massShiftGate,
  prGatesPass,
  realFilesGate,
  unassignedZonesGate,
  volumeGate,
  type GateResult,
} from './lib/market-data-refresh/refresh-gates';
import {
  SOURCE_IDS,
  SOURCE_LABELS,
  accessOf,
  checkSource,
  needsBuild,
  probeMarket,
  probeZones,
  type SourceCheck,
  type SourceChecks,
  type SourceId,
} from './lib/market-data-refresh/refresh-probe';
import { accessLine, renderRefreshReport } from './lib/market-data-refresh/refresh-report';
import { readDataSnapshot, type DataSnapshot } from './lib/market-data-refresh/refresh-snapshot';

const PUBLIC_DIR = join(REPO_ROOT, 'public');
const DEFAULT_REPORT_PATH = join(REPO_ROOT, 'node_modules', '.cache', 'market-data-refresh', 'report.md');

/** Ένα σύνολο δεδομένων: ο γεννήτοράς του (script του `package.json` = SSoT της εντολής) και ο φάκελος εξόδου του. */
const DATASETS: Readonly<Record<SourceId, { readonly script: string; readonly outputDir: string }>> = {
  market: { script: 'build:market-transactions', outputDir: join(PUBLIC_DIR, ...MARKET_TRANSACTIONS_DIR.split('/')) },
  zones: { script: 'build:value-zones', outputDir: join(PUBLIC_DIR, ...VALUE_ZONES_DIR.split('/')) },
};

/** Η σουίτα jest πάνω στα πραγματικά αρχεία (Ε7) — η λίστα ζει στο `package.json`. */
const REAL_FILES_TEST_SCRIPT = 'test:market-data-real-files';

interface Options {
  readonly force: boolean;
  /** Μόνο ο φθηνός έλεγχος — **καμία** εγγραφή (ασφαλές και με ανοιχτό dev server). */
  readonly probeOnly: boolean;
  readonly acceptDrop: boolean;
  readonly reportPath: string;
  readonly githubOutput: boolean;
}

function parseOptions(argv: readonly string[]): Options {
  const report = argv.find((arg) => arg.startsWith('--report='));
  return {
    force: argv.includes('--force'),
    probeOnly: argv.includes('--probe-only'),
    acceptDrop: argv.includes('--accept-drop'),
    reportPath: report === undefined ? DEFAULT_REPORT_PATH : report.slice('--report='.length),
    githubOutput: argv.includes('--github-output'),
  };
}

/** `npm run <script> [-- args]` — ίδια εντολή με τον άνθρωπο, ίδιο heap, ίδιο tsx. */
function npmRun(script: string, args: readonly string[] = []): boolean {
  const result = spawnSync('npm', ['run', script, ...(args.length > 0 ? ['--', ...args] : [])], {
    cwd: REPO_ROOT,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  return result.status === 0;
}

function listFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => (entry.isDirectory() ? listFiles(join(dir, entry.name)) : [join(dir, entry.name)]))
    .sort();
}

async function hashTree(dir: string): Promise<Map<string, string>> {
  const hashes = new Map<string, string>();
  for (const path of listFiles(dir)) hashes.set(relative(PUBLIC_DIR, path), await fileSha256(path));
  return hashes;
}

function mismatchesOf(first: ReadonlyMap<string, string>, second: ReadonlyMap<string, string>): string[] {
  const paths = [...new Set([...first.keys(), ...second.keys()])].sort();
  return paths.filter((path) => first.get(path) !== second.get(path));
}

interface BuildOutcome {
  readonly mismatched: string[];
  readonly files: number;
}

/** Ε3 — δύο εκτελέσεις: η πρώτη με **νέα λήψη** της πηγής, η δεύτερη από την cache. Σφάλμα γεννήτορα ⇒ πετά (Ε1). */
async function buildTwice(id: SourceId): Promise<BuildOutcome> {
  const { script, outputDir } = DATASETS[id];
  if (!npmRun(script, ['--refresh'])) throw new Error(`${script}: ο γεννήτορας απέτυχε (Ε1 — σχήμα πηγής ή δίκτυο)`);
  const first = await hashTree(outputDir);
  if (!npmRun(script)) throw new Error(`${script}: η δεύτερη εκτέλεση απέτυχε`);
  const second = await hashTree(outputDir);
  return { mismatched: mismatchesOf(first, second), files: second.size };
}

function readRunSummary<T>(path: string): T {
  // Γραμμένο από τον ΔΙΚΟ μας γεννήτορα λίγα δευτερόλεπτα πριν, με τον κοινό τύπο (`MamaRunSummary` / `ValueZonesRunSummary`).
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

type Probes = SourceChecks;

/**
 * Κάθε πηγή κρίνεται **χωριστά** (ADR-889 §11.10): ο gsis.gr κόβει τους runners του GitHub (403), ενώ το data.gov.gr
 * περνά — η απρόσιτη πηγή δεν ρίχνει την άλλη. Και με `--force` ο έλεγχος τρέχει: η κεφαλίδα δεν αποφασίζει, η
 * προσβασιμότητα όμως ναι.
 */
async function probeAll(before: DataSnapshot, force: boolean): Promise<Probes> {
  return {
    market: await checkSource(async () => probeMarket(before.market, await resolveMamaWindow([]), probeSource), force),
    zones: await checkSource(() => probeZones(before.zones, probeSource), force),
  };
}

interface Rebuilt {
  readonly gates: GateResult[];
  readonly market: MarketDiff | null;
  readonly zones: ZoneDiff | null;
}

async function rebuild(probes: Probes, before: DataSnapshot, acceptDrop: boolean): Promise<Rebuilt> {
  const gates: GateResult[] = [];
  const mismatched: string[] = [];
  let files = 0;
  for (const id of SOURCE_IDS) {
    if (!needsBuild(probes[id])) continue;
    const outcome = await buildTwice(id);
    mismatched.push(...outcome.mismatched);
    files += outcome.files;
  }
  const after = readDataSnapshot(PUBLIC_DIR);
  const market = needsBuild(probes.market) && after.market !== null ? diffMarket(before.market, after.market) : null;
  const zones = needsBuild(probes.zones) && after.zones !== null ? diffZones(before.zones, after.zones) : null;
  if (market !== null) gates.push(coverageGate(readRunSummary<MamaRunSummary>(MAMA_RUN_SUMMARY_PATH).totals));
  gates.push(determinismGate(mismatched, files));
  if (zones !== null) gates.push(unassignedZonesGate(readRunSummary<ValueZonesRunSummary>(VALUE_ZONES_RUN_SUMMARY_PATH)));
  gates.push(volumeGate(market, zones, acceptDrop));
  if (market !== null) gates.push(massShiftGate(market));
  gates.push(realFilesGate(npmRun(REAL_FILES_TEST_SCRIPT)));
  return { gates, market, zones };
}

function writeGithubOutput(enabled: boolean, changed: boolean): void {
  const target = process.env.GITHUB_OUTPUT;
  if (enabled && target !== undefined) appendFileSync(target, `changed=${changed}\n`);
}

function describeCheck(check: SourceCheck): string {
  if (!check.reachable) return `ΑΠΡΟΣΙΤΗ (HTTP ${check.status ?? '—'})`;
  return `${check.decision.changed ? 'ΑΛΛΑΞΕ' : 'ίδιο'}${check.decision.reasons.map((reason) => `\n  - ${reason}`).join('')}`;
}

/** `::error` / `::warning` στη σελίδα του run του GitHub· τοπικά απλή γραμμή. */
function annotate(level: 'error' | 'warning', title: string, message: string): void {
  if (process.env.GITHUB_ACTIONS === 'true') console.log(`::${level} title=${title}::${message}`);
  else console.error(`${level === 'error' ? '🔴' : '⚠️'} ${title}: ${message}`);
}

/**
 * Η πρόσβαση κάθε πηγής (ADR-889 §11.11): **αδήλωτα** απρόσιτη ⇒ κόκκινο (`exitCode 1`)· δηλωμένος περιορισμός ⇒ ⚠️.
 * Ποτέ σιωπηλό «ίδιο». Επιστρέφει αν υπάρχει κάτι μη-πράσινο (τότε γράφεται αναφορά).
 */
function flagAccess(probes: Probes): boolean {
  const access = accessOf(probes);
  let notable = false;
  for (const id of SOURCE_IDS) {
    const line = accessLine(id, probes[id]);
    if (line === null) continue;
    notable = true;
    // Το annotation έχει δικό του σήμα επιπέδου· χωρίς Markdown και χωρίς το εικονίδιο της αναφοράς.
    annotate(access[id] === 'unexpected' ? 'error' : 'warning', SOURCE_LABELS[id], line.replace(/\*\*/g, '').replace(/^(🔴|⚠️) /u, ''));
    if (access[id] === 'unexpected') process.exitCode = 1;
  }
  return notable;
}

/** Ε8 πάνω στο ΜΑΜΑ που σερβίρει **τώρα** το `public/` (μετά την παραγωγή, αν έγινε). Κόκκινο ⇒ `exitCode 1`. */
function checkFreshness(): GateResult {
  const gate = freshnessGate(readDataSnapshot(PUBLIC_DIR).market?.asOf ?? null, new Date());
  if (!gate.ok) {
    annotate('error', gate.title, gate.detail);
    process.exitCode = 1;
  } else if (gate.warning) annotate('warning', gate.title, gate.detail);
  return gate;
}

function writeReport(path: string, report: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, report);
  console.log(`\n${report}\n📄 αναφορά → ${path}`);
}

/**
 * Κωδικός εξόδου **0** μόνο όταν: καμία πηγή δεν είναι **αδήλωτα** απρόσιτη **και** κάθε πύλη πέρασε — μαζί η φρεσκάδα Ε8.
 * Το `changed=` του `$GITHUB_OUTPUT` λέει κάτι άλλο — «υπάρχει έγκυρη νέα έξοδος για PR» — γι' αυτό μπορεί να είναι `true`
 * σε κόκκινο run. Το workflow τα διαβάζει χωριστά (ADR-889 §11.10 · §11.11).
 */
async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));
  const before = readDataSnapshot(PUBLIC_DIR);
  const probes = await probeAll(before, options.force);
  if (options.probeOnly) {
    for (const id of SOURCE_IDS) console.log(`${id}: ${describeCheck(probes[id])}`);
    flagAccess(probes);
    const freshness = checkFreshness();
    console.log(`${freshness.id}: ${freshness.ok ? (freshness.warning ? '⚠️' : '✅') : '❌'} ${freshness.detail}`);
    return;
  }
  const notable = flagAccess(probes);
  if (!needsBuild(probes.market) && !needsBuild(probes.zones)) {
    const freshness = checkFreshness();
    if (notable || !freshness.ok || freshness.warning === true) {
      writeReport(options.reportPath, renderRefreshReport({ market: { check: probes.market, diff: null }, zones: { check: probes.zones, diff: null }, gates: [freshness] }));
    } else console.log(`✅ Καμία αλλαγή στις πηγές (ΜΑΜΑ + ζώνες) — κανένα PR. ${freshness.detail}.`);
    writeGithubOutput(options.githubOutput, false);
    return;
  }
  const { gates: outputGates, market, zones } = await rebuild(probes, before, options.acceptDrop);
  const gates = [...outputGates, checkFreshness()];
  writeReport(options.reportPath, renderRefreshReport({ market: { check: probes.market, diff: market }, zones: { check: probes.zones, diff: zones }, gates }));
  const passed = prGatesPass(gates);
  writeGithubOutput(options.githubOutput, passed);
  if (!passed) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
