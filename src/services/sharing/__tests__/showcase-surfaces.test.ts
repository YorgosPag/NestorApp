/**
 * ADR-742 §7quaterdecies — **ο πίνακας των πέντε επιφανειών showcase**
 *
 * Αντικατέστησε **τέσσερις** χειρόγραφες αλυσίδες τριαδικών που είχαν ήδη
 * αποκλίνει σε πλήθος κλάδων (5 context vs 3 PDF). Οι έλεγχοι εδώ φυλάνε αυτό
 * ακριβώς: **τη συμφωνία του πίνακα με τον εαυτό του και με τον τύπο**.
 *
 * 🔴 Ο πιο σημαντικός είναι ο τελευταίος: *κάθε τιμή του `ShareEntityType` που
 * τελειώνει σε `_showcase` έχει εγγραφή*. Χωρίς αυτόν, νέα επιφάνεια θα έμπαινε
 * στον τύπο και θα έλειπε από τον πίνακα — δηλαδή **ακριβώς** το σφάλμα που
 * επέτρεπαν οι αλυσίδες με το `else`.
 *
 * @module services/sharing/__tests__/showcase-surfaces
 */

import {
  SHOWCASE_SURFACES,
  buildShowcaseContext,
  findShowcaseSurface,
  showcaseEmailEndpoint,
  showcasePdfHref,
  type ShowcaseShareEntityType,
} from '../showcase-surfaces';
import type { ShareEntityType } from '@/types/sharing';

/**
 * 🔑 Ο κατάλογος γράφεται **με το χέρι** επίτηδες. Αν παραγόταν από τον ίδιο
 * τον πίνακα, ο έλεγχος θα σύγκρινε τον πίνακα με τον εαυτό του — *«κανένας
 * παραβάτης» και «καμία μέτρηση» δίνουν το ίδιο πράσινο*.
 */
const EXPECTED_SHOWCASE_TYPES: readonly ShowcaseShareEntityType[] = [
  'property_showcase',
  'project_showcase',
  'building_showcase',
  'storage_showcase',
  'parking_showcase',
];

/** Τύποι share που **δεν** είναι showcase — οφείλουν να μη βρίσκουν επιφάνεια. */
const NON_SHOWCASE_TYPES: readonly ShareEntityType[] = [
  'file',
  'contact',
  'vendor_rfq_invite',
];

describe('SHOWCASE_SURFACES — ο πίνακας', () => {
  test('περιέχει ακριβώς τις πέντε επιφάνειες, καμία λιγότερη και καμία παραπάνω', () => {
    expect(Object.keys(SHOWCASE_SURFACES).sort()).toEqual([...EXPECTED_SHOWCASE_TYPES].sort());
  });

  test.each(EXPECTED_SHOWCASE_TYPES)('%s: το κλειδί συμφωνεί με το `entityType` της εγγραφής', type => {
    expect(SHOWCASE_SURFACES[type].entityType).toBe(type);
  });

  test.each(EXPECTED_SHOWCASE_TYPES)('%s: το `contextIdKey` παράγεται από το `kind`', type => {
    const surface = SHOWCASE_SURFACES[type];
    expect(surface.contextIdKey).toBe(`${surface.kind}Id`);
  });

  test('κάθε επιφάνεια έχει μοναδικό `kind` (αλλιώς ο πίνακας ανά είδος χάνει εγγραφή)', () => {
    const kinds = Object.values(SHOWCASE_SURFACES).map(s => s.kind);
    expect(new Set(kinds).size).toBe(kinds.length);
  });
});

describe('findShowcaseSurface', () => {
  test.each(EXPECTED_SHOWCASE_TYPES)('βρίσκει το %s', type => {
    expect(findShowcaseSurface(type)?.entityType).toBe(type);
  });

  test.each(NON_SHOWCASE_TYPES)('επιστρέφει null για %s', type => {
    expect(findShowcaseSurface(type)).toBeNull();
  });
});

describe('buildShowcaseContext', () => {
  test.each(EXPECTED_SHOWCASE_TYPES)('%s: χτίζει `{ type, <kind>Id }`', type => {
    const surface = SHOWCASE_SURFACES[type];

    const context = buildShowcaseContext(type, 'ent_001');

    expect(context).toEqual({ type: surface.kind, [surface.contextIdKey]: 'ent_001' });
  });

  test.each(NON_SHOWCASE_TYPES)('%s: επιστρέφει undefined', type => {
    expect(buildShowcaseContext(type, 'ent_001')).toBeUndefined();
  });
});

describe('showcasePdfHref', () => {
  /**
   * ⚠️ Οι διαδρομές γράφονται **αυτούσιες**: είναι **ζωντανό συμβόλαιο** —
   * κυκλοφορούν ήδη σε μοιρασμένους δημόσιους συνδέσμους. Ιδιαίτερα το ακίνητο
   * κρατά το ιστορικό `/api/showcase`, που μοιάζει με παράλειψη και δεν είναι.
   */
  const withPdf: ReadonlyArray<readonly [ShowcaseShareEntityType, string]> = [
    ['property_showcase', '/api/showcase/tok_1/pdf'],
    ['project_showcase', '/api/project-showcase/tok_1/pdf'],
    ['building_showcase', '/api/building-showcase/tok_1/pdf'],
  ];

  test.each(withPdf)('%s → %s', (type, expected) => {
    expect(showcasePdfHref(type, 'tok_1')).toBe(expected);
  });

  test.each(['storage_showcase', 'parking_showcase'] as const)(
    '%s: null — δεν έχει γεννήτρια PDF (ADR-315 `requiresPdfPath: false`)',
    type => {
      expect(showcasePdfHref(type, 'tok_1')).toBeNull();
    },
  );

  test.each(NON_SHOWCASE_TYPES)('%s: null', type => {
    expect(showcasePdfHref(type, 'tok_1')).toBeNull();
  });

  test('κωδικοποιεί το token — δεν το ενώνει ωμά στη διαδρομή', () => {
    expect(showcasePdfHref('property_showcase', 'a/b?c')).toBe('/api/showcase/a%2Fb%3Fc/pdf');
  });
});

describe('showcaseEmailEndpoint', () => {
  const cases: ReadonlyArray<readonly [ShowcaseShareEntityType, string]> = [
    ['property_showcase', '/api/properties/ent_1/showcase/email'],
    ['project_showcase', '/api/projects/ent_1/showcase/email'],
    ['building_showcase', '/api/buildings/ent_1/showcase/email'],
    ['storage_showcase', '/api/storages/ent_1/showcase/email'],
    ['parking_showcase', '/api/parking/ent_1/showcase/email'],
  ];

  test.each(cases)('%s → %s', (type, expected) => {
    const context = buildShowcaseContext(type, 'ent_1')!;

    expect(showcaseEmailEndpoint(context)).toBe(expected);
  });

  test('κωδικοποιεί το id', () => {
    const context = buildShowcaseContext('project_showcase', 'a/b')!;

    expect(showcaseEmailEndpoint(context)).toBe('/api/projects/a%2Fb/showcase/email');
  });
});
