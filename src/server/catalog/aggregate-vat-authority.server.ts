import 'server-only';

/**
 * **Ο φράκτης Χ4 της μηχανής του συνόλου** (ADR-923 §5.13 Σ6, ανασκόπηση Μ-1 · 3ος γύρος): αλλαγή που μετακινεί SKU σε κλάδο
 * με **άλλον ενεργό** συντελεστή ΦΠΑ αλλάζει την τελική τιμή προς τον καταναλωτή, άρα θέλει το δικαίωμα τιμολόγησης.
 *
 * 🔑 Το δικαίωμα κρίνεται **πριν** από τη συναλλαγή (δίκτυο εκτός συναλλαγής, όπως η μετακίνηση κατηγορίας) και περνά μέσα ως τιμή.
 * 🔑 Καμία ανάγνωση όταν καμία αλυσίδα κατηγοριών SKU δεν άλλαξε (η συνήθης εγγραφή τιμών/ιδιοτήτων), ή όταν το δικαίωμα υπάρχει.
 *
 * @module server/catalog/aggregate-vat-authority.server
 */

import { hasPermission, type AuthContext } from '@/lib/auth';
import { chainCategoryIdsOf, aggregateVatShifts, skusWithChangedChains } from '@/subapps/catalog/aggregate/aggregate-vat';
import type { CatalogAggregate } from '@/subapps/catalog/aggregate/aggregate-model';
import { memberPath } from '@/subapps/catalog/aggregate/judge-aggregate';
import type { CatalogCategoryDefinition } from '@/subapps/catalog/types/category';
import { CATALOG_AUTHORITY_PERMISSIONS } from '@/subapps/catalog/vocabulary/catalog-authorities';
import { readActiveByIds } from './catalog-library-reads.server';
import type { CatalogTx } from './catalog-store.server';
import { assertNoIssues } from './catalog-write-error';

/** Το δικαίωμα τιμολόγησης του δρώντα, κριμένο **πριν** από τη συναλλαγή. */
export interface AggregateVatAuthority {
  readonly pricingAllowed: boolean;
}

/**
 * Για εγγραφές που **δομικά** δεν αλλάζουν την αλυσίδα SKU που ζει πριν και μετά: δημιουργία (το νέο μέλος δεν είναι πρόγονος
 * κανενός υπάρχοντος SKU), διαγραφή (ο καταρράκτης παίρνει και τα SKU), επανυπολογισμός (`touch`). Αν παρ' όλα αυτά προκύψει
 * μετατόπιση, η απάντηση είναι **άρνηση** (fail-closed), ποτέ σιωπηλή αλλαγή τελικής τιμής.
 */
export const VAT_NEUTRAL_WRITE: AggregateVatAuthority = { pricingAllowed: false };

export async function readAggregateVatAuthority(ctx: AuthContext): Promise<AggregateVatAuthority> {
  return { pricingAllowed: await hasPermission(ctx, CATALOG_AUTHORITY_PERMISSIONS.pricing) };
}

/** Οι κατηγορίες των αλυσίδων που άλλαξαν **και** οι πρόγονοί τους (δύο `getAll`). */
async function readVatCategories(scope: CatalogTx, categoryIds: readonly string[]) {
  const direct = await readActiveByIds<CatalogCategoryDefinition>(scope, 'category', categoryIds);
  const missing = [...direct.values()].flatMap((category) => category.ancestorIds).filter((id) => !direct.has(id));
  return new Map([...direct, ...(await readActiveByIds<CatalogCategoryDefinition>(scope, 'category', missing))]);
}

export async function assertAggregateKeepsVat(scope: CatalogTx, aggregate: CatalogAggregate, authority: AggregateVatAuthority): Promise<void> {
  if (authority.pricingAllowed) return;
  const changed = skusWithChangedChains(aggregate);
  if (changed.length === 0) return;
  const shifted = aggregateVatShifts(aggregate, await readVatCategories(scope, chainCategoryIdsOf(aggregate, changed)));
  assertNoIssues(shifted.map((id) => ({ code: 'vatRatePricingAuthority' as const, path: `${memberPath(id)}.categoryIds` })));
}
