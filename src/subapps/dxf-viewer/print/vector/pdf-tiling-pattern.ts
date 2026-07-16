/**
 * ADR-667 Φ2 — Native PDF Tiling Patterns (SSoT).
 *
 * **Το πρόβλημα που λύνει:** το vector PDF export **δεν ζωγράφιζε μοτίβο** — έστρωνε **N raster
 * tiles** (`addImage`) ανά γραμμοσκίαση και, πάνω από έναν αυθαίρετο cap, υποβάθμιζε σε **μέσο
 * χρώμα**: μια μεγάλη κεκλιμένη τοπογραφική επιφάνεια έβγαινε **συμπαγές γκρι**. Το PDF format
 * έχει **native Tiling Patterns** (PDF spec §8.7.3, Pattern Type 1): ορίζεις το κελί **μία** φορά,
 * δίνεις `XStep`/`YStep` + `/Matrix`, και ο viewer το επαναλαμβάνει επ' άπειρον. Το κόστος γίνεται
 * **σταθερό ως προς το εμβαδόν** (4.000 `addImage` → **1 pattern + 1 fill**). Αυτό ακριβώς κάνουν
 * το AutoCAD/Revit PDF export — καμία δική μας εφεύρεση.
 *
 * ⚠️ **Ο λόγος ύπαρξης αυτού του module (Απόφαση 2 — load-bearing, ΜΗ προφανές):** το
 * `fillWithPattern` του jsPDF (`jspdf.node.js:5152`) χτίζει `F = Matrix(1, 0, 0, -1, 0,
 * getPageHeight())` όπου το `getPageHeight()` επιστρέφει **mm**, ενώ το PDF spec απαιτεί το
 * pattern `/Matrix` να δείχνει σε **default user space = points**. **Το flip του jsPDF είναι
 * unit-buggy by construction** και επιβιώνει **μόνο** επειδή το `F` είναι involution (`F·F = I`)
 * → ακυρώνεται **ακριβώς** αν του δώσουμε `F.multiply(M_final)`.
 *
 * > **Αν ξεχαστεί η ακύρωση, το μοτίβο πέφτει ~74mm εκτός θέσης — ΧΩΡΙΣ κανένα σφάλμα.**
 *
 * ⇒ **ΕΝΑΣ** κάτοχος αυτών των μαθηματικών: το {@link patternMatrixFor}. **ΠΟΤΕ** open-coded ανά
 * call site.
 *
 * SSoT reuse (μηδέν clone, N.12/N.18): το «τι ζωγραφίζεται» (tile matrix / anchor / ταυτότητα
 * υλικού) ζει στο ADR-643 (`hatch-image-paint.ts`, `hatch-image-variant-key.ts`) και περνά εδώ
 * **αυτούσιο** μέσω του pre-pass· εδώ αλλάζει **μόνο το backend** (PDF pattern αντί `CanvasPattern`).
 *
 * @module subapps/dxf-viewer/print/vector/pdf-tiling-pattern
 * @see docs/centralized-systems/reference/adrs/ADR-667-pdf-native-tiling-patterns.md
 * @see docs/centralized-systems/reference/adrs/ADR-643-hatch-image-fill.md — το on-screen SSoT
 */

import type { jsPDF, Matrix, TilingPattern } from 'jspdf';
import { createModuleLogger } from '@/lib/telemetry';
import type { Point2D } from '../../rendering/types/Types';

const logger = createModuleLogger('DXF_PRINT');

/**
 * Ανώτατο πλήθος patterns **ανά σελίδα** — **μετρημένο**, όχι αυθαίρετο (Απόφαση 14). Τα resource
 * dictionaries είναι **O(n²)** (κάθε pattern παίρνει δικό του `/Resources` που απαριθμεί **όλα** τα
 * προηγούμενα): 100 → 0.14MB/48ms · 400 → 1.31MB/285ms · 800 → **4.78MB/762ms**. Στα 800 το κόστος
 * είναι ακόμη αποδεκτό (<1s). Στην πράξη η πραγματική περίπτωση είναι **1 pattern** (μία
 * τοπογραφική επιφάνεια) ⇒ **φράχτης, όχι λειτουργικό όριο**.
 *
 * ⚠️ Η **αναφερόμενη** απόφαση υπέρβασης ζει στο **async pre-pass** (`scene-image-resolver`), γιατί
 * το `capture.fidelity` διαβάζεται ΠΡΙΝ τρέξει το `draw` ⇒ ό,τι αποφασιστεί εδώ **δεν μπορεί ποτέ
 * να αναφερθεί**. Εδώ ο cap είναι **δεύτερη, αμυντική γραμμή** (N.7.2 #4 belt-and-suspenders).
 */
