import 'server-only';

/**
 * **Η τιμή ξένου καταλόγου για τον αγοραστή** (ADR-923 §5.12 Δ4 · Δ5 · Σ4 · Σ7).
 *
 * 🔑 Ο θεατής προκύπτει από το `ctx.companyId` του αγοραστή και τη σχέση, ποτέ από το σώμα. Ο πελάτης ονομάζει **τη σχέση του**,
 *    όχι χώρο: ξένη, ανύπαρκτη και ανενεργή σχέση δίνουν την **ίδια** απάντηση, άρα το route δεν είναι όργανο απαρίθμησης.
 * 🔑 Η σχέση ξαναρωτιέται **μέσα** στη συναλλαγή της τιμής: η ανάκληση κερδίζει κάθε αγώνα.
 * 🔒 Μόνο `foreignOutcomeOf` φεύγει από εδώ.
 * @module server/supply-relationships/supply-foreign-quote.server
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import type { AuthContext } from '@/lib/auth';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { readOwnedOrNull, runForeignCatalogRead, type CatalogReadScope } from '@/server/catalog/catalog-store.server';
import { quoteWithin } from '@/server/catalog/price-quote.server';
import { viewerOfRelationship } from '@/server/catalog/pricing-viewer.server';
import { FOREIGN_UNAVAILABLE, foreignOutcomeOf, type ForeignPrice, type ForeignQuote } from '@/subapps/catalog/pricing/foreign-quote';
import { FOREIGN_SKU_NONE, type ForeignSkuSearch } from '@/subapps/catalog/pricing/foreign-sku-search';
import { supplyRelationshipFromDocument } from '@/subapps/catalog/schema/zod/supply-relationship.schema';
import type { SupplyRelationship } from '@/subapps/catalog/types/supply-relationship';

import { searchCatalogInScope } from './supply-foreign-search.server';
import { readActiveSupplyRelationshipInTx } from './supply-relationship-store.server';

export interface ForeignQuoteRequest {
  readonly relationshipId: string;
  readonly variantId: string;
  readonly quantity: number;
}

export interface ForeignSearchRequest {
  readonly relationshipId: string;
  readonly term: string;
}

/** Η τιμή **και** η έκδοσή της: ο αριθμός φαίνεται στη γραμμή BOQ χωρίς ανάγνωση (Δ8). */
export type ForeignQuoteForLine =
  | Exclude<ForeignQuote, { kind: 'priced' }>
  | { readonly kind: 'priced'; readonly price: ForeignPrice; readonly versionNumber: number; readonly relationship: SupplyRelationship };

/** Η σχέση του αγοραστή με αυτό το id, ή `null`. Εκτός συναλλαγής: μόνο για να μάθουμε ποιον κατάλογο θα ανοίξουμε. */
async function readBuyerRelationship(ctx: AuthContext, relationshipId: string): Promise<SupplyRelationship | null> {
  const db = getAdminFirestore();
  const snap = await db.collection(COLLECTIONS.SUPPLY_RELATIONSHIPS).doc(relationshipId).get();
  const relationship = supplyRelationshipFromDocument(snap.data());
  return relationship?.buyerCompanyId === ctx.companyId ? relationship : null;
}

async function quoteInScope(scope: CatalogReadScope, buyerCompanyId: string, request: ForeignQuoteRequest): Promise<ForeignQuoteForLine> {
  const ends = { supplierCompanyId: scope.ctx.companyId, buyerCompanyId };
  const relationship = await readActiveSupplyRelationshipInTx(scope.tx, scope.db, ends);
  if (relationship === null) return FOREIGN_UNAVAILABLE;
  const viewer = await viewerOfRelationship(scope, relationship);
  const subject = { kind: 'variant', variantId: request.variantId } as const;
  // ⛔ `priceListId: null`: ο αγοραστής δεν διαλέγει ποτέ λίστα· παίρνει του ειδικότερου κοινού που τον καλύπτει.
  const outcome = foreignOutcomeOf(await quoteWithin(scope, { subject, quantity: request.quantity, at: null, priceListId: null }, viewer));
  if (outcome.kind !== 'priced') return outcome;
  const version = await readOwnedOrNull<{ readonly number: number }>(scope, 'priceListVersion', outcome.price.priceListVersionId);
  return version === null ? FOREIGN_UNAVAILABLE : { ...outcome, versionNumber: version.number, relationship };
}

/** Μία τιμή για τη γραμμή BOQ: η εσωτερική μορφή, με σχέση και έκδοση. */
export async function quoteForeignLine(ctx: AuthContext, request: ForeignQuoteRequest): Promise<ForeignQuoteForLine> {
  const relationship = await readBuyerRelationship(ctx, request.relationshipId);
  if (relationship === null) return FOREIGN_UNAVAILABLE;
  return runForeignCatalogRead(relationship.companyId, (scope) => quoteInScope(scope, ctx.companyId, request));
}

/** Η απάντηση του route: το κλειστό σχήμα, χωρίς τη σχέση. */
export async function quoteForeignPrice(ctx: AuthContext, request: ForeignQuoteRequest): Promise<ForeignQuote> {
  const quoted = await quoteForeignLine(ctx, request);
  return quoted.kind === 'priced' ? { kind: 'priced', price: quoted.price } : quoted;
}

async function searchInScope(scope: CatalogReadScope, buyerCompanyId: string, term: string): Promise<ForeignSkuSearch> {
  const relationship = await readActiveSupplyRelationshipInTx(scope.tx, scope.db, { supplierCompanyId: scope.ctx.companyId, buyerCompanyId });
  if (relationship === null) return FOREIGN_SKU_NONE;
  return { rows: await searchCatalogInScope(scope, await viewerOfRelationship(scope, relationship), term) };
}

/** Τα SKU που βλέπει ο αγοραστής για έναν όρο. Ξένη, ανύπαρκτη, ανακλημένη σχέση ⇒ ίδια κενή απάντηση με «δεν βρέθηκε τίποτα» (Σ7). */
export async function searchForeignCatalog(ctx: AuthContext, request: ForeignSearchRequest): Promise<ForeignSkuSearch> {
  const relationship = await readBuyerRelationship(ctx, request.relationshipId);
  if (relationship === null) return FOREIGN_SKU_NONE;
  return runForeignCatalogRead(relationship.companyId, (scope) => searchInScope(scope, ctx.companyId, request.term));
}
