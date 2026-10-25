/**
 * Το κοινό πλαίσιο των επικυρωτών τιμών (ADR-923 §5.10): η οικογένεια, η βιβλιοθήκη ιδιοτήτων
 * **όπως είναι τώρα**, το μητρώο μονάδων, οι ρυθμίσεις γλωσσών, το σχήμα παραλλαγών, το βάθος του
 * φορέα και τα μέσα στα οποία μπορεί να δείξει. Ίδιο ιδίωμα με το `family-validation-context.ts`.
 * @module subapps/catalog/schema/product-validation-context
 */

import type { MeasurementRegistry } from '../measurement/measurement-registry';
import type { CatalogAssetDefinition } from '../types/asset';
import type { CatalogAttributeDefinition } from '../types/attribute';
import type { CatalogSettingsDefinition } from '../types/catalog-settings';
import type { CatalogFamilyDefinition, VariantScheme } from '../types/family';
import type { IssueCollector } from './catalog-issues';

/** Ό,τι χρειάζεται ο επικυρωτής από ένα μέσο: μόνο το είδος του (η ύπαρξη = κλειδί του χάρτη). */
export type AssetLookup = ReadonlyMap<string, Pick<CatalogAssetDefinition, 'kind'>>;

export interface ProductValuesContext {
  readonly family: CatalogFamilyDefinition;
  readonly attributes: ReadonlyMap<string, CatalogAttributeDefinition>;
  readonly registry: MeasurementRegistry;
  readonly settings: CatalogSettingsDefinition;
  /** Το σχήμα παραλλαγών του μοντέλου· `null` = απλό προϊόν. */
  readonly scheme: VariantScheme | null;
  /** Το βάθος του φορέα: 0 = ρίζα/απλό · 1 = υπο-μοντέλο ή SKU 1 επιπέδου · 2 = SKU 2 επιπέδων. */
  readonly depth: number;
  /** Τα μέσα του χώρου που αναφέρονται από τις τιμές (ο γραφέας τα διαβάζει στη συναλλαγή). */
  readonly assets: AssetLookup;
}

/** Πλαίσιο + συλλέκτης — ό,τι περνά σε κάθε έλεγχο τιμής. */
export interface ValueCheck {
  readonly context: ProductValuesContext;
  readonly collector: IssueCollector;
}