export const MAX_PDF_PATTERNS_PER_PAGE = 800;

/** Το **κελί** ενός μοτίβου: τι ζωγραφίζεται μία φορά και επαναλαμβάνεται. */
export interface PdfPatternCell {
  /**
   * Ταυτότητα **υλικού** (`imageFillVariantKey` — «τι ζωγραφίζεται», όχι «ποιο αρχείο»).
   * Χρησιμεύει ΚΑΙ ως `addImage` alias ⇒ ο jsPDF ενσωματώνει τα bytes **μία** φορά ως XObject και
   * κάθε κελί/clone το **αναφέρει** (`/I0 Do`), δεν το περιέχει.
   */
  readonly materialKey: string;
  /** Το raster του κελιού (PNG data URL — ίδιο idiom με `addImage`/`capture-2d`). */
  readonly dataUrl: string;
  /** Πλάτος/ύψος κελιού σε **paper mm**. Μη-τετράγωνα κελιά: η αναλογία ζει **εδώ** (Απόφαση 9). */
  readonly cellWMm: number;
  readonly cellHMm: number;
}

/** Πού «κουμπώνει» (phase) και πώς στρέφεται το μοτίβο πάνω στο χαρτί. */
export interface PdfPatternPlacement {
  /** Σημείο αγκύρωσης σε **paper mm** (Y-down — ίδιο frame με το `toPaper` του emitter). */
  readonly anchorMm: Point2D;
  /**
   * Γωνία μοτίβου σε μοίρες, **visual clockwise** — η σύμβαση της **οθόνης** είναι η αλήθεια
   * (Απόφαση 12: ό,τι βλέπει ο χρήστης ΕΙΝΑΙ ό,τι τυπώνεται).
   */
  readonly angleDeg: number;
}

/**
 * Registry **ανά `draw(pdf, area)` κλήση** — ΟΧΙ ανά document (Απόφαση 4).
 *
 * ⚠️ Το `runPrintSet` φτιάχνει N φύλλα, **το καθένα με δικό του `toPaper`/`worldToPaperScale`**,
 * και όλα πάνε σε **ΕΝΑ** jsPDF. Registry ανά document ⇒ ίδιο υλικό σε άλλο φύλλο θα έπαιρνε το
 * pattern του φύλλου 1 ⇒ **λάθος κλίμακα ΚΑΙ φάση, σιωπηλά**. Δύο φύλλα = δύο registries.
 */
export interface PdfPatternRegistry {
  /** Δηλώνει ότι το κελί θα χρειαστεί. Καθαρό bookkeeping — **μηδέν** κλήση jsPDF. */
  register(cell: PdfPatternCell): void;
  /**
   * Ορίζει **ΟΛΑ** τα δηλωμένα κελιά σε **ΕΝΑ** `advancedAPI()` block. Κλήση **μία** φορά, στην
   * **ΑΡΧΗ** του `draw()`, πριν εκπεμφθεί η πρώτη οντότητα (Απόφαση 10). Idempotent.
   */
  defineAll(): void;
  /**
   * Γεμίζει το **ήδη χτισμένο** current path με το μοτίβο (even-odd → νησίδες = τρύπες).
   * `false` ⇒ ο caller **πρέπει** να πέσει σε fallback (Απόφαση 8: καμία διαδρομή δεν καταλήγει
   * σε «τίποτα»).
   */
  fillCurrentPath(cell: PdfPatternCell, placement: PdfPatternPlacement): boolean;
}

/**
 * Το `cloneIndex` είναι **υπαρκτό runtime πεδίο** του jsPDF `TilingPattern` (`jspdf.node.js:985`)
 * που τα επίσημα types **δεν δηλώνουν**. Το `cloneTilingPattern` (`:5131`) το χρησιμοποιεί για
 * **ντετερμινιστικό** clone key ⇒ το διαβάζουμε για το memoise (Απόφαση 3). Ρητή δήλωση αντί για
 * `as any` (N.2 / enterprise standards).
 */
interface ClonableTilingPattern extends TilingPattern {
  readonly cloneIndex: number;
}

