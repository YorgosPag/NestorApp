/**
 * =============================================================================
 * Conveyance — συμμεταβιβάζοντες: προσθήκη / αφαίρεση (ADR-915 §23)
 * =============================================================================
 *
 * Καθαρός πυρήνας, ίδιος σε server (μέσα στο transaction) και client (optimistic). Ό,τι **δεν** ξέρει μια καθαρή
 * συνάρτηση — φυσικό ή νομικό πρόσωπο, ιδιότητα — έρχεται κριμένο στο `sellerCandidates` (`sellerCandidateOf`): ο
 * server το γεμίζει από τις επαφές που διάβασε ο ίδιος, ο client από τον επιλογέα. Η απόφαση του server είναι η τελική.
 *
 * 🔑 Τρεις ιδιότητες, όλες από την ταυτότητα = επαφή (§22 Ε2):
 *  - **Ιδεμπότητα**: ήδη πωλητής ⇒ καμία αλλαγή· αφαίρεση απόντος ⇒ καμία αλλαγή (δύο καρτέλες, δύο κλικ = ένα αποτέλεσμα).
 *  - **Ατομικότητα**: μία μη κατάλληλη επαφή ⇒ καμία προσθήκη (ποτέ «μισή» λίστα οικοπεδούχων).
 *  - **Αντιστρεψιμότητα**: η αφαίρεση βγάζει το πρόσωπο από τη λίστα **μόνο**· απαντήσεις (`partyFacts[key]`) και
 *    αποκλίσεις (`itemId@key`) μένουν, και επανέρχονται ακριβώς αν το πρόσωπο ξαναμπεί (Procore: «inactive, not
 *    deleted — to preserve historical data»). Τα αρχεία ζουν ούτως ή άλλως στην επαφή.
 *
 * **Layering**: leaf — καθαρές συναρτήσεις.
 *
 * @module lib/conveyance/case-party-commands
 */

import type { ConveyanceCase, ConveyanceSellerParty } from '@/types/conveyance-case';
import { MAX_CASE_SELLERS, sellerParty, sellerKeyOf, type SellerCandidate } from './case-parties';
import { change, reject, type CommandResult } from './command-result';
import type { CommandRejection, ConveyanceCommand } from './conveyance-commands';

/** Κριμένοι υποψήφιοι ανά `contactId` — απουσία ⇒ «δεν μπορεί να γίνει πωλητής». */
export type SellerCandidates = ReadonlyMap<string, SellerCandidate>;

type AddSellers = Extract<ConveyanceCommand, { type: 'add_sellers' }>;
type RemoveSeller = Extract<ConveyanceCommand, { type: 'remove_seller' }>;

/** Τα πρόσωπα που προστίθενται — ή ο λόγος άρνησης για **όλη** την εντολή. */
function newSellersOf(current: ConveyanceCase, contactIds: readonly string[], candidates: SellerCandidates): readonly ConveyanceSellerParty[] | CommandRejection {
  const present = new Set(current.parties.sellers.map((party) => party.key));
  const buyers = new Set(current.parties.buyers.map((buyer) => buyer.contactId));
  const added: ConveyanceSellerParty[] = [];
  for (const contactId of contactIds) {
    if (present.has(sellerKeyOf(contactId))) continue;
    const candidate = candidates.get(contactId);
    if (candidate === undefined) return 'seller_not_eligible';
    if (buyers.has(contactId)) return 'seller_is_buyer';
    added.push(sellerParty(contactId, candidate.kind, candidate.capacity));
  }
  return added;
}

export function addSellers(current: ConveyanceCase, command: AddSellers, candidates: SellerCandidates): CommandResult {
  const added = newSellersOf(current, command.contactIds, candidates);
  if (typeof added === 'string') return reject(added);
  if (added.length === 0) return { ok: true, next: current, changes: [] };
  const sellers = [...current.parties.sellers, ...added];
  if (sellers.length > MAX_CASE_SELLERS) return reject('too_many_sellers');
  return {
    ok: true,
    next: { ...current, parties: { ...current.parties, sellers } },
    changes: added.map((party) => change(`parties.sellers.${party.key}`, null, party.capacity)),
  };
}

export function removeSeller(current: ConveyanceCase, command: RemoveSeller): CommandResult {
  const party = current.parties.sellers.find((seller) => seller.key === command.partyKey);
  if (party === undefined) return { ok: true, next: current, changes: [] };
  if (party.capacity === 'principal') return reject('principal_not_removable');
  const sellers = current.parties.sellers.filter((seller) => seller.key !== party.key);
  return {
    ok: true,
    next: { ...current, parties: { ...current.parties, sellers } },
    changes: [change(`parties.sellers.${party.key}`, party.capacity, null)],
  };
}
