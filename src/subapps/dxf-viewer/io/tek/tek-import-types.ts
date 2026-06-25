/**
 * ADR-526 (Tekton .TEK IMPORT — stair-first) — intermediate parse types (pure).
 *
 * Ο Τέκτων (FESPA) εξάγει το native `<tekton>` XML σε **μέτρα** με Y «προς τα πάνω»
 * (CAD frame). Αυτά τα types είναι η ΕΝΔΙΑΜΕΣΗ αναπαράσταση μετά το parse του XML
 * και ΠΡΙΝ το mapping σε BIM entities — καθαρά δεδομένα, μηδέν geometry math.
 *
 * Είναι ο ΚΑΘΡΕΦΤΗΣ (read-side) του export `tek-types.ts` (write-side): ό,τι γράφει
 * ο writer, το διαβάζει ο reader. Οι μετατροπές meters→scene-units + Y-flip ΔΕΝ
 * γίνονται εδώ· γίνονται στους mappers (`tek-*-to-bim.ts`) μέσω του SSoT.
 */

/** Σημείο κάτοψης του Τέκτονα — **μέτρα**, Y προς τα πάνω (όπως γράφεται στο XML). */
export interface TekPoint2D {
  readonly x: number;
  readonly y: number;
}

/**
 * Ένα `<stair>` record (entity type 21) όπως διαβάζεται από το XML — όλες οι τιμές
 * στις ΜΟΝΑΔΕΣ ΤΟΥ ΤΕΚΤΟΝΑ (μέτρα / μοίρες-όχι), χωρίς καμία μετατροπή.
 *
 * Τα `polylines` είναι οι ακατέργαστες `<point2d>` λίστες με τη σειρά που εμφανίζονται
 * (ακμές βαθμίδων, εσωτερικό/εξωτερικό περίγραμμα, γραμμή πορείας). Διατηρούνται ΟΛΕΣ
 * ώστε ο mapper να παράγει είτε πιστή 2D αναπαράσταση είτε παραμετρική σκάλα.
 */
export interface TekStairRecord {
  /**
   * Το **αυθεντικό `<record>` XML** της σκάλας (ADR-526 Φ3 — preserve-and-replay). Διατηρείται
   * αυτούσιο ώστε στο export μιας μη-τροποποιημένης εισαγόμενης σκάλας να εκπέμπεται **verbatim**
   * → byte-faithful round-trip (ο Τέκτων τη ζωγραφίζει ΑΚΡΙΒΩΣ όπως την έδωσε, με τα δικά του
   * σύμβολα/βέλη/τόξα). Μηδέν lossy regeneration των ιδιόκτητων Tekton συμβόλων.
   */
  readonly rawXml: string;
  /** Όλες οι `<point2d>` πολυγραμμές (μέτρα), με σειρά εμφάνισης· κενές παραλείπονται. */
  readonly polylines: readonly (readonly TekPoint2D[])[];
  /** `<start_elevation>` — στάθμη βάσης (μέτρα). */
  readonly startElevationM: number;
  /** `<end_elevation>` — στάθμη κορυφής (μέτρα). Ύψος = end − start. */
  readonly endElevationM: number;
  /** `<steps>` — πλήθος βαθμίδων (πατημάτων) όπως το μετρά ο Τέκτων. */
  readonly steps: number;
  /** `<landings>` — πλήθος πλατύσκαλων. */
  readonly landings: number;
  /** `<stair_width>` — καθαρό πλάτος σκάλας (μέτρα). */
  readonly stairWidthM: number;
  /** `<horiz_b>` — πάτημα/going ανά βαθμίδα (μέτρα). */
  readonly treadGoingM: number;
  /** `<vert_b>` — ρίχτι/riser ανά βαθμίδα (μέτρα). */
  readonly riserHeightM: number;
  /** `<slope_h>` — πάχος πλάκας/μηρού της κλίσης (μέτρα). */
  readonly waistThicknessM: number;
  /** `<wlength>` — ανάπτυγμα γραμμής πορείας (μέτρα). Πληροφοριακό. */
  readonly walklineLengthM: number;
  /** `<min_step_width>` — ελάχιστο πλάτος ελικοειδούς βαθμίδας (μέτρα). > 0 ⇒ winders. */
  readonly minStepWidthM: number;
  /** `<steps_numbering>` — 1 αν ο Τέκτων αριθμεί τις βαθμίδες. */
  readonly stepsNumbering: boolean;
}

/**
 * Ένα `<line>` record (entity type 4) — δύο κορυφές σε **μέτρα** (Y-up), χρώμα **BGR**.
 * Καθρέφτης (read-side) του export `TekLine` (`LINE_RECORD_TEMPLATE`). Καμία μετατροπή εδώ.
 */
