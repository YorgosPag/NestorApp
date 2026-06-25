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

/** Μία 2D κορυφή πολυγραμμής σκάλας σε world μέτρα (Y-flipped) — `<point2d><record>`. */
export interface TekStairPoint {
  /** X (world μέτρα). */
  readonly x: number;
  /** Y (world μέτρα, Y-flipped). */
  readonly y: number;
}

/**
 * Μία σκάλα έτοιμη για σειριοποίηση σε `<stair><record>` (entity **type 21**· όλα τα μήκη σε
 * **μέτρα**, οι πολυγραμμές Y-flipped). Ο Τέκτων είναι **παραμετρικός**: ανακατασκευάζει τη
 * σκάλα από τα scalar πεδία (πάτημα/ρίχτι/πλάτος/στάθμες/πλήθος) + τη γραμμή πορείας· οι
 * πολυγραμμές (`stepLines`/contours/`walkline`) είναι η **ήδη υπολογισμένη** γεωμετρία μας
 * (`StairGeometry`) ώστε η σκάλα να αναγνωρίζεται 2Δ ΑΜΕΣΩΣ (faithful, μηδέν re-parametrization).
 *
 * Αντίστροφο του import (ADR-526 Φ1): εκεί `TekStairRecord` → `StairEntity`· εδώ
 * `StairEntity` → `TekStair`. Winder intlist (τόξα) + pixel-perfect ελικοειδές footprint = Φ3b.
 */
export interface TekStair {
  /** Ακέραιο id (1-based, `<n>`). */
  readonly id: number;
  /** Στάθμη βάσης — `<start_elevation>` (μέτρα). */
  readonly startElevationM: number;
  /** Στάθμη άφιξης (= βάση + συνολικό ύψος) — `<end_elevation>` (μέτρα). */
  readonly endElevationM: number;
  /** Πλήθος πατημάτων (Τέκτων `<steps>` = ρίχτια − 1). */
  readonly steps: number;
  /** Πλήθος πλατύσκαλων — `<landings>`. */
  readonly landings: number;
  /** Καθαρό πλάτος — `<stair_width>` (μέτρα). */
  readonly stairWidthM: number;
  /** Πάτημα / going — `<horiz_b>` (μέτρα). */
  readonly treadGoingM: number;
  /** Ρίχτι / riser — `<vert_b>` (μέτρα). */
  readonly riserHeightM: number;
  /** Πάχος πλάκας/μηρού — `<slope_h>` (μέτρα). */
  readonly waistThicknessM: number;
  /** Μήκος γραμμής πορείας — `<wlength>` (μέτρα). */
  readonly walklineLengthM: number;
  /** Minimum winder width (>0 means spiral) — `<min_step_width>` (meters). */
  readonly minStepWidthM: number;
  /** Αρίθμηση βαθμίδων — `<steps_numbering>` (1/0). */
  readonly stepsNumbering: boolean;
  /** Βέλος κατεύθυνσης ανόδου (slot 1). */
  readonly arrow: readonly TekStairPoint[];
  /** Γραμμές βαθμίδων / ακμές πατημάτων (slot 3). */
  readonly stepLines: readonly TekStairPoint[];
  /** Εσωτερικό περίγραμμα / μηρός (slot 4). */
  readonly innerContour: readonly TekStairPoint[];
  /** Εξωτερικό περίγραμμα / μηρός (slot 5). */
  readonly outerContour: readonly TekStairPoint[];
  /** Γραμμή πορείας (slot 6). */
  readonly walkline: readonly TekStairPoint[];
}
