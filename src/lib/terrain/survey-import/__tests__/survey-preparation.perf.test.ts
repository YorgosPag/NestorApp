/**
 * @jest-environment node
 */

/**
 * ADR-920 Β4.8 υπο-βήμα 5α — **ΠΟΣΟ ΚΟΣΤΙΖΕΙ ΜΙΑ ΠΡΟΕΠΙΣΚΟΠΗΣΗ** στον κύριο νήμα, σε πραγματικά μεγέθη αποτύπωσης.
 *
 * Το `useTerrainSurveyImport` τρέχει το `prepareSurveyUpload` σε `useMemo` — δηλαδή **σε κάθε** αλλαγή στήλης ή μονάδας,
 * όχι μία φορά ανά αρχείο — και ο καλών τρέχει μετά το `terrainMapModelOf`. Αν αυτό θέλει Web Worker δεν είναι γνώμη·
 * είναι αριθμός (κατώφλι RAIL: > 50 ms αισθητό, > 100 ms worker), και μέχρι αυτό το αρχείο κανείς δεν τον είχε.
 *
 * ## Τα τρία μεγέθη — γιατί αυτά
 *   - **10k**  — συνηθισμένη πυκνή αποτύπωση οικοπέδου (1 m κάνναβος, 100 m × 100 m).
 *   - **~29k** — η **βαρύτερη που περνά**: ~2 τρίγωνα ανά σημείο ⇒ κάτω από `LISTING_TERRAIN_MAX_TRIANGLES` (60.000).
 *                Αυτό είναι το χειρότερο κόστος που πληρώνει ποτέ ένας άνθρωπος που βλέπει χάρτη.
 *   - **~100k** — το όριο του συμβολαίου (`LISTING_TERRAIN_SOURCE_MAX_POINTS`). Βγαίνει **πάντα** `TERRAIN_TOO_DENSE`,
 *                αλλά μόνο αφού χτιστεί το TIN — άρα πληρώνεται όλο, για να πάρει ο άνθρωπος άρνηση.
 *
 * ## Γιατί ΚΑΝΕΝΑ χρονικό όριο εδώ (πρότυπο `geo-auto-match.perf.test.ts`, ADR-650 §M10e)
 * Όριο 3× του μετρημένου σπάει σε φορτωμένο μηχάνημα· όριο ίσο με το μετρημένο θα διαβαζόταν ως αποδεκτός προϋπολογισμός.
 * Το αρχείο **μετρά και γράφει**· ο αριθμός ζει στο ADR-920 §13.8, όπου παίρνεται η απόφαση. Οι έλεγχοι που μένουν αφορούν
 * την **απάντηση** στο πραγματικό μέγεθος — κανένα άλλο test δεν οδηγεί την προετοιμασία πάνω από μερικές εκατοντάδες σημεία.
 *
 * ⚠️ Node, όχι browser: ίδια μηχανή (V8), άλλο μηχάνημα. Το κινητό είναι πιο αργό — ο συντελεστής γράφεται στο ADR ως
 *    συντελεστής, ποτέ ως μέτρηση.
 * ⚠️ **Το jest φουσκώνει τον τριγωνισμό ~6×** (μετρημένο 2026-10-25: ο ίδιος `cdt2d` στα ίδια 10k = 10,0 s εδώ, 1,7 s σε
 *    σκέτο Node). Οι αριθμοί αυτού του αρχείου είναι για **σύγκριση μεταξύ τους**, όχι ο χρόνος του χρήστη — εκείνος
 *    ζει στο ADR-920 §13.8, μετρημένος σε σκέτο Node.
 *
 * ⏱ **Δύο τρόποι** (μετρημένο 2026-10-24: ο πλήρης πίνακας κόστισε **2.923 s**: ~1 ms ανά σημείο στον τριγωνισμό, ~n^1,25 —
 *    ADR-920 §13.8):
 *   - προεπιλογή: **μόνο** 10k, μία ψυχρή κλήση (~10 s) — η απάντηση στο πραγματικό μέγεθος μένει καρφωμένη.
 *   - `TERRAIN_PERF=full npx jest <αυτό το αρχείο> -i`: τα τρία μεγέθη, ψυχρή + διάμεσος 5, και τα μέρη χωριστά.
 */

import { encodeListingTerrainSource } from '../../publication/listing-terrain-source';
import { judgeListingTerrainSource } from '../../publication/listing-terrain-judge';
import { terrainMapModelOf } from '../../publication/terrain-map-model';
import type { TopoPoint } from '../../terrain-types';
import { prepareSurveyUpload, surveyFactsOf, surveyMarksOf, surveySourceOf } from '../survey-upload-preparation';

const E0 = 400_000_000;
const N0 = 4_200_000_000;
const FULL = process.env.TERRAIN_PERF === 'full';
const WARM_RUNS = FULL ? 5 : 0;
const fullOnly = FULL ? it : it.skip;

