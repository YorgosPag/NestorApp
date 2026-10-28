/**
 * **Ο τίτλος μιας ειδοποίησης στη γλώσσα του ΠΑΡΑΛΗΠΤΗ** — από το ΙΔΙΟ `titleKey`/`titleParams` που αποδίδει η κάρτα.
 *
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ (ADR-327, μετρημένο 2026-10-28): ο καλών έδινε δύο τίτλους — `titleKey` (για την κάρτα) **και**
 * ελεύθερο `title`, γραμμένο **ελληνικά** στον κώδικα (`Σάρωση προσφοράς ολοκληρώθηκε: …`, `Νέα προσφορά για …`).
 * Το `title` είναι η εφεδρεία της κάρτας **και το θέμα του email** (`subject: title`) ⇒ ένας αγγλόφωνος PM έπαιρνε
 * ελληνικό θέμα, και κάθε αλλαγή διατύπωσης ήθελε δύο σημεία που αποκλίνουν (N.11).
 *
 * 🔑 Τώρα, όταν υπάρχει `titleKey`, ο orchestrator αποδίδει εδώ τον τίτλο στη δηλωμένη γλώσσα του παραλήπτη
 * (`settings.language`)· το `title` του καλούντα μένει μόνο εφεδρεία για κλειδί που ΔΕΝ λύνεται.
 * Σύγχρονος μεταφραστής πάνω σε ρητά bundles (`createBundleTranslate`) — ποτέ η καθολική γλώσσα του i18next.
 *
 * ⚠️ Τα namespaces είναι ΚΛΕΙΣΤΟ σύνολο: όσα χρησιμοποιούν σήμερα οι `titleKey` του server (μετρημένο: `common-account`
 * · `common-shared`). Κλειδί άλλου namespace ⇒ `null` ⇒ εφεδρεία — και η άγκυρα `notification-title.test.ts`
 * σαρώνει τους καλούντες ώστε ένα νέο namespace να κοκκινίσει αντί να περάσει σιωπηλά.
 *
 * @module server/notifications/notification-title
 */

import elAccount from '@/i18n/locales/el/common-account.json';
import elShared from '@/i18n/locales/el/common-shared.json';
import enAccount from '@/i18n/locales/en/common-account.json';
import enShared from '@/i18n/locales/en/common-shared.json';
import { createBundleTranslate, type BundleTranslate } from '@/i18n/bundle-translate';
import { DEFAULT_LANGUAGE, type HumanLanguage } from '@/i18n/languages';

/** Τα namespaces που αποδίδει ο server για τίτλους ειδοποιήσεων. */
export const NOTIFICATION_TITLE_NAMESPACES = ['common-account', 'common-shared'] as const;

const TRANSLATORS: Readonly<Record<HumanLanguage, BundleTranslate>> = {
  el: createBundleTranslate({ 'common-account': elAccount, 'common-shared': elShared }, 'common-shared', 'el'),
  en: createBundleTranslate({ 'common-account': enAccount, 'common-shared': enShared }, 'common-shared', 'en'),
};

/**
 * Η **εφεδρεία** `title` που ζητά η υπογραφή των dispatchers — από το ΙΔΙΟ κλειδί, στην προεπιλεγμένη γλώσσα. Ο καλών
 * δεν γράφει πια δεύτερο, ελεύθερο κείμενο (που απέκλινε και ήταν σκληροκωδικοποιημένο).
 */
export function notificationFallbackTitle(
  titleKey: string,
  titleParams?: Readonly<Record<string, string>>,
): string {
  return renderNotificationTitle(titleKey, titleParams, DEFAULT_LANGUAGE) ?? titleKey;
}

/** Ο τίτλος στη γλώσσα του παραλήπτη· `null` χωρίς κλειδί ή όταν το κλειδί δεν λύνεται (ο καλών κρατά την εφεδρεία). */
export function renderNotificationTitle(
  titleKey: string | undefined,
  titleParams: Readonly<Record<string, string>> | undefined,
  language: HumanLanguage,
): string | null {
  if (!titleKey) return null;
  const text = TRANSLATORS[language](titleKey, titleParams);
  return text === titleKey ? null : text;
}
