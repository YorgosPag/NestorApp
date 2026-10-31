/**
 * Τα κοινά της πρότασης (ADR-923 §5.5.1): ταυτότητα στόχου, ισότητα τιμών, συγχώνευση πάνω σε ζωντανές τιμές. Μία
 * φορά, γιατί τα ρωτούν ο κατασκευαστής, ο κριτής της πρότασης **και** η έγκριση: αν διαφωνούσαν, ο άνθρωπος θα
 * ενέκρινε άλλο από ό,τι γράφεται.
 * @module subapps/catalog/import/proposal-values
 */

import { canonicalJson } from '@/lib/legal/canonical-json';
import type { MeasurementRegistry } from '../measurement/measurement-registry';
import type { CatalogAttributeDefinition } from '../types/attribute';
import type { ImportFieldValue, ImportIssue, ImportProposalField, ImportTarget } from '../types/catalog-import';
import type { AttributeValue, ProductValues } from '../types/product';
import { standardAmountOf } from '../values/standard-amount';
import { isBareAmountText, parseAttributeText, type ValueTextContext } from '../values/value-text-codec';
import type { ImportValueEquality } from './field-diff';

/** Σταθερό κλειδί στόχου: η βάση της σύγκρισης τριών σημείων και οι αποφάσεις του ανθρώπου δένουν εδώ, όχι σε θέση πίνακα. */
export function importTargetKey(target: ImportTarget): string {
  switch (target.kind) {
    case 'attribute':
      return `a:${target.attributeId}:${target.channel}:${target.locale}`;
    case 'price':
      return `p:${target.field}`;
    default:
      return target.kind;
  }
}

/** Ισότητα τιμών ιδιότητας: μέτρηση/αριθμός στη μονάδα-πρότυπο (1,8 kW ≡ 1800 W), όλα τα άλλα κατά περιεχόμενο. */
export function attributeValueEquality(attribute: CatalogAttributeDefinition, registry: MeasurementRegistry): ImportValueEquality {
  return (left, right) => {
    const a = standardAmountOf(attribute, left as AttributeValue, registry);
    const b = standardAmountOf(attribute, right as AttributeValue, registry);
    return a !== null && b !== null ? a === b : canonicalJson(left) === canonicalJson(right);
  };
}

export const plainValueEquality: ImportValueEquality = (left, right) => canonicalJson(left) === canonicalJson(right);

interface ImportCellText {
  readonly text: string;
  readonly unitCode: string | null;
}

/** Το κείμενο του κελιού μαζί με τη μονάδα της πηγής: ό,τι διαβάζει ο κωδικοποιητής και ό,τι βλέπει ο άνθρωπος στη διόρθωση. */
export function importCellText({ text, unitCode }: ImportCellText): string {
  return unitCode !== null && isBareAmountText(text) ? `${text} ${unitCode}` : text;
}

export type ImportCellParse =
  | { readonly ok: true; readonly value: AttributeValue | null }
  | { readonly ok: false; readonly issue: ImportIssue['code']; readonly params?: Readonly<Record<string, string | number>> };

/**
 * Κείμενο πηγής → τιμή: ο **ένας** δρόμος για την πρόταση και την αντιστοίχιση. Εδώ κλείνει η σιωπηλή προεπιλογή: στο πλέγμα ο
 * γυμνός αριθμός παίρνει τη μονάδα της ιδιότητας, γιατί την έχει μπροστά του ο άνθρωπος. Στην εισαγωγή δεν την έχει κανείς.
 */
export function parseImportCell(attribute: CatalogAttributeDefinition, cell: ImportCellText, context: ValueTextContext): ImportCellParse {
  if (attribute.type === 'measurement' && cell.unitCode === null && isBareAmountText(cell.text)) {
    return { ok: false, issue: 'measurementUnitMissing' };
  }
  return parseAttributeText(attribute, importCellText(cell), context);
}

/** Η ζωντανή τιμή στη θέση του στόχου. */
export function liveSlotValue(values: ProductValues, target: Extract<ImportTarget, { kind: 'attribute' }>): AttributeValue | null {
  return values[target.attributeId]?.[target.channel]?.[target.locale] ?? null;
}

const isAttributeValue = (value: ImportFieldValue): value is AttributeValue =>
  !['money', 'priceQuantity', 'unit', 'discountGroup'].includes(value.type);

/** Οι ζωντανές τιμές με τα εισερχόμενα των πεδίων που επιλέγει ο καλών. Τίποτα δεν σβήνεται: η εισαγωγή μόνο θέτει. */
export function mergeFieldsIntoValues(
  values: ProductValues,
  fields: readonly ImportProposalField[],
  include: (field: ImportProposalField) => boolean,
): ProductValues {
  const merged: Record<string, ProductValues[string]> = { ...values };
  for (const field of fields) {
    const { target, incoming } = field;
    if (target.kind !== 'attribute' || incoming === null || !isAttributeValue(incoming) || !include(field)) continue;
    const slots = merged[target.attributeId] ?? {};
    merged[target.attributeId] = { ...slots, [target.channel]: { ...slots[target.channel], [target.locale]: incoming } };
  }
  return merged;
}
