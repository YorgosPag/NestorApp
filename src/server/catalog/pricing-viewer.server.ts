import 'server-only';

/**
 * **Ποιος ρωτά την τιμή** (ADR-923 §5.11 «3β» · §12 🔒 · §5.12 Σ6): ο θεατής χτίζεται από **αποθηκευμένες** εγγραφές του
 * χώρου, ποτέ από ό,τι στέλνει ο πελάτης. Ο πελάτης λέει «σαν τον Χ», ο διακομιστής ξέρει **ποιος** είναι ο Χ.
 *
 * 🔴 Ο συνεργάτης είναι **σύνολο** ταυτοτήτων: η σχέση προμήθειας δένει την επαφή με τον χώρο, οπότε όποια από τις δύο κι
 *    αν ρωτηθεί, ο θεατής κρίνεται και με τις δύο. Αλλιώς το «δες σαν τον Χ» θα έδειχνε άλλη τιμή από την πραγματική.
 * @module server/catalog/pricing-viewer.server
 */

import {
  readActiveRelationshipOfContactInTx,
  readActiveSupplyRelationshipInTx,
} from '@/server/supply-relationships/supply-relationship-store.server';
import { pricingPartyKey } from '@/subapps/catalog/pricing/price-audience';
import { relationshipParties } from '@/subapps/catalog/pricing/supply-relationship-judge';
import type { PriceQuoteViewAs } from '@/subapps/catalog/types/price-list-requests';
import type {
  CustomerAssignmentDefinition,
  CustomerGroupDefinition,
  PricingPartyRef,
  PricingViewer,
} from '@/subapps/catalog/types/price-list';
import type { SupplyRelationship } from '@/subapps/catalog/types/supply-relationship';
import { readActiveByIds } from './catalog-library-reads.server';
import { readForUpsert, type CatalogReadScope, type CatalogTx } from './catalog-store.server';
import { assertNoIssues } from './catalog-write-error';
import { partyIssues } from './pricing-party-reads.server';

/** Η σχέση πίσω από έναν συμβαλλόμενο: ο χώρος ζητείται με το ζεύγος, η επαφή με το πεδίο δεσίματος. */
async function relationshipOfParty(scope: CatalogTx, party: PricingPartyRef) {
  const supplierCompanyId = scope.ctx.companyId;
  return party.kind === 'workspace'
    ? readActiveSupplyRelationshipInTx(scope.tx, scope.db, { supplierCompanyId, buyerCompanyId: party.companyId })
    : readActiveRelationshipOfContactInTx(scope.tx, scope.db, supplierCompanyId, party.contactId);
}

/** Η ομάδα του θεατή: η **πρώτη** ταυτότητα με ανάθεση, με τη σειρά προτεραιότητας του `relationshipParties`. */
async function assignedGroupOf(scope: CatalogReadScope, parties: readonly PricingPartyRef[]): Promise<string | null> {
  for (const party of parties) {
    const { current } = await readForUpsert<CustomerAssignmentDefinition>(scope, 'customerAssignment', pricingPartyKey(party));
    if (current !== null) return current.customerGroupId;
  }
  return null;
}

/** **Ο ξένος θεατής** (§5.12 Δ5): χτίζεται από τη σχέση, με τις ταυτότητές της, στη σκοπιά του καταλόγου που διαβάζεται. */
export async function viewerOfRelationship(scope: CatalogReadScope, relationship: Pick<SupplyRelationship, 'buyerCompanyId' | 'supplierContactId'>): Promise<PricingViewer> {
  const parties = relationshipParties(relationship);
  return { kind: 'signedIn', customerGroupId: await assignedGroupOf(scope, parties), parties };
}

async function partnerViewer(scope: CatalogTx, party: PricingPartyRef): Promise<PricingViewer> {
  assertNoIssues(await partyIssues(scope, party, 'viewAs.party'));
  const relationship = await relationshipOfParty(scope, party);
  const parties = relationship === null ? [party] : relationshipParties(relationship);
  return { kind: 'signedIn', customerGroupId: await assignedGroupOf(scope, parties), parties };
}

/** Ο θεατής, χτισμένος από ό,τι **υπάρχει** στον χώρο. */
export async function viewerOf(scope: CatalogTx, viewAs: PriceQuoteViewAs): Promise<PricingViewer> {
  switch (viewAs.kind) {
    case 'anonymous':
      return { kind: 'anonymous' };
    case 'signedIn':
      return { kind: 'signedIn', customerGroupId: null, parties: [] };
    case 'customerGroup': {
      const groups = await readActiveByIds<CustomerGroupDefinition>(scope, 'customerGroup', [viewAs.customerGroupId]);
      assertNoIssues(groups.size === 1 ? [] : [{ code: 'unknownReference', path: 'viewAs.customerGroupId' }]);
      return { kind: 'signedIn', customerGroupId: viewAs.customerGroupId, parties: [] };
    }
    case 'partner':
      return partnerViewer(scope, viewAs.party);
  }
}
