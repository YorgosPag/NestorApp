/**
 * **Ο κριτής των μεταβάσεων της σχέσης προμήθειας** (ADR-923 §5.12 Σ1–Σ7): κάθε πράξη, από όποια πόρτα, περνά από εδώ.
 *
 * Καθαρό: καμία ανάγνωση, κανένα ρολόι. Ο γραφέας φέρνει την τρέχουσα εγγραφή **μέσα από τη συναλλαγή** και ο κριτής
 * λέει τι γίνεται, οπότε δύο ταυτόχρονες πράξεις κρίνονται σειριακά και η άρνηση δεν αφήνει γραφή.
 *
 * | Τρέχουσα | Αποδοχή πρόσκλησης | Αίτημα | Έγκριση | Απόρριψη | Ανάκληση |
 * |---|---|---|---|---|---|
 * | καμία | `active` | `requested` | `not-requested` | `not-requested` | καμία αλλαγή |
 * | `requested` | `active` | ίδιο, με νέο αριθμό πελάτη | `active` | `declined` | `revoked` |
 * | `active`, ίδια επαφή | καμία αλλαγή | `already-connected` | `not-requested` | `not-requested` | `revoked` |
 * | `active`, χωρίς επαφή | δέσιμο επαφής | `already-connected` | `not-requested` | `not-requested` | `revoked` |
 * | `active`, άλλη επαφή | `already-connected` | `already-connected` | `not-requested` | `not-requested` | `revoked` |
 * | `declined`/`revoked` | `active` | `requested`, ως το όριο | `not-requested` | `not-requested` | καμία αλλαγή |
 *
 * @module subapps/catalog/pricing/supply-relationship-judge
 */

import type { PricingPartyRef } from '../types/price-list';
import {
  SUPPLY_REQUEST_LIMIT,
  type SupplyRelationship,
  type SupplyRelationshipEnds,
  type SupplyRelationshipRefusal,
  type SupplyRelationshipSide,
} from '../types/supply-relationship';

export type SupplyTransition =
  /** Το έγγραφο όπως πρέπει να γραφτεί. Αναθεώρηση και σφραγίδες τα βάζει ο γραφέας. */
  | { readonly kind: 'write'; readonly next: SupplyRelationshipDraft }
  | { readonly kind: 'unchanged' }
  | { readonly kind: 'refused'; readonly reason: SupplyRelationshipRefusal };

export type SupplyRelationshipDraft = Omit<SupplyRelationship, 'id' | 'revision' | 'createdAt' | 'updatedAt' | 'updatedBy'>;

interface SupplyAct {
  readonly uid: string;
  readonly now: string;
}

const refused = (reason: SupplyRelationshipRefusal): SupplyTransition => ({ kind: 'refused', reason });
const write = (next: SupplyRelationshipDraft): SupplyTransition => ({ kind: 'write', next });
const UNCHANGED: SupplyTransition = { kind: 'unchanged' };

function blankOf(ends: SupplyRelationshipEnds, origin: SupplyRelationshipDraft['origin']): SupplyRelationshipDraft {
  return {
    companyId: ends.supplierCompanyId,
    buyerCompanyId: ends.buyerCompanyId,
    state: 'requested',
    origin,
    supplierContactId: null,
    customerRef: null,
    requestCount: 0,
    requestedByUid: null,
    requestedAt: null,
    acceptedByUid: null,
    acceptedAt: null,
    approvedByUid: null,
    approvedAt: null,
    endedBySide: null,
    endedByUid: null,
    endedAt: null,
  };
}

/** Κάθε ενεργοποίηση σβήνει το τέλος της προηγούμενης ζωής και μηδενίζει τον μετρητή αιτημάτων. */
const activated = (base: SupplyRelationshipDraft, act: SupplyAct): SupplyRelationshipDraft => ({
  ...base,
  state: 'active',
  requestCount: 0,
  acceptedByUid: act.uid,
  acceptedAt: act.now,
  endedBySide: null,
  endedByUid: null,
  endedAt: null,
});

