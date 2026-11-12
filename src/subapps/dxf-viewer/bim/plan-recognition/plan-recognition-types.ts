/**
 * Τύποι της αναγνώρισης κάτοψης από εικόνα (ADR-929 Φ0) — το **συμβόλαιο** ανάμεσα στις φάσεις:
 * γεωμετρία (Φ2, όραση υπολογιστή) · ανάγνωση (Φ3, VLM) · σύντηξη (Φ4) · έλεγχος (Φ5).
 *
 * 🔑 **Ένας χώρος συντεταγμένων για ΟΛΑ τα ευρήματα (Δ3).** Κάθε σημείο και κάθε πλαίσιο εδώ είναι σε
 * **φυσικά px της εικόνας υποβάθρου** (`raster-px`: αρχή πάνω-αριστερά, Y προς τα κάτω), δηλαδή στην
 * **αρχική** εικόνα και όχι στην ευθυγραμμισμένη. Η ευθυγράμμιση της Φ1 κρατά την ομογραφία της και
 * γυρίζει κάθε εύρημα πίσω σε αρχικά px πριν το παραδώσει: μια ομογραφία στέλνει ευθείες σε ευθείες, άρα
 * τα άκρα ενός τμήματος μεταφέρονται ακριβώς. Στη σκηνή περνούν **μόνο** μέσω
 * `floorplan-background/geometry/raster-scene-mapping.ts` (`rasterPixelToScene`).
 *
 * 🔑 **Το VLM δεν δίνει συντεταγμένες γεωμετρίας (Δ5).** Αναφέρεται σε **IDs** τμημάτων της Φ2. Γι' αυτό
 * η {@link PlanReading} δεν έχει κανένα σημείο τοίχου. Έχει μόνο πλαίσια κειμένου (πού γράφτηκε κάτι)
 * και δείκτες προς τμήματα (σε ποια γραμμή αναφέρεται).
 *
 * 🔑 **Η μονάδα στο όνομα (ADR-793).** `…Mm`, `…M2`, `…Px`: κανένας αριθμός μήκους χωρίς μονάδα.
 *
 * @module subapps/dxf-viewer/bim/plan-recognition/plan-recognition-types
 * @see docs/centralized-systems/reference/adrs/ADR-929-raster-plan-recognition.md
 */

import type { Point2D } from '../../rendering/types/Types';
import type { RasterRectPx } from '../../types/coordinate-space';

// ─── Είσοδος (Δ14) ───────────────────────────────────────────────────────────

/**
 * Τα τέσσερα είδη εισόδου του Δ14, με τη σειρά προτεραιότητας: σάρωση παλιού σχεδίου (β) · PDF χωρίς
 * διανύσματα πολλών σελίδων (δ) · κάτοψη αγγελίας (γ) · σκίτσο με το χέρι (α).
 */
export type PlanInputKind = 'scan' | 'multipage-pdf' | 'listing' | 'sketch';

// ⚠️ Η εικόνα ως pixel ΔΕΝ δηλώνεται εδώ: είναι το `PlanRaster` (`@/lib/geometry/raster/plan-raster`,
// RGBA από `getImageData`) που ήδη τρέφει τον ανιχνευτή χώρων του ADR-884 σε Web Worker, μαζί με τα εργαλεία του
// `lib/geometry/raster/` (Otsu · μορφολογία · συνιστώσες · περίγραμμα). Δεύτερος τύπος για το ίδιο buffer θα
// χώριζε τη Φ1 από αυτά (ADR-929 §3).

// ─── Βεβαιότητα και προέλευση (Δ9) ──────────────────────────────────────────

/** Οι μηχανές που συνεισφέρουν βεβαιότητα: η γεωμετρία, η ανάγνωση, ο λύτης (Δ1, Δ9). */
export type PlanConfidenceFactor = 'geometry' | 'reading' | 'solver';

/**
 * Βεβαιότητα στο κλειστό διάστημα [0, 1], **μαζί** με τις συνιστώσες της. Η συνολική τιμή αποφασίζει
 * `ready` ή `needs-decision`. Οι συνιστώσες εξηγούν στον άνθρωπο (Λεπτομερής όψη, Δ18) **ποια** μηχανή
 * διστάζει, ώστε η ερώτηση να είναι συγκεκριμένη και όχι «δεν είμαι σίγουρος».
 */
