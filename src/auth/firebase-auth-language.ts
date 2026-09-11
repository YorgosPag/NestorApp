/**
 * @fileoverview **Ο ΕΝΑΣ ΓΡΑΦΕΑΣ ΤΟΥ `auth.languageCode`** (ADR-851).
 * @module auth/firebase-auth-language
 *
 * Μετρημένο 2026-09-11: **κανένα** `auth.languageCode =` σε όλο το `src/` ⇒ ό,τι στέλνει η ίδια
 * η Firebase (πλέον: η επιβεβαίωση της **νέας** διεύθυνσης στο `verifyBeforeUpdateEmail` και η
 * ειδοποίηση της **παλιάς**) έφευγε στην προεπιλογή της κονσόλας — που ήταν `en`.
 *
 * 🔑 **Η αυθεντία της γλώσσας είναι το i18next** — εδώ ζει μόνο ο **καθρέφτης** της προς τη
 * Firebase, όπως το `syncDocumentLanguage` για το `<html lang>` (`i18n/config.ts`). Ένας γραφέας,
 * ιδεμποτικός, σε κάθε `languageChanged`.
 *
 * ⚠️ Το `pseudo` (ADR-666) δεν είναι γλώσσα της Firebase ⇒ `resolveHumanLanguage` ⇒ η προεπιλογή.
 */

import type { Auth } from 'firebase/auth';
import type { i18n as I18nInstance } from 'i18next';

import { resolveHumanLanguage } from '@/i18n/languages';

/** Το υποσύνολο του i18next που χρειάζεται ο καθρέφτης — ώστε η άγκυρα να μη στήνει ολόκληρο i18next. */
export type LanguageSource = Pick<I18nInstance, 'language' | 'on' | 'off'>;

/**
 * **Δέσε τη γλώσσα της Firebase στη γλώσσα της οθόνης.**
 * @returns Αποσύνδεση — για το `useEffect` που το εγκαθιστά.
 */
export function bindAuthLanguage(auth: Pick<Auth, 'languageCode'>, source: LanguageSource): () => void {
  const mirror = (language: string): void => {
    const next = resolveHumanLanguage(language);
    if (auth.languageCode !== next) auth.languageCode = next;
  };
  mirror(source.language);
  source.on('languageChanged', mirror);
  return () => source.off('languageChanged', mirror);
}
