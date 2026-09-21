/**
 * @fileoverview **SSoT: το mock μετάφρασης των jest tests που «ηχεί» το κλειδί.**
 * @module test-utils/i18n-mock
 * @related ADR-598 · CHECK 3.28 (jscpd)
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ: ΕΝΑ ΜΙΣΟ MOCK ΕΣΠΑΣΕ ΣΙΩΠΗΛΑ ΟΤΑΝ ΑΛΛΑΞΕ Ο ΚΑΤΑΝΑΛΩΤΗΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Μετρημένο 2026-09-21: ~240 tests γράφουν δικό τους `useTranslation: () => ({ t })`,
 * και ~25 από αυτά κάνουν mock το `react-i18next` **χωρίς** `i18n`. Αρκούσε όσο
 * κανένα component του δέντρου δεν περνούσε από τον hook του έργου. Μόλις το
 * `SearchableCombobox` απέκτησε `useTranslation('common')` (`e704cacd`), ο hook
 * διάβασε `i18n.language` πάνω σε `undefined` και το
 * `client-picker-vocabulary.test.tsx` έγινε κόκκινο 6/6 — για λόγο άσχετο με
 * αυτό που ρωτά.
 *
 * 🔑 **Το σχήμα ζει ΕΔΩ, μία φορά**: ό,τι διαβάζει ο hook του έργου
 * (`src/i18n/hooks/useTranslation.ts`) από το `react-i18next` — `t`, `i18n.language`,
 * `ready` — και ό,τι επιστρέφει στους καταναλωτές του (`currentLanguage`).
 *
 * ⚠️ **Η μετανάστευση των υπόλοιπων ΔΕΝ έγινε εδώ** — ανήκει στο
 * `.claude-rules/pending-ratchet-work.md` (κανόνας N.0.2). Νέο test: χρησιμοποίησε
 * αυτό, μη γράψεις το 241ο.
 *
 * Χρήση (ο factory του `jest.mock` δεν βλέπει imports — γι' αυτό `requireActual`):
 * ```ts
 * jest.mock('react-i18next', () => ({
 *   ...jest.requireActual('react-i18next'),
 *   useTranslation: () =>
 *     jest
 *       .requireActual<typeof import('@/test-utils/i18n-mock')>('@/test-utils/i18n-mock')
 *       .keyEchoTranslation(),
 * }));
 * ```
 */

import type { Language } from '@/i18n/languages';

/** Ό,τι χρειάζεται και το `react-i18next` mock και ο hook του έργου. */
export interface KeyEchoTranslation {
  /** Επιστρέφει το κλειδί αυτούσιο — οι ισχυρισμοί γράφονται με κλειδιά. */
  readonly t: (key: string) => string;
  readonly i18n: { readonly language: Language };
  readonly ready: true;
  readonly currentLanguage: Language;
}

export function keyEchoTranslation(language: Language = 'el'): KeyEchoTranslation {
  return {
    t: (key: string) => key,
    i18n: { language },
    ready: true,
    currentLanguage: language,
  };
}
