/**
 * @jest-environment jsdom
 *
 * @fileoverview ⚖️ **Η ΑΠΟΔΟΣΗ ΤΩΝ ΑΔΕΙΩΝ ΣΤΗΝ ΟΘΟΝΗ** (ADR-863 Φ3).
 * @related components/legal/ThirdPartyAttribution.tsx · components/legal/ThirdPartyComponentTable.tsx ·
 *   lib/legal/third-party-index.ts
 *
 * 🔑 **ΤΟ ΦΕΡΟΝ ΕΡΩΤΗΜΑ ΤΗΣ ΣΟΥΙΤΑΣ**: *«αν ο κατάλογος δεν έρθει ποτέ, έχει αποδοθεί ό,τι
 * απαιτεί η άδεια;»*. Γι' αυτό η `Ο4` δεν είναι μία ακόμη περίπτωση — είναι **η** περίπτωση.
 *
 * Τα κείμενα λύνονται πάνω στα **ίδια** JSON που φορτώνει η εφαρμογή (el **και** en): ένα
 * κλειδί που λείπει δίνει «⛔ ΑΛΥΤΟ» και η άγκυρα κοκκινίζει.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';

import elLegal from '@/i18n/locales/el/legal.json';
import enLegal from '@/i18n/locales/en/legal.json';

const CATALOGUE: Record<string, Record<string, unknown>> = {
  'el:legal': elLegal,
  'en:legal': enLegal,
};
const language = { current: 'el' };

function resolve(ns: string, key: string, params?: Record<string, string>): string {
  let node: unknown = CATALOGUE[`${language.current}:${ns}`];
  for (const step of key.split('.')) node = (node as Record<string, unknown> | undefined)?.[step];
  if (typeof node !== 'string') return `⛔ ΑΛΥΤΟ: ${ns}:${key}`;
  return node.replace(/\{(\w+)\}/g, (_, name: string) => params?.[name] ?? `{${name}}`);
}

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: (ns: string) => ({
    t: (key: string, params?: Record<string, string>) => resolve(ns, key, params),
    i18n: { language: language.current },
  }),
}));

/**
 * ⚠️ **Μεταλλάσσεται ΤΟ ΣΤΙΓΜΙΟΤΥΠΟ, όχι το component.** Ο κύκλος ζωής της φόρτωσης
 * (`useLazySnapshot`) είναι **υπάρχον, δοκιμασμένο** SSoT· αυτό που πρέπει να αποδειχθεί
 * εδώ είναι ότι η οθόνη ξεχωρίζει τις **τρεις καταστάσεις** του.
 */
const snapshot: { current: unknown } = { current: null };
jest.mock('@/hooks/useLazySnapshot', () => ({
  useLazySnapshot: () => snapshot.current,
}));

import {
  EMPTY_THIRD_PARTY_INDEX,
  buildThirdPartyIndex,
  type ThirdPartyIndex,
} from '@/lib/legal/third-party-index';
import { ThirdPartyAttribution } from '../ThirdPartyAttribution';

function index(overrides: Partial<ThirdPartyIndex> = {}): ThirdPartyIndex {
  return {
    fingerprint: 'sha256:φ',
    generatedAt: '2026-09-16T00:00:00.000Z',
    measured: true,
    components: [
      { name: 'react', version: '19.0.0', license: 'MIT', surface: 'browser' },
      { name: 'sharp', version: '0.34.0', license: 'Apache-2.0', surface: 'server' },
    ],
    ...overrides,
  };
}

afterEach(() => {
  language.current = 'el';
  snapshot.current = null;
});

// ─── Ι — ο αναγνώστης του παραγόμενου αρχείου ────────────────────────────────

describe('Ι — ο κατάλογος διαβάζεται, ή ονομάζεται χαλασμένος', () => {
  it('Ι1: σωστό σχήμα ⇒ στοιχεία με τα τέσσερα πεδία', () => {
    const parsed = buildThirdPartyIndex({
      fingerprint: 'sha256:φ',
      generatedAt: 'τ',
      measured: true,
      rows: [{ n: 'react', v: '19.0.0', l: 'MIT', s: 'browser' }],
    });
    expect(parsed.components).toEqual([
      { name: 'react', version: '19.0.0', license: 'MIT', surface: 'browser' },
    ]);
    expect(parsed.measured).toBe(true);
  });

  /**
   * 🔴 Ένα `fetch(...).json()` επιστρέφει χαρούμενα τη σελίδα σφάλματος του διακομιστή.
   * Χωρίς αυτόν τον φρουρό, ο επόμενος βρόχος πετά **μέσα σε render**, σε δημόσια σελίδα.
   */
  it('Ι2: ΜΕΤΑΛΛΑΞΗ — φορτίο χωρίς `rows` ⇒ πετά ΜΕ ΑΙΤΙΑ, δεν επιστρέφει κενό', () => {
    expect(() => buildThirdPartyIndex({ fingerprint: 'x' })).toThrow(/γραμμές/);
    expect(() => buildThirdPartyIndex('<html>σφάλμα</html>')).toThrow(/σχήμα/);
  });

  /** 🔴 **fail-closed**: άγνοια ΔΕΝ γίνεται ποτέ «δεν διανέμεται». */
  it('Ι3: ΜΕΤΑΛΛΑΞΗ — άγνωστη επιφάνεια γίνεται `unknown`, ΠΟΤΕ `server`', () => {
    const parsed = buildThirdPartyIndex({ rows: [{ n: 'x', v: '1', l: 'MIT', s: 'φαντασμα' }] });
    expect(parsed.components[0].surface).toBe('unknown');
  });

  it('Ι4: γραμμή χωρίς όνομα απορρίπτεται — κενή σειρά δεν αποδίδει τίποτα σε κανέναν', () => {
    const parsed = buildThirdPartyIndex({ rows: [{ v: '1', l: 'MIT' }, { n: 'ok', v: '1', l: 'MIT', s: 'browser' }] });
    expect(parsed.components.map((c) => c.name)).toEqual(['ok']);
  });
});

