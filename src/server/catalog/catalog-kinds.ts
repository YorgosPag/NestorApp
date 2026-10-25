/**
 * Τα **πέντε είδη** οντοτήτων σχήματος καταλόγου (ADR-923 §5.9) σε **έναν** πίνακα: συλλογή, τύπος ιστορικού,
 * γεννήτορας ταυτότητας, παρακολουθούμενα πεδία. Η μηχανή αποθήκευσης δεν ξέρει τίποτα άλλο για το καθένα —
 * νέο είδος = νέα γραμμή εδώ, και ο `Record` σπάει τη μεταγλώττιση αν λείψει κάποιο πεδίο.
 * @module server/catalog/catalog-kinds
 */

import type { TrackedFieldDef } from '@/lib/audit/audit-diff';
import type { AuditEntityType } from '@/config/audit-entity-registry';
import {
  CATALOG_ATTRIBUTE_GROUP_TRACKED_FIELDS,
  CATALOG_ATTRIBUTE_TRACKED_FIELDS,
  CATALOG_CATEGORY_TRACKED_FIELDS,
  CATALOG_FAMILY_TRACKED_FIELDS,
  CATALOG_MEASUREMENT_FAMILY_TRACKED_FIELDS,
} from '@/config/audit-tracked-fields-catalog';
import { COLLECTIONS } from '@/config/firestore-collections';
import {
  generateDeterministicCatalogAttributeGroupId,
  generateDeterministicCatalogAttributeId,
  generateDeterministicCatalogCategoryId,
  generateDeterministicCatalogFamilyId,
  generateDeterministicCatalogMeasurementFamilyId,
} from '@/services/enterprise-id.service';

export const CATALOG_KINDS = ['attribute', 'attributeGroup', 'measurementFamily', 'category', 'family'] as const;
export type CatalogKind = (typeof CATALOG_KINDS)[number];

export interface CatalogKindSpec {
  readonly collection: string;
  readonly entityType: AuditEntityType;
  readonly idOf: (companyId: string, code: string) => string;
  readonly trackedFields: Record<string, TrackedFieldDef>;
}

export const CATALOG_KIND_SPECS: Readonly<Record<CatalogKind, CatalogKindSpec>> = {
  attribute: {
    collection: COLLECTIONS.CATALOG_ATTRIBUTES,
    entityType: 'catalog_attribute',
    idOf: generateDeterministicCatalogAttributeId,
    trackedFields: CATALOG_ATTRIBUTE_TRACKED_FIELDS,
  },
  attributeGroup: {
    collection: COLLECTIONS.CATALOG_ATTRIBUTE_GROUPS,
    entityType: 'catalog_attribute_group',
    idOf: generateDeterministicCatalogAttributeGroupId,
    trackedFields: CATALOG_ATTRIBUTE_GROUP_TRACKED_FIELDS,
  },
  measurementFamily: {
    collection: COLLECTIONS.CATALOG_MEASUREMENT_FAMILIES,
    entityType: 'catalog_measurement_family',
    idOf: generateDeterministicCatalogMeasurementFamilyId,
    trackedFields: CATALOG_MEASUREMENT_FAMILY_TRACKED_FIELDS,
  },
  category: {
    collection: COLLECTIONS.CATALOG_CATEGORIES,
    entityType: 'catalog_category',
    idOf: generateDeterministicCatalogCategoryId,
    trackedFields: CATALOG_CATEGORY_TRACKED_FIELDS,
  },
  family: {
    collection: COLLECTIONS.CATALOG_FAMILIES,
    entityType: 'catalog_family',
    idOf: generateDeterministicCatalogFamilyId,
    trackedFields: CATALOG_FAMILY_TRACKED_FIELDS,
  },
};
