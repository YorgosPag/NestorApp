/**
 * @jest-environment node
 *
 * @fileoverview **Ο ΚΑΘΡΕΦΤΗΣ ΤΗΣ ΓΛΩΣΣΑΣ ΠΡΟΣ ΤΗ FIREBASE** (ADR-851) — άγκυρες.
 * @related auth/firebase-auth-language.ts
 */

import { bindAuthLanguage, type LanguageSource } from '../firebase-auth-language';

type Listener = (language: string) => void;

/** Ένα ελάχιστο i18next: γλώσσα + ακροατές `languageChanged`. */
function fakeI18n(initial: string): LanguageSource & { change: (language: string) => void; listeners: () => number } {
  const listeners = new Set<Listener>();
  const source = {
    language: initial,
    on: (_event: string, listener: Listener) => { listeners.add(listener); },
    off: (_event: string, listener: Listener) => { listeners.delete(listener); },
    change: (language: string) => {
      source.language = language;
      listeners.forEach((listener) => listener(language));
    },
    listeners: () => listeners.size,
  };
  return source as unknown as LanguageSource & { change: (language: string) => void; listeners: () => number };
}

describe('bindAuthLanguage — η Firebase μιλά τη γλώσσα της οθόνης', () => {
  it('Λ1 — γράφει ΑΜΕΣΩΣ την τρέχουσα γλώσσα (όχι μόνο στην επόμενη αλλαγή)', () => {
    const auth = { languageCode: null as string | null };
    bindAuthLanguage(auth, fakeI18n('en'));
    expect(auth.languageCode).toBe('en');
  });

  it('🔑 Λ2 — ακολουθεί ΚΑΘΕ αλλαγή γλώσσας', () => {
    const auth = { languageCode: null as string | null };
    const i18n = fakeI18n('el');
    bindAuthLanguage(auth, i18n);
    i18n.change('en');
    expect(auth.languageCode).toBe('en');
  });

  it('Λ3 — `pseudo` (ADR-666) δεν είναι γλώσσα της Firebase ⇒ η προεπιλογή', () => {
    const auth = { languageCode: null as string | null };
    bindAuthLanguage(auth, fakeI18n('pseudo'));
    expect(auth.languageCode).toBe('el');
  });

  it('Λ4 — η αποσύνδεση ΣΤΑΜΑΤΑ τον καθρέφτη (κανένας ακροατής δεν ξεχνιέται)', () => {
    const auth = { languageCode: null as string | null };
    const i18n = fakeI18n('el');
    const unbind = bindAuthLanguage(auth, i18n);
    unbind();
    i18n.change('en');
    expect(auth.languageCode).toBe('el');
    expect(i18n.listeners()).toBe(0);
  });
});
