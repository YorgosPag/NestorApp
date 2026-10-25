/**
 * =============================================================================
 * Η ΠΡΟΣΒΑΣΗ ΣΤΙΣ ΘΕΣΕΙΣ ΤΙΜΗΣ `[channel|'*'][locale|'*']` — μία φορά (ADR-923 §5.10 Δ4)
 * =============================================================================
 *
 * Κάθε καταναλωτής (επικύρωση, πληρότητα, κανόνες, οθόνη, εκδότης) ρωτά **εδώ** «ποια θέση
 * διαβάζω για το κανάλι Χ και τη γλώσσα Υ;». Ο κανόνας είναι ένας: scopable ⇒ το κανάλι,
 * αλλιώς `'*'` · localizable ⇒ η γλώσσα, αλλιώς `'*'` (Akeneo `scope`/`locale` = `null`).
 * Δεύτερη εκδοχή του κανόνα σε component θα διάβαζε σιωπηλά άλλη θέση από τον γραφέα.
 *
 * @module subapps/catalog/values/value-shape
 */

import type { HumanLanguage } from '@/i18n/languages';
import type { CatalogAttributeDefinition } from '../types/attribute';
import {
  ANY_SLOT,
  type AttributeValue,
  type ChannelSlot,
  type LocaleSlot,
  type ValueSlots,
} from '../types/product';
import type { CatalogChannel } from '../vocabulary/channels';

type SlotFlags = Pick<CatalogAttributeDefinition, 'scopable' | 'localizable'>;

/** Η θέση καναλιού που διαβάζει/γράφει αυτή η ιδιότητα για το κανάλι `channel`. */
export function channelSlotFor(attribute: SlotFlags, channel: CatalogChannel): ChannelSlot {
  return attribute.scopable ? channel : ANY_SLOT;
}

/** Η θέση γλώσσας που διαβάζει/γράφει αυτή η ιδιότητα για τη γλώσσα `locale`. */
export function localeSlotFor(attribute: SlotFlags, locale: HumanLanguage): LocaleSlot {
  return attribute.localizable ? locale : ANY_SLOT;
}

/** Η τιμή της ιδιότητας όπως τη βλέπει το κανάλι × γλώσσα — `undefined` αν λείπει. */
export function readSlot(
  slots: ValueSlots | undefined,
  attribute: SlotFlags,
  channel: CatalogChannel,
  locale: HumanLanguage,
): AttributeValue | undefined {
  return slots?.[channelSlotFor(attribute, channel)]?.[localeSlotFor(attribute, locale)];
}

/** Η μοναδική θέση `'*'/'*'` — ό,τι διαβάζουν οι άξονες και οι κανόνες συνέπειας. */
export function readUnscopedSlot(slots: ValueSlots | undefined): AttributeValue | undefined {
  return slots?.[ANY_SLOT]?.[ANY_SLOT];
}

export interface SlotEntry {
  readonly channel: ChannelSlot;
  readonly locale: LocaleSlot;
  readonly value: AttributeValue;
}

/** Όλες οι γεμάτες θέσεις μιας ιδιότητας, με σταθερή σειρά (σειρά εισαγωγής των κλειδιών). */
export function listSlots(slots: ValueSlots): readonly SlotEntry[] {
  const entries: SlotEntry[] = [];
  for (const [channel, byLocale] of Object.entries(slots) as Array<[ChannelSlot, ValueSlots[ChannelSlot]]>) {
    if (!byLocale) continue;
    for (const [locale, value] of Object.entries(byLocale) as Array<[LocaleSlot, AttributeValue | undefined]>) {
      if (value) entries.push({ channel, locale, value });
    }
  }
  return entries;
}

/** Θέσεις με **μία** τιμή στο `'*'/'*'` — για τιμές που δεν είναι ανά κανάλι/γλώσσα. */
export function unscopedSlots(value: AttributeValue): ValueSlots {
  return { [ANY_SLOT]: { [ANY_SLOT]: value } };
}

/**
 * Είναι η τιμή **κενή**; Κενό κείμενο, κενή λίστα, πίνακας χωρίς γραμμές. Μια κενή τιμή **δεν**
 * αποθηκεύεται (η θέση παραλείπεται) — ο επικυρωτής την αναφέρει, η πληρότητα τη μετρά ως απούσα.
 * `boolean: false` **δεν** είναι κενό: είναι απάντηση.
 */
export function isEmptyAttributeValue(value: AttributeValue): boolean {
  switch (value.type) {
    case 'text':
      return value.text.trim() === '';
    case 'richText':
      return value.html.trim() === '';
    case 'number':
    case 'measurement':
      return value.amount === '';
    case 'select':
      return value.optionCode === '';
    case 'multiSelect':
      return value.optionCodes.length === 0;
    case 'date':
      return value.date === '';
    case 'asset':
      return value.assetIds.length === 0;
    case 'reference':
      return value.targets.length === 0;
    case 'table':
      return value.rows.length === 0;
    case 'boolean':
      return false;
  }
}
