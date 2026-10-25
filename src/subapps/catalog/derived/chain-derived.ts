/**
 * =============================================================================
 * ΤΑ ΠΑΡΑΓΩΓΑ ΤΗΣ ΑΛΥΣΙΔΑΣ — SKU πάνω στις συγχωνευμένες τιμές, ρίζα πάνω στους απογόνους
 * (ADR-923 §5.10 Δ7 · Δ8 · Δ11)
 * =============================================================================
 *
 * - **SKU**: συγχώνευση προγόνων (`resolveInheritedValues`) ⇒ πληρότητα ανά κανάλι × γλώσσα, αποτύπωμα εισόδων,
 *   facets, ετικέτα. Η ίδια συνάρτηση για γραφέα, εργασία επανυπολογισμού και εκδότη.
 * - **Ρίζα**: το ευρετήριο απογόνων ⇒ περίληψη «πλήρεις 5/7» (Akeneo product model grid), ένωση facets
 *   (η λίστα φιλτράρει **μοντέλα**, Δ11), ευρήματα κανόνων.
 *
 * @module subapps/catalog/derived/chain-derived
 */

import { completeChannelKeys, completeChannelKey, computeCompleteness } from '../completeness/compute-completeness';
import { completenessInputsHash } from '../completeness/inputs-hash';
import type { MeasurementRegistry } from '../measurement/measurement-registry';
import type { ConsistencyViolation } from '../rules/evaluate-consistency';
import type { CatalogAttributeDefinition } from '../types/attribute';
import type { CatalogSettingsDefinition } from '../types/catalog-settings';
import type { CatalogFamilyDefinition, VariantScheme } from '../types/family';
import type {
  CatalogCompletenessSummary,
  CatalogDescendantEntry,
  CatalogHolderDerived,
  CatalogProductDerived,
  CatalogProductModelDerived,
} from '../types/product-derived';
import { resolveInheritedValues, type InheritanceLink } from '../values/resolve-inherited';
import { mapCatalogChannels } from '../vocabulary/channels';
import { facetKeysOf, productLabelOf } from './holder-derived';

/** Ό,τι ξέρει ο γραφέας για το σχήμα τη στιγμή της εγγραφής — κοινό για όλη την αλυσίδα. */
export interface CatalogSchemaSnapshot {
  readonly family: CatalogFamilyDefinition;
  readonly attributes: ReadonlyMap<string, CatalogAttributeDefinition>;
  readonly registry: MeasurementRegistry;
  readonly settings: CatalogSettingsDefinition;
  readonly scheme: VariantScheme | null;
}

/** Τα παράγωγα ενός SKU. `chain` = ρίζα → (υπο-μοντέλο) → το ίδιο το SKU, με τις αναθεωρήσεις **μετά** την εγγραφή. */
export function productChainDerived(
  schema: CatalogSchemaSnapshot,
  chain: readonly InheritanceLink[],
  own: CatalogHolderDerived,
): CatalogProductDerived {
  const resolved = resolveInheritedValues(chain, schema.scheme);
  const completeness = computeCompleteness({ ...schema, resolved });
  return {
    ...own,
    rootModelId: chain.length > 1 ? chain[0].id : null,
    label: productLabelOf(resolved, schema.family),
    facetKeys: facetKeysOf(resolved),
    completeness,
    completenessHash: completenessInputsHash({ ...schema, chain }),
    completeChannels: completeChannelKeys(completeness),
  };
}

/** «Πλήρεις N/M» ανά κανάλι × γλώσσα, από τα πλήρη ζεύγη κάθε SKU του ευρετηρίου. */
export function summarizeDescendants(
  descendants: Readonly<Record<string, CatalogDescendantEntry>>,
  settings: CatalogSettingsDefinition,
): CatalogCompletenessSummary {
  const products = Object.values(descendants).filter((entry) => entry.kind === 'product');
  return mapCatalogChannels((channel) =>
    Object.fromEntries(settings.channelLocales[channel].map((locale) => {
      const key = completeChannelKey(channel, locale);
      const complete = products.filter((entry) => entry.completeChannels.includes(key)).length;
      return [locale, { complete, total: products.length }] as const;
    })),
  );
}

/** Τα παράγωγα της ρίζας: δικά της + ευρετήριο + περίληψη + ένωση facets + ευρήματα κανόνων. */
export function rootModelDerived(
  schema: CatalogSchemaSnapshot,
  root: InheritanceLink,
  own: CatalogHolderDerived,
  descendants: Readonly<Record<string, CatalogDescendantEntry>>,
  findings: readonly ConsistencyViolation[],
): CatalogProductModelDerived {
  const facets = new Set(facetKeysOf(resolveInheritedValues([root], schema.scheme)));
  Object.values(descendants).forEach((entry) => entry.facetKeys.forEach((key) => facets.add(key)));
  return {
    ...own,
    rootModelId: null,
    descendants,
    summary: summarizeDescendants(descendants, schema.settings),
    facetKeys: [...facets].sort(),
    findings,
  };
}

/**
 * Τα παράγωγα ενός υπο-μοντέλου: τα δικά του + τα facets της **δικής του** αλυσίδας (ρίζα → υπο-μοντέλο) — ώστε το
 * «χρησιμοποιείται αυτή η επιλογή;» (Θωράκιση 3) να βλέπει και υπο-μοντέλο χωρίς ακόμη SKU. Το ευρετήριο ζει στη ρίζα.
 */
export function subModelDerived(
  schema: CatalogSchemaSnapshot,
  chain: readonly InheritanceLink[],
  own: CatalogHolderDerived,
): CatalogProductModelDerived {
  const facetKeys = facetKeysOf(resolveInheritedValues(chain, schema.scheme));
  return { ...own, rootModelId: chain[0].id, descendants: {}, summary: null, facetKeys, findings: [] };
}
