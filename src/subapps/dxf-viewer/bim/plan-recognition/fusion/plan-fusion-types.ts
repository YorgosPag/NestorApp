/**
 * Τύποι της **σύντηξης** (ADR-929 Φ4): πώς συμφωνούν η γεωμετρία της Φ2 και η ανάγνωση της Φ3.
 *
 * 🔑 **Δύο χώροι pixel, ρητά.** Οι υπολογισμοί γίνονται στο **ευθυγραμμισμένο** πλαίσιο της Φ1 (`…AlignedPx`), όπου οι
 * παρειές των τοίχων είναι ευθείες σταθερής διεύθυνσης και η κλίμακα είναι (τοπικά) ενιαία. Ό,τι βλέπει ο άνθρωπος
 * (πλαίσιο πηγής, προτεινόμενα τμήματα) γυρίζει στα **αρχικά** px (`RasterRectPx`, `RasterSegment`) μέσω της ομογραφίας (Δ3).
 *
 * 🔑 **Η κλίμακα του λύτη είναι `k` = px ευθυγραμμισμένα ανά mm.** Η απόκριση προς τα έξω δίνει και τα μέτρα ανά **αρχικό**
 * pixel, με την ίδια σημασιολογία με το SSoT `RasterPixelScale`.
 *
 * 🔑 **Ερωτήσεις ως δεδομένα, όχι κείμενο.** Κωδικός + τιμές + πλαίσιο πηγής. Η διατύπωση (i18n el/en) ανήκει στη Φ5 (N.11).
 *
 * @module subapps/dxf-viewer/bim/plan-recognition/fusion/plan-fusion-types
 * @see docs/centralized-systems/reference/adrs/ADR-929-raster-plan-recognition.md §6.5
 */

import type { PlanePoint } from '@/lib/geometry/homography';
import type { RasterRectPx } from '../../../types/coordinate-space';
import type { RasterPixelScale } from '../../../floorplan-background/geometry/raster-pixel-scale';
import type { PlanAlignment } from '../alignment/plan-alignment-types';
import type {
  PlanConfidence,
  PlanInputKind,
  PlanReadingOutcome,
  PlanSegmentRole,
  RasterSegment,
} from '../plan-recognition-types';

// ─── Είσοδος ────────────────────────────────────────────────────────────────

/**
 * Μέτρηση εμβαδού του χώρου γύρω από ένα σημείο (ευθυγραμμισμένα px²), με δεδομένη κλίμακα για το κλείσιμο των θυρών.
 * Ενέσιμη, ώστε η σύντηξη να μένει καθαρή· η προεπιλογή είναι ο ανιχνευτής χώρων του ADR-884 (`room-area-probe.ts`).
 */
export type RoomAreaProbe = (seedAligned: PlanePoint, metresPerAlignedPx: number) => number | null;

export interface PlanFusionInput {
  readonly kind: PlanInputKind;
  readonly alignment: Pick<PlanAlignment, 'image' | 'originalToAligned' | 'alignedToOriginal' | 'sheet'>;
  readonly segments: readonly RasterSegment[];
  /**
   * `null` = **δεν ζητήθηκε ακόμα** (Φ5: ο άνθρωπος βλέπει πρώτα τη γεωμετρία και αποφασίζει αν θα στείλει, Δ15 #4).
   * Διαφέρει από το `unavailable`, που λέει γιατί μια ζητημένη ανάγνωση δεν έγινε.
   */
  readonly reading: PlanReadingOutcome | null;
  /** Η υπάρχουσα κλίμακα του υποβάθρου (`resolveRasterPixelScale`): όταν υπάρχει, **κερδίζει** (Δ4). */
  readonly knownScale: RasterPixelScale | null;
  /** DPI της αρχικής εικόνας (απόδοση PDF ή μεταδεδομένα σάρωσης), για τη γραμμένη κλίμακα «1:100». */
  readonly sourceDpi: number | null;
  /**
   * ADR-929 Φ5.4 — ο ρόλος κάθε τμήματος (`classifySegmentRoles`). Μόνο οι υποψήφιες παρειές (`isWallCandidateRole`)
   * γίνονται ευθείες του πλαισίου, ώστε καμία διάσταση να μη δεθεί σε γραμμή διάστασης. Χωρίς χάρτη (ή χωρίς εγγραφή για
   * ένα τμήμα) ⇒ το τμήμα είναι υποψήφιο: ποτέ σιωπηλή απόρριψη.
   */
  readonly segmentRoles?: ReadonlyMap<string, PlanSegmentRole>;
  readonly roomAreaProbe?: RoomAreaProbe;
  readonly options?: Partial<PlanFusionOptions>;
}

