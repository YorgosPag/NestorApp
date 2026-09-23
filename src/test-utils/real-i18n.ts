/**
 * @fileoverview **SSoT: i18n με ΠΡΑΓΜΑΤΙΚΟΥΣ loaders και ΠΡΑΓΜΑΤΙΚΟ ICU για τα jest tests.**
 * @module test-utils/real-i18n
 * @related test-utils/i18n-mock (το «ηχώ» mock) · CHECK 3.9 · CHECK 3.36 · CHECK 3.28 (jscpd)
 *
 * 🔑 **Πότε το χρησιμοποιείς**: όταν η άγκυρα ρωτά «**τι διαβάζει ο άνθρωπος**», όχι «ποιο κλειδί
 * ζητήθηκε». Ένα mock που επιστρέφει το κλειδί είναι πράσινο για κείμενο που κανείς δεν βλέπει.
 *
 * 1. **Οι πραγματικοί loaders** (`getNamespaceLoader`): `null` σημαίνει «λείπει `case` στο
 *    `namespace-loaders`», το κενό που το CHECK 3.36 ελέγχει μόνο στατικά. Χειρόγραφοι πόροι θα
 *    ήταν τρίτο αντίγραφο του locale, και η άγκυρα θα επιβεβαίωνε τον εαυτό της.
 * 2. **Το ICU είναι μέρος της άγκυρας**: τα locale γράφονται σε μονό άγκιστρο (`{count, plural, …}`)
 *    και το CHECK 3.9 το επιβάλλει. Χωρίς το plugin οι πληθυντικοί ζωγραφίζονται **ωμοί**.
 *
 * ⚠️ Εξήχθη όταν ήρθε το **τέταρτο** αντίγραφο (ADR-777 §8.71). Ο hook του έργου αντικαθίσταται
 * ακόμη **σε κάθε αρχείο** με τον γνήσιο `useTranslation` του `react-i18next` (ο factory του
 * `jest.mock` δεν βλέπει imports):
 * ```ts
 * jest.mock('@/i18n/hooks/useTranslation', () => {
 *   const reactI18next = jest.requireActual('react-i18next');
 *   return { useTranslation: (ns: readonly string[]) => reactI18next.useTranslation(ns as string[]) };
 * });
 * ```
 */

import i18next, { type i18n } from 'i18next';
import ICU from 'i18next-icu';
import { initReactI18next } from 'react-i18next';

import { getNamespaceLoader } from '@/i18n/namespace-loaders';

type Resources = Record<string, Record<string, unknown>>;

async function loadNamespace(lng: string, ns: string): Promise<Record<string, unknown>> {
  const loader = getNamespaceLoader(lng as never, ns as never);
  if (loader === null) throw new Error(`namespace-loaders: missing case for "${lng}/${ns}" (CHECK 3.36)`);
  const mod = await loader();
  return ((mod as { default?: unknown }).default ?? mod) as Record<string, unknown>;
}

/**
 * Νέο, απομονωμένο instance, σπαρμένο από τους πραγματικούς loaders.
 *
 * @param namespaces Ο πρώτος είναι ο προεπιλεγμένος.
 */
export async function createRealI18n(namespaces: readonly string[], lng = 'el'): Promise<i18n> {
  const resources: Resources = {};
  for (const ns of namespaces) resources[ns] = await loadNamespace(lng, ns);

  const instance = i18next.createInstance();
  await instance
    .use(new ICU({ bindI18n: 'languageChanged', bindI18nStore: 'added removed' }))
    .use(initReactI18next)
    .init({
      lng,
      fallbackLng: lng,
      resources: { [lng]: resources },
      ns: [...namespaces],
      defaultNS: namespaces[0],
      react: { useSuspense: false },
      interpolation: { escapeValue: false },
    });
  return instance;
}
