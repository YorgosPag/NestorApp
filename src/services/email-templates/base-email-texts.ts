/**
 * @fileoverview **ΤΑ ΛΟΓΙΑ ΤΟΥ ΚΕΛΥΦΟΥΣ ΚΑΘΕ EMAIL — ΑΝΑ ΓΛΩΣΣΑ** (ADR-877 §6).
 * @module services/email-templates/base-email-texts
 *
 * 🔴 **Γιατί υπάρχει (N.11)**: το υποσέλιδο του `wrapInBrandedTemplate` έγραφε καρφωμένο
 * «All rights reserved.» — **αγγλικά σε κάθε ελληνικό email** της εφαρμογής, ενώ το ίδιο πρότυπο
 * ήδη δεχόταν `lang`. Εντοπίστηκε ανοίγοντας τα `.eml` του emulator (επαλήθευση ADR-877).
 * Ίδιο σχήμα με `auth-action-email-texts.ts`: καθαρά δεδομένα, η γλώσσα είναι **παράμετρος**.
 *
 * ⚠️ **`Record<HumanLanguage, …>`, ΠΟΤΕ `Partial`** — νέα γλώσσα δεν μεταγλωττίζεται χωρίς τα λόγια της.
 */

import { resolveHumanLanguage, type HumanLanguage } from '@/i18n/languages';

export interface BaseEmailTexts {
  /** Η φράση μετά το «© <έτος> <προϊόν>.» */
  readonly rightsReserved: string;
}

const BASE_EMAIL_TEXTS: Readonly<Record<HumanLanguage, BaseEmailTexts>> = {
  el: { rightsReserved: 'Με την επιφύλαξη παντός δικαιώματος.' },
  en: { rightsReserved: 'All rights reserved.' },
};

export function baseEmailTexts(language: string | undefined): BaseEmailTexts {
  return BASE_EMAIL_TEXTS[resolveHumanLanguage(language)];
}
