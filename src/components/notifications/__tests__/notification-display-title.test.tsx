/**
 * =============================================================================
 * ADR-841 §7 Α18.10 — **Ο ΤΙΤΛΟΣ ΤΗΣ ΚΑΡΤΑΣ ΒΓΑΙΝΕΙ ΑΠΟ ΤΟ ΚΛΕΙΔΙ**
 * =============================================================================
 *
 * Το ερώτημα: *«αυτό που διαβάζει ο άνθρωπος είναι **μετάφραση**, ή το παγωμένο
 * κείμενο που έγραψε ο διακομιστής τη στιγμή της παραγωγής;»*
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΙ ΜΕΤΡΗΘΗΚΕ, ΚΑΙ ΓΙΑΤΙ ΤΟ «ΠΡΑΣΙΝΟ» ΗΤΑΝ ΨΕΥΤΙΚΟ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η οθόνη έδειχνε *«**1 άτομα ψάχνουν** ακίνητο σαν το δικό σας — ΝΕΣΤΩΡ»* —
 * πληθυντικός λάθος στο **1**, χωρίς το όνομα του ακινήτου, και **στα ελληνικά για
 * κάθε γλώσσα**. Το κλειδί όμως **υπάρχει, σωστό, και στις δύο γλώσσες**.
 *
 * Ο ένοχος ήταν το `defaultValue`: με αυτό, το i18next **δεν γυρίζει ποτέ το
 * κλειδί** ⇒ ο φύλακας {@link isUnresolvedTranslation} απαντά *«λύθηκε»* ⇒ το
 * **δίχτυ διασταυρούμενων namespaces** του `useTranslation` (ADR-716 Φ5) **δεν
 * τρέχει ΠΟΤΕ**. Δηλαδή το `defaultValue` δεν έκρυβε μόνο την αστοχία από τη
 * **CHECK 3.51** — **εμπόδιζε τη θεραπεία που το ίδιο το repo είχε ήδη χτίσει**.
 *
 * ⚠️ **Η ΣΟΥΙΤΑ ΤΡΕΧΕΙ ΤΟΝ ΠΡΑΓΜΑΤΙΚΟ HOOK** (`renderHook` + `I18nextProvider`),
 * με το ίδιο ιδίωμα του `i18n/__tests__/use-translation-prefixed-key-resolution` —
 * γιατί η μισή απόδειξη ζει **μέσα** στον wrapper του `useTranslation`, όχι στη
 * συνάρτηση που δοκιμάζουμε. Ένα ψεύτικο `t` θα ήταν πράσινο και **πριν** τη
 * διόρθωση.
 */

import fs from 'node:fs';
import path from 'node:path';

import React from 'react';
import { renderHook } from '@testing-library/react';
import i18next from 'i18next';
import ICU from 'i18next-icu';
import { I18nextProvider, initReactI18next } from 'react-i18next';

import { notificationDisplayTitle } from '@/components/notifications/notification-display-title';
import { COMMON_NAMESPACES } from '@/i18n/namespace-bundles';
import { useTranslation } from '@/i18n/hooks/useTranslation';

import commonEl from '@/i18n/locales/el/common.json';
import commonSharedEl from '@/i18n/locales/el/common-shared.json';
import commonSharedEn from '@/i18n/locales/en/common-shared.json';

// Ο πραγματικός loader χτυπά δίκτυο/δυναμικά imports — το bundle το στήνουμε εδώ.
jest.mock('@/i18n/lazy-config', () => ({
  loadNamespace: jest.fn(() => Promise.resolve()),
  CRITICAL_NAMESPACES: [],
}));

const KEY = 'demandInterest.notificationTitle';

/** Το κείμενο που γράφει **σήμερα** ο διακομιστής στο `title` (θέμα του email). */
const FROZEN = '1 άτομα ψάχνουν ακίνητο σαν το δικό σας — ΝΕΣΤΩΡ';

const instance = i18next.createInstance();

