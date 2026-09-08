/**
 * Άγκυρα — **ΟΣΟ Η ΙΕΡΑΡΧΙΑ ΦΟΡΤΩΝΕΙ, Ο ΚΑΤΑΛΟΓΟΣ ΔΕΙΧΝΕΙ ΟΛΟΥΣ ΚΑΙ ΤΟ ΛΕΕΙ**
 *
 * ## Γιατί υπάρχει
 *
 * Το `/pro?area=…` κρίνει τη διοικητική εμβέλεια με **γενεαλογία** που ζει στο αρχείο
 * των **4,1 MB**. Όσο εκείνο δεν έχει φτάσει, το `lineageIdsOf` επιστρέφει **κενό** —
 * και με κενή γενεαλογία **κάθε** βιτρίνα απαντά `disjoint`.
 *
 * 🔴 **Η αφελής υλοποίηση λέει «Κανείς δεν ταιριάζει με αυτά τα κριτήρια» για τα πρώτα
 * ms κάθε επίσκεψης** — δηλαδή ψέμα, στην πιο κρίσιμη στιγμή: ο επισκέπτης που μόλις
 * διάλεξε περιοχή συμπεραίνει ότι *«δεν δουλεύει κανείς εκεί»* και **φεύγει**.
 * «Άγνωστο ≠ κενό» *(N.12)*.
 *
 * ⚠️ **Ο κώδικας το κάνει σωστά — αλλά καμία πύλη δεν το ρωτούσε.** Μετρημένο
 * 2026-09-08 στο ζωντανό περπάτημα *(ADR-846, Π7)*: το `areaPending` δεν αναφερόταν σε
 * κανένα test. Και τα τρία σκέλη του *(`hierarchyLoading` · `where !== null` ·
 * `isAdministrativeWhere`)* μπορούσαν να σβηστούν χωρίς να κοκκινίσει τίποτα.
 *
 * ## Τι φυλάει
 *
 * ✅ **Κ1** — όσο φορτώνει: **όλοι** ορατοί, και η αναμονή **γράφεται** στην οθόνη.
 * ✅ **Κ2** — μόλις φορτώσει: το φίλτρο **εφαρμόζεται** *(αλλιώς το Κ1 θα περνούσε και
 *    με ένα φίλτρο που δεν φιλτράρει ποτέ)*.
 * ✅ **Κ3** — η αναμονή είναι **ειδική για τον διοικητικό άξονα**: ερώτημα **σημείου**
 *    δεν περιμένει την ιεραρχία, γιατί δεν τη χρειάζεται.
 *
 * @module components/mandate/__tests__/agency-directory-area-pending
 * @see ADR-846 · `AgencyDirectoryContent`
 */

import React from 'react';
import { render, screen } from '@testing-library/react';

import elBundle from '@/i18n/locales/el/property-market.json';
import { showcaseFixture } from '@/lib/agency/__fixtures__/showcase-fixture';

/** Η γενεαλογία γίνεται γνωστή **μόνο** όταν σταματήσει η φόρτωση — όπως στην πραγματικότητα. */
const mockHierarchy = { isLoading: true };

const mockLineage: Record<string, readonly string[]> = {
  'region:112': ['region:112'],
  'municipality:1303': ['municipality:1303', 'regionalUnit:1210', 'region:112'],
  'regionalUnit:1210': ['regionalUnit:1210', 'region:112'],
};

jest.mock('@/hooks/useAdministrativeHierarchy', () => ({
  ADMIN_LEVELS: {
    MAJOR_GEO: 1, DECENTRALIZED_ADMIN: 2, REGION: 3, REGIONAL_UNIT: 4,
    MUNICIPALITY: 5, MUNICIPAL_UNIT: 6, COMMUNITY: 7, SETTLEMENT: 8,
  },
  ADMIN_LEVEL_LABELS: { 3: 'Περιφέρεια', 4: 'Περιφερειακή Ενότητα', 5: 'Δήμος', 6: 'Δημοτική Ενότητα', 7: 'Κοινότητα' },
  lineageIdsOf: (id: string): readonly string[] =>
    mockHierarchy.isLoading ? [] : (mockLineage[id] ?? []),
  useAdministrativeHierarchy: () => ({
    isLoading: mockHierarchy.isLoading,
    findById: () => undefined,
    levelOptions: () => [],
    resolvePath: () => ({}),
    getByLevel: () => [],
    searchOptions: () => [],
    getChildren: () => [],
  }),
}));

const mockSearch = { value: '' };

jest.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(mockSearch.value),
}));

