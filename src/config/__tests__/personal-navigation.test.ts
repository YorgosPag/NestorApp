/**
 * @file ADR-871 — ο ΕΝΑΣ κατάλογος του προσωπικού χώρου.
 *
 * Τι κλειδώνει (και γιατί):
 * - Κ: ο λογαριασμός και το «Δημιουργώ χώρο» κρίνονται από τους ΙΔΙΟΥΣ επιλυτές με την
 *   προσγείωση (`resolveAccountRoute` · `hasOrganization`) — και για τους τρεις σχηματισμούς
 *   ταυτότητας, μαζί με το `''` που ο διακομιστής θεωρεί απουσία.
 * - Ε: το `UserMenu` βλέπει ΤΕΣΣΕΡΑ στοιχεία, στη σειρά του καταλόγου (Ε5 · Υ4).
 * - Λ: κάθε ετικέτα υπάρχει σε el ΚΑΙ en, και κάθε κλειδί στοιχείου είναι `personal.items.*`
 *   — αυτό είναι το αποδείξιμο σκέλος της δήλωσης στο `.i18n-shell-slice.json`.
 * - Δ: καμία διαδρομή με πρόθεμα χώρου (ADR-820 §6).
 */

import elNavigation from '@/i18n/locales/el/navigation.json';
import enNavigation from '@/i18n/locales/en/navigation.json';
import elPropertyMarket from '@/i18n/locales/el/property-market.json';
import enPropertyMarket from '@/i18n/locales/en/property-market.json';
import { ACCOUNT_ROUTES, PRIVATE_PROFILE_ROUTE } from '@/lib/routes';
import { CREATE_WORKSPACE_ROUTE } from '@/lib/workspace/workspace-routes';
import { NEW_OFFER_ROUTE } from '@/lib/owner-property/owner-property-routes';

import {
  PERSONAL_NAVIGATION,
  PERSONAL_PRIMARY_ACTION,
  resolvePersonalNavigation,
  type PersonalNavigationSurface,
} from '../personal-navigation';

const ids = (companyId: string | null | undefined, surface: PersonalNavigationSurface): string[] =>
  resolvePersonalNavigation({ companyId }, surface).flatMap((g) => g.items.map((i) => i.id));

const hrefOf = (companyId: string | null, id: string): string | undefined =>
  resolvePersonalNavigation({ companyId }, 'sidebar')
    .flatMap((g) => g.items)
    .find((i) => i.id === id)?.href;

/** `a.b.c` → η τιμή στο αντικείμενο, ή `undefined`. */
const lookup = (tree: unknown, dotted: string): unknown =>
  dotted.split('.').reduce<unknown>(
    (node, part) => (node !== null && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined),
    tree,
  );

describe('Κ — κρίσεις ταυτότητας από τους ΥΠΑΡΧΟΝΤΕΣ επιλυτές', () => {
  it('Κ1: ιδιώτης → λογαριασμός /profile, και βλέπει το «Δημιουργώ χώρο γραφείου»', () => {
    expect(hrefOf(null, 'account')).toBe(PRIVATE_PROFILE_ROUTE);
    expect(hrefOf(null, 'createWorkspace')).toBe(CREATE_WORKSPACE_ROUTE);
  });

  it('Κ2: μέλος γραφείου → λογαριασμός /account, και ΔΕΝ βλέπει «Δημιουργώ χώρο»', () => {
    expect(hrefOf('comp_9c7c1a50', 'account')).toBe(ACCOUNT_ROUTES.root);
    expect(hrefOf('comp_9c7c1a50', 'createWorkspace')).toBeUndefined();
  });

  it('Κ3: `companyId: ""` = ΑΠΟΥΣΙΑ, όπως στον διακομιστή (fail-closed)', () => {
    expect(hrefOf('', 'account')).toBe(PRIVATE_PROFILE_ROUTE);
    expect(hrefOf('', 'createWorkspace')).toBe(CREATE_WORKSPACE_ROUTE);
  });

  it('Κ4: άγνωστη ταυτότητα (`null`) → τίποτα που εξαρτάται από τον οργανισμό', () => {
    const all = resolvePersonalNavigation(null, 'sidebar').flatMap((g) => g.items.map((i) => i.id));
    expect(all).not.toContain('createWorkspace');
    expect(all).toContain('account');
  });
});

