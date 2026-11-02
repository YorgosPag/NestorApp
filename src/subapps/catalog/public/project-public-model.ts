/**
 * **Η δημόσια προβολή ενός μοντέλου** (ADR-923 §5.13 Σ2 · Δ1 · Ε4): καθαρή σύνθεση, χωρίς καμία ανάγνωση.
 *
 * 🔑 Μπαίνει μόνο ό,τι βλέπει ο ανώνυμος: η κρίση είναι η μία `judgeVisibility`. Χωρίς ορατό SKU απαντά `null`, ώστε
 *    κρυφό και ανύπαρκτο να είναι ταυτόσημα. Τίποτα από κρυφό SKU δεν αφήνει ίχνος, ούτε κατηγορία του.
 * 🔒 Δημοσιεύεται **κλειστά**: ιδιότητα που η οικογένεια δηλώνει απαιτούμενη για `storefront`, ή άξονας παραλλαγής. Ό,τι
 *    δεν είναι δηλωμένο μένει έξω, γιατί μια ιδιότητα κειμένου ή αριθμού μπορεί να κρατά εσωτερική πληροφορία.
 * 🔒 Τα μέσα έρχονται ως είσοδος, ήδη ελεγμένα (Σ3): id που λείπει από τον χάρτη δεν δημοσιεύεται.
 *
 * Ο καλών (Σ3) περνά μόνο ζωντανά SKU. @module subapps/catalog/public/project-public-model
 */

import type { HumanLanguage } from '@/i18n/languages';
import type { CatalogSchemaSnapshot } from '../derived/chain-derived';
import { judgeVisibility, showsProduct, type StoredVisibilityRule } from '../pricing/visibility';
import type { CatalogAttributeDefinition } from '../types/attribute';
import type { CatalogFamilyDefinition } from '../types/family';
import type { AttributeValue, CatalogValueHolderKind, ValueSlots } from '../types/product';
import type { VisibilityAncestry } from '../types/visibility-rule';
import { resolveInheritedValues, type InheritanceLink, type ResolvedValues } from '../values/resolve-inherited';
import { isEmptyAttributeValue, readSlot } from '../values/value-shape';
import {
  PUBLIC_CATALOG_SCHEMA_VERSION,
  type PublicCatalogAttribute,
  type PublicCatalogMedia,
  type PublicCatalogModel,
  type PublicCatalogOption,
  type PublicCatalogValue,
  type PublicCatalogVariant,
} from './public-catalog-schema';

const PUBLIC_CHANNEL = 'storefront';
const ANONYMOUS = { kind: 'anonymous' } as const;

export interface PublicProjectionVariant {
  readonly id: string;
  readonly code: string | null;
  readonly label: string | null;
  readonly chain: readonly InheritanceLink[];
  readonly ancestry: VisibilityAncestry;
}

export interface PublicProjectionInput {
  readonly companyId: string;
  readonly rootId: string;
  readonly kind: CatalogValueHolderKind;
  readonly code: string;
  readonly familyId: string;
  readonly schema: Pick<CatalogSchemaSnapshot, 'family' | 'attributes' | 'scheme'>;
  readonly locales: readonly HumanLanguage[];
  readonly variants: readonly PublicProjectionVariant[];
  readonly rules: readonly StoredVisibilityRule[];
  readonly atMs: number;
  readonly media: ReadonlyMap<string, PublicCatalogMedia>;
}

/** Οι ιδιότητες που επιτρέπεται να βγουν: δηλωμένες για `storefront`, ή άξονες, με τη σειρά της οικογένειας. */
export function publicAttributeIdsOf(family: CatalogFamilyDefinition): readonly string[] {
  const axes = new Set(family.variantSchemes.flatMap((scheme) => scheme.levels.flatMap((level) => level.axisAttributeIds)));
  return family.attributes
    .filter((binding) => binding.requiredChannels.includes(PUBLIC_CHANNEL) || axes.has(binding.attributeId))
    .map((binding) => binding.attributeId);
}

function optionOf(attribute: CatalogAttributeDefinition, code: string): PublicCatalogOption | null {
  if (attribute.type !== 'select' && attribute.type !== 'multiSelect') return null;
  const option = attribute.config.options.find((candidate) => candidate.code === code);
  return option ? { optionCode: option.code, labels: option.labels } : null;
}

