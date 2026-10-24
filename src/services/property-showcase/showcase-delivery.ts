/**
 * @fileoverview **Η γραμμή «Παράδοση» του showcase** — από την **αγγελία**, όχι από το νεκρό `deliveryDate` (ADR-919 §11).
 * @related ADR-919 §7 (απόσυρση `Property.deliveryDate`) · lib/listings/availability-phrase.ts
 * @module services/property-showcase/showcase-delivery
 *
 * 🔑 **Μία αλήθεια για ό,τι στέλνεται έξω**: το showcase (οθόνη, PDF, Telegram) πηγαίνει σε πελάτες, άρα λέει ό,τι
 * λέει και η δημόσια αγγελία — το **επιλυμένο** `PublicListing.availability`, με την ίδια φράση με την κάρτα και το
 * email. Μη δημοσιευμένη μονάδα ⇒ καμία γραμμή (ADR-777 §8.99.4 «Ιδιωτικότητα»: μόνο αγγελίες που περνούν το
 * `isPubliclyListed`). `unknown` ⇒ καμία γραμμή.
 *
 * ⚠️ Ο μεταφραστής δένεται **ρητά** στη γλώσσα του snapshot (`createBundleTranslate`), όχι στην καθολική του i18next:
 * το ίδιο showcase αποδίδεται σε `el` και `en` στην ίδια διεργασία.
 */

import { createBundleTranslate, type BundleTranslate } from '@/i18n/bundle-translate';
import elCommon from '@/i18n/locales/el/common.json';
import elShared from '@/i18n/locales/el/common-shared.json';
import enCommon from '@/i18n/locales/en/common.json';
import enShared from '@/i18n/locales/en/common-shared.json';
import { availabilityPromisePhrase } from '@/lib/listings/availability-phrase';
import type { EnumLocale } from '@/services/property-enum-labels/property-enum-labels.service';
import type { ListingAvailability } from '@/types/listing-availability';

const TRANSLATORS: Readonly<Record<EnumLocale, BundleTranslate>> = {
  el: createBundleTranslate({ common: elCommon, 'common-shared': elShared }, 'common', 'el'),
  en: createBundleTranslate({ common: enCommon, 'common-shared': enShared }, 'common', 'en'),
};

/** Η τιμή της γραμμής, ή `undefined` όταν δεν υπάρχει τίποτα τίμιο να ειπωθεί. */
export function showcaseDeliveryPhrase(availability: ListingAvailability | null, locale: EnumLocale): string | undefined {
  if (availability === null || availability.kind === 'unknown') return undefined;
  const t = TRANSLATORS[locale];
  return availability.kind === 'ready'
    ? t('common:listingAvailability.readyNow')
    : availabilityPromisePhrase(availability, t, locale);
}
