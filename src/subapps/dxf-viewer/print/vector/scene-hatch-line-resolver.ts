/**
 * ADR-667 Φ3 — **pre-pass γραμμών μοτίβου** για το vector PDF.
 *
 * **Το πρόβλημα που λύνει:** μετά τη Φ2 τα γεμίσματα «Εικόνα»/«Διαδικαστικά» βγαίνουν native
 * tiling patterns, αλλά ο **default τύπος κάθε νέου hatch** (`user-defined`, 45°/100mm) και τα
 * `predefined` εξακολουθούσαν να βγαίνουν **μόνο ως περίγραμμα** — άδειο σχήμα. Μαζί τους έλειπε
 * το `patternSpace:'screen'`, το **πιο κοινό** hatch του συστήματος (ο Τέκτων το βάζει σε **ΚΑΘΕ**
 * imported `.tek` hatch, `tek-hatch-to-bim.ts:102`).
 *
 * **Δύο μονοπάτια, ένα ερώτημα «τι ζωγραφίζεται»:**
 *   • `patternSpace:'screen'` → **ριγέ κελί** (tiling pattern). Το `patternSpace` είναι
 *     **ΟΡΘΟΓΩΝΙΑ διάσταση**, όχι κλάδος του `fillType` (Απόφαση 6) — το
 *     `buildHatchEntitySegments` **δεν το γνωρίζει καν** (δεν είναι στο `Pick<>` του) ⇒ αν το
 *     αγνοούσαμε, θα βγάζαμε **world-space γραμμές που ΠΟΤΕ δεν εμφανίστηκαν στην οθόνη**.
 *   • αλλιώς → **exploded segments** από το SSoT `buildHatchEntitySegments` — τις **ίδιες**
 *     γραμμές που τρέφουν την οθόνη (`drawPatternSegments`) και τον DXF writer. Αυτό ακριβώς
 *     κάνει και το AutoCAD PDF export: **πραγματικά διανύσματα**, όχι raster.
 *
 * 🔴 **ΓΙΑΤΙ PRE-PASS ΚΑΙ ΟΧΙ ΜΕΣΑ ΣΤΟ `draw`** (Απόφαση 7 — ο κανόνας δεν κάμπτεται):
 * το `capture.fidelity` το διαβάζει ο `runPrint` **ΑΦΟΥ** επιστρέψει το capture και **ΠΡΙΝ**
 * τρέξει το `draw` closure (`print-service.ts:167`) ⇒ ό,τι αποφασιστεί μέσα στο `draw` **δεν
 * μπορεί ΠΟΤΕ να αναφερθεί στον χρήστη**. Το `draw` είναι επιπλέον **σύγχρονο** (ADR-040). Το
 * pre-pass δεν είναι στυλιστική προτίμηση — είναι η **μόνη** θέση όπου υποβάθμιση **και**
 * ειδοποίηση λειτουργούν μαζί. (Η Φ2 το επιβεβαίωσε στην πράξη: ο pattern cap **μετακινήθηκε**
 * εδώ ακριβώς γι' αυτόν τον λόγο.)
 *
 * SSoT reuse (μηδέν νέα budget logic, N.12/N.18): `estimateHatchFillLines` +
 * `MAX_TEK_FILL_LINES_PER_HATCH/TOTAL` **αυτούσια** από τον TEK exporter (ADR-647).
 *
 * @module subapps/dxf-viewer/print/vector/scene-hatch-line-resolver
 * @see docs/centralized-systems/reference/adrs/ADR-667-pdf-native-tiling-patterns.md
 * @see export/core/tek/tek-hatch-explode.ts — ο budget guard SSoT + το πρότυπο χρήσης
 */

