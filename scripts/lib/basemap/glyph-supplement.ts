/**
 * @fileoverview **Το συμπλήρωμα συμβόλων των γραμματοσειρών χάρτη** (Noto Sans Math) — και ο κατάλογος κάλυψης που
 * αποδεικνύει στο git τι σερβίρει ο διακομιστής.
 * @related ADR-891 §9.5 · `basemap-assets.ts` (καλεί) · `glyph-pbf.ts` · `font-maker.ts` ·
 *   `src/lib/maps/generated/basemap-glyph-coverage.json` (έξοδος) · `src/lib/maps/__tests__/overlay-glyph-coverage.test.ts`
 *
 * 🔴 **ΤΟ ΕΥΡΗΜΑ (μετρημένο 2026-09-28)**: το `≈` (U+2248) της ετικέτας συσσωματώματος `12 · +5≈` **δεν υπάρχει** στις
 * στοίβες του Protomaps. Το εύρος `8704-8959` φορτώνει κανονικά (Regular: 8 σύμβολα, Medium: 0), άρα η MapLibre **δεν**
 * πέφτει στην τοπική εφεδρεία — ο χαρακτήρας απλώς **σβήνει**, χωρίς σφάλμα πουθενά.
 *
 * 🔑 **Η ΣΥΝΤΑΓΗ ΤΟΥ UPSTREAM + ΕΝΑ FACE.** Το Protomaps χτίζει κάθε στοίβα με `font-maker` από ~50 TTF της οικογένειας
 * Noto (`scripts/create_fonts.sh`) — χωρίς το Noto Sans **Math**. Το προσθέτουμε ως **τελευταίο** face: μπαίνει μόνο
 * ό,τι λείπει (`mergeGlyphRange`), άρα καμία υπάρχουσα γλυφή δεν αλλάζει.
 *
 * 🏆 **Ο ΚΑΤΑΛΟΓΟΣ ΚΑΛΥΨΗΣ ΕΙΝΑΙ Η ΑΠΟΔΕΙΞΗ.** Τα `.pbf` ζουν εκτός git, άρα κανένα test δεν τα βλέπει. Ο γεννήτορας
 * γράφει στο git **ποια κωδικοσημεία** έχει κάθε στοίβα που σερβίρουμε· η άγκυρα ελέγχει ότι κάθε σύμβολο που
 * μπορεί να γράψει μια ετικέτα της εφαρμογής υπάρχει εκεί. Χωρίς αυτό, το επόμενο σύμβολο θα έσβηνε ξανά σιωπηλά.
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import {
  BASEMAP_BUNDLE_PATHS,
  BASEMAP_FONTSTACKS,
  BASEMAP_MATH_SUPPLEMENTED_FONTSTACKS,
} from '../../../src/lib/maps/basemap-catalog';
import { loadCachedSource } from '../cached-download';
import { glyphRangeFileName, loadFontMaker, renderFontstackRanges } from './font-maker';
import { codepointRuns, glyphCodepoints, mergeGlyphRange } from './glyph-pbf';

/** Commit του `notofonts/notofonts.github.io` — η **ίδια** ρίζα (`fonts/<Οικογένεια>/unhinted/ttf`) που διαβάζει το Protomaps. */
const NOTOFONTS_COMMIT = '55773c3eb233b5a0eaa07de6226da189b136b4f0';
const NOTOFONTS_RAW = `https://raw.githubusercontent.com/notofonts/notofonts.github.io/${NOTOFONTS_COMMIT}/fonts`;

const NOTO_SANS_MATH = {
  url: `${NOTOFONTS_RAW}/NotoSansMath/unhinted/ttf/NotoSansMath-Regular.ttf`,
  sha256: 'b127e84699212b6b2ef50aff58e0ebebeec04ffe6db1b9eb9e209c8c3d97b4aa',
} as const;

/** Το OFL του ίδιου commit — ταξιδεύει μαζί με τα `.pbf` (ο κατάλογος το δηλώνει στο `distributedAssets`). */
const NOTO_SANS_MATH_LICENSE = {
  url: `${NOTOFONTS_RAW}/LICENSE`,
  sha256: 'f2095b08bed08b23a6fe26112fcd679a2bee3f002eef077eb05d215ed1051bd8',
  bundlePath: 'fonts/NotoSansMath-OFL.txt',
} as const;

/** Ο κατάλογος κάλυψης στο git, σχετικά με τη ρίζα του repo. */
export const GLYPH_COVERAGE_FILE = 'src/lib/maps/generated/basemap-glyph-coverage.json';