/**
 * **Ο μόνος** κάτοχος της ακύρωσης του `F` (Απόφαση 2). Επιστρέφει το `patternData.matrix` που
 * πρέπει να δοθεί στο `fillEvenOdd` ώστε, **αφού** ο jsPDF ξανα-εφαρμόσει το δικό του `F`, το
 * τελικό `/Matrix` να είναι το σωστό `M_final`.
 *
 * Σύμβαση πολλαπλασιασμού jsPDF (row-vector): `X.multiply(Y) === Y·X` — «**πρώτα Y, μετά X**».
 *
 * ⚠️ **Μην hardcode-άρεις `210`**: το `getPageHeight()` για A4 landscape επιστρέφει
 * `210.0015555555555` (floating slop του pt↔mm round-trip). Η ακύρωση είναι ακριβής **μόνο** αν
 * χτίσιμο και ακύρωση χρησιμοποιούν την **ίδια** τιμή ⇒ το `pageHeightMm` περνά ρητά.
 */
export function patternMatrixFor(
  pdf: jsPDF, pageHeightMm: number, placement: PdfPatternPlacement,
): Matrix {
  const k = pdf.internal.scaleFactor;
  const rad = (placement.angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  // A: cell(u,v) → page mm, Y-down. Σε Y-down frame το [c, s, −s, c] είναι **visual clockwise** —
  // ίδια σημασιολογία με το `.rotateSelf(angle)` του screen SSoT (`computeImageTileMatrix`).
  const a = pdf.Matrix(cos, sin, -sin, cos, placement.anchorMm.x, placement.anchorMm.y);
  // T: page mm (Y-down, πάνω-αριστερά) → default user space (points, Y-up, κάτω-αριστερά).
  const t = pdf.Matrix(k, 0, 0, -k, 0, pageHeightMm * k);
  // F: το unit-buggy flip που ΘΑ ξανα-εφαρμόσει το `fillWithPattern`. F·F = I ⇒ ακυρώνεται.
  const f = pdf.Matrix(1, 0, 0, -1, 0, pageHeightMm);
  return f.multiply(t.multiply(a)); // = F · (A·T) → ο jsPDF το κάνει (A·T)·F·F = A·T = M_final
}

/** Κλειδί **βάσης**: ίδιο υλικό + ίδιες διαστάσεις κελιού ⇒ ΕΝΑ ορισμένο κελί (dedup). */
function baseKeyOf(cell: PdfPatternCell): string {
  return `${cell.materialKey}|${cell.cellWMm}x${cell.cellHMm}`;
}

/** Εκφυλισμένο κελί (μηδενικό/άπειρο) → μη ζωγραφίσιμο· ο caller πέφτει σε fallback. */
function isDrawableCell(cell: PdfPatternCell): boolean {
  return Number.isFinite(cell.cellWMm) && Number.isFinite(cell.cellHMm)
    && cell.cellWMm > 0 && cell.cellHMm > 0 && cell.dataUrl.length > 0;
}

/** Εκφυλισμένη τοποθέτηση (NaN anchor/γωνία) → μη ζωγραφίσιμη. */
function isDrawablePlacement(p: PdfPatternPlacement): boolean {
  return Number.isFinite(p.anchorMm.x) && Number.isFinite(p.anchorMm.y)
    && Number.isFinite(p.angleDeg);
}

/**
 * Ορίζει **ΕΝΑ** κελί. Πρέπει να τρέχει **μέσα** σε `advancedAPI()`: εκεί `apiMode = ADVANCED` ⇒
 * **RAW** συντεταγμένες (μηδέν `scaleFactor`, μηδέν Y-flip) ⇒ το κελί γράφεται σε mm στο
 * `[0, 0, cellW, cellH]` και το `/Matrix` μένει **καθαρά ομοιόμορφο**.
 *
 * ⚠️ Το `beginTilingPattern` κάνει `beginNewRenderTarget` (`pages = []`)· **μόνο** το
 * `endTilingPattern` κάνει pop ⇒ το `finally` είναι **υποχρεωτικό**: αν σκάσει το `addImage` και
 * το stack δεν ξετυλιχθεί, **όλο το υπόλοιπο περιεχόμενο της σελίδας γράφεται μέσα στο pattern**
 * ⇒ **λευκή σελίδα, κανένα σφάλμα** (Απόφαση 10).
 */
function defineCell(
  pdf: jsPDF, key: string, cell: PdfPatternCell, bases: Map<string, ClonableTilingPattern>,
): void {
  const box = [0, 0, cell.cellWMm, cell.cellHMm];
  const base = pdf.TilingPattern(box, cell.cellWMm, cell.cellHMm) as ClonableTilingPattern;
  let embedded = false;
  pdf.beginTilingPattern(base);
  try {
    // Σταθερό alias ⇒ τα bytes ενσωματώνονται ΜΙΑ φορά ως XObject (μετρημένο: 1/16/64 fills →
    // ίδιο πλήθος XObjects). 'NONE' = μηδέν επανασυμπίεση ενός ήδη PNG raster.
    pdf.addImage(cell.dataUrl, 'PNG', 0, 0, cell.cellWMm, cell.cellHMm, cell.materialKey, 'NONE');
    embedded = true;
  } finally {
    pdf.endTilingPattern(key, base);
  }
  if (embedded) bases.set(key, base);
}

/**
 * Φτιάχνει registry για **ΕΝΑ** `draw(pdf, area)` πέρασμα (= ένα φύλλο).
 *
 * ⚠️ Το `pageHeightMm` διαβάζεται **ΕΔΩ**, εκτός κάθε `advancedAPI()`: μέσα σε render target το
 * `pageSize.getHeight()` επιστρέφει το **μέγεθος του κελιού**, όχι της σελίδας (Απόφαση 10).
 */
export function createPdfPatternRegistry(pdf: jsPDF): PdfPatternRegistry {
  const pageHeightMm = pdf.internal.pageSize.getHeight();
  const pending = new Map<string, PdfPatternCell>();
  const bases = new Map<string, ClonableTilingPattern>();
  /** matrix-key → clone key. Το memoise δίνει **ΚΑΙ** dedup **ΚΑΙ** έλεγχο θέσης (Απόφαση 3). */
  const clones = new Map<string, string>();
  let defined = false;

  function register(cell: PdfPatternCell): void {
    if (!isDrawableCell(cell)) return;
    const key = baseKeyOf(cell);
    if (!pending.has(key) && !bases.has(key)) pending.set(key, cell);
  }

  function defineAll(): void {
    if (defined) return;
    defined = true;
    if (pending.size === 0) return;
    pdf.advancedAPI(() => {
      // Το catch είναι ΜΕΣΑ στο body: το `advancedAPI` ΔΕΝ έχει try/finally γύρω από το callback
      // (`jspdf.node.js:1236-1254`) ⇒ ένα throw θα άφηνε τον api mode κολλημένο σε ADVANCED και
      // κάθε επόμενη compat κλήση (mm, Y-down) θα έγραφε RAW ⇒ κατεστραμμένη σελίδα, σιωπηλά.
      try {
        for (const [key, cell] of pending) defineCell(pdf, key, cell, bases);
      } catch (error) {
        // Ένα κελί που δεν ορίστηκε ΔΕΝ μπαίνει στο `bases` ⇒ το `fillCurrentPath` γυρίζει
        // `false` ⇒ ο caller πέφτει σε fallback (Απόφαση 8). Μηδέν σιωπή: το log το κρατά.
        logger.warn('Tiling pattern definition failed; falling back', { error });
      }
    });
    pending.clear();
  }

  function fillCurrentPath(cell: PdfPatternCell, placement: PdfPatternPlacement): boolean {
    const key = baseKeyOf(cell);
    const base = bases.get(key);
    // ⚠️ ΚΡΙΣΙΜΟ: το `fillWithPattern` με ΑΓΝΩΣΤΟ key κάνει `patterns[undefined]` → **σιωπηλό
    // no-op** (ούτε γέμισμα, ούτε σφάλμα). Ο έλεγχος εδώ είναι η μόνη άμυνα.
    if (!base || !isDrawablePlacement(placement)) return false;

    const matrix = patternMatrixFor(pdf, pageHeightMm, placement);
    // Το key είναι συνάρτηση **ΚΑΘΕ input του matrix** (Απόφαση 4) — resolved paper μαθηματικά,
    // όχι world ⇒ άλλο φύλλο/κλίμακα/φάση ⇒ άλλο pattern, ποτέ σιωπηλή επαναχρησιμοποίηση.
    const memoKey = `${key}|${matrix.toString()}`;
    const memoised = clones.get(memoKey);
    if (memoised) {
      pdf.fillEvenOdd({ key: memoised }); // ΧΩΡΙΣ matrix ⇒ μηδέν νέο clone, ψημένο /Matrix
      return true;
    }
    if (clones.size >= MAX_PDF_PATTERNS_PER_PAGE) return false;

    // Το clone key είναι **ντετερμινιστικό**: `cloneTilingPattern` (`jspdf.node.js:5131`) το χτίζει
    // ως `key + "$$" + cloneIndex++ + "$$"` ⇒ το διαβάζουμε ΠΡΙΝ το fill και το κρατάμε.
    const cloneKey = `${key}$$${base.cloneIndex}$$`;
    pdf.fillEvenOdd({
      key, matrix, boundingBox: [0, 0, cell.cellWMm, cell.cellHMm],
      xStep: cell.cellWMm, yStep: cell.cellHMm,
    });
    clones.set(memoKey, cloneKey);
    return true;
  }

  return { register, defineAll, fillCurrentPath };
}