import type { Entity, HatchEntity } from '../../types/entities';
import {
  buildHatchEntitySegments, type HatchLineSegment,
} from '../../bim/geometry/shared/hatch-pattern-geometry';
import { isSolidHatch } from '../../bim/hatch/hatch-properties';
// ADR-647 SSoT — ο ΙΔΙΟΣ dense guard που προστατεύει το TEK export. Τα ονόματα λένε «TEK» επειδή
// εκεί γεννήθηκαν, αλλά το ερώτημα («πόσες γραμμές θα παραχθούν και αντέχουμε;») ΔΕΝ είναι
// format-specific. Δεύτερο σετ ορίων = δεύτερη budget logic = ακριβώς ό,τι απαγορεύει η Απόφαση 7.
import {
  estimateHatchFillLines, MAX_TEK_FILL_LINES_PER_HATCH, MAX_TEK_FILL_LINES_TOTAL,
} from '../../export/core/tek/tek-hatch-explode';
import type { PrintColorPolicy } from '../../config/print-color-policy';
import {
  SCREEN_HATCH_DEFAULT_ANGLE_DEG, SCREEN_HATCH_PAPER_CELL_W_MM,
  SCREEN_HATCH_PAPER_LINE_MM, SCREEN_HATCH_PAPER_SPACING_MM,
} from '../../rendering/entities/shared/screen-hatch-constants';
// ADR-667 Φ3.1 — ο density-LOD SSoT. Το ΙΔΙΟ ερώτημα που ρωτά η οθόνη σε px, εδώ σε mm χαρτιού.
import { isHatchDensityTooHighOnPaper } from '../../rendering/entities/shared/hatch-density-lod';
import { resolveHatchFillRgb } from './hatch-fill-style';
import type { PdfStripePatternCell } from './pdf-tiling-pattern';

/** Ένα screen-space hatch → το ριγέ κελί του + η γωνία του (η γωνία ζει στο `/Matrix`). */
export interface ResolvedStripeFill {
  readonly cell: PdfStripePatternCell;
  /** Γωνία γραμμών, **visual clockwise** — σύμβαση **οθόνης** (Απόφαση 12). */
  readonly angleDeg: number;
}

/** Αποτέλεσμα του pre-pass: segments + ριγέ κελιά + collapsed tints + warnings. */
export interface SceneHatchLineResolution {
  /** hatch id → γραμμές μοτίβου σε **world** (ο emitter τις mappάρει σε paper mm). */
  readonly segments: ReadonlyMap<string, readonly HatchLineSegment[]>;
  /** hatch id → ριγέ κελί (`patternSpace:'screen'`). */
  readonly stripeFills: ReadonlyMap<string, ResolvedStripeFill>;
  /**
   * ADR-667 Φ3.1 — hatch ids που είναι **πολύ πυκνά για το χαρτί** (ISO 128-2) ⇒ ο emitter τα
   * γεμίζει με **tint** αντί να ζωγραφίσει γραμμές που θα γίνονταν μαύρη μάζα. Κάτοπτρο του
   * density-LOD της οθόνης (Revit *pattern overscaling*).
   */
  readonly collapsedFills: ReadonlySet<string>;
  /** Διαγνωστικοί κωδικοί (ASCII, logs only — δεν περνούν i18n). */
  readonly warnings: string[];
}

/** Μεταβλητή κατάσταση του pre-pass (ένα αντικείμενο αντί για παράλληλες παραμέτρους). */
interface HatchLineSink {
  readonly segments: Map<string, readonly HatchLineSegment[]>;
  readonly stripeFills: Map<string, ResolvedStripeFill>;
  readonly collapsedFills: Set<string>;
  readonly warnings: string[];
  /** Υπόλοιπο συνολικού budget γραμμών (mirror του accumulator στο `tek-hatch-explode.ts:111`). */
  budget: number;
  /** mm ανά μονάδα σχεδίου — η **κλίμακα του χαρτιού** (το ανάλογο του `transform.scale`). */
  readonly worldToPaperScale: number;
}

/**
 * Walk τα (flattened) entities και resolve τις γραμμές μοτίβου κάθε γραμμοσκίασης. **Καθαρά
 * σύγχρονο** (μηδέν decode) — αλλά τρέχει **εκτός** του `draw`, που είναι το μόνο που μετράει.
 * Μη-hatch entities αγνοούνται (δεν μπαίνουν σε κανένα map).
 */
