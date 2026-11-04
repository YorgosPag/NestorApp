/**
 * Τύποι της ευθυγράμμισης κάτοψης (ADR-929 Φ1): τι ζητά και τι απαντά ο Worker.
 *
 * 🔑 **Δύο χώροι pixel, μία γέφυρα (Δ3).** Η ευθυγραμμισμένη εικόνα έχει **δικά της** pixel (`aligned`): ίσια, καθαρή,
 * σε ανάλυση εργασίας. Κάθε εύρημα των επόμενων φάσεων γυρίζει στα **αρχικά** pixel (`raster-px`, το φυσικό πλέγμα του
 * υποβάθρου) **μόνο** μέσω της {@link PlanAlignment.alignedToOriginal}. Μια ομογραφία στέλνει ευθείες σε ευθείες, άρα
 * τα άκρα ενός τμήματος μεταφέρονται ακριβώς, και ένα ορθογώνιο γίνεται τετράπλευρο ({@link PlanRegion.originalQuad}).
 *
 * 🔑 **Ο έλεγχος του ανθρώπου πριν από κάθε αποστολή (Δ15 #4).** Η πινακίδα και τα υπομνήματα είναι **υποψήφιες**
 * περιοχές με βεβαιότητα. Ο πελάτης τις δείχνει επισημασμένες και ο χρήστης τις διορθώνει πριν κοπούν. Καμία δεν
 * κόβεται σιωπηλά εδώ.
 *
 * @module subapps/dxf-viewer/bim/plan-recognition/alignment/plan-alignment-types
 * @see docs/centralized-systems/reference/adrs/ADR-929-raster-plan-recognition.md §6.2
 */

import type { Homography, Quad } from '@/lib/geometry/homography';
import type { PlanRaster } from '@/lib/geometry/raster/plan-raster';
import type { RasterRectPx } from '../../../types/coordinate-space';

/**
 * Οι δύο δυαδοποιήσεις του Δ14: **σάρωση** (ασπρόμαυρη/κιτρινισμένη, σκοτάδι = μελάνι) και **αγγελία** (χρωματιστή
 * κάτοψη: τα γεμάτα χρώματα των χώρων ΔΕΝ είναι μελάνι, μόνο το ουδέτερο σκούρο).
 */
export type PlanBinarization = 'scan' | 'listing';

export interface PlanAlignOptions {
  /** Ανώτατα pixel της εικόνας εργασίας: μεγαλύτερη πηγή ⇒ μείωση με ακέραιο συντελεστή (μέσος περιοχής). */
  readonly maxWorkingPixels: number;
  readonly binarization: PlanBinarization | 'auto';
  readonly deskew: boolean;
  /** Κάτω από αυτή τη βεβαιότητα κλίσης η εικόνα **δεν** περιστρέφεται (αρχή 4: καμία τυφλή διόρθωση). */
  readonly minSkewConfidence: number;
  /** Κλίσεις κάτω από αυτό (μοίρες) θεωρούνται ήδη ίσιες: η περιστροφή θα θόλωνε χωρίς όφελος. */
  readonly minSkewDeg: number;
  /**
   * Διόρθωση προοπτικής από 4 σημεία (φωτογραφία κινητού, Δ14 α): οι γωνίες του φύλλου σε **αρχικά** px, με σειρά
   * πάνω-αριστερά · πάνω-δεξιά · κάτω-δεξιά · κάτω-αριστερά. `null` ⇒ καμία.
   */
  readonly perspectiveQuad: Quad | null;
  /** Συνιστώσες μελανιού κάτω από αυτό το εμβαδόν (px εργασίας) σβήνονται ως θόρυβος. */
  readonly speckleMaxAreaPx: number;
  readonly detectSheet: boolean;
}

export const DEFAULT_PLAN_ALIGN: PlanAlignOptions = {
  maxWorkingPixels: 12_000_000,
  binarization: 'auto',
  deskew: true,
  minSkewConfidence: 0.25,
  minSkewDeg: 0.02,
  perspectiveQuad: null,
  speckleMaxAreaPx: 6,
  detectSheet: true,
};

/** Ορθογώνιο σε px της **ευθυγραμμισμένης** εικόνας, συνεχής χώρος, `max` αποκλειστικό. */
export interface AlignedRectPx {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

/** Μια περιοχή και στους δύο χώρους: όπως τη βλέπει η ανάλυση και όπως πέφτει στην αρχική εικόνα. */
export interface PlanRegion {
  readonly aligned: AlignedRectPx;
  /** Το ίδιο ορθογώνιο στα αρχικά px — τετράπλευρο, γιατί η ομογραφία μπορεί να το στρίψει ή να το παραμορφώσει. */
  readonly originalQuad: Quad;
  /** Το περιβάλλον ορθογώνιο του `originalQuad` (για κοπή/απόκρυψη στον πελάτη). */
  readonly originalBounds: RasterRectPx;
}

/** Γιατί θεωρήθηκε πινακίδα ή υπόμνημα: ο Λεπτομερής έλεγχος (Δ18) το εξηγεί στον άνθρωπο. */
export interface AnnotationBlock {
  readonly region: PlanRegion;
  /** 0–1: ορθογωνιότητα κελιών · πλήθος κελιών · κείμενο μέσα τους · θέση σε γωνία του πλαισίου. */
  readonly confidence: number;
  readonly cellCount: number;
  /** Η πλευρά του πλαισίου που ακουμπά — η πινακίδα κατά ISO 7200 ζει κάτω-δεξιά. */
  readonly anchoredTo: readonly ('top' | 'right' | 'bottom' | 'left')[];
}

export interface SheetLayout {
  /** Το πλαίσιο του φύλλου, όταν υπάρχει (τέσσερις μακριές γραμμές κοντά στις άκρες). */
  readonly frame: PlanRegion | null;
  /** Η περιοχή του σχεδίου: το εσωτερικό του πλαισίου, αλλιώς ολόκληρη η εικόνα. */
  readonly drawing: PlanRegion;
  /** Υποψήφιες πινακίδες/υπομνήματα, κατά φθίνουσα βεβαιότητα. Περιέχουν προσωπικά δεδομένα (Δ15 #4). */
  readonly annotations: readonly AnnotationBlock[];
}

export interface SkewResult {
  /** Η μετρημένη γωνία των κυρίαρχων ευθειών (raster-px, `+x → +y`). */
  readonly angleDeg: number;
  readonly confidence: number;
  /** `true` ⇒ η εικόνα περιστράφηκε κατά `−angleDeg`. */
  readonly applied: boolean;
}

/** Η έξοδος της Φ1: ευθυγραμμισμένη εικόνα + ομογραφίες + ό,τι μετρήθηκε στον δρόμο. */
export interface PlanAlignment {
  readonly image: PlanRaster;
  /** Μάσκα μελανιού της `image` (`1` = μελάνι), καθαρισμένη από κηλίδες: η είσοδος της Φ2. */
  readonly ink: Uint8Array;
  readonly alignedToOriginal: Homography;
  readonly originalToAligned: Homography;
  /** Τα όρια της **αποκωδικοποιημένης** αρχικής εικόνας (§6.1 #2: ποτέ το `naturalBounds` του εγγράφου). */
  readonly original: { readonly width: number; readonly height: number };
  /** Ο ακέραιος συντελεστής μείωσης αρχική → εργασίας (1 = καμία). */
  readonly workingScale: number;
  readonly binarization: PlanBinarization;
  readonly skew: SkewResult;
  readonly perspectiveApplied: boolean;
  readonly sheet: SheetLayout | null;
}