jest.mock('@/lib/workspace/navigation', () => ({
  useRouter: () => ({ replace: jest.fn(), push: jest.fn() }),
  // Ο σύνδεσμος του συνόρου χρειάζεται πραγματικό δρομολογητή· εδώ αρκεί ένα <a>.
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

const mockAgencies = [
  showcaseFixture({
    companyId: 'comp_a',
    alias: 'alpha',
    displayName: 'Γραφείο ΑΛΦΑ',
    coverage: { adminIds: ['regionalUnit:1210'] },
  }),
  showcaseFixture({
    companyId: 'comp_b',
    alias: 'beta',
    displayName: 'Γραφείο ΒΗΤΑ',
    coverage: null,
  }),
];

jest.mock('@/services/realtime/hooks/usePublicAgencies', () => ({
  usePublicAgencies: () => ({ agencies: mockAgencies, loading: false, error: null }),
}));

// 🔑 **Πραγματικά κείμενα από το locale** — ένα `t = key => key` θα έκανε το Κ1 να
//    ελέγχει λατινικά κλειδιά, δηλαδή πράσινο χωρίς νόημα.
jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({
    i18n: { language: 'el' },
    t: (key: string, params?: Record<string, unknown>): string => {
      const bundle: Record<string, unknown> = jest.requireActual(
        '@/i18n/locales/el/property-market.json',
      );
      let node: unknown = bundle;
      for (const segment of key.replace(/^property-market:/, '').split('.')) {
        node = (node as Record<string, unknown> | undefined)?.[segment];
      }
      if (typeof node !== 'string') return key;
      return Object.entries(params ?? {}).reduce(
        (text, [name, replacement]) => text.replaceAll(`{${name}}`, String(replacement)),
        node,
      );
    },
  }),
}));

import { AgencyDirectoryContent } from '../AgencyDirectoryContent';

const DIRECTORY = (elBundle as unknown as {
  mandate: { directory: Record<string, string> };
}).mandate.directory;

function renderDirectory(search: string, hierarchyLoading: boolean): void {
  mockSearch.value = search;
  mockHierarchy.isLoading = hierarchyLoading;
  render(<AgencyDirectoryContent />);
}

/** Τα ονόματα των γραφείων που **φαίνονται** αυτή τη στιγμή. */
function visibleNames(): string[] {
  return mockAgencies
    .map((agency) => agency.displayName)
    .filter((name) => screen.queryByText(name) !== null);
}

describe('ADR-846 Π7 — αργή ιεραρχία: όλοι ορατοί, και η αναμονή δηλώνεται', () => {
  // =========================================================================
  // 🔴 Κ1 — Η ΑΓΚΥΡΑ. Χωρίς αυτήν, η οθόνη λέει «κανείς δεν ταιριάζει» — ψέμα.
  // =========================================================================
  it('Κ1 — με ερώτημα περιοχής και ιεραρχία που φορτώνει: ΚΑΙ ΟΙ ΔΥΟ ορατοί, με ειδοποίηση', () => {
    renderDirectory('area=region:112', true);

    expect(screen.getByText(DIRECTORY.areaLoading)).toBeInTheDocument();
    expect(visibleNames()).toEqual(['Γραφείο ΑΛΦΑ', 'Γραφείο ΒΗΤΑ']);
    // ⛔ Το κείμενο που ΔΕΝ επιτρέπεται να εμφανιστεί ποτέ σε αυτή τη στιγμή.
    expect(screen.queryByText(DIRECTORY.emptyAfterFilter)).not.toBeInTheDocument();
  });

  // =========================================================================
  // Κ2 — ΠΑΡΟΝΟΜΑΣΤΗΣ: όταν φορτώσει, το φίλτρο ΟΝΤΩΣ φιλτράρει. Χωρίς αυτό, ένα
  //      «δείχνε πάντα όλους» θα περνούσε το Κ1 θριαμβευτικά.
  // =========================================================================
  it('Κ2 — με φορτωμένη ιεραρχία το φίλτρο εφαρμόζεται, και η ειδοποίηση φεύγει', () => {
    renderDirectory('area=region:112', false);

    expect(screen.queryByText(DIRECTORY.areaLoading)).not.toBeInTheDocument();
    expect(visibleNames()).toEqual(['Γραφείο ΑΛΦΑ']);
  });

  // =========================================================================
  // Κ3 — Η ΑΝΑΜΟΝΗ ΕΙΝΑΙ ΣΤΟΧΕΥΜΕΝΗ. Ερώτημα σημείου δεν χρωστά τίποτα στην
  //      ιεραρχία· μια καθολική «περίμενε» θα καθυστερούσε οθόνη χωρίς λόγο.
  // =========================================================================
  it('Κ3 — ερώτημα ΣΗΜΕΙΟΥ δεν περιμένει την ιεραρχία', () => {
    renderDirectory('lat=40.5&lng=23.0&radius=20000', true);

    expect(screen.queryByText(DIRECTORY.areaLoading)).not.toBeInTheDocument();
  });
});
