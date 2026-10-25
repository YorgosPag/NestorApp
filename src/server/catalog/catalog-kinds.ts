/**
 * Τα **είδη** οντοτήτων του καταλόγου (ADR-923 §5.9 · §5.10) σε **έναν** πίνακα: συλλογή, τύπος ιστορικού,
 * ταυτότητα, παρακολουθούμενα πεδία, προβολή για το ιστορικό. Η μηχανή αποθήκευσης δεν ξέρει τίποτα άλλο για το
 * καθένα — νέο είδος = νέα γραμμή εδώ, και ο `Record` σπάει τη μεταγλώττιση αν λείψει κάποιο πεδίο.
 *
 * 🔑 **Τρεις τρόποι ταυτότητας**, κλειστό σύνολο:
 *   - `code` — ντετερμινιστικό από `(χώρος, κωδικός)` (σχήμα · μοντέλα · μέσα): η μοναδικότητα του κωδικού είναι δομική·
 *   - `random` — το **SKU** (Δ3): ο κωδικός του είναι ιδιότητα με κράτηση, όχι ταυτότητα·
 *   - `singleton` — οι ρυθμίσεις: **ένα** έγγραφο ανά χώρο.
 * @module server/catalog/catalog-kinds
 */

import type { TrackedFieldDef } from '@/lib/audit/audit-diff';
import type { AuditEntityType } from '@/config/audit-entity-registry';
import {
  CATALOG_ASSET_TRACKED_FIELDS,
  CATALOG_ATTRIBUTE_GROUP_TRACKED_FIELDS,
  CATALOG_ATTRIBUTE_TRACKED_FIELDS,
  CATALOG_CATEGORY_TRACKED_FIELDS,
  CATALOG_FAMILY_TRACKED_FIELDS,
  CATALOG_MEASUREMENT_FAMILY_TRACKED_FIELDS,
  CATALOG_PRODUCT_MODEL_TRACKED_FIELDS,
  CATALOG_PRODUCT_TRACKED_FIELDS,
  CATALOG_SETTINGS_TRACKED_FIELDS,
  CATALOG_VALUES_AUDIT_FIELD,
  catalogValuesAuditRows,
} from '@/config/audit-tracked-fields-catalog';
import { COLLECTIONS } from '@/config/firestore-collections';
import {
  ENTERPRISE_ID_PREFIXES,
  type EnterpriseIdPrefix,
  generateCatalogProductId,
  generateDeterministicCatalogAssetId,
  generateDeterministicCatalogAttributeGroupId,
  generateDeterministicCatalogAttributeId,
  generateDeterministicCatalogCategoryId,
  generateDeterministicCatalogFamilyId,
  generateDeterministicCatalogMeasurementFamilyId,
  generateDeterministicCatalogProductModelId,
  generateDeterministicCatalogSettingsId,
} from '@/services/enterprise-id.service';

export const CATALOG_KINDS = [
  'attribute',
  'attributeGroup',
  'measurementFamily',
  'category',
  'family',
  'productModel',
  'product',
  'asset',
  'settings',
] as const;
export type CatalogKind = (typeof CATALOG_KINDS)[number];

export type CatalogKindIdentity =
  | { readonly mode: 'code'; readonly idOf: (companyId: string, code: string) => string }
  | { readonly mode: 'random'; readonly prefix: EnterpriseIdPrefix; readonly mint: () => string }
  | { readonly mode: 'singleton'; readonly idOf: (companyId: string) => string };

export interface CatalogKindSpec {
  readonly collection: string;
  readonly entityType: AuditEntityType;
  readonly identity: CatalogKindIdentity;
  readonly trackedFields: Record<string, TrackedFieldDef>;
  /** Προβολή της εγγραφής **πριν** από τη σύγκριση του ιστορικού (π.χ. `values` ανά ιδιότητα). */
  readonly auditView?: (record: Readonly<Record<string, unknown>>) => Record<string, unknown>;
}

const byCode = (idOf: (companyId: string, code: string) => string): CatalogKindIdentity => ({ mode: 'code', idOf });

/** Ο χάρτης `values` ως συλλογή ανά ιδιότητα — ό,τι συγκρίνει το ιστορικό (ADR-923 §5.10 Θωράκιση 6). */
const valuesPerAttribute = (record: Readonly<Record<string, unknown>>): Record<string, unknown> => ({
  ...record,
  [CATALOG_VALUES_AUDIT_FIELD]: catalogValuesAuditRows(record[CATALOG_VALUES_AUDIT_FIELD]),
});

export const CATALOG_KIND_SPECS: Readonly<Record<CatalogKind, CatalogKindSpec>> = {
  attribute: {
    collection: COLLECTIONS.CATALOG_ATTRIBUTES,
    entityType: 'catalog_attribute',
    identity: byCode(generateDeterministicCatalogAttributeId),
    trackedFields: CATALOG_ATTRIBUTE_TRACKED_FIELDS,
  },
  attributeGroup: {
    collection: COLLECTIONS.CATALOG_ATTRIBUTE_GROUPS,
    entityType: 'catalog_attribute_group',
    identity: byCode(generateDeterministicCatalogAttributeGroupId),
    trackedFields: CATALOG_ATTRIBUTE_GROUP_TRACKED_FIELDS,
  },
  measurementFamily: {
    collection: COLLECTIONS.CATALOG_MEASUREMENT_FAMILIES,
    entityType: 'catalog_measurement_family',
    identity: byCode(generateDeterministicCatalogMeasurementFamilyId),
    trackedFields: CATALOG_MEASUREMENT_FAMILY_TRACKED_FIELDS,
  },
  category: {
    collection: COLLECTIONS.CATALOG_CATEGORIES,
    entityType: 'catalog_category',
    identity: byCode(generateDeterministicCatalogCategoryId),
    trackedFields: CATALOG_CATEGORY_TRACKED_FIELDS,
  },
  family: {
    collection: COLLECTIONS.CATALOG_FAMILIES,
    entityType: 'catalog_family',
    identity: byCode(generateDeterministicCatalogFamilyId),
    trackedFields: CATALOG_FAMILY_TRACKED_FIELDS,
  },
  productModel: {
    collection: COLLECTIONS.CATALOG_PRODUCT_MODELS,
    entityType: 'catalog_product_model',
    identity: byCode(generateDeterministicCatalogProductModelId),
    trackedFields: CATALOG_PRODUCT_MODEL_TRACKED_FIELDS,
    auditView: valuesPerAttribute,
  },
  product: {
    collection: COLLECTIONS.CATALOG_PRODUCTS,
    entityType: 'catalog_product',
    identity: { mode: 'random', prefix: ENTERPRISE_ID_PREFIXES.CATALOG_PRODUCT, mint: generateCatalogProductId },
    trackedFields: CATALOG_PRODUCT_TRACKED_FIELDS,
    auditView: valuesPerAttribute,
  },
  asset: {
    collection: COLLECTIONS.CATALOG_ASSETS,
    entityType: 'catalog_asset',
    identity: byCode(generateDeterministicCatalogAssetId),
    trackedFields: CATALOG_ASSET_TRACKED_FIELDS,
  },
  settings: {
    collection: COLLECTIONS.CATALOG_SETTINGS,
    entityType: 'catalog_settings',
    identity: { mode: 'singleton', idOf: generateDeterministicCatalogSettingsId },
    trackedFields: CATALOG_SETTINGS_TRACKED_FIELDS,
  },
};