/** Ντετερμινιστική ψευδοτυχαιότητα (LCG) — ο κάνναβος μετατοπίζεται λίγο, όπως στο πεδίο, ίδιος σε κάθε τρέξιμο. */
function lcg(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

/**
 * `side × side` σημεία σε κάνναβο 1 m με μετατόπιση ±0,3 m (κανένα τετράγωνο ομοκυκλικό ⇒ αληθινό Delaunay), πάνω σε
 * λόφους ±3 m γύρω από τα 120 m και γενική κλίση 2 % — κλίσεις σε όλες τις κλάσεις, εκατοντάδες ισοϋψείς.
 */
function surveyOf(side: number): TopoPoint[] {
  const random = lcg(side);
  const points: TopoPoint[] = [];
  for (let i = 0; i < side; i++) {
    for (let j = 0; j < side; j++) {
      const x = i + (random() - 0.5) * 0.6;
      const y = j + (random() - 0.5) * 0.6;
      const z = 120 + 3 * Math.sin(x / 15) * Math.cos(y / 20) + 0.02 * x;
      points.push({ x: E0 + Math.round(x * 1000), y: N0 + Math.round(y * 1000), z: Math.round(z * 1000) });
    }
  }
  return points;
}

interface Timing {
  readonly coldMs: number;
  /** `null` στον σύντομο τρόπο (καμία θερμή επανάληψη). */
  readonly medianMs: number | null;
}

/** Πρώτη κλήση (ό,τι πληρώνει ο άνθρωπος στο πρώτο αρχείο) + διάμεσος των επόμενων. */
function timed<R>(work: () => R, runs = WARM_RUNS): { result: R; timing: Timing } {
  let start = performance.now();
  const result = work();
  const coldMs = performance.now() - start;
  const warm: number[] = [];
  for (let run = 0; run < runs; run++) {
    start = performance.now();
    work();
    warm.push(performance.now() - start);
  }
  warm.sort((a, b) => a - b);
  return { result, timing: { coldMs, medianMs: warm.length === 0 ? null : warm[Math.floor(warm.length / 2)] } };
}

const ms = (timing: Timing): string =>
  timing.medianMs === null
    ? `${timing.coldMs.toFixed(0)} ψυχρή ms`
    : `${timing.coldMs.toFixed(0)} ψυχρή / ${timing.medianMs.toFixed(0)} διάμεσος ms`;

/** Τα μέρη της προετοιμασίας χωριστά — ώστε η απόφαση να ξέρει ΤΙ θα πήγαινε στον worker. */
function phasesOf(points: readonly TopoPoint[]): string[] {
  const source = surveySourceOf(points);
  const judged = timed(() => judgeListingTerrainSource(source));
  const lines = [`  κριτής (σχήμα + TIN + στιγμιότυπο): ${ms(judged.timing)}`];
  if (!judged.result.ok) return lines;
  const { source: canonical, frame } = judged.result;
  lines.push(`  facts: ${ms(timed(() => surveyFactsOf(canonical.points)).timing)}`);
  lines.push(`  κωδικοποίηση + bytes: ${ms(timed(() => new TextEncoder().encode(encodeListingTerrainSource(canonical)).length).timing)}`);
  lines.push(`  σημάνσεις: ${ms(timed(() => surveyMarksOf(canonical.points, frame)).timing)}`);
  return lines;
}

function report(label: string, points: readonly TopoPoint[]) {
  const prepared = timed(() => prepareSurveyUpload(points));
  const lines = [`[ADR-920 Β4.8 μέτρηση] ${label}: ${points.length} σημεία`, `  prepareSurveyUpload: ${ms(prepared.timing)}`];
  if (FULL) lines.push(...phasesOf(points));
  const preparation = prepared.result;
  if (preparation.ok) {
    const { snapshot, marks } = preparation;
    const model = timed(() => terrainMapModelOf(snapshot, marks));
    lines.push(`  τρίγωνα: ${snapshot.mesh.slopeClass.length} · ισοϋψείς: ${snapshot.contours.length}`);
    lines.push(`  terrainMapModelOf: ${ms(model.timing)} · μέγεθος μοντέλου (JSON): ${(JSON.stringify(model.result).length / 1024).toFixed(0)} KiB`);
    lines.push(`  σώμα αποστολής: ${(preparation.encoded.length / 1024).toFixed(0)} KiB`);
  } else {
    lines.push(`  άρνηση: ${preparation.code}`);
  }
  console.log(lines.join('\n'));
  return preparation;
}

describe('ADR-920 Β4.8 — κόστος προεπισκόπησης σε πραγματικά μεγέθη', () => {
  jest.setTimeout(300_000);

  it('10k σημεία: περνά', () => {
    expect(report('10k', surveyOf(100)).ok).toBe(true);
  });

  fullOnly('~29k σημεία (η βαρύτερη που περνά): περνά', () => {
    expect(report('~29k', surveyOf(170)).ok).toBe(true);
  });

  fullOnly('~100k σημεία (το όριο του συμβολαίου): άρνηση «πολύ πυκνό», μετά το TIN', () => {
    const preparation = report('~100k', surveyOf(316));
    expect(preparation).toMatchObject({ ok: false, code: 'TERRAIN_TOO_DENSE' });
  });
});