export interface PlanFusionOptions {
  /** Δύο τμήματα ανήκουν στην ίδια οικογένεια διεύθυνσης όταν διαφέρουν λιγότερο από αυτό (μοίρες). */
  readonly familyToleranceDeg: number;
  /**
   * Συνευθειακά τμήματα: εύρος ομάδας έως `max(minCollinearTolPx, collinearToleranceStroke × διάμεσο πινελιάς)`. Δύο,
   * επειδή η Φ2 σε στραβή, φθαρμένη σάρωση σπάει κατά τόπους μια πινελιά 2 px σε **δύο** μισές γραμμές 1,8 px η μία από την
   * άλλη (μετρημένο, §6.5): είναι η ίδια σχεδιασμένη γραμμή.
   */
  readonly collinearToleranceStroke: number;
  readonly minCollinearTolPx: number;
  /** Πόσο μακριά από το κείμενο (κλάσμα της μικρής πλευράς του σχεδίου) αναζητούνται οι παρειές μιας διάστασης. */
  readonly bindingReachFraction: number;
  /** Κατώτατη σχετική ανοχή δέσης/συναίνεσης (η πραγματική μεγαλώνει με τον θόρυβο του είδους εισόδου). */
  readonly bindingToleranceRel: number;
  /** Πόσες κοντινότερες ευθείες ανά πλευρά εξετάζονται για κάθε διάσταση. */
  readonly bindingNeighbours: number;
  /** Πόσο έξω από το κέντρο του ζεύγους μπορεί να κάθεται το κείμενο (κλάσμα της απόστασης, τυπική απόκλιση). */
  readonly centringRel: number;
  /**
   * Δέση **εκτός ανοχής** (βαθμίδα 2): η γεωμετρικά καλύτερη, όταν η τιμή απέχει έως τόσο. Έτσι μια **λάθος** γραμμένη τιμή
   * φτάνει στον λύτη ως σύγκρουση με τις δύο τιμές, αντί να μείνει σιωπηλά «αδέσμευτη».
   */
  readonly maxBlunderRel: number;
  /** Το ίδιο σε απόλυτη τιμή: για μια διάσταση 10 εκ. τα σχετικά ποσοστά δεν σημαίνουν τίποτα. */
  readonly maxBlunderMm: number;
  /** Βαθμίδα 1: το ζεύγος πρέπει να έχει κεντράρισμα ≥ αυτό × του καλύτερου κεντραρισμένου υποψηφίου. */
  readonly tier1CentringRel: number;
  /** Δεύτερο υποψήφιο με βαθμό ≥ αυτό × του πρώτου ⇒ η δέση είναι διφορούμενη. */
  readonly ambiguityRatio: number;
  /** Πλάτος κάδου του ιστογράμματος κλίμακας, σχετικό. */
  readonly scaleBinRel: number;
  /** Αβεβαιότητα θέσης παρειάς από την όραση, σε mm πραγματικού κόσμου, ανά είδος εισόδου. */
  readonly cvSigmaMm: Readonly<Record<PlanInputKind, number>>;
  /** Κάτω όριο της αβεβαιότητας θέσης σε px (κβάντιση εικόνας). */
  readonly cvSigmaFloorPx: number;
  /** Σφάλμα σχεδίασης μιας γραμμένης διάστασης πέρα από τη στρογγυλοποίηση (mm). */
  readonly dimensionDraftSigmaMm: number;
  /** Κρίσιμη τιμή του τεστ Baarda (α₀ = 0,001 ⇒ 3,29). */
  readonly baardaCritical: number;
  /** **Αριθμητικό** κατώφλι πλεονασμού: κάτω από αυτό η παρατήρηση δεν ελέγχεται **καθόλου** (κανένα `w`). */
  readonly minRedundancy: number;
  /**
   * Μια διάσταση είναι «μη ελέγξιμη» όταν το **ελάχιστο ανιχνεύσιμο σφάλμα** της (MDB, Baarda) ξεπερνά αυτό το κλάσμα της
   * τιμής της: τότε ένα λάθος της μπορεί να περάσει απαρατήρητο, και η εφαρμογή δεν ισχυρίζεται «συνεπής».
   */
  readonly uncheckableMdbRel: number;
  /** Σχετική διαφωνία κλίμακας ανάμεσα σε πηγές που γίνεται ερώτηση. */
  readonly scaleConflictRel: number;
  /** Σχετική διαφωνία γραμμένου/μετρημένου εμβαδού που γίνεται ερώτηση (καθαρό/μικτό εμβαδόν, στρογγυλοποίηση). */
  readonly areaConflictRel: number;
}

