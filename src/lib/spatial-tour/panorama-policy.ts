/**
 * @fileoverview **ΤΙ ΕΙΝΑΙ ΔΕΚΤΟ ΠΑΝΟΡΑΜΑ 360°** — η ΜΙΑ πολιτική (τύπος · μέγεθος · αναλογία · ανάλυση) και η κρίση.
 * @related ADR-884 Φ0.8 · §4.5 (Κ3α) · `server/spatial-tour/panorama-facts.ts` (η εξαγωγή των γεγονότων)
 * @module lib/spatial-tour/panorama-policy
 *
 * 🔑 **Ένας κάτοχος της πολιτικής, δύο καταναλωτές**: η **έναρξη** ανεβάσματος (κρίνει τη **δήλωση** — τύπος,
 * μέγεθος — πριν ανοίξει συνεδρία) και η **ολοκλήρωση** (κρίνει τα **bytes**). Ο πελάτης διαβάζει τις ίδιες
 * σταθερές μόνο για να **προειδοποιήσει** νωρίς· η απόφαση δεν είναι ποτέ δική του.
 *
 * ⚠️ **Γιατί ΔΕΝ ζει στο `FILE_TYPE_CONFIG`**: εκείνο κρίνει με MIME (`image/jpeg` ⇒ «εικόνα») και τροφοδοτεί το
 * **γενικό** ανέβασμα. Ένα πανόραμα **δεν** αναγνωρίζεται από τον MIME — μόνο από τη **γεωμετρία** (2:1) — και
 * **δεν** πρέπει να έχει δεύτερη πόρτα: μπαίνει μόνο από τη διαμεσολαβημένη ροή (καραντίνα → κρίση → κανονικό).
 *
 * **Layering**: leaf — καθαρές συναρτήσεις, κανένα SDK.
 */

/** Ο μόνος τύπος που δεχόμαστε — το equirectangular JPEG είναι η κοινή έξοδος κάθε κάμερας 360° και του Zillow. */
export const PANORAMA_CONTENT_TYPE = 'image/jpeg';

/** **40 MB** — το 8K equirect φτάνει ~15 MB, οι 12K+ περισσότερο (Φ0.8). */
export const PANORAMA_MAX_BYTES = 40 * 1024 * 1024;

/**
 * **Ελάχιστο πλάτος 4096 px** (4K equirect) — κάτω από αυτό η σφαίρα θολώνει ορατά στο ζουμ και ο θεατής θα
 * έδειχνε κάτι χειρότερο από τις φωτογραφίες της ίδιας αγγελίας. Κάθε σύγχρονη κάμερα 360° (Ricoh Theta, Insta360)
 * και η συρραφή κινητού δίνουν ≥ 5.7K.
 */
export const PANORAMA_MIN_WIDTH_PX = 4096;

/** Ανοχή στην αναλογία 2:1 — ένα pixel (οι στρογγυλέψεις της συρραφής δίνουν π.χ. 8192×4097). */
const ASPECT_TOLERANCE_PX = 1;

/** Τα γεγονότα που εξάγει ο διακομιστής από τα **bytes** — ποτέ από τη δήλωση του πελάτη. */
export interface PanoramaFacts {
  /** Ο πραγματικός τύπος από τα bytes (`sharp`), όχι από το όνομα ή τον MIME. */
  readonly format: string | null;
  readonly widthPx: number | null;
  readonly heightPx: number | null;
  readonly byteLength: number;
  /** XMP `GPano:ProjectionType`, αν υπάρχει. */
  readonly projectionType: string | null;
  /** XMP `GPano:PoseHeadingDegrees`, αν υπάρχει — πού «κοιτάζει» το κέντρο της εικόνας. */
  readonly poseHeadingDegrees: number | null;
  /**
   * EXIF `DateTimeOriginal` (ISO) — **πότε τραβήχτηκε**, όχι πότε ανέβηκε. Δεν κρίνεται· τροφοδοτεί τον άξονα
   * του χρονολογίου (§12 Δ6): λήψη «πριν τους σοβάδες» που ανέβηκε μια βδομάδα μετά μένει στη σωστή θέση.
   */
  readonly takenAt: string | null;
}

export type PanoramaRefusal =
  | 'not-jpeg'
  | 'too-large'
  | 'not-equirect'
  | 'too-small'
  /** Το XMP **δηλώνει** άλλη προβολή (π.χ. `cylindrical`) — η αναλογία μόνη της θα την περνούσε. */
  | 'wrong-projection';

export type PanoramaVerdict =
  | { readonly ok: true; readonly headingRad: number }
  | { readonly ok: false; readonly refusal: PanoramaRefusal };

/** **Η δήλωση πριν ανοίξει συνεδρία** — τύπος και μέγεθος· `null` ⇒ δεκτή. */
export function refusalOfDeclaredPanorama(declared: { readonly contentType: string; readonly byteLength: number }): PanoramaRefusal | null {
  if (declared.contentType !== PANORAMA_CONTENT_TYPE) return 'not-jpeg';
  if (declared.byteLength > PANORAMA_MAX_BYTES) return 'too-large';
  return null;
}

/**
 * Μοίρες → ακτίνια, **όπως τις δηλώνει το αρχείο**. Απούσα κατεύθυνση ⇒ 0 (ο υπεύθυνος την ορίζει στην τοποθέτηση, Φ2).
 * ⚠️ **Καμία κανονικοποίηση εδώ, επίτηδες**: η περιτύλιξη γωνίας έχει **ένα** SSoT (`normalizeAngleDeg`, CHECK 3.7) και
 * ανήκει στον **θεατή** που περιστρέφει (Φ1)· ένα δεύτερο `% 360` εδώ θα ήταν διχάλα του κανόνα.
 */
function headingRadOf(degrees: number | null): number {
  if (degrees === null || !Number.isFinite(degrees)) return 0;
  return (degrees * Math.PI) / 180;
}

/**
 * **Είναι αυτά τα bytes δεκτό πανόραμα;** Η σειρά είναι «από το φθηνότερο»: τύπος → μέγεθος → γεωμετρία →
 * δηλωμένη προβολή. Το XMP είναι **προαιρετικό** (πολλά εργαλεία συρραφής δεν το γράφουν)· όταν όμως υπάρχει
 * και λέει άλλη προβολή, **νικά** την αναλογία.
 */
export function judgePanorama(facts: PanoramaFacts): PanoramaVerdict {
  if (facts.format !== 'jpeg') return { ok: false, refusal: 'not-jpeg' };
  if (facts.byteLength > PANORAMA_MAX_BYTES) return { ok: false, refusal: 'too-large' };
  const { widthPx, heightPx } = facts;
  // Η ανοχή μετριέται στο **ύψος**: 8192×4097 είναι στρογγύλεμα συρραφής (μισό πλάτος ±1), όχι άλλη προβολή.
  if (widthPx === null || heightPx === null || Math.abs(widthPx / 2 - heightPx) > ASPECT_TOLERANCE_PX) {
    return { ok: false, refusal: 'not-equirect' };
  }
  if (widthPx < PANORAMA_MIN_WIDTH_PX) return { ok: false, refusal: 'too-small' };
  if (facts.projectionType !== null && facts.projectionType.toLowerCase() !== 'equirectangular') {
    return { ok: false, refusal: 'wrong-projection' };
  }
  return { ok: true, headingRad: headingRadOf(facts.poseHeadingDegrees) };
}