export function resolveSceneHatchLines(
  entities: readonly Entity[], colorPolicy: PrintColorPolicy, worldToPaperScale: number,
): SceneHatchLineResolution {
  const sink: HatchLineSink = {
    segments: new Map(), stripeFills: new Map(), collapsedFills: new Set(), warnings: [],
    budget: MAX_TEK_FILL_LINES_TOTAL,
    worldToPaperScale,
  };

  for (const e of entities) {
    if (e.type !== 'hatch') continue;
    const hatch = e as HatchEntity;
    if (!needsPatternLines(hatch)) continue;
    // Απόφαση 6 — ΟΡΘΟΓΩΝΙΑ διάσταση: ελέγχεται ΠΡΙΝ τους world-space κλάδους, ακριβώς όπως
    // στην οθόνη (`HatchRenderer.ts:227-231`). Δεν είναι «άλλο fillType» — είναι άλλος ΧΩΡΟΣ.
    if (hatch.patternSpace === 'screen') {
      sink.stripeFills.set(hatch.id, buildStripeFill(hatch, colorPolicy));
      continue;
    }
    // 🔴 ADR-667 Φ3.1 — density-LOD ΠΡΙΝ το budget: ρωτά «είναι ΑΝΑΓΝΩΣΙΜΟ;», ο budget ρωτά
    // «ΑΝΤΕΧΟΥΜΕ;». Δύο διαφορετικά ερωτήματα ⇒ και τα δύο μένουν (βλ. `explodeWithBudget`).
    // Η σειρά είναι σκόπιμη: το collapse είναι ΚΑΙ perf win (μηδέν παραγωγή segments), οπότε
    // ρωτάμε πρώτα το φθηνό «θα φαίνεται καν;» και μόνο μετά ξοδεύουμε budget.
    if (isHatchDensityTooHighOnPaper(hatch, sink.worldToPaperScale)) {
      collapseToTint(hatch, sink);
      continue;
    }
    explodeWithBudget(hatch, sink);
  }

  return {
    segments: sink.segments,
    stripeFills: sink.stripeFills,
    collapsedFills: sink.collapsedFills,
    warnings: sink.warnings,
  };
}

/**
 * True όταν η γραμμοσκίαση φτάνει πράγματι στους κλάδους **γραμμών** του `emitHatch`.
 *
 * ⚠️ **Κάτοπτρο της σειράς dispatch** (Απόφαση 5 — η σειρά είναι ΝΟΜΟΣ): ό,τι κερδίζει **πριν**
 * από αυτούς δεν χρειάζεται ούτε κελί ούτε segments. Χωρίς αυτό, ένα solid hatch θα κατανάλωνε
 * budget για γραμμές που **δεν πρόκειται να ζωγραφιστούν ποτέ**.
 *
 * 🚫 **ΟΧΙ `switch (fillType)`:** το `fillType` είναι **optional** και οι δύο παραγωγοί `dxfFaces`
 * **δεν το θέτουν** ⇒ κάθε structural/poché solid θα έπεφτε στο `default`.
 */
function needsPatternLines(hatch: HatchEntity): boolean {
  // 1 — pre-computed faces (SOLID / poché): κερδίζουν τα πάντα στον emitter.
  if ((hatch as { dxfFaces?: unknown }).dxfFaces) return false;
  // 2 — συμπαγής: γεμίζει πλήρως, καμία γραμμή. (Χειρίζεται `fillType === undefined`.)
  if (isSolidHatch(hatch)) return false;
  // 4 — «Εικόνα»/«Διαδικαστικά»: raster tiling pattern (Φ2, `scene-image-resolver`).
  if (hatch.fillType === 'image') return false;
  // 6 — gradient: PDF shading patterns = ξεχωριστός μηχανισμός (⏳ Φ4).
  if (hatch.fillType === 'gradient') return false;
  return (hatch.boundaryPaths ?? []).some((p) => p.length >= 3);
}

/**
 * Ριγέ κελί ενός screen-space hatch. **Ταυτότητα = ΜΟΝΟ το μελάνι**: η γωνία μπαίνει στο
 * `/Matrix` του pattern, όχι μέσα στο κελί ⇒ **ένα κελί ανά χρώμα, όχι ανά γωνία** — ακριβώς
 * όπως ο `screenPatternCache` της οθόνης κλειδώνει **ανά χρώμα** και στρέφει με `setTransform`.
 *
 * Το πλήθος των διακριτών κελιών φράσσεται από τα χρώματα της σκηνής ⇒ ο
 * `MAX_PDF_PATTERNS_PER_PAGE` είναι εδώ αδιάφορος (η αμυντική γραμμή του registry αρκεί).
 */
function buildStripeFill(hatch: HatchEntity, policy: PrintColorPolicy): ResolvedStripeFill {
  const rgb = resolveHatchFillRgb(hatch, policy);
  return {
    cell: {
      kind: 'stripe',
      materialKey: `${rgb.r},${rgb.g},${rgb.b}`,
      cellWMm: SCREEN_HATCH_PAPER_CELL_W_MM,
      cellHMm: SCREEN_HATCH_PAPER_SPACING_MM,
      strokeRgb: rgb,
      lineWidthMm: SCREEN_HATCH_PAPER_LINE_MM,
    },
    angleDeg: hatch.lineAngle ?? SCREEN_HATCH_DEFAULT_ANGLE_DEG,
  };
}

