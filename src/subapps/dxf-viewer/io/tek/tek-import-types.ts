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