/** **Πόρτα α:** ο αγοραστής αποδέχεται πρόσκληση από επαφή. Η συγκατάθεση του προμηθευτή είναι η ίδια η έκδοση. */
export function judgeInvitationAcceptance(
  current: SupplyRelationship | null,
  input: { readonly ends: SupplyRelationshipEnds; readonly contactId: string; readonly act: SupplyAct },
): SupplyTransition {
  const { ends, contactId, act } = input;
  if (current === null) return write({ ...activated(blankOf(ends, 'invitation'), act), supplierContactId: contactId });
  if (current.state !== 'active') return write({ ...activated(current, act), supplierContactId: contactId });
  if (current.supplierContactId === contactId) return UNCHANGED;
  return current.supplierContactId === null ? write({ ...current, supplierContactId: contactId }) : refused('already-connected');
}

/** **Πόρτα β:** ο αγοραστής ζητά με αριθμό πελάτη. Τίποτα δεν ενεργοποιείται χωρίς τον προμηθευτή. */
export function judgeAccessRequest(
  current: SupplyRelationship | null,
  input: { readonly ends: SupplyRelationshipEnds; readonly customerRef: string | null; readonly act: SupplyAct },
): SupplyTransition {
  const { ends, customerRef, act } = input;
  const requested = (base: SupplyRelationshipDraft): SupplyRelationshipDraft => ({
    ...base,
    state: 'requested',
    customerRef,
    requestCount: base.requestCount + 1,
    requestedByUid: act.uid,
    requestedAt: act.now,
    endedBySide: null,
    endedByUid: null,
    endedAt: null,
  });
  if (current === null) return write(requested(blankOf(ends, 'link')));
  if (current.state === 'active') return refused('already-connected');
  if (current.state === 'requested') return current.customerRef === customerRef ? UNCHANGED : write({ ...current, customerRef });
  return current.requestCount >= SUPPLY_REQUEST_LIMIT ? refused('request-limit') : write(requested(current));
}

/** Ο προμηθευτής εγκρίνει, δένοντας προαιρετικά την επαφή του. Ο αποδέκτης της ακμής είναι όποιος ζήτησε. */
export function judgeRequestApproval(
  current: SupplyRelationship,
  input: { readonly contactId: string | null; readonly act: SupplyAct },
): SupplyTransition {
  if (current.state !== 'requested') return refused('not-requested');
  const acceptedBy = { uid: current.requestedByUid ?? input.act.uid, now: input.act.now };
  return write({
    ...activated(current, acceptedBy),
    supplierContactId: input.contactId ?? current.supplierContactId,
    approvedByUid: input.act.uid,
    approvedAt: input.act.now,
  });
}

/** Ο προμηθευτής απορρίπτει. Το τέλος ανήκει σε εκείνον, ώστε ο μετρητής να φυλά τα επόμενα αιτήματα. */
export function judgeRequestDecline(current: SupplyRelationship, act: SupplyAct): SupplyTransition {
  if (current.state !== 'requested') return refused('not-requested');
  return write({ ...current, state: 'declined', endedBySide: 'supplier', endedByUid: act.uid, endedAt: act.now });
}

/** Σ7: άμεση ανάκληση από **οποιαδήποτε** πλευρά. Ιδεμποτής: δεύτερη ανάκληση δεν γράφει τίποτα. */
export function judgeRelationshipEnd(
  current: SupplyRelationship,
  input: { readonly side: SupplyRelationshipSide; readonly act: SupplyAct },
): SupplyTransition {
  if (current.state !== 'active' && current.state !== 'requested') return UNCHANGED;
  return write({ ...current, state: 'revoked', endedBySide: input.side, endedByUid: input.act.uid, endedAt: input.act.now });
}

/**
 * **Οι ταυτότητες του αγοραστή στα μάτια του προμηθευτή** (Σ6), με σειρά προτεραιότητας για την ομάδα πελάτη: η επαφή
 * είναι η ρητή, διαχειριζόμενη ταυτότητα του προμηθευτή, ο χώρος είναι το δίχτυ όταν δεν δέθηκε επαφή.
 */
export function relationshipParties(relationship: Pick<SupplyRelationship, 'buyerCompanyId' | 'supplierContactId'>): readonly PricingPartyRef[] {
  const workspace: PricingPartyRef = { kind: 'workspace', companyId: relationship.buyerCompanyId };
  return relationship.supplierContactId === null ? [workspace] : [{ kind: 'contact', contactId: relationship.supplierContactId }, workspace];
}
