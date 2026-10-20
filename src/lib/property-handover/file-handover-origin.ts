/**
 * @fileoverview **Η προέλευση παράδοσης ενός αρχείου** (ADR-916 Φ-Γ1 · Π2) — «αυτό σάς το παρέδωσε η κατασκευάστρια».
 * @related lib/property-handover/property-handover-id.ts (οι ταυτότητες) · firestore.rules `handoverOriginUnchanged`
 * @module lib/property-handover/file-handover-origin
 *
 * 🔑 **Γιατί ανά αρχείο και όχι μόνο στον φάκελο**: ο αγοραστής προσθέτει **δικά** του αρχεία στον ίδιο φάκελο (Δ5,
 * Centriq). Το σήμα «Από την κατασκευάστρια» είναι ο μόνος τρόπος να ξεχωρίσει το επίσημο εγχειρίδιο από ένα δικό του
 * σκαναρισμένο χαρτί — και, με τα `crc32c`/`size`, να **αποδείξει** σε διαφορά ότι δεν άλλαξε από την παράδοση.
 * Είναι επίσης το κριτήριο του Δ9 (τα παραδομένα δεν μετρούν στο όριο χώρου του ADR-866 §5.9, όταν αυτό γραφτεί).
 *
 * ⛔ **Το γράφει ΜΟΝΟ ο εκτελεστής της παράδοσης** (Admin SDK). Ο πελάτης ούτε το γεννά ούτε το αλλάζει (κανόνας).
 *
 * **Layering**: leaf — τύπος + καθαρός αναγνώστης, κανένα SDK.
 */

export interface FileHandoverOrigin {
  readonly handoverId: string;
  /** Το αρχείο της εταιρείας από το οποίο έγινε το αντίγραφο (στιγμιότυπο — όχι ζωντανός σύνδεσμος, Δ2). */
  readonly sourceFileId: string;
  /** Ποιος το εξέδωσε. Μένει ακόμη κι αν η εταιρεία φύγει από την πλατφόρμα — το αρχείο είναι του αγοραστή. */
  readonly issuerCompanyId: string;
  /** Η απόδειξη ακεραιότητας, όπως τη μέτρησε το GCS **στο αντίγραφο**. */
  readonly crc32c: string;
  readonly size: number;
  /** Νέα αναθεώρηση πηγής που είχε ήδη παραδοθεί ⇒ το **αντίγραφο** της προηγούμενης· αλλιώς `null`. */
  readonly revisionOfFileId: string | null;
}

const nonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.trim() !== '';

/** **Διαβάζει** την προέλευση από ωμό έγγραφο αρχείου — `null` ⇒ «δεν είναι παραδομένο αρχείο». Ποτέ ισχυρισμός τύπου. */
export function readFileHandoverOrigin(raw: unknown): FileHandoverOrigin | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const { handoverId, sourceFileId, issuerCompanyId, crc32c, size, revisionOfFileId } = raw as Record<string, unknown>;
  if (!nonEmptyString(handoverId) || !nonEmptyString(sourceFileId) || !nonEmptyString(issuerCompanyId)) return null;
  if (!nonEmptyString(crc32c) || typeof size !== 'number' || !Number.isInteger(size) || size < 0) return null;
  return {
    handoverId, sourceFileId, issuerCompanyId, crc32c, size,
    revisionOfFileId: nonEmptyString(revisionOfFileId) ? revisionOfFileId : null,
  };
}
