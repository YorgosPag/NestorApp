/**
 * =============================================================================
 * Μητρώο λήξεων — Ο ΥΠΕΥΘΥΝΟΣ ΕΠΙΚΟΙΝΩΝΙΑΣ ΑΥΤΟΨΙΑΣ της ανάθεσης έκδοσης (ADR-915 §45.15 · 1β)
 * =============================================================================
 *
 * **«Με ποιον κλείνει ο μηχανικός την αυτοψία;»** Στην πράξη η λίστα παραλαβής ΠΕΑ ζητά «Ιδιότητα · Ονοματεπώνυμο ·
 * Τηλέφωνο» (ιδιοκτήτης, διαχειριστής, ενοικιαστής, τεχνικός υπεύθυνος κλπ). Το γραφείο τον ορίζει **ρητά**.
 *
 * 🔑 **Δείκτης σε επαφή + ιδιότητα, ποτέ αντίγραφο** (ServiceTitan Contact Management: η επαφή είναι ανεξάρτητη και
 *    **συνδέεται** με ρόλο). Όνομα και τηλέφωνο διαβάζονται **ζωντανά** από την επαφή — ένα τηλέφωνο που αλλάζει στο CRM
 *    αλλάζει και εδώ. Ελεύθερο τηλέφωνο **δεν** υπάρχει: θα ήταν δεύτερη αλήθεια.
 * 🔑 **Κάθε ορισμός είναι γεγονός** (`inspectionContacts`), όπως η προθεσμία: η αλλαγή προσθέτει, ποτέ δεν αντικαθιστά
 *    σιωπηλά. Ο τρέχων **παράγεται** (ο νεότερος).
 * ⚠️ Το επίσημο έντυπο buildingcert με αυτό το πεδίο **δεν** βρέθηκε (§45.15 έρευνα): οι ιδιότητες είναι της πρακτικής,
 *    με «Άλλο» + κείμενο για ό,τι δεν χωρά.
 *
 * **Layering**: leaf — καθαρές συναρτήσεις, μηδέν I/O. Εισάγει από τον μειωτή **μόνο τύπους**.
 *
 * @module lib/document-validity/issuance-inspection-contact
 */

import type { IssuanceAssignmentRecord, IssuanceReduction } from './issuance-assignment';
import type { IssuanceStage } from './issuance-stage';

/** Τα στάδια όπου ο υπεύθυνος ορίζεται/αλλάζει — ο μειωτής (`ALLOWED_FROM`) **και** το πάνελ διαβάζουν αυτό. */
export const INSPECTION_CONTACT_STAGES: readonly IssuanceStage[] = ['proposed', 'ownerApproved', 'sent', 'quoted', 'accepted'];

/** Οι ιδιότητες — κλειστό σύνολο, με `other` για ό,τι δεν χωρά (τότε το κείμενο είναι υποχρεωτικό). */
export const INSPECTION_CONTACT_ROLES = ['owner', 'manager', 'tenant', 'technical', 'other'] as const;
export type InspectionContactRole = (typeof INSPECTION_CONTACT_ROLES)[number];

/** Τα όρια — ΕΝΑ σημείο. */
export const INSPECTION_CONTACT_POLICY = {
  /** Μέγιστο μήκος της ιδιότητας «Άλλο». */
  roleOtherMax: 60,
  /** Αμυντικό φρένο του ιστορικού ορισμών — όχι πολιτική. */
  maxEntries: 20,
} as const;

/** Ένας ορισμός υπευθύνου αυτοψίας από το γραφείο. */
export interface IssuanceInspectionContactEntry {
  readonly contactId: string;
  readonly role: InspectionContactRole;
  /** Μόνο για `other` — αλλιώς `null`. */
  readonly roleOther: string | null;
  readonly at: string;
  readonly byUid: string;
}

/** Η πράξη του μειωτή: ορισμός ή αλλαγή του υπευθύνου αυτοψίας (μόνο γραφείο, σε ανοιχτό στάδιο). */
export interface IssuanceSetInspectionContactAction {
  readonly kind: 'set-inspection-contact';
  readonly contactId: string;
  readonly role: InspectionContactRole;
  readonly roleOther: string | null;
}

/** Ο **τρέχων** υπεύθυνος αυτοψίας — ο νεότερος ορισμός· `null` = δεν ορίστηκε. */
export function currentInspectionContactOf(record: Pick<IssuanceAssignmentRecord, 'inspectionContacts'>): IssuanceInspectionContactEntry | null {
  return record.inspectionContacts.at(-1) ?? null;
}

/** Η ιδιότητα «Άλλο» θέλει κείμενο· οι υπόλοιπες **κανένα** (ποτέ «Ιδιοκτήτης» με παράπλευρο κείμενο). */
function normalizedRoleOther(action: IssuanceSetInspectionContactAction): string | null | undefined {
  const text = action.roleOther?.trim() ?? '';
  if (action.role !== 'other') return text === '' ? null : undefined;
  return text !== '' && text.length <= INSPECTION_CONTACT_POLICY.roleOtherMax ? text : undefined;
}

/**
 * Ορισμός ή αλλαγή του υπευθύνου αυτοψίας. Ίδιος με τον τρέχοντα ⇒ `changed: false` (ιδεμποτές). Το ότι η επαφή είναι
 * **του γραφείου** το κρίνει ο διακομιστής πριν από τον μειωτή (`readOwnedContactDocs`).
 */
export function inspectionContactSet(
  record: IssuanceAssignmentRecord,
  action: IssuanceSetInspectionContactAction,
  uid: string,
  nowIso: string,
): IssuanceReduction {
  const roleOther = normalizedRoleOther(action);
  if (action.contactId.trim() === '' || roleOther === undefined) return { ok: false, refusal: 'terms-refused' };
  const current = currentInspectionContactOf(record);
  if (current?.contactId === action.contactId && current.role === action.role && current.roleOther === roleOther) {
    return { ok: true, record, changed: false };
  }
  if (record.inspectionContacts.length >= INSPECTION_CONTACT_POLICY.maxEntries) return { ok: false, refusal: 'terms-refused' };
  const entry: IssuanceInspectionContactEntry = { contactId: action.contactId, role: action.role, roleOther, at: nowIso, byUid: uid };
  return { ok: true, record: { ...record, inspectionContacts: [...record.inspectionContacts, entry] }, changed: true };
}