export interface PlanConfidence {
  readonly score: number;
  readonly factors: Readonly<Partial<Record<PlanConfidenceFactor, number>>>;
}

/**
 * Η προέλευση ενός ευρήματος: **από πού** στην **αρχική** εικόνα βγήκε. Ταξιδεύει μαζί με την πρόταση
 * ως το στοιχείο της σκηνής. Επιτρέπει το «κλικ στο στοιχείο ⇒ εστίαση στην πηγή» (Δ9) και την ένδειξη
 * «εκτίμηση από κάτοψη» στο δημόσιο αποτέλεσμα (Δ18 #4).
 */
export interface PlanSource {
  /** Το υπόβαθρο ορόφου (ADR-340, `rbg_*`): η **μόνη** πηγή αναγνώρισης (Δ2). */
  readonly backgroundId: string;
  readonly fileId: string;
  /** Σελίδα PDF με αρίθμηση από 1· για εικόνα πάντα 1. */
  readonly pageNumber: number;
  readonly rect: RasterRectPx;
}

// ─── Φ2: γεωμετρία από όραση υπολογιστή ──────────────────────────────────────

/**
 * Ένα ευθύγραμμο τμήμα της εικόνας. Το `id` είναι **σταθερό μέσα σε μία αναγνώριση** και είναι ό,τι
 * βλέπει το VLM (Δ5: «η διάσταση 3.50 αναφέρεται στο τμήμα s17»).
 */
export interface RasterSegment {
  readonly id: string;
  /** Άκρα σε φυσικά px της αρχικής εικόνας (`raster-px`). */
  readonly start: Point2D;
  readonly end: Point2D;
  /**
   * Τι είναι η γραμμή στην εικόνα (Φ2). `stroke`: η **μέση γραμμή** μιας πινελιάς (περιγραμμένος τοίχος, συνήθης
   * σάρωση). `fill-face`: το **όριο** μιας γεμάτης περιοχής (poché), δηλαδή μία από τις δύο παρειές ενός γεμάτου
   * τοίχου. Και τα δύο είναι παρειές για τη στρατηγική ζευγών (Δ7), ώστε **μία** στρατηγική να καλύπτει και τα δύο στυλ.
   */
  readonly style: 'stroke' | 'fill-face';
  /**
   * Μετρημένο πάχος μελανιού σε px της **αρχικής** εικόνας. Για `stroke`, το πάχος της πινελιάς. Για `fill-face`, το
   * πάχος της γεμάτης περιοχής που οριοθετεί: απέναντι, σε αυτή την απόσταση, πρέπει να υπάρχει η άλλη παρειά.
   */
  readonly strokeWidthPx: number;
  readonly confidence: PlanConfidence;
}

// ─── Φ5.4: ρόλος τμήματος — τι ΕΙΝΑΙ η γραμμή (ADR-929 §6.7) ─────────────────

/**
 * Τι είναι ένα τμήμα στο σχέδιο. Η γεωμετρία (Φ2) δίνει **πού** είναι η γραμμή· ο ρόλος λέει **τι** είναι, ώστε μια γραμμή
 * διάστασης να μη γίνει ποτέ παρειά τοίχου. `unknown` = τα τεκμήρια δεν αποφασίζουν: μένει υποψήφια παρειά (ποτέ σιωπηλή
 * απόρριψη πραγματικού τοίχου), αλλά φαίνεται ως αβέβαιη. Επεκτάσιμο (π.χ. `symbol`) χωρίς αλλαγή σχήματος.
 */
export type PlanSegmentRole = 'wall-face' | 'dimension-line' | 'extension-line' | 'annotation' | 'unknown';

/** Η απόληξη στο άκρο μιας γραμμής: βέλος · πλάγια παύλα · κουκκίδα · κάθετη γραμμή που τη διασχίζει · καμία. */
export type PlanTerminatorKind = 'arrow' | 'tick' | 'dot' | 'cross' | 'none';

/**
 * Τα τεκμήρια του ρόλου, με όνομα (Δ9: ο άνθρωπος βλέπει **γιατί**): κείμενο που διακόπτει ή συνοδεύει τη γραμμή ·
 * απολήξεις · γραμμές επέκτασης · λεπτή πινελιά. (Η δεύτερη γνώμη του VLM προστίθεται όταν υλοποιηθεί, όχι πριν.)
 */
export type PlanRoleFactor = 'text' | 'terminators' | 'extension' | 'thinness';

