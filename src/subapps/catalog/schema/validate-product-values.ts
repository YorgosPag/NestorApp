/**
 * =============================================================================
 * Η ΕΠΙΚΥΡΩΣΗ ΤΩΝ ΤΙΜΩΝ ΕΝΟΣ ΦΟΡΕΑ — μοντέλο, υπο-μοντέλο ή SKU (ADR-923 §5.10 Δ1 · Δ4 · Δ5)
 * =============================================================================
 *
 * Απέναντι στο σχήμα **όπως είναι τη στιγμή της εγγραφής** (ο γραφέας διαβάζει οικογένεια,
 * ιδιότητες, ρυθμίσεις και μέσα μέσα στη συναλλαγή). Ελέγχει, ανά ιδιότητα:
 *   1. ότι **ανήκει** στην οικογένεια·
 *   2. ότι ζει στο **επίπεδο** αυτού του φορέα (αυστηρή κληρονομιά — καμία υπέρβαση)·
 *   3. ότι οι **θέσεις** ταιριάζουν στις σημαίες: scopable ⇒ πραγματικό κανάλι, αλλιώς `'*'`·
 *      localizable ⇒ γλώσσα **ενεργή** στις ρυθμίσεις (και, αν είναι και scopable, ενεργή **στο
 *      κανάλι** — Akeneo «locale not bound to channel»), αλλιώς `'*'`·
 *   4. την ίδια την τιμή (`validate-attribute-value.ts`).
 * Και για τον φορέα: κάθε **άξονας** του επιπέδου του έχει τιμή (ένας άξονας χωρίς τιμή δεν
 * ορίζει παραλλαγή)· «δεν εφαρμόζεται/άγνωστο» **ποτέ** μαζί με τιμή και **ποτέ** σε άξονα.
 *
 * @module subapps/catalog/schema/validate-product-values
 */

import { isHumanLanguage, type HumanLanguage } from '@/i18n/languages';
import type { CatalogAttributeDefinition } from '../types/attribute';
import { enabledCatalogLocales } from '../types/catalog-settings';
import { ANY_SLOT, type CatalogValueHolder, type ChannelSlot, type LocaleSlot, type ValueSlots } from '../types/product';
import { attributeOwnerDepth, axesAtDepth, isAxisOf } from '../values/attribute-levels';
import { listSlots, readUnscopedSlot } from '../values/value-shape';
import { isCatalogChannel } from '../vocabulary/channels';
import { CATALOG_LIMITS } from '../vocabulary/catalog-limits';
import { IssueCollector, type CatalogIssue } from './catalog-issues';
import type { ProductValuesContext, ValueCheck } from './product-validation-context';
import { validateAttributeValue } from './validate-attribute-value';

/** Η ιδιότητα, **μόνο** αν ανήκει στην οικογένεια και υπάρχει στη βιβλιοθήκη. */
function familyAttributeOf(context: ProductValuesContext, attributeId: string): CatalogAttributeDefinition | undefined {
  const inFamily = context.family.attributes.some((binding) => binding.attributeId === attributeId);
  return inFamily ? context.attributes.get(attributeId) : undefined;
}

/** Επιτρέπεται να υπάρχει τιμή σε αυτή τη θέση; */
function checkSlot(
  check: ValueCheck,
  attribute: CatalogAttributeDefinition,
  channel: ChannelSlot,
  locale: LocaleSlot,
  path: string,
): void {
  const channelOk = attribute.scopable ? isCatalogChannel(channel) : channel === ANY_SLOT;
  if (!channelOk) check.collector.add('valueChannelSlotInvalid', path, { channel });
  if (!attribute.localizable) {
    if (locale !== ANY_SLOT) check.collector.add('valueLocaleSlotInvalid', path, { locale });
    return;
  }
  if (!isHumanLanguage(locale)) {
    check.collector.add('valueLocaleSlotInvalid', path, { locale });
    return;
  }
  const enabled: ReadonlySet<HumanLanguage> =
    attribute.scopable && isCatalogChannel(channel)
      ? new Set(check.context.settings.channelLocales[channel])
      : enabledCatalogLocales(check.context.settings);
  if (!enabled.has(locale)) check.collector.add('localeNotEnabled', path, { locale, channel });
}

