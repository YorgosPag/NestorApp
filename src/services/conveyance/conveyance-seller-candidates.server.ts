/**
 * Conveyance — οι επαφές μιας εντολής `add_sellers`, κριμένες από τον server (ADR-915 §23).
 *
 * Ο client στέλνει **μόνο** contactIds. Φυσικό/νομικό πρόσωπο και ιδιότητα παράγονται εδώ, από την επαφή που διάβασε ο
 * ίδιος ο server (με έλεγχο μισθωτή) και από το έργο (`sellerSources`), με τον ΕΝΑΝ κριτή `sellerCandidateOf`.
 *
 * ⚠️ Η ανάγνωση γίνεται **πριν** από το transaction της υπόθεσης: η καταλληλότητα μιας επαφής δεν είναι αμετάβλητο που
 *    φυλάει το CAS της υπόθεσης (επαφή που αρχειοθετείται το ίδιο δευτερόλεπτο είναι καλοήθης αγώνας, όχι παραβίαση).
 *
 * @module services/conveyance/conveyance-seller-candidates.server
 */

import 'server-only';

import type { Firestore } from 'firebase-admin/firestore';

import { readOwnedContactDocs } from '@/server/lib/owned-contact-docs';
import { sellerCandidateOf, type SellerCapacitySources, type SellerCandidate } from '@/lib/conveyance/case-parties';
import type { SellerCandidates } from '@/lib/conveyance/case-party-commands';
import type { ConveyanceCommand } from '@/lib/conveyance/conveyance-commands';

const NO_CANDIDATES: SellerCandidates = new Map();

/** Οι κριμένοι υποψήφιοι της εντολής — κενό για κάθε εντολή εκτός `add_sellers` (καμία ανάγνωση). */
export async function sellerCandidatesFor(
  db: Firestore,
  companyId: string,
  command: ConveyanceCommand,
  sources: SellerCapacitySources,
): Promise<SellerCandidates> {
  if (command.type !== 'add_sellers') return NO_CANDIDATES;
  const contacts = await readOwnedContactDocs(db, companyId, command.contactIds);
  const candidates = new Map<string, SellerCandidate>();
  for (const contactId of command.contactIds) {
    const candidate = sellerCandidateOf(contactId, contacts.get(contactId) ?? null, sources);
    if (candidate) candidates.set(contactId, candidate);
  }
  return candidates;
}
