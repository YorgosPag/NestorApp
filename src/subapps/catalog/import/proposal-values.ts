/**
 * Τα κοινά της πρότασης (ADR-923 §5.5.1): ταυτότητα στόχου, ισότητα τιμών, συγχώνευση πάνω σε ζωντανές τιμές. Μία
 * φορά, γιατί τα ρωτούν ο κατασκευαστής, ο κριτής της πρότασης **και** η έγκριση: αν διαφωνούσαν, ο άνθρωπος θα
 * ενέκρινε άλλο από ό,τι γράφεται.
 * @module subapps/catalog/import/proposal-values
 */

import { canonicalJson } from '@/lib/legal/canonical-json';
import { normalizeMixedScriptHomoglyphs } from '@/utils/greek-text';
import type { MeasurementRegistry } from '../measurement/measurement-registry';
import type { CatalogAttributeDefinition } from '../types/attribute';
import type { ImportFieldValue, ImportIssue, ImportNoValueReasonValue, ImportProposalField, ImportTarget } from '../types/catalog-import';
import { NO_VALUE_REASONS, type AttributeValue, type CatalogValueHolder, type NoValueReason, type ProductValues } from '../types/product';
import { writeNoValueReason } from '../values/holder-edit';
import { listSlots } from '../values/value-shape';
import { normalizeUniqueText } from '../values/normalize-unique';
import { standardAmountOf } from '../values/standard-amount';
import { isBareAmountText, optionCodeOf, parseAttributeText, type ValueTextContext } from '../values/value-text-codec';
import type { ImportValueEquality } from './field-diff';

