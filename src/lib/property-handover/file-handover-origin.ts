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

import { readHandoverSourceScope, type HandoverSourceScope } from './handover-source-scope';

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
  /**
   * ADR-916 Φ-Γ3 — **από πού** ήρθε: της μονάδας ή **κοινό** του κτιρίου/έργου (σήμα «Από την κατασκευάστρια · Κτίριο»).
   * Απόν στο έγγραφο ⇒ `unit` (κάθε αντίγραφο πριν τη Φ-Γ3). ⛔ Ίδιος φρουρός κανόνα με όλο το πεδίο (`handoverOriginKeys`).
   */
  readonly sourceScope: HandoverSourceScope;
}

const nonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.trim() !== '';

/**
 * **Το σημάδι «αυτό ΕΙΝΑΙ Πρωτόκολλο παράδοσης»** (ADR-916 Φ-Γ2 Σ4) — και στα δύο αντίτυπα (εταιρεία · αγοραστής).
 * 🔴 Υπάρχει για να **σπάσει έναν βρόχο**: το PDF της εταιρείας ζει πάνω στο ακίνητο· αν το έκρινε παραδοτέο το σύνολο
 * παράδοσης, θα έμπαινε στο καθολικό ⇒ νέο αποτύπωμα ⇒ νέο πρωτόκολλο ⇒ ∞. Η κρίση (`handoverDispositionOf`) το στέλνει
 * στα `internal`: το Πρωτόκολλο ταξιδεύει από τον **δικό** του δρόμο. Κριτήριο **δομικό** (ποιος το γέννησε), όχι
 * κατηγορία που ένας άνθρωπος μπορεί να αλλάξει. ⛔ Ίδιος φρουρός κανόνα με το `handoverOrigin` (`handoverOriginKeys`).
 */
export interface FileHandoverProtocolOf {
  readonly protocolId: string;
  readonly handoverId: string;
  readonly revision: number;
}

/** **Διαβάζει** το σημάδι πρωτοκόλλου από ωμό έγγραφο αρχείου — `null` ⇒ «δεν είναι Πρωτόκολλο». */
export function readFileHandoverProtocolOf(raw: unknown): FileHandoverProtocolOf | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const { protocolId, handoverId, revision } = raw as Record<string, unknown>;
  if (!nonEmptyString(protocolId) || !nonEmptyString(handoverId)) return null;
  return typeof revision === 'number' && Number.isInteger(revision) && revision >= 1 ? { protocolId, handoverId, revision } : null;
}

/** **Διαβάζει** την προέλευση από ωμό έγγραφο αρχείου — `null` ⇒ «δεν είναι παραδομένο αρχείο». Ποτέ ισχυρισμός τύπου. */
export function readFileHandoverOrigin(raw: unknown): FileHandoverOrigin | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const { handoverId, sourceFileId, issuerCompanyId, crc32c, size, revisionOfFileId, sourceScope } = raw as Record<string, unknown>;
  if (!nonEmptyString(handoverId) || !nonEmptyString(sourceFileId) || !nonEmptyString(issuerCompanyId)) return null;
  if (!nonEmptyString(crc32c) || typeof size !== 'number' || !Number.isInteger(size) || size < 0) return null;
  const scope = readHandoverSourceScope(sourceScope);
  if (scope === null) return null;
  return {
    handoverId, sourceFileId, issuerCompanyId, crc32c, size,
    revisionOfFileId: nonEmptyString(revisionOfFileId) ? revisionOfFileId : null,
    sourceScope: scope,
  };
}