// ─── Ο — η οθόνη: τρεις καταστάσεις, ονομασμένες ─────────────────────────────

describe('Ο — ό,τι βλέπει ο επισκέπτης', () => {
  it('Ο1: όσο δεν ξέρουμε ⇒ «φόρτωση», ΠΟΤΕ κενός πίνακας', () => {
    snapshot.current = null;
    render(<ThirdPartyAttribution />);
    expect(screen.getByText(resolve('legal', 'openSource.loading'))).toBeInTheDocument();
    expect(screen.queryByRole('table')).toBeNull();
  });

  /** 🔴 «Ρώτησα και δεν έμαθα» ΔΕΝ επιτρέπεται να μοιάζει με «δεν χρησιμοποιούμε τίποτα». */
  it('Ο2: αποτυχία φόρτωσης ⇒ ρητή δήλωση, ΟΧΙ «0 στοιχεία»', () => {
    snapshot.current = EMPTY_THIRD_PARTY_INDEX;
    render(<ThirdPartyAttribution />);
    expect(screen.getByText(resolve('legal', 'openSource.unavailable'))).toBeInTheDocument();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('Ο3: με κατάλογο ⇒ πίνακας, σύνολο, και η επιφάνεια ΜΕΤΑΦΡΑΣΜΕΝΗ', () => {
    snapshot.current = index();
    const { container } = render(<ThirdPartyAttribution />);

    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByText(resolve('legal', 'openSource.total', { count: '2' }))).toBeInTheDocument();
    expect(screen.getByText('react')).toBeInTheDocument();
    // Το αναγνωριστικό SPDX μένει αυτούσιο· η επιφάνεια μεταφράζεται.
    expect(screen.getByText('Apache-2.0')).toBeInTheDocument();
    expect(screen.getByText(resolve('legal', 'openSource.surface.server'))).toBeInTheDocument();
    expect(container.textContent).not.toContain('⛔');
  });

  /**
   * 🔴🔴 **Η ΑΓΚΥΡΑ ΓΙΑ ΤΗΝ ΟΠΟΙΑ ΥΠΑΡΧΕΙ Η ΣΟΥΙΤΑ.** Η υποχρέωση των αδειών NOTICE είναι
   * ότι **το κείμενο συνοδεύει το αντίγραφο**. Αν αυτό εξαρτιόταν από το αν φόρτωσε ένα
   * JSON, θα ήταν συμμόρφωση με όρους — δηλαδή καμία συμμόρφωση.
   */
  it('Ο4: 🔴 οι σύνδεσμοι στα πλήρη κείμενα υπάρχουν ΑΚΟΜΗ ΚΙ ΟΤΑΝ ο κατάλογος αποτύχει', () => {
    snapshot.current = EMPTY_THIRD_PARTY_INDEX;
    render(<ThirdPartyAttribution />);

    expect(screen.getByRole('link', { name: resolve('legal', 'openSource.fullText') }))
      .toHaveAttribute('href', '/third-party/THIRD_PARTY_NOTICES.txt');
    expect(screen.getByRole('link', { name: resolve('legal', 'openSource.sbom') }))
      .toHaveAttribute('href', '/.well-known/sbom');
  });

  /** ⏳ Όσο η σπορά επιφανειών εκκρεμεί, η σελίδα το ΛΕΕΙ — δεν σιωπά και δεν δείχνει «0». */
  it('Ο5: `measured: false` ⇒ η οθόνη δηλώνει ότι η μέτρηση εκκρεμεί', () => {
    snapshot.current = index({ measured: false });
    render(<ThirdPartyAttribution />);
    expect(screen.getByText(resolve('legal', 'openSource.unmeasuredIntro'))).toBeInTheDocument();
  });

  it('Ο6: το ίδιο, στα αγγλικά — κανένα άλυτο κλειδί σε καμία κατάσταση', () => {
    language.current = 'en';
    snapshot.current = index();
    const { container } = render(<ThirdPartyAttribution />);
    expect(container.textContent).not.toContain('⛔');
  });
});