/**
 * ADR-667 Φ3.1 — **πολύ πυκνό για να διαβαστεί στο χαρτί** ⇒ tint αντί για γραμμές.
 *
 * Κάτοπτρο του density-LOD της οθόνης (`HatchRenderer` → `isHatchDensityTooHighOnScreen`) και
 * **η τεκμηριωμένη πρακτική του Revit** (*pattern overscaling*: πολύ πυκνό μοτίβο → συμπαγές
 * γέμισμα, resolution-driven ⇒ ισχύει και στην εκτύπωση). Το AutoCAD **δεν** το κάνει: τυπώνει
 * κάθε γραμμή ⇒ **μαύρη μάζα** — αυτή ήταν ακριβώς η δική μας συμπεριφορά (μετρημένο: 0,089mm
 * απόσταση με 0,18mm μελάνι = **~200% κάλυψη**).
 *
 * **Αναφέρεται πάντα** (Απόφαση 11): σε αντίθεση με το catalog MISS, εδώ **υπάρχει υπαρκτή
 * απόκλιση από την οθόνη** — ο χρήστης βλέπει γραμμές στο zoom του και παίρνει απόχρωση στο
 * χαρτί. Το Revit το κάνει σιωπηλά· εμείς όχι.
 *
 * **ΜΠΟΝΟΥΣ — perf:** ακριβώς όπως η οθόνη, **παραλείπει την παραγωγή** των segments. Στο
 * περιστατικό αυτό σημαίνει **69.136 γραμμές που δεν υπολογίζονται καν**.
 */
function collapseToTint(hatch: HatchEntity, sink: HatchLineSink): void {
  sink.collapsedFills.add(hatch.id);
  sink.warnings.push('hatch-lines:density');
}

/**
 * Explode **με τον υπάρχοντα guard** (Απόφαση 7). Πρότυπο: `tek-hatch-explode.ts:119-130`.
 *
 * 🔴 **Ο guard τρέχει ΠΡΙΝ το `buildHatchEntitySegments`** — αλλιώς προστατεύει μόνο το μέγεθος
 * της εξόδου ενώ ο browser έχει **ήδη παγώσει**. Μετρημένο: 400×400 boundary με βήμα 0.127 =
 * **164s**· απουσία guard = **OOM 4GB**· το `clipSegmentToRegion` είναι
 * **O(γραμμές × ακμές ορίου)**. Θα αντικαθιστούσαμε ένα **ορατό** λάθος (κενό σχήμα) με ένα
 * **αόρατο πάγωμα** — απαράδεκτο.
 *
 * ⚠️ **Ο budget ΔΕΝ αντικαθιστά τον density-LOD** (το πίστευε η αρχική Απόφαση 7 — **λάθος**,
 * διορθώθηκε στη Φ3.1): μετράει **ΠΛΗΘΟΣ**, όχι **ΑΝΑΓΝΩΣΙΜΟΤΗΤΑ**. Οι 69.136 γραμμές που
 * παρήγαγαν τη μαύρη μάζα πέρασαν **άνετα** κάτω από τα 120.000. Απαντούν σε **άλλο ερώτημα**
 * («πάγωμα» vs «διαβάζεται;») ⇒ **και τα δύο** χρειάζονται, το ένα δεν καλύπτει το άλλο.
 */
function explodeWithBudget(hatch: HatchEntity, sink: HatchLineSink): void {
  const estimate = estimateHatchFillLines(hatch);
  if (estimate > MAX_TEK_FILL_LINES_PER_HATCH || estimate > sink.budget) {
    // Ορατή υποβάθμιση: η οθόνη δείχνει μοτίβο, το χαρτί μόνο περίγραμμα ⇒ ο χρήστης το μαθαίνει.
    sink.warnings.push('hatch-lines:budget');
    return;
  }
  const segments = buildHatchEntitySegments(hatch);
  // Catalog MISS / άγνωστο μοτίβο → `[]` (`hatch-pattern-geometry.ts:377`). **Καμία σημείωση**:
  // η οθόνη δείχνει κι αυτή τίποτα ⇒ **μηδέν απόκλιση** οθόνης↔χαρτιού, άρα τίποτα να αναφερθεί
  // (το fidelity report μετρά «τι έχασε το PDF έναντι της ΟΘΟΝΗΣ», όχι έναντι της πρόθεσης).
  // Ο emitter πέφτει στο ΔΑΠΕΔΟ περίγραμμα (Απόφαση 8) — καμία διαδρομή δεν καταλήγει σε «τίποτα».
  if (!segments.length) return;
  sink.budget -= segments.length;
  sink.segments.set(hatch.id, segments);
}