export const DEFAULT_PLAN_FUSION: PlanFusionOptions = {
  familyToleranceDeg: 1.5,
  collinearToleranceStroke: 2,
  minCollinearTolPx: 1.5,
  bindingReachFraction: 0.25,
  bindingToleranceRel: 0.015,
  bindingNeighbours: 24,
  centringRel: 0.05,
  maxBlunderRel: 0.5,
  maxBlunderMm: 500,
  tier1CentringRel: 0.5,
  ambiguityRatio: 0.85,
  scaleBinRel: 0.005,
  cvSigmaMm: { scan: 15, 'multipage-pdf': 10, listing: 40, sketch: 200 },
  cvSigmaFloorPx: 0.5,
  dimensionDraftSigmaMm: 3,
  baardaCritical: 3.29,
  minRedundancy: 1e-3,
  uncheckableMdbRel: 0.05,
  scaleConflictRel: 0.02,
  areaConflictRel: 0.06,
};

// ─── Πλαίσιο: οικογένειες διευθύνσεων και ευθείες παρειών ───────────────────

/** Μια διεύθυνση τοίχων στο ευθυγραμμισμένο πλαίσιο (γωνία στο [0, π)). 0 και π/2 υπάρχουν πάντα. */
export interface PlanDirectionFamily {
  readonly id: number;
  readonly angleRad: number;
}

/**
 * Μία **ευθεία παρειάς**: όλα τα συνευθειακά τμήματα της ίδιας οικογένειας. Ο άγνωστος του λύτη είναι η μετατόπισή της
 * κατά την κάθετο `n = (−sin θ, cos θ)`. Έτσι το σύστημα μένει **γραμμικό** και για λοξούς τοίχους.
 */
export interface FaceLine {
  readonly id: string;
  readonly familyId: number;
  /** Η παρατηρημένη μετατόπιση `n · p` (ευθυγραμμισμένα px). */
  readonly offsetPx: number;
  /** Το εύρος κατά μήκος της διεύθυνσης `u · p`. */
  readonly extentMinPx: number;
  readonly extentMaxPx: number;
  readonly segmentIds: readonly string[];
}

// ─── Δέση διαστάσεων ─────────────────────────────────────────────────────────

/** Ποιος πρότεινε τη δέση: η γεωμετρία μόνη, ή συμφώνησε και η ανάγνωση (Δ1: το VLM είναι ένδειξη). */
export type DimensionBindingSource = 'geometry' | 'geometry+reading';

export interface DimensionBinding {
  /** Η ευθεία με τη μικρότερη μετατόπιση (`lineA.offset < lineB.offset`). */
  readonly lineA: string;
  readonly lineB: string;
  readonly gapPx: number;
  readonly score: number;
  readonly source: DimensionBindingSource;
  readonly ambiguous: boolean;
  /** `false` ⇒ δέση βαθμίδας 2: η τιμή **δεν** ταιριάζει στην κλίμακα· ο λύτης θα κρίνει αν είναι σύγκρουση. */
  readonly withinTolerance: boolean;
}

export type FusedDimensionStatus = 'consistent' | 'conflict' | 'uncheckable' | 'unbound';

export interface FusedDimension {
  readonly textId: string;
  readonly valueMm: number;
  /** Η ακρίβεια γραφής («3.50» ⇒ 10 mm), από το κείμενο όπως γράφτηκε. */
  readonly precisionMm: number;
  readonly binding: DimensionBinding | null;
  /** Η απόσταση των παρειών **όπως σχεδιάστηκε**, στην επιλεγμένη κλίμακα. */
  readonly measuredMm: number | null;
  /** Η απόσταση **μετά τη συνόρθωση**. */
  readonly adjustedMm: number | null;
  /** Τυποποιημένο υπόλοιπο Baarda· `null` όταν δεν ελέγχεται. */
  readonly w: number | null;
  /** Αριθμός πλεονασμού στο [0, 1]: πόσο ελέγχεται η τιμή από τις υπόλοιπες. */
  readonly redundancy: number | null;
  /** Το μικρότερο λάθος γραφής που **θα** φαινόταν (MDB, mm): «ελέγχεται για λάθη ≥ 11 εκ.» στη Λεπτομερή όψη (Δ18). */
  readonly detectableErrorMm: number | null;
  readonly status: FusedDimensionStatus;
  readonly confidence: PlanConfidence;
  readonly rect: RasterRectPx;
}

