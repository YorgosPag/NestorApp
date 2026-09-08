/**
 * Άγκυρα — **Η ΑΠΟΡΡΟΦΗΣΗ ΛΕΕΙ ΠΟΣΑ ΕΦΥΓΑΝ, ΟΧΙ ΕΝΑ ΑΠΟ ΑΥΤΑ**
 *
 * ## Γιατί υπάρχει
 *
 * 🔴 **2026-09-08, ζωντανό περπάτημα της Φάσης 1** *(ADR-846, Π3)*: δηλωμένα «ΔΗΜΟΣ
 * ΘΕΡΜΗΣ» **και** «Π.Ε. ΧΑΛΚΙΔΙΚΗΣ». Προσθέτω «ΠΕΡΙΦΕΡΕΙΑ ΚΕΝΤΡΙΚΗΣ ΜΑΚΕΔΟΝΙΑΣ» —
 * **εξαφανίζονται και τα δύο chips**, και η οθόνη ανακοινώνει **ένα**:
 * *«Το «ΔΗΜΟΣ ΘΕΡΜΗΣ» βρίσκεται ήδη μέσα…»*. Ο κώδικας έγραφε `nameOf(swallowed[0])`,
 * τρεις γραμμές κάτω από σχόλιο που ορκίζεται *«σιωπή εδώ διαβάζεται ως σφάλμα»*.
 *
 * ⚠️ **Δεν είναι καλλωπισμός.** Η απορρόφηση είναι η **μοναδική** άμυνα αυτής της
 * οθόνης απέναντι στην υπερδήλωση *(γι' αυτό δεν έχει πλαφόν, σε αντίθεση με το Google
 * Business Profile)*. Μια άμυνα που **δεν λέει τι έκανε** εκπαιδεύει τον άνθρωπο να μην
 * την εμπιστεύεται.
 *
 * ## Τι φυλάει
 *
 * ✅ **Κ1** — το component αναφέρει το **πραγματικό** πλήθος όσων έφυγαν.
 * ✅ **Κ2** — το ίδιο το μήνυμα *(και στις δύο γλώσσες)* **διακλαδίζεται** στο `count`.
 *    Χωρίς αυτό, το `count` θα ταξίδευε σωστά και θα αγνοούνταν σιωπηλά — πράσινο που
 *    δεν σημαίνει τίποτα.
 *
 * ⛔ **ΔΕΝ** ελέγχει την ίδια την κανονικοποίηση — αυτή έχει άγκυρα στο
 *    `lib/agency/__tests__/coverage-match.test.ts` και **δεν** αντιγράφεται εδώ.
 *
 * @module components/mandate/__tests__/coverage-absorption-voice
 * @see ADR-846 · `CoverageAreaPicker`
 */

import React from 'react';
import fs from 'fs';
import path from 'path';
import { render, screen, fireEvent } from '@testing-library/react';

import { CoverageAreaPicker } from '../CoverageAreaPicker';
import { SHOWCASE_KEYS } from '../agency-showcase-labels';

/**
 * **Τρία επίπεδα μιας αληθινής αλυσίδας** — Περιφέρεια ⊃ Π.Ε. ⊃ Δήμος. Η γενεαλογία
 * γράφεται ρητά, ώστε το `normalizeCoverageIds` *(πραγματικό, όχι στουμπωμένο)* να έχει
 * τι να καταπιεί.
 */
const mockLineage: Record<string, readonly string[]> = {
  'region:12': ['region:12'],
  'regionalUnit:1209': ['regionalUnit:1209', 'region:12'],
  'regionalUnit:1210': ['regionalUnit:1210', 'region:12'],
  'municipality:1303': ['municipality:1303', 'regionalUnit:1209', 'region:12'],
};

const mockNames: Record<string, string> = {
  'region:12': 'ΠΕΡΙΦΕΡΕΙΑ ΚΕΝΤΡΙΚΗΣ ΜΑΚΕΔΟΝΙΑΣ',
  'regionalUnit:1209': 'ΠΕΡΙΦΕΡΕΙΑΚΗ ΕΝΟΤΗΤΑ ΘΕΣΣΑΛΟΝΙΚΗΣ',
  'regionalUnit:1210': 'ΠΕΡΙΦΕΡΕΙΑΚΗ ΕΝΟΤΗΤΑ ΧΑΛΚΙΔΙΚΗΣ',
  'municipality:1303': 'ΔΗΜΟΣ ΘΕΡΜΗΣ',
};

