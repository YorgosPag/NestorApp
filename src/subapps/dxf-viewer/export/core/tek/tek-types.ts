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

/**
 * Μία footprint κορυφή στέγης + η κλίση της ακμής που ξεκινά εκεί — `<point><record>`.
 * `angleRad` = γωνία κλίσης σε radians (0 = αέτωμα/κατακόρυφο άκρο ή επίπεδη στέγη).
 */
export interface TekRoofPoint {
  /** X (world μέτρα). */
  readonly x: number;
  /** Y (world μέτρα). */
  readonly y: number;
  /** Κλίση ακμής σε radians (atan(rise/run)). */
  readonly angleRad: number;
}

/**
 * Ένα «νερό» (face) της στέγης = κλειστό 3D πολύγωνο σε world μέτρα — ένα `<onev3list>`
 * με `<v3>` κορυφές. Reuse `TekPlanePoint` ({x,y,z}) — ίδια σημασιολογία (3D κορυφή, μέτρα).
 */
export type TekRoofFace = readonly TekPlanePoint[];

/**
 * Μία στέγη έτοιμη για σειριοποίηση σε `<autoroof><record>` (όλα σε μέτρα). Ο Τέκτων
 * αναπαριστά την κεκλιμένη στέγη με: footprint `points` (κορυφές + κλίση ανά ακμή) +
 * `faces` (τα υπολογισμένα «νερά» ως 3D πολύγωνα) + στάθμη βάσης + πάχος εξώθησης.
 */
export interface TekRoof {
  /** Ακέραιο id (1-based, μοναδικό ανά αρχείο). */
  readonly id: number;
  /** Στάθμη βάσης / γείσου (eaves datum) — `<elevation>` (μέτρα). */
  readonly elevationM: number;
  /** Πάχος στέγης (εξώθηση «νερών») — `<width>` (μέτρα). */
  readonly widthM: number;
  /** Όγκος στέγης (m³) — `<roof_volume_acc>`. Μη-μηδενικό = «χτισμένη» (ο Τέκτων το χρειάζεται). */
  readonly volumeM3: number;
  /** Χρώμα 6-ψήφιο hex ΧΩΡΙΣ `#`. */
  readonly colorHex: string;
  /** Footprint κορυφές + κλίση ανά ακμή (`<point>`). */
  readonly points: readonly TekRoofPoint[];
  /** Τα κεκλιμένα «νερά» ως 3D πολύγωνα (`<v3list>`). Κενό → επίπεδη στέγη. */
  readonly faces: readonly TekRoofFace[];
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

/**
 * Ένα ευθύγραμμο τμήμα (DXF line / polyline segment) έτοιμο για `<line><record>`
 * (type 4). Όλες οι συντεταγμένες σε **μέτρα**· `elevation0/1` = z κάθε άκρου (Φ-D).
 */
export interface TekLine {
  /** Ακέραιο id (1-based, μοναδικό ανά αρχείο). */
  readonly id: number;
  /** Αρχή (μέτρα). */
  readonly v0: { readonly x: number; readonly y: number };
  /** Τέλος (μέτρα). */
  readonly v1: { readonly x: number; readonly y: number };
  /** z αρχής (μέτρα). */
  readonly elevation0: number;
  /** z τέλους (μέτρα). */
  readonly elevation1: number;
  /** Χρώμα 6-ψήφιο hex ΧΩΡΙΣ `#`. */
  readonly colorHex: string;
}

/**
 * Ένα τόξο/κύκλος (DXF arc / circle) έτοιμο για `<arc><record>` (type 5). Όλες οι
 * συντεταγμένες σε **μέτρα** (Φ-D). `isCircle=true` → πλήρης κύκλος (`p0` = σημείο
 * περιφέρειας ώστε `radius = |centre−p0|`· `p1` = (0,0)). `isCircle=false` → τόξο
 * (`p0` = σημείο αρχής, `p1` = σημείο τέλους, και τα δύο στην περιφέρεια).
 */
export interface TekArc {
  /** Ακέραιο id (1-based, μοναδικό ανά αρχείο). */
  readonly id: number;
  /** `true` = κύκλος, `false` = τόξο. */
  readonly isCircle: boolean;
  /** Κέντρο (μέτρα). */
  readonly centre: { readonly x: number; readonly y: number };
  /** Σημείο αρχής τόξου / σημείο περιφέρειας κύκλου (μέτρα). */
  readonly p0: { readonly x: number; readonly y: number };
  /** Σημείο τέλους τόξου / (0,0) για κύκλο (μέτρα). */
  readonly p1: { readonly x: number; readonly y: number };
  /** z (μέτρα). */
  readonly elevation: number;
  /** Χρώμα 6-ψήφιο hex ΧΩΡΙΣ `#`. */
  readonly colorHex: string;
}
