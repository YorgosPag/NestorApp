/**
 * @fileoverview **Το συμβόλαιο της πόρτας κατόχου** — κοινό για route και πελάτη (ADR-930 §3.8).
 * @module services/crm/opportunity-owner-schema
 *
 * `GET  /api/opportunities/[id]/owner` → ο τρέχων κάτοχος + οι υποψήφιοι (τα ΕΝΕΡΓΑ μέλη του χώρου).
 * `POST /api/opportunities/[id]/owner` `{ expectedOwnerUid, newOwnerUid, note? }` — `expectedOwnerUid` = ο κάτοχος που
 * **είδε** ο άνθρωπος· διαφορετικός από τον αποθηκευμένο ⇒ 409 (κάποιος άλλος τη μεταβίβασε στο μεταξύ).
 */

import { z } from 'zod';

import type { NetworkPerson } from '@/types/network-wire';
import { OWNER_TRANSFER_NOTE_MAX, type OwnerTransferRequest } from './opportunity-owner-transfer';

const uid = z.string().trim().min(1).max(128);

export const opportunityOwnerBody = z.object({
  expectedOwnerUid: uid.nullable(),
  newOwnerUid: uid,
  note: z.string().max(OWNER_TRANSFER_NOTE_MAX).optional(),
});

export type OpportunityOwnerBody = z.infer<typeof opportunityOwnerBody>;

/** Ο τύπος του σχήματος ΕΙΝΑΙ ο τύπος του πυρήνα — αν αποκλίνουν, σπάει η μεταγλώττιση εδώ. */
const _bodyMatchesCore: (body: OpportunityOwnerBody) => OwnerTransferRequest = (body) => body;
void _bodyMatchesCore;

/** Ένας υποψήφιος κάτοχος — όνομα + φωτογραφία από τον ΕΝΑ αναγνώστη προσώπων (`readNetworkPeople`). */
export type OwnerCandidate = NetworkPerson;

export interface OpportunityOwnerCandidatesResponse {
  readonly ownerUid: string | null;
  readonly candidates: readonly OwnerCandidate[];
}

export type OpportunityOwnerTransferResponse =
  | { readonly outcome: 'unchanged'; readonly ownerUid: string }
  | { readonly outcome: 'applied'; readonly ownerUid: string; readonly previousOwnerUid: string | null };

/** Οι λεπτομέρειες του 409. */
export interface OpportunityOwnerConflict {
  readonly currentOwnerUid: string | null;
}
