import 'server-only';

/**
 * **Ποιος διαβάζει τη βιτρίνα ενός προμηθευτή** (ADR-923 §5.13 Σ6 · §5.15 Η3) — ο ΕΝΑΣ τρόπος να χτιστεί ο θεατής για κάθε
 * ανάγνωση ξένου καταλόγου που φτάνει στο κοινό (τιμές βιτρίνας · δημοσιευμένες εκδόσεις καταλόγου).
 *
 * 🔒 Χτίζεται **μέσα** στη συναλλαγή, ποτέ από τον καλούντα: ο ανώνυμος είναι `anonymous`· ο αγοραστής κρίνεται από τη **σχέση**
 *    του ζεύγους (`viewerOfRelationship`), και χωρίς ενεργή σχέση είναι απλώς «συνδεδεμένος», χωρίς ομάδα και χωρίς ταυτότητες.
 *    Η ανάκληση της σχέσης κερδίζει κάθε αγώνα.
 * 🔑 Ο αγοραστής ονομάζεται **μόνο** με τον χώρο του `AuthContext`, ποτέ με κάτι από το αίτημα.
 *
 * @module server/catalog/public/showcase-viewer.server
 */

import { readActiveSupplyRelationshipInTx } from '@/server/supply-relationships/supply-relationship-store.server';
import type { PricingViewer } from '@/subapps/catalog/types/price-list';
import type { CatalogReadScope } from '../catalog-store.server';
import { viewerOfRelationship } from '../pricing-viewer.server';

/** Ποιος ρωτά. Ο αγοραστής ονομάζεται **μόνο** με τον χώρο του `AuthContext`, ποτέ με κάτι από το αίτημα. */
export type ShowcaseViewerSource = { readonly kind: 'anonymous' } | { readonly kind: 'buyer'; readonly buyerCompanyId: string };

const SIGNED_IN_WITHOUT_RELATIONSHIP: PricingViewer = { kind: 'signedIn', customerGroupId: null, parties: [] };

/** Ο θεατής, στη σκοπιά του καταλόγου του προμηθευτή (`scope.ctx.companyId`). */
export async function showcaseViewerOf(scope: CatalogReadScope, source: ShowcaseViewerSource): Promise<PricingViewer> {
  if (source.kind === 'anonymous') return { kind: 'anonymous' };
  const ends = { supplierCompanyId: scope.ctx.companyId, buyerCompanyId: source.buyerCompanyId };
  const relationship = await readActiveSupplyRelationshipInTx(scope.tx, scope.db, ends);
  return relationship === null ? SIGNED_IN_WITHOUT_RELATIONSHIP : viewerOfRelationship(scope, relationship);
}