export interface GlyphSupplementResult {
  /** Πόσα κωδικοσημεία πρόσθεσε το συμπλήρωμα, ανά στοίβα. */
  readonly addedByStack: Readonly<Record<string, number>>;
}

/** Γράφει μέσα στον φάκελο assets του bundle: συγχωνεύει το Noto Sans Math στις στοίβες του καταλόγου. */
export async function applyMathSupplement(assetsDir: string, cacheDir: string): Promise<GlyphSupplementResult> {
  const cache = join(cacheDir, 'assets', 'notofonts', NOTOFONTS_COMMIT.slice(0, 12));
  const face = await loadCachedSource({
    url: NOTO_SANS_MATH.url,
    path: join(cache, 'NotoSansMath-Regular.ttf'),
    label: 'Noto Sans Math',
    expectedSha256: NOTO_SANS_MATH.sha256,
  });
  const license = await loadCachedSource({
    url: NOTO_SANS_MATH_LICENSE.url,
    path: join(cache, 'LICENSE'),
    label: 'notofonts LICENSE (OFL)',
    expectedSha256: NOTO_SANS_MATH_LICENSE.sha256,
  });

  const supplement = renderFontstackRanges(await loadFontMaker(cacheDir), [readFileSync(face.path)]);
  const addedByStack: Record<string, number> = {};
  for (const stack of BASEMAP_MATH_SUPPLEMENTED_FONTSTACKS) {
    addedByStack[stack] = mergeIntoStack(join(assetsDir, 'fonts', stack), supplement);
  }
  writeFileSync(join(assetsDir, ...NOTO_SANS_MATH_LICENSE.bundlePath.split('/')), readFileSync(license.path));
  return { addedByStack };
}

/** Συγχωνεύει κάθε μη κενό εύρος του συμπληρώματος στο αντίστοιχο αρχείο της στοίβας. */
function mergeIntoStack(stackDir: string, supplement: ReadonlyMap<number, Buffer>): number {
  let added = 0;
  for (const [start, pbf] of supplement) {
    if (glyphCodepoints(pbf).length === 0) continue;
    const target = join(stackDir, glyphRangeFileName(start));
    // Το upstream γράφει ΟΛΑ τα εύρη (257 αρχεία ανά στοίβα, μετρημένο) — ένα που λείπει είναι σπασμένο bundle.
    if (!existsSync(target)) throw new Error(`γραμματοσειρές: λείπει το ${target} από τη βάση του upstream`);
    const merged = mergeGlyphRange(readFileSync(target), pbf);
    if (merged.added.length === 0) continue;
    writeFileSync(target, merged.pbf);
    added += merged.added.length;
  }
  return added;
}

/** Τα κωδικοσημεία όλων των εύρων μιας στοίβας στο bundle. */
function stackCodepoints(stackDir: string): number[] {
  return readdirSync(stackDir)
    .filter((name) => /^\d+-\d+\.pbf$/.test(name))
    .flatMap((name) => glyphCodepoints(readFileSync(join(stackDir, name))));
}

/**
 * Γράφει τον κατάλογο κάλυψης (στο git): ποια κωδικοσημεία έχει κάθε στοίβα, **για ποια έκδοση** των assets.
 * Η άγκυρα απορρίπτει κατάλογο άλλης έκδοσης — δεν μπορεί να μείνει μπαγιάτικος χωρίς να κοκκινίσει.
 */
export function writeGlyphCoverage(assetsDir: string, repoRoot: string): string {
  const stacks = Object.fromEntries(
    BASEMAP_FONTSTACKS.map((stack) => [stack, codepointRuns(stackCodepoints(join(assetsDir, 'fonts', stack)))]),
  );
  const target = join(repoRoot, ...GLYPH_COVERAGE_FILE.split('/'));
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, formatCoverage(BASEMAP_BUNDLE_PATHS.assets, stacks));
  return target;
}

/** Μία γραμμή ανά στοίβα: το diff μιας νέας έκδοσης δείχνει **ποια** στοίβα άλλαξε, όχι χιλιάδες γραμμές αριθμών. */
function formatCoverage(assets: string, stacks: Record<string, Array<[number, number]>>): string {
  const rows = Object.entries(stacks).map(([stack, runs]) => `    ${JSON.stringify(stack)}: ${JSON.stringify(runs)}`);
  return [
    '{',
    `  "$comment": ${JSON.stringify('ΠΑΡΑΓΟΜΕΝΟ από `npm run build:basemap` (ADR-891 §9.5) — μην το αλλάξεις με το χέρι.')},`,
    `  "assets": ${JSON.stringify(assets)},`,
    '  "stacks": {',
    rows.join(',\n'),
    '  }',
    '}',
    '',
  ].join('\n');
}
