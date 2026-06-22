/**
 * ADR-507/508 (Tekton .TEK export) — τύποι records του exporter.
 *
 * Ο Τέκτων (v9.1) αποθηκεύει σε XML· οι συντεταγμένες σε **μέτρα**, η θέση/μήκος/γωνία
 * μέσω 2D affine `<xmatrix>`. Εδώ ζουν τα ενδιάμεσα (mapper → writer) σχήματα.
 */

/** 2D affine matrix του Τέκτονα: μοναδιαίο ορθογώνιο → οντότητα (μέτρα). */
export interface TekXMatrix {
  /** Διάνυσμα μήκους X (E−S). */
  readonly x00: number;
  /** Διάνυσμα πάχους X (n̂·t). */
  readonly x01: number;
  /** Διάνυσμα μήκους Y (E−S). */
  readonly x10: number;
  /** Διάνυσμα πάχους Y (n̂·t). */
  readonly x11: number;
  /** Σημείο εκκίνησης X (μέτρα). */
  readonly x20: number;
  /** Σημείο εκκίνησης Y (μέτρα). */
  readonly x21: number;
}

/** Ένα κούφωμα (πόρτα/παράθυρο) έτοιμο για σειριοποίηση σε nested `<open><record>` (μέτρα). */
export interface TekOpening {
  /** Ορατή ετικέτα (mark ή index). */
  readonly name: string;
  /** Ποδιά (sill) πάνω από το δάπεδο — `<elevation>` (μέτρα). */
  readonly sillM: number;
  /** Υπέρθυρο (head = sill + height) — `<top>` (μέτρα). */
  readonly headM: number;
  /** Πλευρά ανοίγματος 0/1 (φορά/μεντεσές· cosmetic — από handing). */
  readonly side: number;
  /** Στυλ συμβόλου 0=παράθυρο (υαλοπίνακας) / 1=πόρτα (φύλλο). */
  readonly style: number;
  /** Affine θέσης/πλάτους πάνω στον host τοίχο. */
  readonly xmatrix: TekXMatrix;
  /** Θέση ετικέτας διάστασης `<txtpos>` (μέτρα). */
  readonly txtX: number;
  readonly txtY: number;
}

/** Μία κορυφή footprint επίπλου σε world μέτρα (X,Y,Z) — `<point3d><record>`. */
export interface TekPlanePoint {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/**
 * Ένα έπιπλο σαν «κουτί πραγματικού μεγέθους» έτοιμο για σειριοποίηση σε `<plane><record>`
 * (όλα σε μέτρα). Ο Τέκτων εξωθεί το footprint πολύγωνο κατά `widthM` (πάχος plane = ύψος
 * επίπλου), από τη στάθμη που ορίζουν τα `pointZ` (= mounting elevation).
 */
export interface TekPlane {
  /** Footprint πολύγωνο (rotated rectangle) σε world μέτρα. */
  readonly points: readonly TekPlanePoint[];
  /** Πάχος εξώθησης = ύψος επίπλου (μέτρα). */
  readonly widthM: number;
  /** Χρώμα 6-ψήφιο hex ΧΩΡΙΣ `#`. */
  readonly colorHex: string;
}

/** Ένας τοίχος έτοιμος για σειριοποίηση σε `<record>` (όλα τα μήκη σε μέτρα). */
export interface TekWall {
  /** Ακέραιο id (1-based, μοναδικό ανά αρχείο). */
  readonly id: number;
  /** Ορατή ετικέτα (συνήθως = id). */
  readonly name: string;
  /** Ύψος τοίχου (μέτρα). */
  readonly heightM: number;
  /** Στάθμη βάσης (μέτρα). */
  readonly elevationM: number;
  /** Χρώμα 6-ψήφιο hex ΧΩΡΙΣ `#` (π.χ. `80BCFC`). */
  readonly colorHex: string;
  /** Affine θέσης/διαστάσεων. */
  readonly xmatrix: TekXMatrix;
  /** Περιεχόμενο nested `<open>` (κουφώματα) — κενό αν κανένα (φάση 2). */
  readonly openXml?: string;
}