/** Η μετάφραση τιμής σε δημόσια μορφή. `reference`, `table`, `asset` δεν έχουν: ο τύπος τους δεν είναι δημόσια τιμή. */
function publicValueOf(attribute: CatalogAttributeDefinition, value: AttributeValue): PublicCatalogValue | null {
  switch (value.type) {
    case 'text':
      return { type: 'text', text: value.text };
    case 'richText':
      return { type: 'richText', html: value.html };
    case 'number':
      return { type: 'number', value: value.amount };
    case 'measurement':
      return { type: 'measurement', value: value.amount, unitCode: value.unitCode };
    case 'boolean':
      return { type: 'boolean', value: value.value };
    case 'date':
      return { type: 'date', date: value.date };
    case 'select': {
      const option = optionOf(attribute, value.optionCode);
      return option && { type: 'option', option };
    }
    case 'multiSelect':
      return { type: 'options', options: value.optionCodes.flatMap((code) => optionOf(attribute, code) ?? []) };
    case 'asset':
    case 'reference':
    case 'table':
      return null;
  }
}

function localizedValues(attribute: CatalogAttributeDefinition, slots: ValueSlots, locales: readonly HumanLanguage[]) {
  const entries = locales.flatMap((locale) => {
    const value = readSlot(slots, attribute, PUBLIC_CHANNEL, locale);
    if (!value || value.type !== attribute.type || isEmptyAttributeValue(value)) return [];
    const projected = publicValueOf(attribute, value);
    return projected ? [[locale, projected] as const] : [];
  });
  return Object.fromEntries(entries);
}

type IncludeOwner = (depth: number) => boolean;

function attributeRows(
  input: PublicProjectionInput,
  resolved: ResolvedValues,
  includeOwner: IncludeOwner,
): readonly PublicCatalogAttribute[] {
  return publicAttributeIdsOf(input.schema.family).flatMap((attributeId) => {
    const attribute = input.schema.attributes.get(attributeId);
    const owned = resolved.values.get(attributeId);
    if (!attribute || !owned || !includeOwner(owned.owner.depth)) return [];
    const values = localizedValues(attribute, owned.slots, input.locales);
    return Object.keys(values).length === 0 ? [] : [{ attributeId, labels: attribute.labels, values }];
  });
}

function assetIdsOf(attribute: CatalogAttributeDefinition, slots: ValueSlots, locales: readonly HumanLanguage[]): readonly string[] {
  return locales.flatMap((locale) => {
    const value = readSlot(slots, attribute, PUBLIC_CHANNEL, locale);
    return value?.type === 'asset' ? value.assetIds : [];
  });
}

function mediaRows(input: PublicProjectionInput, resolved: ResolvedValues, includeOwner: IncludeOwner): readonly PublicCatalogMedia[] {
  const family = input.schema.family;
  const candidates = family.imageAttributeId ? [family.imageAttributeId, ...publicAttributeIdsOf(family)] : publicAttributeIdsOf(family);
  const assetIds = new Set([...new Set(candidates)].flatMap((attributeId) => {
    const attribute = input.schema.attributes.get(attributeId);
    const owned = resolved.values.get(attributeId);
    return attribute && owned && includeOwner(owned.owner.depth) ? assetIdsOf(attribute, owned.slots, input.locales) : [];
  }));
  return [...assetIds].flatMap((assetId) => input.media.get(assetId) ?? []);
}

function isShown(input: PublicProjectionInput, variant: PublicProjectionVariant): boolean {
  return showsProduct(judgeVisibility(input.rules, variant.ancestry, ANONYMOUS, input.atMs).visibility);
}

const inVariant: IncludeOwner = (depth) => depth > 0;

function publicVariant(input: PublicProjectionInput, variant: PublicProjectionVariant, resolved: ResolvedValues): PublicCatalogVariant {
  return {
    variantId: variant.id,
    code: variant.code,
    label: variant.label,
    attributes: [...attributeRows(input, resolved, inVariant)],
    media: [...mediaRows(input, resolved, inVariant)],
  };
}

/** Το δημόσιο έγγραφο, ή `null` όταν ο ανώνυμος δεν βλέπει κανένα SKU. */
export function projectPublicModel(input: PublicProjectionInput): PublicCatalogModel | null {
  const shown = input.variants.filter((variant) => isShown(input, variant));
  const [first] = shown;
  if (first === undefined) return null;
  const scheme = input.schema.scheme;
  const root = resolveInheritedValues(first.chain.slice(0, 1), scheme);
  const inRoot: IncludeOwner = (depth) => depth === 0;
  const resolvedVariants = shown.map((variant) => ({ variant, resolved: resolveInheritedValues(variant.chain, scheme) }));
  return {
    schemaVersion: PUBLIC_CATALOG_SCHEMA_VERSION,
    companyId: input.companyId,
    modelId: input.rootId,
    kind: input.kind,
    code: input.code,
    familyId: input.familyId,
    familyLabels: input.schema.family.labels,
    categoryIds: [...new Set(resolvedVariants.flatMap(({ resolved }) => resolved.categoryIds))],
    locales: [...input.locales],
    attributes: [...attributeRows(input, root, inRoot)],
    media: [...mediaRows(input, root, inRoot)],
    variants: resolvedVariants.map(({ variant, resolved }) => publicVariant(input, variant, resolved)),
  };
}