export interface TekLineRecord {
  /** `<v0X>` αρχή X (μέτρα). */
  readonly v0x: number;
  /** `<v0Y>` αρχή Y (μέτρα, Y-up). */
  readonly v0y: number;
  /** `<v1X>` τέλος X (μέτρα). */
  readonly v1x: number;
  /** `<v1Y>` τέλος Y (μέτρα, Y-up). */
  readonly v1y: number;
  /** `<color>` αυθεντικό RGB hex (όπως το γράφει ο export `colorHex6`· `#` + normalize στον mapper). */
  readonly color: string;
}

/**
 * Ένα `<arc>` record (entity type 5) — κέντρο + 2 ακραία σημεία σε **μέτρα** (Y-up).
 * Καθρέφτης του export `TekArc` (`ARC_RECORD_TEMPLATE`). `isCircle` ⇒ `<circle>1`.
 * ΣΗΜ.: ο export γράφει `p0=τέλος`, `p1=αρχή` (το Y-flip αντιστρέφει τη φορά) — ο mapper
 * το αντιστρέφει. Για κύκλο, `p0` = σημείο περιφέρειας, `p1` = (0,0) αγνοείται.
 */
export interface TekArcRecord {
  /** `<circle>` — `true` (1) κύκλος, `false` (0) τόξο. */
  readonly isCircle: boolean;
  /** `<centreX>` κέντρο X (μέτρα). */
  readonly centreX: number;
  /** `<centreY>` κέντρο Y (μέτρα, Y-up). */
  readonly centreY: number;
  /** `<p0X>` (μέτρα) — τόξο: τέλος· κύκλος: σημείο περιφέρειας (→ ακτίνα). */
  readonly p0x: number;
  /** `<p0Y>` (μέτρα, Y-up). */
  readonly p0y: number;
  /** `<p1X>` (μέτρα) — τόξο: αρχή· κύκλος: αγνοείται. */
  readonly p1x: number;
  /** `<p1Y>` (μέτρα, Y-up). */
  readonly p1y: number;
  /** `<color>` αυθεντικό RGB hex (όπως ο export). */
  readonly color: string;
}

/** 2×3 affine πίνακας του Τέκτονα (column-major) — `<xmatrix>` element. */
export interface TekXMatrix {
  readonly x00: number; readonly x01: number;
  readonly x10: number; readonly x11: number;
  readonly x20: number; readonly x21: number;
}

/**
 * Ένα `<text>` record (entity type 3). Το περιεχόμενο ζει **inline** στο `<s>` (π.χ.
 * `<s>ΚΟΥΖΙΝΑ</s>`, `<s>Ε = 70.77 τμ</s>`, ή ψηφία `<s>1</s>`). Θέση/μέγεθος/περιστροφή
 * από το `<xmatrix>` (x20/x21 = θέση μέτρα Y-up· x00/x11 = κλίμακα γλύφου).
 */
export interface TekTextRecord {
  /** `<s>` — το κείμενο αυτούσιο (inline). */
  readonly content: string;
  /** `<xmatrix>` — θέση + κλίμακα + περιστροφή. */
  readonly matrix: TekXMatrix;
  /** `<color>` RGB hex (όπως line/arc). */
  readonly color: string;
  /** `<hallign>` — 0=αριστερά, 1=κέντρο, 2=δεξιά. */
  readonly hAlign: number;
  /** `<ttfont><name>` — οικογένεια γραμματοσειράς (π.χ. "Arial"). Κενό → renderer default. */
  readonly fontFamily: string;
}

/** Αποτέλεσμα parse ενός ολόκληρου `.tek` αρχείου (stair-first scope — Φ1). */
export interface TekParseResult {
  /** Έκδοση αρχείου (`<fileversion>`) — π.χ. 516. */
  readonly fileVersion: number | null;
  /** Έκδοση Τέκτονα (`<version>`) — π.χ. "9.1.0.46". */
  readonly tektonVersion: string | null;
  /** Πλήθος ορόφων (`<numfloors>`). */
  readonly floorCount: number;
  /** Όλα τα stair records που βρέθηκαν, με σειρά ορόφου. */
  readonly stairs: readonly TekStairRecord[];
  /** Μη-κρίσιμες προειδοποιήσεις (π.χ. άδειο stair, λείπει πεδίο). */
  readonly warnings: readonly string[];
}

/**
 * Υπερσύνολο του `TekParseResult` (ADR-526 Φ5a) — προσθέτει 2Δ primitives (γραμμές/τόξα).
 * Backward-compatible: όποιος consumer χρειάζεται μόνο σκάλες διαβάζει το `stairs` ως πριν.
 * Επόμενες φάσεις (Φ5b) επεκτείνουν additive (walls/openings/slabs/roofs).
 */
export interface TekSceneParseResult extends TekParseResult {
  /** Όλα τα `<line>` records (type 4), με σειρά ορόφου. */
  readonly lines: readonly TekLineRecord[];
  /** Όλα τα `<arc>` records (type 5) — τόξα ΚΑΙ κύκλοι. */
  readonly arcs: readonly TekArcRecord[];
  /** Όλα τα `<text>` records (type 3). */
  readonly texts: readonly TekTextRecord[];
}