/** Σταθερό κλειδί στόχου: η βάση της σύγκρισης τριών σημείων και οι αποφάσεις του ανθρώπου δένουν εδώ, όχι σε θέση πίνακα. */
export function importTargetKey(target: ImportTarget): string {
  switch (target.kind) {
    case 'attribute':
      return `a:${target.attributeId}:${target.channel}:${target.locale}`;
    case 'price':
      return `p:${target.field}`;
    case 'noValueReason':
      return `r:${target.attributeId}`;
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

const printedForm = (text: string): string => normalizeUniqueText(normalizeMixedScriptHomoglyphs(text));
const NEXT_IS_DIGIT = /^\d/u;

/**
 * Η επιλογή που εννοεί ένα τυπωμένο κείμενο (§5.5.1 Ε4): ακριβώς, αλλιώς **μόνη** επιλογή που είναι αρχή του (`MFP-34ΤΜ` → `MFP-34`). Το
 * «MFP-3» δεν είναι αρχή του «MFP-34», γιατί ακολουθεί ψηφίο. Δύο υποψήφιες ⇒ καμία: κανένας κανόνας δεν διαλέγει σιωπηλά.
 */
export function selectOptionFor(attribute: CatalogAttributeDefinition, text: string): string | null {
  if (attribute.type !== 'select') return null;
  const { options } = attribute.config;
  const exact = optionCodeOf(options, text);
  if (exact) return exact;
  const printed = printedForm(text);
  const opensWith = (form: string): boolean => form !== '' && printed.startsWith(form) && !NEXT_IS_DIGIT.test(printed.slice(form.length));
  const found = options.filter((option) => [option.code, ...Object.values(option.labels)].some((label) => label !== undefined && opensWith(printedForm(label))));
  return found.length === 1 ? found[0].code : null;
}

/**
 * Κείμενο πηγής → τιμή: ο **ένας** δρόμος για την πρόταση και την αντιστοίχιση. Εδώ κλείνει η σιωπηλή προεπιλογή: στο πλέγμα ο
 * γυμνός αριθμός παίρνει τη μονάδα της ιδιότητας, γιατί την έχει μπροστά του ο άνθρωπος. Στην εισαγωγή δεν την έχει κανείς.
 */
export function parseImportCell(attribute: CatalogAttributeDefinition, cell: ImportCellText, context: ValueTextContext): ImportCellParse {
  if (attribute.type === 'measurement' && cell.unitCode === null && isBareAmountText(cell.text)) {
    return { ok: false, issue: 'measurementUnitMissing' };
  }
  const option = attribute.type === 'select' ? selectOptionFor(attribute, cell.text) : null;
  if (option !== null) return { ok: true, value: { type: 'select', optionCode: option } };
  return parseAttributeText(attribute, importCellText(cell), context);
}

/** Η ζωντανή τιμή στη θέση του στόχου. */
export function liveSlotValue(values: ProductValues, target: Extract<ImportTarget, { kind: 'attribute' }>): AttributeValue | null {
  return values[target.attributeId]?.[target.channel]?.[target.locale] ?? null;
}

const isAttributeValue = (value: ImportFieldValue): value is AttributeValue =>
  !['money', 'priceQuantity', 'unit', 'discountGroup', 'noValueReason'].includes(value.type);

/** Κείμενο κελιού `noValueReason` ⇒ λόγος. Ο κωδικός του λεξιλογίου (`notApplicable` · `unknown`), αυτούσιος — όχι λέξη. */
export function parseNoValueReasonText(text: string): ImportNoValueReasonValue | null {
  const code = text.trim();
  return (NO_VALUE_REASONS as readonly string[]).includes(code) ? { type: 'noValueReason', reason: code as NoValueReason } : null;
}

/** Οι ζωντανές τιμές με τα εισερχόμενα των πεδίων που επιλέγει ο καλών. Τίποτα δεν σβήνεται: η εισαγωγή μόνο θέτει. */
function mergeFieldsIntoValues(
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

/** Τα δύο μέρη ενός φορέα που αγγίζει η εισαγωγή. */
export type ImportHolderContent = Pick<CatalogValueHolder, 'values' | 'noValueReasons'>;

export const EMPTY_IMPORT_HOLDER: ImportHolderContent = { values: {}, noValueReasons: {} };

/**
 * Τα εισερχόμενα των επιλεγμένων πεδίων πάνω στον φορέα — **ο ΕΝΑΣ δρόμος** για τον κριτή της πρότασης και την έγκριση (§23.2 K4).
 *
 * 🔑 Η σημασιολογία του επεξεργαστή (`holder-edit`): τιμή και λόγος απουσίας **δεν συνυπάρχουν**. Ο λόγος σβήνει τις τιμές της
 *    ιδιότητας· η τιμή σβήνει τον λόγο. Ως τώρα η εισαγωγή έγραφε μόνο `values` ⇒ τιμή πάνω σε «δεν εφαρμόζεται» έδινε
 *    `noValueConflict` (422) στο κουμπί της έγκρισης.
 * 🔑 **Πρώτα οι λόγοι, μετά οι τιμές**: αν η ίδια πηγή φέρει και τα δύο για την ίδια ιδιότητα, κερδίζει η τιμή — η πληροφορία, όχι
 *    η απουσία της. Ντετερμινιστικό, ανεξάρτητο από τη σειρά των πεδίων.
 */
export function mergeFieldsIntoHolder<H extends ImportHolderContent>(
  holder: H,
  fields: readonly ImportProposalField[],
  include: (field: ImportProposalField) => boolean,
): H {
  const chosen = fields.filter((field) => field.incoming !== null && include(field));
  const declared = chosen.reduce<H>((acc, field) => {
    if (field.target.kind !== 'noValueReason' || field.incoming?.type !== 'noValueReason') return acc;
    return writeNoValueReason(acc, field.target.attributeId, field.incoming.reason, null);
  }, holder);
  const valued = new Set(chosen.flatMap((field) => (field.target.kind === 'attribute' && field.incoming !== null && isAttributeValue(field.incoming) ? [field.target.attributeId] : [])));
  const noValueReasons = Object.fromEntries(Object.entries(declared.noValueReasons).filter(([attributeId]) => !valued.has(attributeId)));
  return { ...declared, values: mergeFieldsIntoValues(declared.values, chosen, () => true), noValueReasons };
}

/** Έχει η ιδιότητα έστω μία ζωντανή τιμή σε κάποια θέση; Το ίδιο κριτήριο με τον επικυρωτή (`noValueConflict`). */
export function holdsValue(values: ProductValues, attributeId: string): boolean {
  const slots = values[attributeId];
  return slots !== undefined && listSlots(slots).length > 0;
}
