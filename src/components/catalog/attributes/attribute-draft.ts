/**
 * @fileoverview **Το πρόχειρο ιδιότητας καταλόγου** — καθαρές συναρτήσεις (ADR-923 §5.2 · Φάση 1γ).
 * @module components/catalog/attributes/attribute-draft
 *
 * 🔑 **Αλλαγή τύπου = νέα ρύθμιση του τύπου** (discriminated union): μια `measurement` δεν κουβαλά ποτέ τα `options`
 *    ενός `select`. Οι σημαίες που ο νέος τύπος δεν υποστηρίζει (`unique` · `localizable`) σβήνουν **εδώ**, όχι ως
 *    εύρημα που ο άνθρωπος πρέπει να καταλάβει.
 * 🔑 **Οι προεπιλογές είναι έγκυρες** όπου γίνεται (πίνακας με κλειδί + τιμή, αρχείο = εικόνα), ώστε ο άνθρωπος να
 *    ξεκινά από κάτι που αποθηκεύεται — εκτός από ό,τι **πρέπει** να αποφασίσει (επιλογές ενός select).
 * 🔑 **Η επικύρωση είναι του γραφέα** (`validateAttribute`), συν «υπάρχει η ομάδα;» (ο γραφέας το ελέγχει μέσα στη
 *    συναλλαγή· εδώ το δείχνουμε πριν την αποστολή).
 */

import { IssueCollector, type CatalogIssue } from '@/subapps/catalog/schema/catalog-issues';
import { validateAttribute } from '@/subapps/catalog/schema/validate-attribute';
import type { MeasurementRegistry } from '@/subapps/catalog/measurement/measurement-registry';
import {
  deriveAttributeMeasurementFamilyCodes,
  type AttributeConfigMap,
  type AttributeMappings,
  type CatalogAttributeDefinition,
  type TypedAttributeConfig,
} from '@/subapps/catalog/types/attribute';
import {
  isLocalizableAttributeType,
  isUniqueCapableAttributeType,
  type AttributeType,
} from '@/subapps/catalog/vocabulary/attribute-types';
import type { AttributeRecord, FamilyRecord } from '@/services/catalog/catalog-api.client';

export const NO_MAPPINGS: AttributeMappings = {
  etimFeature: null,
  bsddUri: null,
  ifc: null,
  atoeCode: null,
  platformTerm: { status: 'unbound' },
};

/** Η πρώτη οικογένεια μέτρησης του μητρώου και η μονάδα-πρότυπό της — έγκυρη αφετηρία για νέα μέτρηση. */
function firstMeasurement(registry: MeasurementRegistry): { readonly family: string; readonly unit: string } {
  const family = registry.families[0];
  return { family: family?.code ?? '', unit: family?.standardUnitCode ?? '' };
}

/** Η προεπιλεγμένη ρύθμιση κάθε τύπου. `Record`-πληρότητα ⇒ νέος τύπος χωρίς προεπιλογή δεν μεταγλωττίζεται. */
export function defaultConfigFor(type: AttributeType, registry: MeasurementRegistry): TypedAttributeConfig {
  const measurement = firstMeasurement(registry);
  const number = { min: null, max: null, decimals: 0, negativeAllowed: false };
  const configs: { readonly [K in AttributeType]: AttributeConfigMap[K] } = {
    text: { maxLength: null, pattern: null },
    richText: { maxLength: null },
    number,
    measurement: { ...number, decimals: 2, measurementFamilyCode: measurement.family, defaultUnitCode: measurement.unit },
    boolean: {},
    select: { options: [] },
    multiSelect: { options: [], maxSelections: null },
    date: { min: null, max: null },
    asset: { assetKinds: ['image'], maxFiles: 1 },
    reference: { relation: 'related', targetFamilyCodes: [], maxReferences: null },
    table: {
      columns: [
        { code: 'key', labels: {}, type: 'text' },
        { code: 'value', labels: {}, type: 'number', decimals: 0 },
      ],
    },
  };
  return typedConfig(type, configs[type]);
}

