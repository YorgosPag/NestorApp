/**
 * @fileoverview **ΤΟ ΛΕΞΙΛΟΓΙΟ ΤΩΝ ΑΡΝΗΣΕΩΝ ΤΗΣ ΠΕΡΙΗΓΗΣΗΣ** — όσα μπορεί να πει ο διακομιστής στο σώμα `TOUR_REFUSED`.
 * @related ADR-884 §4.5 (Κ3α) · `server/spatial-tour/tour-capture-upload.ts` (`TourUploadRefusal`) · `app/api/spatial-tours/_shared`
 * @module lib/spatial-tour/tour-refusal-vocabulary
 *
 * 🔑 **Γιατί υπάρχει ως τιμή, όχι μόνο ως τύπος**: η οθόνη διαβάζει τον λόγο από **δίκτυο** — ένα `as` πάνω σε
 * ανεπαλήθευτο string θα ήταν ψέμα τύπων. Ο φρουρός {@link isTourRefusalName} είναι το σύνορο του πελάτη.
 * 🔒 Ο διακομιστής **δεσμεύεται** να λέει ακριβώς αυτά: η άγκυρα (`tour-refusal-vocabulary.test.ts`) συγκρίνει
 * το σύνολο με τον πίνακα HTTP της διαδρομής (`Record<TourUploadRefusal, …>`) — απόκλιση κοκκινίζει.
 *
 * **Layering**: leaf.
 */

export const TOUR_REFUSALS = [
  // ── Η περιήγηση και η πόρτα του υπευθύνου ──
  'tour-absent', 'not-requestable', 'not-manager', 'expiry-required', 'expiry-past', 'expiry-too-far',
  'request-absent', 'not-pending', 'not-active', 'reason-required', 'grant-absent', 'tour-custody-mismatch',
  'tour-unreadable',
  // ── Η πύλη θέασης και οι ρυθμίσεις (Κ3β) ──
  'sign-in-required', 'not-viewable', 'publish-needs-capture', 'visibility-unsupported',
  // ── Ο κριτής ανεβάσματος ──
  'no-capture-grant', 'revoked', 'expired', 'unreadable-expiry', 'scope-missing',
  // ── Τα bytes ──
  'not-jpeg', 'too-large', 'not-equirect', 'too-small', 'wrong-projection',
  // ── Η ροή ανεβάσματος ──
  'ticket-invalid', 'ticket-foreign', 'upload-missing', 'upload-incomplete', 'declaration-invalid',
  // ── Ο γράφος: τοποθέτηση, βελάκια (Φ2β) ──
  'capture-absent', 'capture-placed', 'capture-unplaced', 'capture-not-ready', 'node-absent', 'level-absent', 'graph-full',
  // ── Ο χώρος ενός σημείου (Φ2στ) ──
  'room-invalid',
  // ── Η κάτοψη: εικόνα, κλίμακα, θέση, προσανατολισμός (Φ2στ-β) ──
  'plan-absent', 'plan-uncalibrated', 'plan-not-eligible', 'position-outside-plan', 'scale-invalid',
  // ── Τα σχήματα των χώρων + οι νοητές γραμμές (Φ2στ-γ Γ3β) ──
  'space-invalid', 'space-outside-plan', 'space-overlap', 'space-absent', 'area-invalid',
  'separation-invalid', 'separation-absent',
] as const;

export type TourRefusalName = (typeof TOUR_REFUSALS)[number];

export function isTourRefusalName(value: unknown): value is TourRefusalName {
  return typeof value === 'string' && (TOUR_REFUSALS as readonly string[]).includes(value);
}

/**
 * **Οι αρνήσεις της ΠΥΛΗΣ ΘΕΑΣΗΣ** — ό,τι μπορεί να πει το `view-session`, και **τίποτα άλλο** (ADR-884 Κ3β).
 *
 * 🏆 **Λεξιλόγιο ανά λειτουργία** (Google AIP-193 `ErrorInfo.reason`, Stripe error codes ανά endpoint): ο πελάτης
 * χαρτογραφεί **μόνο** όσα μπορεί να του επιστρέψει η κλήση του. Η δημόσια σελίδα θέασης κουβαλούσε τις λέξεις **όλων**
 * των αρνήσεων (ανέβασμα, γράφος, κάτοψη) — μετρημένο 2026-09-28: 46 κλειδιά = **73%** του slice της, για 4 που φτάνουν.
 * 🔒 **Δεμένο στον διακομιστή με τύπο**: το `TourViewSessionOutcome` επιστρέφει `TourViewSessionRefusal` — νέα άρνηση
 * στην πύλη **δεν μεταγλωττίζεται** αν δεν μπει εδώ (και τότε ο πίνακας ετικετών απαιτεί λέξεις).
 */
export const TOUR_VIEW_SESSION_REFUSALS = [
  'tour-absent', 'tour-custody-mismatch', 'sign-in-required', 'not-viewable',
] as const satisfies readonly TourRefusalName[];

export type TourViewSessionRefusal = (typeof TOUR_VIEW_SESSION_REFUSALS)[number];

export function isTourViewSessionRefusal(value: TourRefusalName): value is TourViewSessionRefusal {
  return (TOUR_VIEW_SESSION_REFUSALS as readonly TourRefusalName[]).includes(value);
}

/**
 * **Οι αρνήσεις του ΓΡΑΦΕΑ ΣΧΗΜΑΤΩΝ** (ADR-884 Φ2στ-γ Γ3γ-1 · AIP-193) — τις λέει **μόνο** το `POST …/graph` στις εντολές
 * `space/unspace/separate/unseparate`, άρα τις χαρτογραφεί **μόνο** ο επεξεργαστής (πίσω από `next/dynamic`).
 * 🔑 Μετρημένο 2026-09-28 (CHECK 3.34): στον ενιαίο πίνακα οι λέξεις τους (~1 KB) ανέβαζαν το slice των σελίδων ρυθμίσεων
 * και φωτογράφου πάνω από το ταβάνι — για αρνήσεις που εκεί **δεν φτάνουν ποτέ**. Ο γενικός αναγνώστης της οθόνης
 * (`tourCall`) τις αντιμετωπίζει ως «έξω από το συμβόλαιο» ⇒ γενικό μήνυμα.
 */
export const TOUR_SHAPE_REFUSALS = [
  'space-invalid', 'space-outside-plan', 'space-overlap', 'space-absent', 'area-invalid',
  'separation-invalid', 'separation-absent',
] as const satisfies readonly TourRefusalName[];

export type TourShapeRefusal = (typeof TOUR_SHAPE_REFUSALS)[number];

/** Κάθε άρνηση **εκτός** του γραφέα σχημάτων — το λεξιλόγιο όλων των άλλων οθονών. */
export type TourGeneralRefusal = Exclude<TourRefusalName, TourShapeRefusal>;

export function isTourShapeRefusal(value: TourRefusalName): value is TourShapeRefusal {
  return (TOUR_SHAPE_REFUSALS as readonly TourRefusalName[]).includes(value);
}

export function isTourGeneralRefusal(value: TourRefusalName): value is TourGeneralRefusal {
  return !isTourShapeRefusal(value);
}
