/**
 * =============================================================================
 * ADR-744 §15 (Φ4) — ΑΓΚΥΡΕΣ ΤΟΥ PER-ROUTE SLICE
 * =============================================================================
 *
 * Το `shell-slice-no-raw-keys.test.ts` ρωτά «φτάνει το slice για το **κέλυφος**;».
 * Εδώ ρωτιέται το **επόμενο**, και έχει άλλη απάντηση: *«φτάνει για **αυτή τη
 * διαδρομή**, και ΜΟΝΟ γι' αυτήν;»*.
 *
 * 🔑 **ΤΟ ΚΡΙΣΙΜΟ TEST ΕΙΝΑΙ ΤΟ `Κ2`**: μπουτάρει i18next με **μόνο** το κέλυφος
 * και αποδεικνύει ότι τα τέσσερα κλειδιά βγαίνουν **ΩΜΑ** — δηλαδή ότι το
 * πρόβλημα **υπάρχει**. Χωρίς αυτό, το `Κ3` («με το route slice βγαίνουν
 * μεταφρασμένα») θα μπορούσε να είναι πράσινο επειδή **δεν υπήρχε ποτέ βλάβη**.
 * Ο παρονομαστής πρώτα, η θεραπεία μετά.
 * =============================================================================
 */

import i18next, { type i18n as I18nInstance } from 'i18next';

import shellSlice from '../generated/shell-slice.el.json';
import routeSlice from '../generated/routes/test-harness__listing-shapes.el.json';
import { getBundleState, resetBundleRegistry } from '../bundle-registry';
import { registerRouteSlice } from '../route-slice';

/** Τα κλειδιά που ο ΧΡΗΣΜΟΣ βρήκε ωμά ζωντανά (CHECK 3.51, 2026-08-20). */
const LIVE_RAW_KEYS = [
  'map.basemap.map',
  'map.basemap.satellite',
  'map.coordinate.displayLabel',
  'map.styleSelector.quickSwitcher',
] as const;

const NS = 'geo-canvas';
const LANG = 'el';

type Tree = Record<string, unknown>;

function readPath(tree: Tree | undefined, dotted: string): unknown {
  let node: unknown = tree;
  for (const part of dotted.split('.')) {
    if (node === null || typeof node !== 'object') return undefined;
    node = (node as Tree)[part];
  }
  return node;
}

async function bootI18n(resources: Record<string, unknown>): Promise<I18nInstance> {
  const instance = i18next.createInstance();
  await instance.init({
    lng: LANG,
    fallbackLng: LANG,
    resources: { [LANG]: resources },
    ns: Object.keys(resources),
    defaultNS: 'common',
    interpolation: { escapeValue: false },
  });
  return instance;
}

describe('Κ — το per-route slice κάνει ΑΚΡΙΒΩΣ ό,τι υπόσχεται', () => {
  it('Κ1: είναι ΑΦΑΙΡΕΣΗ — κανένα κλειδί του δεν υπάρχει ήδη στο κέλυφος', () => {
    const shell = shellSlice as unknown as Record<string, Tree>;
    const route = routeSlice as unknown as Record<string, Tree>;
    expect(Object.keys(route).length).toBeGreaterThan(0);

    const duplicated: string[] = [];
    const walk = (namespace: string, node: unknown, trail: string[]): void => {
      if (node !== null && typeof node === 'object' && !Array.isArray(node)) {
        for (const [key, value] of Object.entries(node as Tree)) walk(namespace, value, [...trail, key]);
        return;
      }
      const dotted = trail.join('.');
      if (readPath(shell[namespace], dotted) !== undefined) duplicated.push(`${namespace}:${dotted}`);
    };
    for (const [namespace, tree] of Object.entries(route)) walk(namespace, tree, []);

    // Ένωση αντί για αφαίρεση θα έκανε το «per-route» ΜΕΓΑΛΥΤΕΡΟ από το σημερινό.
    expect(duplicated).toEqual([]);
  });

  it('Κ2: ΧΩΡΙΣ το route slice τα τέσσερα κλειδιά βγαίνουν ΩΜΑ (ο παρονομαστής)', async () => {
    const instance = await bootI18n(shellSlice as unknown as Record<string, unknown>);
    for (const key of LIVE_RAW_KEYS) {
      // Χωρίς το namespace εγκατεστημένο, το i18next επιστρέφει το ίδιο το κλειδί.
      expect(instance.t(key, { ns: NS })).toBe(key);
    }
  });

  it('Κ3: ΜΕ το route slice βγαίνουν μεταφρασμένα — και είναι ΕΛΛΗΝΙΚΑ', () => {
    const route = routeSlice as unknown as Record<string, Tree>;
    for (const key of LIVE_RAW_KEYS) {
      const value = readPath(route[NS], key);
      expect(typeof value).toBe('string');
      expect(value).not.toBe(key);
      expect(String(value)).toMatch(/[Ά-ώ]/);
    }
  });
});

describe('Ρ — το μητρώο πληρότητας (το μάθημα του §11)', () => {
  beforeEach(() => resetBundleRegistry());

  it('Ρ1: το route slice δηλώνεται `shell-partial`, ΠΟΤΕ `complete`', () => {
    registerRouteSlice(routeSlice as unknown as Record<string, Record<string, unknown>>);
    for (const namespace of Object.keys(routeSlice)) {
      // `complete` εδώ θα σταματούσε το `loadNamespace` και ΚΑΘΕ άλλο κλειδί
      // του ίδιου namespace θα έβγαινε ωμό — το ελάττωμα του §11 σε νέα θέση.
      expect(getBundleState(LANG, namespace)).toBe('shell-partial');
    }
  });

  it('Ρ2: είναι ιδεμποτικό — δεύτερη κλήση δεν αλλάζει κατάσταση', () => {
    registerRouteSlice(routeSlice as unknown as Record<string, Record<string, unknown>>);
    const before = Object.keys(routeSlice).map(ns => getBundleState(LANG, ns));
    registerRouteSlice(routeSlice as unknown as Record<string, Record<string, unknown>>);
    expect(Object.keys(routeSlice).map(ns => getBundleState(LANG, ns))).toEqual(before);
  });

  it('Ρ3: ένα ΗΔΗ πλήρες bundle δεν υποβαθμίζεται από το μερικό slice', () => {
    const [namespace] = Object.keys(routeSlice);
    // Προσομοίωση: ο loader πρόλαβε τον bootstrap της σελίδας.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { recordLoaderInstall } = require('../bundle-registry');
    recordLoaderInstall(LANG, namespace);
    registerRouteSlice(routeSlice as unknown as Record<string, Record<string, unknown>>);
    expect(getBundleState(LANG, namespace)).toBe('complete');
  });
});
