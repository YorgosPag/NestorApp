/**
 * @fileoverview **ΤΟ ΟΝΟΜΑ ΤΗΣ ΖΗΤΗΣΗΣ, ΣΤΟΝ SERVER, ΣΤΗ ΓΛΩΣΣΑ ΤΟΥ ΠΑΡΑΛΗΠΤΗ** (ADR-887).
 * @related lib/demand/demand-display-name.ts (ο ΕΝΑΣ παραγωγός) · i18n/bundle-translate.ts · listing-match-notifier.service.ts
 * @module services/demand/demand-name-server
 *
 * 🔑 **Κανένα δεύτερο όνομα**: εδώ δεν γράφεται διατύπωση — μόνο **ποια** locale bundles διαβάζει ο
 * `demandDisplayName` όταν τρέχει έξω από React. Τα namespaces είναι ακριβώς όσα ζητά ο παραγωγός:
 * `property-market` (όνομα, είδος συναλλαγής, εύρος τιμής) · `properties-enums` (είδος ακινήτου) ·
 * `common` (ποσό με μονάδα).
 *
 * ⚠️ Το όνομα που έγραψε ο ίδιος ο άνθρωπος (`title`) περνά **αυτούσιο** — δεν μεταφράζεται ποτέ.
 * ⚠️ Τα ποσά μορφοποιούνται από το `formatCurrency` (τρέχουσα γλώσσα της διεργασίας), όπως και στο
 * υπόλοιπο email ταιριάσματος.
 */

import { createBundleTranslate, type BundleTranslate } from '@/i18n/bundle-translate';
import { resolveHumanLanguage, type HumanLanguage } from '@/i18n/languages';
import elCommon from '@/i18n/locales/el/common.json';
import elMarket from '@/i18n/locales/el/property-market.json';
import elEnums from '@/i18n/locales/el/properties-enums.json';
import enCommon from '@/i18n/locales/en/common.json';
import enMarket from '@/i18n/locales/en/property-market.json';
import enEnums from '@/i18n/locales/en/properties-enums.json';
import { demandDisplayName } from '@/lib/demand/demand-display-name';
import { createModuleLogger } from '@/lib/telemetry';
import { loadUserNotificationSettingsMany } from '@/server/notifications/user-notification-settings-store';
import type { PropertyDemand } from '@/types/property-demand';

const logger = createModuleLogger('demand/demand-name-server');

const TRANSLATORS: Readonly<Record<HumanLanguage, BundleTranslate>> = {
  el: createBundleTranslate(
    { 'property-market': elMarket, 'properties-enums': elEnums, common: elCommon },
    'property-market',
  ),
  en: createBundleTranslate(
    { 'property-market': enMarket, 'properties-enums': enEnums, common: enCommon },
    'property-market',
  ),
};

/** Ο μεταφραστής του ονόματος για μια δηλωμένη (ή άγνωστη ⇒ προεπιλεγμένη) γλώσσα. */
export function demandNameTranslator(language: unknown): BundleTranslate {
  return TRANSLATORS[resolveHumanLanguage(language)];
}

/** `demand → όνομα` για **έναν** παραλήπτη — ό,τι εγχέεται στο `groupTopicsByRecipient`. */
export type DemandNamer = (demand: PropertyDemand) => string;

export function demandNamerFor(language: unknown): DemandNamer {
  const t = demandNameTranslator(language);
  return (demand) => demandDisplayName(demand, t);
}

/**
 * **Ο ονομαστής για ΟΛΟΥΣ τους παραλήπτες ενός περάσματος** — μία ανάγνωση ρυθμίσεων (`getAll`), και κάθε
 * ζήτηση ονομάζεται στη γλώσσα **του συγγραφέα της** (ο παραλήπτης της ειδοποίησης).
 *
 * 🔑 **Βλάβη ανάγνωσης ⇒ προεπιλεγμένη γλώσσα, ΠΟΤΕ σιωπή**: η γλώσσα ενός ονόματος δεν αξίζει να
 * χαθεί μια ειδοποίηση. Το γεγονός καταγράφεται.
 */
export async function loadDemandNamer(recipientIds: readonly string[]): Promise<DemandNamer> {
  let settings: ReadonlyMap<string, { readonly language?: unknown }> = new Map();
  try {
    settings = await loadUserNotificationSettingsMany(recipientIds);
  } catch (error) {
    logger.warn('Recipient languages unreadable — naming demands in the default language', {
      data: {
        recipients: String(recipientIds.length),
        error: error instanceof Error ? error.message : String(error),
      },
    });
  }
  return (demand) => demandNamerFor(settings.get(demand.authorUserId)?.language)(demand);
}
