/**
 * ADR-931 — άγκυρες του λεξιλογίου κοινόχρηστων χώρων.
 *
 * Κάθε κατηγορία: ορισμός (ο τύπος το απαιτεί) + ομάδα του λεξιλογίου + ετικέτα el/en.
 * Κάθε ομάδα: τουλάχιστον μία κατηγορία + τίτλος/περιγραφή el/en. Κάθε νομική φύση: ετικέτα el/en.
 * Νέα κατηγορία χωρίς μετάφραση ⇒ ΚΟΚΚΙΝΟ εδώ, όχι ωμό κλειδί στην οθόνη.
 */

import el from '@/i18n/locales/el/common-spaces.json';
import en from '@/i18n/locales/en/common-spaces.json';
import {
  COMMON_SPACE_CATEGORIES,
  COMMON_SPACE_CATEGORY_DEFS,
  COMMON_SPACE_GROUPS,
  COMMON_SPACE_LEGAL_NATURES,
  commonSpaceCategoriesOf,
  commonSpaceGroupOf,
  isCommonSpaceCategory,
} from '@/constants/common-space-categories';

const LOCALES = { el, en } as const;

function block(locale: keyof typeof LOCALES) {
  return LOCALES[locale] as {
    categories: Record<string, string>;
    groups: Record<string, { title: string; description: string }>;
    legalNature: Record<string, string>;
  };
}

describe('ADR-931 — λεξιλόγιο κοινόχρηστων χώρων', () => {
  it('κάθε κατηγορία ανήκει σε ομάδα του λεξιλογίου', () => {
    for (const category of COMMON_SPACE_CATEGORIES) {
      expect(COMMON_SPACE_GROUPS).toContain(COMMON_SPACE_CATEGORY_DEFS[category].group);
    }
  });

  it('οι ομάδες διαμερίζουν τις κατηγορίες (κάθε κατηγορία σε ΑΚΡΙΒΩΣ μία, καμία ομάδα κενή)', () => {
    const union = COMMON_SPACE_GROUPS.flatMap((group) => commonSpaceCategoriesOf(group));
    expect([...union].sort()).toEqual([...COMMON_SPACE_CATEGORIES].sort());
    for (const group of COMMON_SPACE_GROUPS) expect(commonSpaceCategoriesOf(group).length).toBeGreaterThan(0);
  });

  it('οι κατακόρυφες διεισδύσεις είναι Revit «Major Vertical Penetration» / IPMS A', () => {
    for (const category of commonSpaceCategoriesOf('vertical')) {
      expect(COMMON_SPACE_CATEGORY_DEFS[category]).toMatchObject({ revitAreaType: 'major_vertical_penetration', ipmsComponent: 'A' });
    }
    expect(commonSpaceGroupOf('stairwell')).toBe('vertical');
  });

  it('ο φρουρός δέχεται μόνο τιμές του λεξιλογίου', () => {
    expect(isCommonSpaceCategory('boiler_room')).toBe(true);
    expect(isCommonSpaceCategory('lounges')).toBe(false);
    expect(isCommonSpaceCategory(42)).toBe(false);
  });

  it.each(['el', 'en'] as const)('[%s] κάθε κατηγορία, ομάδα και νομική φύση έχει ετικέτα', (locale) => {
    const keys = block(locale);
    for (const category of COMMON_SPACE_CATEGORIES) expect(keys.categories[category]).toEqual(expect.any(String));
    for (const group of COMMON_SPACE_GROUPS) {
      expect(keys.groups[group]).toEqual({ title: expect.any(String), description: expect.any(String) });
    }
    for (const nature of COMMON_SPACE_LEGAL_NATURES) expect(keys.legalNature[nature]).toEqual(expect.any(String));
  });
});