function validateAttributeSlots(
  check: ValueCheck,
  attribute: CatalogAttributeDefinition,
  attributeId: string,
  slots: ValueSlots,
): void {
  for (const { channel, locale, value } of listSlots(slots)) {
    const path = `values.${attributeId}.${channel}.${locale}`;
    checkSlot(check, attribute, channel, locale, path);
    validateAttributeValue(check, attribute, value, path);
  }
}

/** Ανήκει η ιδιότητα σε αυτόν τον φορέα; (οικογένεια + επίπεδο) — κοινό για τιμές και λόγους. */
function ownedAttribute(check: ValueCheck, attributeId: string, path: string): CatalogAttributeDefinition | undefined {
  const attribute = familyAttributeOf(check.context, attributeId);
  if (!attribute) {
    check.collector.add('attributeUnknown', path);
    return undefined;
  }
  const owner = attributeOwnerDepth(check.context.scheme, attributeId);
  if (owner !== check.context.depth) {
    check.collector.add('valueWrongLevel', path, { level: owner });
    return undefined;
  }
  return attribute;
}

function validateValues(check: ValueCheck, holder: CatalogValueHolder): void {
  const entries = Object.entries(holder.values);
  if (entries.length > CATALOG_LIMITS.maxAttributesPerFamily) {
    check.collector.add('tooMany', 'values', { max: CATALOG_LIMITS.maxAttributesPerFamily });
  }
  for (const [attributeId, slots] of entries) {
    const attribute = ownedAttribute(check, attributeId, `values.${attributeId}`);
    if (attribute) validateAttributeSlots(check, attribute, attributeId, slots);
  }
}

function validateNoValueReasons(check: ValueCheck, holder: CatalogValueHolder): void {
  for (const attributeId of Object.keys(holder.noValueReasons)) {
    const path = `noValueReasons.${attributeId}`;
    if (!ownedAttribute(check, attributeId, path)) continue;
    if (isAxisOf(check.context.scheme, attributeId)) check.collector.add('noValueOnAxis', path);
    if (holder.values[attributeId] && listSlots(holder.values[attributeId]).length > 0) {
      check.collector.add('noValueConflict', path);
    }
  }
}

function validateAxes(check: ValueCheck, holder: CatalogValueHolder): void {
  for (const axisId of axesAtDepth(check.context.scheme, check.context.depth)) {
    if (!readUnscopedSlot(holder.values[axisId])) check.collector.add('axisValueMissing', `values.${axisId}`);
  }
}

function validateCategories(check: ValueCheck, holder: CatalogValueHolder): void {
  if (holder.categoryIds.length > CATALOG_LIMITS.maxCategoriesPerProduct) {
    check.collector.add('tooMany', 'categoryIds', { max: CATALOG_LIMITS.maxCategoriesPerProduct });
  }
  // Η ύπαρξη των κατηγοριών θέλει ανάγνωση ⇒ ελέγχεται στον γραφέα (2β).
  const seen = new Set<string>();
  holder.categoryIds.forEach((categoryId, index) => {
    if (seen.has(categoryId)) check.collector.add('duplicateCode', `categoryIds[${index}]`, { code: categoryId });
    seen.add(categoryId);
  });
}

/** Επικυρώνει τις τιμές, τους λόγους απουσίας, τους άξονες και τις κατηγορίες ενός φορέα. */
export function validateHolderValues(holder: CatalogValueHolder, context: ProductValuesContext): readonly CatalogIssue[] {
  const check: ValueCheck = { context, collector: new IssueCollector() };
  validateValues(check, holder);
  validateNoValueReasons(check, holder);
  validateAxes(check, holder);
  validateCategories(check, holder);
  return check.collector.issues;
}
