/**
 * @fileoverview 🧭 **Το μητρώο ενοτήτων της σελίδας ακινήτου ιδιοκτήτη λέει την αλήθεια στη λίστα** (ADR-946).
 * @related components/owner-property/owner-property-sections.ts · core/layouts/SectionListDetail.tsx
 *
 * Η λίστα ενοτήτων υπάρχει για να **μη** χρειάζεται να ανοίξεις ενότητα για να μάθεις αν κάτι σε περιμένει (η αντίρρηση
 * του NN/g για τις καρτέλες). Άρα η σύνοψη πρέπει να είναι **σωστή** — και να **σωπαίνει** όταν δεν ξέρει.
 */

import { renderHook } from '@testing-library/react';

import { CLOSED, EXPIRING, SETTLED } from '@/lib/mandate/mandate-standing';

import {
  isOwnerPropertySection,
  ownerMandateTally,
  totalViewsOf,
  useOwnerPropertySectionEntries,
} from '../owner-property-sections';

jest.mock('@/i18n/hooks/useTranslation', () => {
  const t = (key: string, options?: { count?: number }) => (options?.count === undefined ? key : `${key}|${options.count}`);
  return { useTranslation: () => ({ t }) };
});

const S = 'property-market:offer.sections';

describe('ADR-946 — μητρώο ενοτήτων ιδιοκτήτη', () => {
  it('Μ1 — τέσσερις ενότητες, σε σταθερή σειρά (η πρώτη = προεπιλογή του φαρδιού)', () => {
    const { result } = renderHook(() => useOwnerPropertySectionEntries({ mandateViews: [], stats: { state: 'loading' } }));
    expect(result.current.map((entry) => entry.id)).toEqual(['overview', 'mandate', 'documents', 'history']);
    expect(result.current.every((entry) => isOwnerPropertySection(entry.id))).toBe(true);
    expect(isOwnerPropertySection('elsewhere')).toBe(false);
  });

  it('Μ2 — εντολές: μετρώνται ΜΟΝΟ οι ζωντανές· ο μετρητής ανάβει ΜΟΝΟ για ό,τι λήγει', () => {
    const views = [{ group: SETTLED }, { group: EXPIRING }, { group: CLOSED }] as const;
    expect(ownerMandateTally(views)).toEqual({ live: 2, expiring: 1 });

    const { result } = renderHook(() => useOwnerPropertySectionEntries({ mandateViews: views, stats: { state: 'loading' } }));
    const mandate = result.current.find((entry) => entry.id === 'mandate');
    expect(mandate).toMatchObject({ summary: `${S}.mandate.live|2`, count: 1, attention: true });
  });

  it('Μ3 — χωρίς εντολή ⇒ «χωρίς εντολή», κανένας μετρητής προσοχής', () => {
    const { result } = renderHook(() => useOwnerPropertySectionEntries({ mandateViews: [{ group: CLOSED }], stats: { state: 'absent' } }));
    expect(result.current.find((entry) => entry.id === 'mandate')).toMatchObject({
      summary: `${S}.mandate.none`,
      count: 0,
      attention: false,
    });
  });

  it('🔴 Μ4 — καμία μέτρηση ⇒ ΚΑΝΕΝΑΣ αριθμός προβολών («0» θα σήμαινε «κανείς δεν ήρθε»)', () => {
    expect(totalViewsOf({ state: 'loading' })).toBeNull();
    expect(totalViewsOf({ state: 'unavailable' })).toBeNull();
    expect(totalViewsOf({ state: 'absent' })).toBeNull();

    const { result } = renderHook(() => useOwnerPropertySectionEntries({ mandateViews: [], stats: { state: 'unavailable' } }));
    expect(result.current[0]?.summary).toBe(`${S}.overview.summary`);
  });
});