// ─── Κλίμακα (Δ4) ────────────────────────────────────────────────────────────

export type PlanScaleSource = 'known-calibration' | 'dimension-consensus' | 'written-scale' | 'room-area';

export interface PlanScaleEvidence {
  readonly source: PlanScaleSource;
  readonly mmPerAlignedPx: number;
  /** Πόσες ανεξάρτητες ενδείξεις τη στηρίζουν (διαστάσεις, χώροι). */
  readonly support: number;
}

export interface PlanScaleSuggestion {
  readonly chosen: PlanScaleSource;
  readonly mmPerAlignedPx: number;
  /** Σχετική τυπική απόκλιση από τη συνόρθωση, όταν η κλίμακα ήταν άγνωστος του λύτη. */
  readonly sigmaRel: number | null;
  /** Μέτρα ανά **αρχικό** pixel στο κέντρο του σχεδίου (σημασιολογία του `RasterPixelScale`). */
  readonly metresPerOriginalPx: number;
  readonly evidence: readonly PlanScaleEvidence[];
}

// ─── Χώροι, ερωτήσεις, αποτέλεσμα ───────────────────────────────────────────

export type FusedRoomStatus = 'consistent' | 'conflict' | 'unmeasured';

export interface FusedRoom {
  readonly name: string;
  readonly writtenAreaM2: number | null;
  readonly measuredAreaM2: number | null;
  readonly status: FusedRoomStatus;
  readonly rect: RasterRectPx | null;
}

/**
 * Οι ερωτήσεις του λύτη. Στο `face-displaced` το `shiftMm` είναι **μέγεθος** (≥ 0): η κατεύθυνση φαίνεται από τα
 * `adjustedSegments`, όχι από ένα πρόσημο κατά μια κάθετο που ο άνθρωπος δεν βλέπει.
 */
export type PlanQuestion =
  | { readonly kind: 'dimension-conflict'; readonly textId: string; readonly writtenMm: number; readonly measuredMm: number; readonly severity: number; readonly rect: RasterRectPx }
  | { readonly kind: 'face-displaced'; readonly lineId: string; readonly shiftMm: number; readonly segmentIds: readonly string[]; readonly severity: number; readonly rect: RasterRectPx }
  | { readonly kind: 'scale-conflict'; readonly chosen: PlanScaleEvidence; readonly other: PlanScaleEvidence; readonly severity: number }
  | { readonly kind: 'area-conflict'; readonly roomName: string; readonly writtenM2: number; readonly measuredM2: number; readonly severity: number; readonly rect: RasterRectPx | null }
  | { readonly kind: 'ambiguous-binding'; readonly textId: string; readonly valueMm: number; readonly severity: number; readonly rect: RasterRectPx }
  | { readonly kind: 'unbound-dimension'; readonly textId: string; readonly valueMm: number; readonly severity: number; readonly rect: RasterRectPx };

export interface AdjustmentSummary {
  readonly observations: number;
  readonly unknowns: number;
  readonly degreesOfFreedom: number;
  /** A posteriori τυπική απόκλιση μοναδιαίου βάρους· ~1 όταν τα σ ήταν ρεαλιστικά. */
  readonly sigma0: number | null;
  /** Ολικό τεστ χ² (95%)· `null` χωρίς βαθμούς ελευθερίας. */
  readonly globalTestPassed: boolean | null;
  readonly rejected: number;
  readonly singular: boolean;
}

export interface PlanFusionResult {
  readonly families: readonly PlanDirectionFamily[];
  readonly faceLines: readonly FaceLine[];
  /** Η συνορθωμένη μετατόπιση ανά ευθεία (μόνο όσες μπήκαν στον λύτη). */
  readonly adjustedOffsetPx: ReadonlyMap<string, number>;
  /** Τα τμήματα της Φ2 μετά τη συνόρθωση, στα αρχικά px: η πρόταση προς τη Φ5. */
  readonly adjustedSegments: readonly RasterSegment[];
  readonly dimensions: readonly FusedDimension[];
  readonly scale: PlanScaleSuggestion | null;
  readonly rooms: readonly FusedRoom[];
  readonly questions: readonly PlanQuestion[];
  readonly segmentConfidence: ReadonlyMap<string, PlanConfidence>;
  /** ADR-929 Φ5.4 — ο ρόλος κάθε τμήματος, όπως μπήκε (κενός χάρτης ⇒ όλα υποψήφιες παρειές). */
  readonly segmentRoles: ReadonlyMap<string, PlanSegmentRole>;
  readonly adjustment: AdjustmentSummary | null;
}
