'use client';

/**
 * @fileoverview **Η βιβλιοθήκη σχήματος ενός χώρου, όπως τη βλέπει η οθόνη** — ιδιότητες, ομάδες, οικογένειες μέτρησης
 *   και το μητρώο μονάδων, ζωντανά και αισιόδοξα (ADR-923 §5.2 · Φάση 1γ).
 * @module hooks/catalog/useCatalogLibrary
 *
 * 🔑 **Μία πηγή ανά σελίδα**: η ζωντανή ανάγνωση **και** οι αισιόδοξες πράξεις ζουν εδώ μαζί, ώστε ό,τι μόλις έγραψε
 *    ο άνθρωπος να το βλέπουν **όλα** τα σημεία της σελίδας (π.χ. νέα ιδιότητα από τον επεξεργαστή οικογένειας εμφανίζεται
 *    αμέσως στη λίστα της). Δύο ανεξάρτητα hooks θα έδιναν δύο αλήθειες για ένα δευτερόλεπτο.
 * 🔑 **Το μητρώο μονάδων το χτίζει ο πυρήνας** (`createMeasurementRegistryFromRecords`), από την **αισιόδοξη** όψη —
 *    η **ίδια** συνάρτηση που χτίζει το μητρώο του γραφέα. Η οθόνη επικυρώνει με αυτό, άρα επικυρώνει όπως ο γραφέας.
 * 🔑 **Σειρά = κλειδί σειράς** (`compareOrderKeys`): ομάδες καθολικά, ιδιότητες μέσα στην ομάδα τους.
 */

import { useMemo } from 'react';

import { compareOrderKeys } from '@/lib/ordering/fractional-index';
import type { CatalogFailure } from '@/services/catalog/catalog-failure';
import type {
  AttributeGroupRecord,
  AttributeRecord,
  MeasurementFamilyRecord,
} from '@/services/catalog/catalog-api.client';
import {
  createMeasurementRegistryFromRecords,
  type MeasurementRegistry,
} from '@/subapps/catalog/measurement/measurement-registry';
import { useCatalogCollection, type CatalogLoadState } from './useCatalogCollection';
import { useCatalogOptimistic, type CatalogOptimistic } from './useCatalogOptimistic';

/** Η χειρότερη από πολλές καταστάσεις: αποτυχία > φόρτωση > έτοιμο. */
export function combineLoadStates(states: readonly CatalogLoadState[]): CatalogLoadState {
  if (states.includes('failed')) return 'failed';
  return states.includes('loading') ? 'loading' : 'ready';
}

export function byOrderKey<T extends { readonly orderKey: string }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => compareOrderKeys(a.orderKey, b.orderKey));
}

export interface CatalogLibrary {
  readonly state: CatalogLoadState;
  readonly attributes: readonly AttributeRecord[];
  readonly groups: readonly AttributeGroupRecord[];
  readonly measurementFamilies: readonly MeasurementFamilyRecord[];
  /** id → ιδιότητα (για επικύρωση οικογένειας). */
  readonly attributeById: ReadonlyMap<string, AttributeRecord>;
  readonly registry: MeasurementRegistry;
  readonly ops: {
    readonly attributes: CatalogOptimistic<AttributeRecord>;
    readonly groups: CatalogOptimistic<AttributeGroupRecord>;
    readonly measurementFamilies: CatalogOptimistic<MeasurementFamilyRecord>;
  };
}

export function useCatalogLibrary(onFailure: (failure: CatalogFailure) => void): CatalogLibrary {
  const attributes = useCatalogCollection('CATALOG_ATTRIBUTES');
  const groups = useCatalogCollection('CATALOG_ATTRIBUTE_GROUPS');
  const measurement = useCatalogCollection('CATALOG_MEASUREMENT_FAMILIES');
  const attributeOps = useCatalogOptimistic(attributes.items, onFailure);
  const groupOps = useCatalogOptimistic(groups.items, onFailure);
  const measurementOps = useCatalogOptimistic(measurement.items, onFailure);

  const sortedAttributes = useMemo(() => byOrderKey(attributeOps.view), [attributeOps.view]);
  const sortedGroups = useMemo(() => byOrderKey(groupOps.view), [groupOps.view]);
  const attributeById = useMemo(() => new Map(attributeOps.view.map((item) => [item.id, item])), [attributeOps.view]);
  const registry = useMemo(() => createMeasurementRegistryFromRecords(measurementOps.view), [measurementOps.view]);
  const ops = useMemo(
    () => ({ attributes: attributeOps, groups: groupOps, measurementFamilies: measurementOps }),
    [attributeOps, groupOps, measurementOps],
  );
  return {
    state: combineLoadStates([attributes.state, groups.state, measurement.state]),
    attributes: sortedAttributes,
    groups: sortedGroups,
    measurementFamilies: measurementOps.view,
    attributeById,
    registry,
    ops,
  };
}
