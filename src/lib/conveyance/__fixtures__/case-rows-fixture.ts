/**
 * Fixture τεστ — «υπόθεση με έναν πωλητή» (ADR-915 §22): οι γραμμές και τα γεγονότα όπως τα παράγει ο ΙΔΙΟΣ
 * επιλυτής της παραγωγής (`caseRowsOf`), ώστε τα τεστ του καταλόγου να γράφουν «αυτές οι γραμμές καταλόγου, αυτά τα
 * γεγονότα» χωρίς να ξαναφτιάχνουν τον πολλαπλασιασμό ανά πρόσωπο.
 *
 * Καμία πραγματική επαφή: συνθετικά αναγνωριστικά.
 */

import { rowKeyOf } from '@/config/conveyance-checklist/row-key';
import type { ChecklistItem } from '@/config/conveyance-checklist/types';
import type { ConveyanceCaseParties, ConveyanceSellerParty } from '@/types/conveyance-case';
import { sellerParty } from '../case-parties';
import { caseRowsOf, type CaseFacts, type CaseRow } from '../case-rows';
import { derivePartyFacts, type FactValues } from '../derive-facts';

export const TEST_SELLER: ConveyanceSellerParty = sellerParty('cont_seller', 'legal_entity', 'principal');

export const TEST_PARTIES: ConveyanceCaseParties = { sellers: [TEST_SELLER], buyers: [] };

/** Οι γραμμές της υπόθεσης για δοσμένες γραμμές καταλόγου (γραμμή πωλητή ⇒ μία ανά πωλητή). */
export function testRows(items: readonly ChecklistItem[], parties: ConveyanceCaseParties = TEST_PARTIES): readonly CaseRow[] {
  return caseRowsOf(items, parties);
}

/** Επίπεδα γεγονότα ⇒ ίδια τιμή για την υπόθεση και για κάθε πωλητή (τα τεστ ρωτούν «αυτό το γεγονός», όχι «ποιανού»). */
export function testFacts(facts: FactValues, parties: ConveyanceCaseParties = TEST_PARTIES): CaseFacts {
  return { case: facts, parties: Object.fromEntries(parties.sellers.map((party) => [party.key, { ...capacityFactsOf(party, parties), ...facts }])) };
}

/**
 * ADR-915 §23 — τα γεγονότα **ιδιότητας** του προσώπου, όπως τα παράγει η παραγωγή (`derivePartyFacts`): στην
 * πραγματική ροή είναι **πάντα** ορισμένα, άρα το fixture δεν τα αφήνει «αναπάντητα». Τα ρητά γεγονότα του τεστ
 * υπερισχύουν.
 */
function capacityFactsOf(party: ConveyanceSellerParty, parties: ConveyanceCaseParties): FactValues {
  const derived = derivePartyFacts(party, parties.sellers);
  return { seller_is_landowner: derived.seller_is_landowner, seller_tax_clearance_by_contractor: derived.seller_tax_clearance_by_contractor };
}

/** Το κλειδί της γραμμής πωλητή για τον (μοναδικό) πωλητή του fixture. */
export function sellerRowKey(itemId: string, seller: ConveyanceSellerParty = TEST_SELLER): string {
  return rowKeyOf(itemId, seller.key);
}
