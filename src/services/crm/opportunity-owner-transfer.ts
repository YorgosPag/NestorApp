/**
 * @fileoverview **Ο κανόνας μιας μεταβίβασης κατόχου ευκαιρίας — καθαρός, χωρίς I/O** (ADR-930 §3.8).
 * @module services/crm/opportunity-owner-transfer
 *
 * Ο server (`opportunity-owner-transfer.server.ts`) τον εκτελεί μέσα σε συναλλαγή· τα tests τον εκτελούν σκέτο.
 * Ένας κανόνας, δύο εκτελεστές (πρότυπο `opportunity-stage-transition.ts`).
 *
 * 🔑 **Πρακτική μεγάλων — και πού πάμε πιο πέρα**:
 *  - Salesforce «Change Owner» / Pipedrive «Change a deal's owner» / HubSpot «Deal owner»: ο κάτοχος ή ο manager
 *    αλλάζει τον κάτοχο, ο νέος κάτοχος είναι χρήστης του λογαριασμού, και ο νέος κάτοχος ειδοποιείται.
 *  - ➕ **CAS στον αναμενόμενο κάτοχο**: και οι τρεις είναι last-write-wins — δύο managers που αναθέτουν ταυτόχρονα
 *    πατούν σιωπηλά ο ένας τον άλλον. Εδώ ο δεύτερος παίρνει 409 με τον **τρέχοντα** κάτοχο.
 *  - ➕ **Ιδεμπότητα**: ίδιος στόχος ⇒ `unchanged` — καμία εγγραφή, καμία γραμμή ιστορικού, καμία ειδοποίηση.
 *  - ➕ **Σημείωμα παράδοσης**: «τι πρέπει να ξέρει ο επόμενος» — φτάνει στον νέο κάτοχο και μένει στο ιστορικό.
 */

import { opportunityOwnerOf, type OpportunityAccessFacts } from './opportunity-access';

/**
 * Τα πεδία ιδιοκτησίας/ταυτότητας που ο **πελάτης** δεν γράφει ποτέ σε ενημέρωση. Η ΜΙΑ λίστα: τη διαβάζουν η πύλη
 * του πελάτη (`crm-mutation-gateway`) και η CHECK 3.114, που τη συγκρίνει με τη λίστα κλειδώματος του `firestore.rules`.
 *  - `assignedTo` — ο κάτοχος· τον γράφει **μόνο** η πόρτα `POST /api/opportunities/[id]/owner`.
 *  - `createdBy` — ιστορικό (Salesforce `CreatedById`, system field). Αν ήταν εγγράψιμο, ο ανατεθειμένος θα έγραφε το
 *    δικό του uid και θα γινόταν «δημιουργός» — δηλαδή θα αποκτούσε **διαγραφή**.
 *  - `ownerHandoffNote` — το τελευταίο σημείωμα παράδοσης· το γράφει η ίδια πόρτα, μαζί με τον κάτοχο.
 */
export const OWNER_OWNED_FIELDS = ['assignedTo', 'createdBy', 'ownerHandoffNote'] as const;

/** Το πεδίο του τελευταίου σημειώματος παράδοσης (μέλος του `OWNER_OWNED_FIELDS`). */
export const OWNER_HANDOFF_NOTE_FIELD = 'ownerHandoffNote' satisfies (typeof OWNER_OWNED_FIELDS)[number];

/** Το μέγιστο μήκος του σημειώματος παράδοσης. */
export const OWNER_TRANSFER_NOTE_MAX = 500;

export interface OwnerTransferRequest {
  /** Ο κάτοχος που **είδε** ο άνθρωπος όταν άνοιξε τη φόρμα — `null` = «χωρίς κάτοχο». */
  readonly expectedOwnerUid: string | null;
  readonly newOwnerUid: string;
  readonly note?: string;
}

export type OwnerTransferInvalidReason = 'owner_required' | 'note_too_long';

export type OwnerTransferPlan =
  | { readonly kind: 'unchanged'; readonly ownerUid: string }
  | { readonly kind: 'invalid'; readonly reason: OwnerTransferInvalidReason }
  | { readonly kind: 'conflict'; readonly currentOwnerUid: string | null }
  | {
      readonly kind: 'apply';
      readonly previousOwnerUid: string | null;
      readonly newOwnerUid: string;
      readonly note: string | null;
    };

/** Το σημείωμα όπως αποθηκεύεται: κομμένα κενά, κενό ⇒ `null`. */
export function normalizeTransferNote(note: string | undefined): string | null {
  const trimmed = (note ?? '').trim();
  return trimmed === '' ? null : trimmed;
}

/**
 * Ο κανόνας. Σειρά: εγκυρότητα αιτήματος → σύγκρουση (CAS) → ιδεμπότητα → εφαρμογή.
 * ⚠️ Η σύγκρουση κρίνεται **πριν** την ιδεμπότητα: αν κάποιος άλλος την έδωσε ήδη στον ίδιο στόχο, ο άνθρωπος πρέπει να
 *    μάθει ότι η εικόνα του ήταν παλιά — όχι να του πούμε «έγινε».
 */
export function planOwnerTransfer(current: OpportunityAccessFacts, request: OwnerTransferRequest): OwnerTransferPlan {
  const newOwnerUid = request.newOwnerUid.trim();
  if (newOwnerUid === '') return { kind: 'invalid', reason: 'owner_required' };
  const note = normalizeTransferNote(request.note);
  if (note !== null && note.length > OWNER_TRANSFER_NOTE_MAX) return { kind: 'invalid', reason: 'note_too_long' };

  const currentOwnerUid = opportunityOwnerOf(current);
  if (currentOwnerUid !== (request.expectedOwnerUid || null)) return { kind: 'conflict', currentOwnerUid };
  if (currentOwnerUid === newOwnerUid) return { kind: 'unchanged', ownerUid: newOwnerUid };
  return { kind: 'apply', previousOwnerUid: currentOwnerUid, newOwnerUid, note };
}