/**
 * ADR-929 Φ5.5 — μια γραμμή επέκτασης πάνω σε γραμμή διάστασης: **ποια**, και ποιο άκρο της είναι το **πόδι** (το ελεύθερο,
 * προς το μετρούμενο αντικείμενο). Μόνο ids: η γεωμετρία ζει στο `RasterSegment`, ποτέ δεύτερη φορά εδώ.
 */
export interface PlanExtensionAnchor {
  readonly extensionId: string;
  readonly foot: 'start' | 'end';
}

/** Η κρίση για ΕΝΑ τμήμα. Ζει **δίπλα** στο `RasterSegment`, όχι μέσα του: η γεωμετρία (και το κλειδί ανάγνωσης) δεν αλλάζει. */
export interface PlanSegmentRoleVerdict {
  readonly segmentId: string;
  readonly role: PlanSegmentRole;
  /** Πιθανότητα «γραμμή διάστασης» στο [0, 1], από τη λογιστική άθροιση των παραγόντων. */
  readonly dimensionScore: number;
  readonly factors: Readonly<Partial<Record<PlanRoleFactor, number>>>;
  /** Οι απολήξεις στο `start` και στο `end`. */
  readonly terminators: readonly [PlanTerminatorKind, PlanTerminatorKind];
  /**
   * ADR-929 Φ5.5 — μόνο για `dimension-line`: οι γραμμές επέκτασης που την τερματίζουν **ή την τέμνουν** (τα ενδιάμεσα
   * σημεία μιας αλυσίδας). Προαιρετικό: παλιότερες αποθηκευμένες εκτελέσεις δεν το έχουν.
   */
  readonly extensionAnchors?: readonly PlanExtensionAnchor[];
}

// ─── Φ3: ανάγνωση από VLM (θύρα `PlanReader`, Δ5) ────────────────────────────

/**
 * `opening-size`: η ετικέτα ανοίγματος των ελληνικών σχεδίων («0.80/2.20» σε κύκλο = πλάτος/ύψος). Χωριστό είδος, ώστε να
 * μη μπει στον λύτη ως διάσταση χώρου (Δ8) και να δέσει με το άνοιγμα της Φ6.
 */
export type PlanTextKind = 'dimension' | 'room-name' | 'area' | 'scale' | 'title' | 'opening-size' | 'other';

/** Ένα κείμενο της εικόνας: **τι** γράφει και **πού** (το πλαίσιο, όχι γεωμετρία του σχεδίου). */
export interface PlanText {
  readonly id: string;
  readonly kind: PlanTextKind;
  /** Όπως γράφτηκε, χωρίς ερμηνεία («3.50x3.40», «1:100», «Σαλόνι 24 τ.μ.»). */
  readonly raw: string;
  readonly rect: RasterRectPx;
  readonly confidence: PlanConfidence;
  /**
   * ADR-929 Δ21 (δ) — τι διάβασε η **μηχανή**, όταν ο άνθρωπος διόρθωσε το κείμενο (`reading/reading-corrections.ts`).
   * Η παρουσία του **είναι** η προέλευση «άνθρωπος» (Δ9): το `raw` λέει τι ισχύει, αυτό λέει τι διαβάστηκε.
   */
  readonly correctedFrom?: string;
  /**
   * ADR-929 Δ21 (δ) βήμα 3 — ο άνθρωπος **επιβεβαίωσε** ότι η μηχανή διάβασε σωστά («Σωστό ✓»): προέλευση «άνθρωπος» (Δ9)
   * **χωρίς** αλλαγή κειμένου. Αποκλείεται με το `correctedFrom` (μία διόρθωση ανά κείμενο).
   */
  readonly confirmed?: true;
}

/** Γραμμένη διάσταση δεμένη σε τμήματα της Φ2: ο **ισχυρός** περιορισμός του λύτη (Δ8). */
export interface PlanDimension {
  readonly textId: string;
  readonly valueMm: number;
  readonly segmentIds: readonly string[];
  readonly confidence: PlanConfidence;
}

/** Γραμμένη κλίμακα σχεδίου («1:100» ⇒ `denominator: 100`), πηγή κλίμακας #2 του Δ4. */
export interface PlanWrittenScale {
  readonly textId: string;
  readonly denominator: number;
  readonly confidence: PlanConfidence;
}

