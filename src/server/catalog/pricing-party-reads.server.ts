import 'server-only';

/**
 * «Υπάρχει αυτός ο συμβαλλόμενος;» — η **μία** ερώτηση για κάθε αναφορά σε συμβαλλόμενο της τιμολόγησης
 * (ανάθεση ομάδας πελάτη · κοινό `partner` συνθήκης ή λίστας), ADR-923 §5.11 «3β».
 *
 * - **Επαφή**: επαφή **του προμηθευτή** (ίδιος χώρος) — ξένη ≡ ανύπαρκτη (ADR-742 §3.3).
 * - **Χώρος**: ένας **άλλος** ενοικιαστής του Νέστορα (`companies/{companyId}`, η ταυτότητα του token). Διαβάζεται
 *   **μόνο** η ύπαρξη — κανένα πεδίο του δεν φεύγει. Ο ίδιος ο προμηθευτής δεν είναι «συνεργάτης» του εαυτού του.
 *
 * Το εύρημα είναι **ένα** (`unknownParty`) για όλες τις περιπτώσεις — δεν λέει αν η επαφή είναι ξένη ή ανύπαρκτη.
 * @module server/catalog/pricing-party-reads.server
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import { isPayloadOwnedByCompany } from '@/lib/auth/tenant-ownership';
import type { CatalogIssue } from '@/subapps/catalog/schema/catalog-issues';
import type { PriceAudience, PricingPartyRef } from '@/subapps/catalog/types/price-list';
import type { CatalogTx } from './catalog-store.server';

async function partyExists(scope: CatalogTx, party: PricingPartyRef): Promise<boolean> {
  if (party.kind === 'workspace') {
    if (party.companyId === scope.ctx.companyId) return false;
    return (await scope.tx.get(scope.db.collection(COLLECTIONS.COMPANIES).doc(party.companyId))).exists;
  }
  const contact = (await scope.tx.get(scope.db.collection(COLLECTIONS.CONTACTS).doc(party.contactId))).data();
  return contact !== undefined && isPayloadOwnedByCompany(contact, scope.ctx.companyId);
}

/** Τα ευρήματα για έναν συμβαλλόμενο (κενά αν υπάρχει). */
export async function partyIssues(scope: CatalogTx, party: PricingPartyRef, path: string): Promise<readonly CatalogIssue[]> {
  return (await partyExists(scope, party)) ? [] : [{ code: 'unknownParty', path }];
}

/** Ο συμβαλλόμενος ενός κοινού `partner` — τα υπόλοιπα κοινά δεν αναφέρουν συμβαλλόμενο. */
export function audiencePartyIssues(scope: CatalogTx, audience: PriceAudience | null, path: string): Promise<readonly CatalogIssue[]> {
  return audience?.kind === 'partner' ? partyIssues(scope, audience.party, `${path}.party`) : Promise.resolve([]);
}