beforeAll(async () => {
  await instance
    .use(new ICU())
    .use(initReactI18next)
    .init({
      lng: 'el',
      fallbackLng: false,
      resources: {},
      ns: [...COMMON_NAMESPACES],
      defaultNS: 'common',
      react: { useSuspense: false },
      interpolation: { escapeValue: false },
    });

  // Ακριβώς η κατάσταση του drawer: **πρωτεύον** `common`, και το κλειδί ζει στο
  // `common-shared` — δηλαδή σε namespace που το react-i18next **δεν κοιτάζει**.
  instance.addResourceBundle('el', 'common', commonEl, true, true);
  instance.addResourceBundle('el', 'common-shared', commonSharedEl, true, true);
  instance.addResourceBundle('en', 'common-shared', commonSharedEn, true, true);
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <I18nextProvider i18n={instance}>{children}</I18nextProvider>
);

/** Ο **πραγματικός** αποδότης του drawer. */
function drawerT() {
  const { result } = renderHook(() => useTranslation(COMMON_NAMESPACES), { wrapper });
  return result.current.t as unknown as Parameters<typeof notificationDisplayTitle>[0];
}

// =============================================================================

describe('Θ0 🔴 Ο ΜΗΧΑΝΙΣΜΟΣ — γιατί το κλειδί δεν έφτανε ποτέ στην οθόνη', () => {
  it('Θ0α — χωρίς `defaultValue`, το i18next γυρίζει ΤΟ ΚΛΕΙΔΙ (⇒ το δίχτυ ενεργοποιείται)', () => {
    expect(instance.t(KEY, { count: 1, title: 'X' })).toBe(KEY);
  });

  it('Θ0β 🔴🔴 — ΜΕ `defaultValue`, γυρίζει το ΠΑΓΩΜΕΝΟ (⇒ το δίχτυ δεν τρέχει ΠΟΤΕ)', () => {
    // Αυτή η γραμμή **είναι** το ελάττωμα, εκτελεσμένο. Όσο επιστρέφει το `FROZEN`,
    // κάθε φύλακας «λύθηκε;» απαντά «ναι» για κλειδί που **δεν** λύθηκε.
    expect(instance.t(KEY, { count: 1, title: 'X', defaultValue: FROZEN })).toBe(FROZEN);
  });
});

describe('Θ1 ✅ ΤΟ ΚΛΕΙΔΙ ΗΤΑΝ ΠΑΝΤΑ ΣΩΣΤΟ — το πρώτο συμπέρασμα ήταν ψευδές', () => {
  it('Θ1α — ICU plural, el: το `1` δεν λέει «άτομα»', () => {
    expect(instance.t(KEY, { ns: 'common-shared', count: 1, title: 'ΔΟΚΙΜΗ Γ' })).toBe(
      '1 άνθρωπος ψάχνει ακίνητο σαν το «ΔΟΚΙΜΗ Γ»',
    );
    expect(instance.t(KEY, { ns: 'common-shared', count: 3, title: 'ΔΟΚΙΜΗ Γ' })).toBe(
      '3 άνθρωποι ψάχνουν ακίνητο σαν το «ΔΟΚΙΜΗ Γ»',
    );
  });

  it('Θ1β — και ο αγγλόφωνος έχει αγγλικά· το παγωμένο `title` **δεν** έχει', () => {
    expect(
      instance.t(KEY, { ns: 'common-shared', lng: 'en', count: 1, title: 'Flat' }),
    ).toBe('1 person is looking for a property like “Flat”');
    expect(FROZEN).not.toContain('person');
  });
});

describe('Θ2 ✅ Η ΑΠΟΦΑΣΗ, ΠΑΝΩ ΣΤΟΝ ΠΡΑΓΜΑΤΙΚΟ HOOK', () => {
  it('Θ2α 🔴 — ο τίτλος βγαίνει από το ΚΛΕΙΔΙ και ΟΝΟΜΑΖΕΙ το ακίνητο', () => {
    // Πριν τη διόρθωση αυτή η γραμμή επέστρεφε το `FROZEN` — 11 ταυτόσημες κάρτες
    // στο ζωντανό συρτάρι, με μόνη διάκριση την ώρα (μετρημένο, Α18.10.δ).
    const out = notificationDisplayTitle(drawerT(), {
      title: FROZEN,
      titleKey: KEY,
      titleParams: { count: '1', title: 'ΔΟΚΙΜΗ Γ' },
    });

    expect(out).toBe('1 άνθρωπος ψάχνει ακίνητο σαν το «ΔΟΚΙΜΗ Γ»');
    expect(out).not.toBe(FROZEN);
    expect(out).not.toContain('ΝΕΣΤΩΡ');
  });

  it('Θ2β — ο πληθυντικός ΔΕΝ κλειδώνεται τη στιγμή της παραγωγής', () => {
    const out = notificationDisplayTitle(drawerT(), {
      title: FROZEN,
      titleKey: KEY,
      titleParams: { count: '4', title: 'Μεζονέτα' },
    });

    expect(out).toBe('4 άνθρωποι ψάχνουν ακίνητο σαν το «Μεζονέτα»');
  });

  it('Θ2γ 🔑 — Η ΕΦΕΔΡΕΙΑ ΜΕΝΕΙ: κλειδί που όντως λείπει ⇒ το αποθηκευμένο, ΠΟΤΕ ωμό κλειδί', () => {
    const out = notificationDisplayTitle(drawerT(), {
      title: FROZEN,
      titleKey: 'demandInterest.thisKeyDoesNotExistAnywhere',
      titleParams: { count: '1' },
    });

    expect(out).toBe(FROZEN);
    expect(out).not.toContain('thisKeyDoesNotExist');
  });

  it('Θ2δ — χωρίς `titleKey` και χωρίς `title`: κενό, όχι σκάσιμο', () => {
    expect(notificationDisplayTitle(drawerT(), {})).toBe('');
  });

  /**
   * 🔴 **ΤΟ ΚΡΙΤΗΡΙΟ ΠΟΥ ΚΑΝΕΙ ΤΟ SSoT ΜΗ ΤΕΤΡΙΜΜΕΝΟ** (ADR-635 Φ C.23).
   *
   * Όταν αστοχεί κλειδί **με πρόθεμα**, το i18next γυρίζει το κλειδί **χωρίς** το
   * πρόθεμα. Μια αφελής σύγκριση `rendered !== titleKey` το κρίνει **επιτυχία** ⇒
   * ωμό κλειδί στην κάρτα. Οι παραγωγοί των προσφορών γράφουν **ακριβώς** τέτοια
   * κλειδιά (`quotes:quotes.notifications.…`).
   */
  it('Θ2ε 🔴 — κλειδί ΜΕ ΠΡΟΘΕΜΑ που αστοχεί ⇒ εφεδρεία, ΠΟΤΕ μισό κλειδί στην κάρτα', () => {
    const out = notificationDisplayTitle(drawerT(), {
      title: FROZEN,
      titleKey: 'common-shared:demandInterest.noSuchKey',
    });

    expect(out).toBe(FROZEN);
    expect(out).not.toContain('noSuchKey');
  });

  it('Θ2στ — ο αποστολέας συμπληρώνεται από το αποθηκευμένο κείμενο όταν λείπει', () => {
    const out = notificationDisplayTitle(drawerT(), {
      title: 'New Email from anna@example.com',
      titleKey: 'notifications.email.newFrom',
    });

    expect(out).toContain('anna@example.com');
    expect(out).not.toContain('{sender}');
  });
});

describe('Θ3 🔴 Η ΠΑΛΙΝΔΡΟΜΗΣΗ ΠΟΥ ΘΑ ΗΤΑΝ ΑΟΡΑΤΗ', () => {
  /**
   * 🔴 Ένα `defaultValue` ξαναγραμμένο εδώ **δεν σπάει τίποτα ορατό**: η οθόνη
   * δείχνει κείμενο, καμία πύλη δεν βλέπει ωμό κλειδί, και το ελάττωμα επιστρέφει
   * σιωπηλά για **επτά** παραγωγούς. Γι' αυτό ρωτιέται ο **πηγαίος κώδικας**.
   */
  it('Θ3α — η SSoT συνάρτηση ΔΕΝ περνά `defaultValue` στον αποδότη', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'src/components/notifications/notification-display-title.ts'),
      'utf8',
    );
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

    expect(code).not.toContain('defaultValue');
  });

  it('Θ3β — ο drawer ΔΕΝ κρατά δεύτερη, δική του απόδοση τίτλου', () => {
    const drawer = fs.readFileSync(
      path.join(process.cwd(), 'src/components/NotificationDrawer.enterprise.tsx'),
      'utf8',
    );

    expect(drawer).toContain('notificationDisplayTitle(t, n)');
    expect(drawer).not.toContain('resolveDisplayTitle');
  });
});