/** Χώρος όπως τον διαβάζει το VLM: όνομα, γραμμένο εμβαδόν, όρια ως IDs τμημάτων (Δ17). */
export interface PlanRoomReading {
  readonly name: string;
  /** Το εμβαδόν **όπως γράφτηκε**: το μετρημένο το υπολογίζει ο λύτης από τα όρια, ποτέ αντιγραφή. */
  readonly writtenAreaM2: number | null;
  readonly boundarySegmentIds: readonly string[];
  readonly nameTextId: string | null;
  readonly confidence: PlanConfidence;
}

export type PlanOpeningKind = 'door' | 'window';

/** Άνοιγμα ως «τοίχος Χ, θέση περίπου, είδος» (Δ5): η ακριβής θέση έρχεται από τα κενά της Φ2. */
export interface PlanOpeningReading {
  readonly kind: PlanOpeningKind;
  readonly hostSegmentId: string;
  /** Θέση κατά μήκος του τμήματος-ξενιστή, στο [0, 1] από το `start`. */
  readonly alongFraction: number;
  /** Η ετικέτα μεγέθους του ανοίγματος (`opening-size`), αν διαβάστηκε. */
  readonly sizeTextId: string | null;
  readonly confidence: PlanConfidence;
}

/** Η έξοδος **ενός** περάσματος ανάγνωσης (Δ5: χωρίς βρόχο αυτο-διόρθωσης). */
export interface PlanReading {
  /** Το μοντέλο της OpenAI που διάβασε (§9.1) — μέρος του κλειδιού κρυφής μνήμης (Δ11). */
  readonly model: string;
  /** Έκδοση prompt + σχήματος: αλλάζει ⇒ νέο κλειδί ⇒ νέα ανάγνωση, ποτέ μπαγιάτικη απάντηση. */
  readonly schemaVersion: number;
  readonly texts: readonly PlanText[];
  readonly dimensions: readonly PlanDimension[];
  readonly writtenScale: PlanWrittenScale | null;
  readonly rooms: readonly PlanRoomReading[];
  readonly openings: readonly PlanOpeningReading[];
}

// ─── Φ4: το αποτέλεσμα της αναγνώρισης ───────────────────────────────────────

/**
 * Γιατί **δεν** υπάρχει ανάγνωση VLM. Ποτέ σιωπηλή υποβάθμιση (Δ15 #1, Δ16 #4): ο χρήστης βλέπει τι
 * λείπει και γιατί, και η γεωμετρία μόνη της δίνει ήδη προτάσεις.
 */
export type PlanReadingUnavailableReason =
  /** Ο διαχειριστής της εταιρείας έκλεισε την ανάγνωση σχεδίων με AI (Δ15 #1). */
  | 'ai-disabled-for-company'
  /** Η πολιτική απορρήτου σε ισχύ δεν γνωστοποιεί ακόμη την ανάγνωση σχεδίων (Δ15 #3): καμία αποστολή ως τότε. */
  | 'ai-legal-disclosure-pending'
  | 'allowance-exhausted'
  /** Η δαπάνη του μήνα δεν διαβάστηκε: fail-closed, όχι «επιτρέπεται όταν δεν ξέρω». */
  | 'allowance-unverifiable'
  /** Η **εκτίμηση** της σελίδας ξεπερνά το όριο ανά σελίδα (Δ16 #2): η κλήση δεν έγινε. */
  | 'page-cost-exceeds-cap'
  /** Το κόστος δεν μπορεί να εκτιμηθεί (μοντέλο χωρίς τιμή ή εικόνα που ο πάροχος θα απέρριπτε): η κλήση δεν έγινε. */
  | 'cost-unknown'
  /** Χωρίς κλειδί παρόχου στον διακομιστή. */
  | 'reader-unconfigured'
  /** Η ίδια ανάγνωση τρέχει ήδη: ξαναρώτα σε λίγο (μία-πτήση, Δ11). */
  | 'reading-in-progress'
  | 'reader-failed';

export type PlanReadingOutcome =
  | { readonly status: 'read'; readonly reading: PlanReading }
  | { readonly status: 'unavailable'; readonly reason: PlanReadingUnavailableReason };

/** Ό,τι παράγει μία αναγνώριση ενός υποβάθρου, πριν γίνει προτάσεις του ADR-911. */
export interface PlanRecognitionResult {
  readonly backgroundId: string;
  readonly fileId: string;
  readonly pageNumber: number;
  readonly segments: readonly RasterSegment[];
  readonly reading: PlanReadingOutcome;
}
