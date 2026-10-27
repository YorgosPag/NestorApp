/**
 * **Αλλαγές σε φορέα τιμών** — αμετάβλητες, καθαρές (ADR-923 §5.10.4 Β3/Β4).
 *
 * Μία τιμή γράφεται στη θέση **κανάλι × γλώσσα** που ορίζει η ιδιότητα (`channelSlotFor` / `localeSlotFor` — ο ίδιος
 * κανόνας με την ανάγνωση). 🔑 Τιμή και λόγος απουσίας (Δ5) **δεν συνυπάρχουν ποτέ**: ο επικυρωτής τα απορρίπτει
 * (`noValueConflict`)· εδώ το εγγυάται η **κατασκευή** — η εγγραφή τιμής σβήνει τον λόγο, ο λόγος σβήνει τις τιμές.
 *
 * @module subapps/catalog/values/holder-edit
 */

import type { HumanLanguage } from '@/i18n/languages';

import type { CatalogAttributeDefinition } from '../types/attribute';
import type { AttributeValue, CatalogValueHolder, NoValueReason, ValueSlots } from '../types/product';
import type { CatalogChannel } from '../vocabulary/channels';
import { channelSlotFor, localeSlotFor } from './value-shape';

type SlotFlags = Pick<CatalogAttributeDefinition, 'scopable' | 'localizable'>;

function withoutKey<T extends object>(record: T, key: string): T {
  if (!(key in record)) return record;
  return Object.fromEntries(Object.entries(record).filter(([entry]) => entry !== key)) as T;
}

/** Γράψε (ή σβήσε με `null`) την τιμή μιας ιδιότητας στη θέση του καναλιού × γλώσσας. */
export function writeHolderValue<H extends CatalogValueHolder>(
  holder: H,
  attributeId: string,
  attribute: SlotFlags,
  channel: CatalogChannel,
  locale: HumanLanguage,
  value: AttributeValue | null,
): H {
  const channelSlot = channelSlotFor(attribute, channel);
  const localeSlot = localeSlotFor(attribute, locale);
  const slots: ValueSlots = holder.values[attributeId] ?? {};
  const locales = slots[channelSlot] ?? {};
  const nextLocales = value === null ? withoutKey(locales, localeSlot) : { ...locales, [localeSlot]: value };
  const nextSlots = Object.keys(nextLocales).length === 0 ? withoutKey(slots, channelSlot) : { ...slots, [channelSlot]: nextLocales };
  const values = Object.keys(nextSlots).length === 0 ? withoutKey(holder.values, attributeId) : { ...holder.values, [attributeId]: nextSlots };
  const noValueReasons = value === null ? holder.noValueReasons : withoutKey(holder.noValueReasons, attributeId);
  return { ...holder, values, noValueReasons };
}

/**
 * Δήλωσε (ή άρε με `null`) «δεν εφαρμόζεται» / «άγνωστο» — σβήνει **όλες** τις τιμές της ιδιότητας (Δ5).
 * Η **άρση** επαναφέρει τις τιμές του `saved` (ο αποθηκευμένος φορέας): ο διακόπτης **αντιστρέφεται** — ζωντανά
 * (ADR-923 §5.10.5) «Άγνωστο» → ξανά «Άγνωστο» άφηνε κενό το 4500 W, και η αποθήκευση θα το έσβηνε οριστικά.
 */
export function writeNoValueReason<H extends CatalogValueHolder>(holder: H, attributeId: string, reason: NoValueReason | null, saved: CatalogValueHolder | null): H {
  if (reason !== null) {
    return { ...holder, values: withoutKey(holder.values, attributeId), noValueReasons: { ...holder.noValueReasons, [attributeId]: reason } };
  }
  const restored = holder.values[attributeId] ? undefined : saved?.values[attributeId];
  return {
    ...holder,
    values: restored ? { ...holder.values, [attributeId]: restored } : holder.values,
    noValueReasons: withoutKey(holder.noValueReasons, attributeId),
  };
}