describe('Ε — μία πηγή, δύο επιφάνειες', () => {
  it('Ε1: το μενού avatar έχει ΤΕΣΣΕΡΑ στοιχεία, στη σειρά του καταλόγου', () => {
    expect(ids(null, 'userMenu')).toEqual(['myMessages', 'myContacts', 'myDossiers', 'account']);
    expect(ids('comp_1', 'userMenu')).toEqual(['myMessages', 'myContacts', 'myDossiers', 'account']);
  });

  it('Ε2: η στήλη έχει τους 8 κύριους προορισμούς + λογαριασμό (+ «Δημιουργώ χώρο» για ιδιώτη)', () => {
    // ADR-777 §8.74 — «Αποθηκευμένες αγγελίες», δίπλα στις ζητήσεις (ιδιωτικό, `saverUserId`).
    expect(ids(null, 'sidebar')).toEqual([
      'myOffers', 'myDemands', 'savedListings', 'myMessages', 'myContacts', 'myDossiers',
      'searchListings', 'professionals', 'account', 'createWorkspace',
    ]);
  });

  it('Ε3: η σειρά του μενού είναι υπακολουθία της σειράς της στήλης (WCAG 3.2.3)', () => {
    const sidebar = ids(null, 'sidebar');
    const menu = ids(null, 'userMenu');
    const positions = menu.map((id) => sidebar.indexOf(id));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it('Ε4: άδειες ομάδες παραλείπονται (το μενού δεν έχει «Ανακάλυψη»)', () => {
    const groups = resolvePersonalNavigation({ companyId: null }, 'userMenu').map((g) => g.id);
    expect(groups).not.toContain('discovery');
    expect(groups).not.toContain('listings');
  });
});

describe('Λ — ετικέτες', () => {
  const entries = PERSONAL_NAVIGATION.flatMap((g) => g.entries);

  it.each([
    ['el', elNavigation],
    ['en', enNavigation],
  ])('Λ1: κάθε κλειδί ομάδας/στοιχείου υπάρχει στο %s', (_lang, locale) => {
    const keys = [
      'personal.sidebarLabel',
      ...PERSONAL_NAVIGATION.map((g) => g.labelKey),
      ...entries.map((e) => e.navLabelKey),
    ];
    for (const key of keys) {
      expect([key, typeof lookup(locale, key)]).toEqual([key, 'string']);
    }
  });

  it('Λ2: ΚΑΘΕ κλειδί στοιχείου είναι `personal.items.*` (η δήλωση του `.i18n-shell-slice.json`)', () => {
    for (const entry of entries) {
      expect(entry.navLabelKey.startsWith('personal.items.')).toBe(true);
    }
  });

  it('Λ3: η κύρια πράξη μοιράζεται το ΙΔΙΟ κλειδί με το CTA της κεφαλίδας, και υπάρχει σε el+en', () => {
    expect(PERSONAL_PRIMARY_ACTION.href).toBe(NEW_OFFER_ROUTE);
    const [ns, key] = PERSONAL_PRIMARY_ACTION.labelKey.split(':');
    expect(ns).toBe('property-market');
    expect(typeof lookup(elPropertyMarket, key)).toBe('string');
    expect(typeof lookup(enPropertyMarket, key)).toBe('string');
  });
});

describe('Δ — διαδρομές', () => {
  it('Δ1: καμία διαδρομή του καταλόγου δεν φέρει πρόθεμα χώρου γραφείου', () => {
    for (const companyId of [null, 'comp_1']) {
      for (const item of resolvePersonalNavigation({ companyId }, 'sidebar').flatMap((g) => g.items)) {
        expect(item.href.startsWith('/o/')).toBe(false);
      }
    }
  });

  it('Δ2: τα `id` είναι μοναδικά (τα χρησιμοποιεί το μενού ως React key)', () => {
    const all = PERSONAL_NAVIGATION.flatMap((g) => g.entries.map((e) => e.id));
    expect(new Set(all).size).toBe(all.length);
  });
});

describe('Μ — μετρητές (ADR-871 Π5 · ADR-867 §4.5 Β10)', () => {
  const counted = (surface: PersonalNavigationSurface): Record<string, string> =>
    Object.fromEntries(
      resolvePersonalNavigation({ companyId: null }, surface)
        .flatMap((g) => g.items)
        .flatMap((i) => (i.countSource === undefined ? [] : [[i.id, i.countSource]])),
    );

  it('Μ1: μόνο τα «Μηνύματα» μετρούν — και με την ΙΔΙΑ πηγή σε στήλη ΚΑΙ μενού avatar', () => {
    expect(counted('sidebar')).toStrictEqual({ myMessages: 'network-unread' });
    expect(counted('userMenu')).toStrictEqual({ myMessages: 'network-unread' });
  });

  it('Μ2: οι ανακοινώσεις του σήματος είναι ΕΝΑ κλειδί ICU plural, σε el ΚΑΙ en', () => {
    // 🔴 ADR-867 (2026-09-22): εδώ κλειδώνονταν τα `threads_one`/`threads_other` — που το i18next-icu ΔΕΝ λύνει.
    // Ζωντανά ο αναγνώστης οθόνης άκουγε «1 αδιάβαστες συνομιλίες». Η μηχανή μετριέται στην i18n-runtime-dialect.test.js.
    for (const tree of [elNavigation, enNavigation]) {
      for (const key of ['personal.unread.threads', 'personal.unread.threadsAtLeast']) {
        expect(lookup(tree, key)).toMatch(/^{count, plural, one {[^{}]*#[^{}]*} other {[^{}]*#[^{}]*}}$/);
      }
    }
  });
});