/**
 * Ζεύγος τύπου–ρύθμισης ως μέλος του discriminated union. ⚠️ Το `as` είναι το **ένα** σημείο όπου το TypeScript
 * δεν μπορεί να συσχετίσει γενικό `K` με το μέλος της ένωσης (γνωστός περιορισμός «correlated unions», TS#30581)·
 * η υπογραφή εγγυάται ότι `config` είναι **ακριβώς** η ρύθμιση του `type`.
 */
export function typedConfig<K extends AttributeType>(type: K, config: AttributeConfigMap[K]): TypedAttributeConfig {
  return { type, config } as Extract<TypedAttributeConfig, { readonly type: K }>;
}

export function emptyAttributeDraft(groupId: string, orderKey: string, registry: MeasurementRegistry): CatalogAttributeDefinition {
  return {
    code: '',
    groupId,
    labels: {},
    description: {},
    localizable: false,
    scopable: false,
    unique: false,
    orderKey,
    mappings: NO_MAPPINGS,
    ...defaultConfigFor('text', registry),
  };
}

/** Μόνο ο ορισμός — χωρίς περίβλημα εγγραφής και χωρίς παράγωγα. */
export function attributeDraftOf(record: AttributeRecord): CatalogAttributeDefinition {
  const { code, groupId, labels, description, localizable, scopable, unique, orderKey, mappings } = record;
  return { code, groupId, labels, description, localizable, scopable, unique, orderKey, mappings, ...typedConfig(record.type, record.config) };
}

/** Νέος τύπος: νέα ρύθμιση, και οι σημαίες που δεν υποστηρίζει σβήνουν. */
export function withAttributeType(
  draft: CatalogAttributeDefinition,
  type: AttributeType,
  registry: MeasurementRegistry,
): CatalogAttributeDefinition {
  if (draft.type === type) return draft;
  return {
    ...draft,
    ...defaultConfigFor(type, registry),
    unique: draft.unique && isUniqueCapableAttributeType(type),
    localizable: draft.localizable && isLocalizableAttributeType(type),
  };
}

/**
 * Ό,τι το zod του γραφέα απορρίπτει στις αντιστοιχίσεις, ώστε να φαίνεται **πριν** την αποστολή: μισό ζεύγος IFC
 * (Pset χωρίς ιδιότητα ή το ανάποδο) και URI του bSDD που δεν είναι URL.
 */
function checkMappings(collector: IssueCollector, mappings: AttributeMappings): void {
  if (mappings.ifc && (mappings.ifc.pset.trim().length === 0 || mappings.ifc.property.trim().length === 0)) {
    collector.add('mappingIncomplete', 'mappings.ifc');
  }
  if (mappings.bsddUri !== null && !isUrl(mappings.bsddUri)) collector.add('invalidUri', 'mappings.bsddUri');
}

function isUrl(value: string): boolean {
  try {
    return new URL(value).protocol.startsWith('http');
  } catch {
    return false;
  }
}

export function validateAttributeDraft(
  draft: CatalogAttributeDefinition,
  registry: MeasurementRegistry,
  groupIds: ReadonlySet<string>,
): readonly CatalogIssue[] {
  const collector = new IssueCollector();
  if (!groupIds.has(draft.groupId)) collector.add('unknownReference', 'groupId');
  checkMappings(collector, draft.mappings);
  return [...validateAttribute(draft, registry), ...collector.issues];
}

/** Η αποθηκευμένη μορφή για την αισιόδοξη εγγραφή (με το παράγωγο του γραφέα). */
export function storedAttributeOf(draft: CatalogAttributeDefinition) {
  return { ...draft, measurementFamilyCodes: deriveAttributeMeasurementFamilyCodes(draft) };
}

/** Οι οικογένειες που χρησιμοποιούν την ιδιότητα — το **ίδιο** παράγωγο (`attributeIds`) που ρωτά ο γραφέας. */
export function familiesUsing(attributeId: string, families: readonly FamilyRecord[]): FamilyRecord[] {
  return families.filter((family) => family.attributeIds.includes(attributeId));
}