jest.mock('@/hooks/useAdministrativeHierarchy', () => ({
  ADMIN_LEVELS: {
    MAJOR_GEO: 1,
    DECENTRALIZED_ADMIN: 2,
    REGION: 3,
    REGIONAL_UNIT: 4,
    MUNICIPALITY: 5,
    MUNICIPAL_UNIT: 6,
    COMMUNITY: 7,
    SETTLEMENT: 8,
  },
  // Κλειδιά i18n (ADR-846 Φ4) — το mock δίνει το ΣΧΗΜΑ, όχι λέξεις: η μετάφραση δεν
  // είναι δουλειά αυτής της άγκυρας, και ωμά ελληνικά εδώ θα ξανάφερναν το χρέος N.11.
  ADMIN_LEVEL_LABEL_KEYS: {
    3: 'addresses:hierarchy.levels.region',
    4: 'addresses:hierarchy.levels.regionalUnit',
    5: 'addresses:hierarchy.levels.municipality',
    6: 'addresses:hierarchy.levels.municipalUnit',
    7: 'addresses:hierarchy.levels.community',
  },
  lineageIdsOf: (id: string): readonly string[] => mockLineage[id] ?? [],
  useAdministrativeHierarchy: () => ({
    isLoading: false,
    findById: (id: string) => (mockNames[id] ? { id, name: mockNames[id] } : undefined),
    levelOptions: (level: number) =>
      Object.entries(mockNames)
        .filter(([id]) => (id.startsWith('region:') ? level === 3 : id.startsWith('regionalUnit:') ? level === 4 : level === 5))
        .map(([id, name]) => ({ value: id, label: name })),
    resolvePath: () => ({}),
    getByLevel: () => [],
    searchOptions: () => [],
    getChildren: () => [],
  }),
}));

/**
 * 🔑 **Ο `t` καταγράφει, δεν μεταφράζει.** Το τι κάνει το ICU με το `count` το ελέγχει
 * το Κ2 πάνω στο **ίδιο το locale**· εδώ μετριέται τι **στέλνει** το component.
 */
const translateCalls: Array<{ key: string; params?: Record<string, unknown> }> = [];

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>): string => {
      translateCalls.push({ key, params });
      return key;
    },
  }),
}));

function lastAbsorption(): Record<string, unknown> | undefined {
  return translateCalls
    .filter((call) => call.key === SHOWCASE_KEYS.coverageAbsorbed)
    .at(-1)?.params;
}

function readLocale(language: 'el' | 'en'): string {
  const file = path.join(process.cwd(), 'src', 'i18n', 'locales', language, 'property-market.json');
  const bundle: unknown = JSON.parse(fs.readFileSync(file, 'utf8'));
  let node: unknown = bundle;
  for (const segment of SHOWCASE_KEYS.coverageAbsorbed.replace(/^property-market:/, '').split('.')) {
    node = (node as Record<string, unknown> | undefined)?.[segment];
  }
  if (typeof node !== 'string') throw new Error(`Λείπει το κλειδί από το locale ${language}`);
  return node;
}

/** Δηλώνει τις δοσμένες περιοχές και μετά προσθέτει την ευρύτερη από το combobox. */
function declareThenAdd(declared: readonly string[], added: string): void {
  render(
    <CoverageAreaPicker value={{ adminIds: [...declared] }} onChange={jest.fn()} />,
  );

  fireEvent.focus(screen.getByRole('combobox'));
  const option = screen.getAllByRole('option').find((li) => li.textContent?.includes(mockNames[added]));
  if (!option) throw new Error(`Δεν βρέθηκε η επιλογή ${mockNames[added]}`);
  fireEvent.mouseDown(option);
}

beforeEach(() => {
  translateCalls.length = 0;
});

describe('ADR-846 — η απορρόφηση ανακοινώνει ΤΟ ΠΛΗΘΟΣ', () => {
  // =========================================================================
  // ΠΑΡΟΝΟΜΑΣΤΗΣ — μία απορρόφηση δηλώνεται ως μία. Χωρίς αυτό, ένα «πάντα 2»
  //                θα περνούσε το Κ1.
  // =========================================================================
  it('ΠΑΡΟΝΟΜΑΣΤΗΣ — ένας δήμος καταπίνεται από την περιφέρεια ⇒ count 1, με το όνομά του', () => {
    declareThenAdd(['municipality:1303'], 'region:12');

    expect(lastAbsorption()).toEqual({
      narrow: 'ΔΗΜΟΣ ΘΕΡΜΗΣ',
      wide: 'ΠΕΡΙΦΕΡΕΙΑ ΚΕΝΤΡΙΚΗΣ ΜΑΚΕΔΟΝΙΑΣ',
      count: 1,
    });
  });

  // =========================================================================
  // 🔴 Κ1 — Η ΑΓΚΥΡΑ. Πριν τη διόρθωση εδώ έφτανε πάντα «1».
  // =========================================================================
  it('Κ1 — δύο περιοχές καταπίνονται ⇒ το μήνυμα παίρνει count 2, όχι 1', () => {
    declareThenAdd(['municipality:1303', 'regionalUnit:1210'], 'region:12');

    expect(lastAbsorption()?.count).toBe(2);
    expect(lastAbsorption()?.wide).toBe('ΠΕΡΙΦΕΡΕΙΑ ΚΕΝΤΡΙΚΗΣ ΜΑΚΕΔΟΝΙΑΣ');
  });

  // =========================================================================
  // Κ2 — ΤΟ ΜΗΝΥΜΑ ΔΙΑΚΛΑΔΙΖΕΤΑΙ. Ένα `count` που φτάνει και αγνοείται είναι
  //      χειρότερο από απόν: μοιάζει σωστό στον κώδικα και ψεύδεται στην οθόνη.
  // =========================================================================
  it.each(['el', 'en'] as const)('Κ2 — το locale %s διακλαδίζεται σε πληθυντικό πάνω στο count', (language) => {
    const message = readLocale(language);

    expect(message).toContain('{count, plural,');
    expect(message).toContain('one {');
    expect(message).toContain('other {');
  });
});
