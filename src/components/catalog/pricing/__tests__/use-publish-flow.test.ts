import { act, renderHook } from '@testing-library/react';

import type { PriceListVersionWire } from '@/subapps/catalog/types/pricing-views';
import { usePublishFlow } from '../use-publish-flow';

// Κανένα δίκτυο: το βήμα «schedule» με γνωστή άρνηση δεν στέλνει τίποτα (η κρίση είναι στον πελάτη).
jest.mock('@/services/catalog/catalog-pricing-api.client', () => ({
  previewPublication: jest.fn(),
  publishVersion: jest.fn(),
  setVersionValidFrom: jest.fn(),
}));

const draft = { id: 'plv_1', priceListId: 'plst_1', number: 1, status: 'draft', validFrom: null, revision: 1 } as unknown as PriceListVersionWire;

describe('usePublishFlow — Σ3 (ζωντανά): το εύρημα λέει την ΤΡΕΧΟΥΣΑ ημερομηνία, όχι το στιγμιότυπο του κλικ', () => {
  it('πριν από την πρώτη προσπάθεια ⇒ σιωπή· μετά ⇒ η κρίση ακολουθεί κάθε αλλαγή ημερομηνίας', () => {
    const { result } = renderHook(() => usePublishFlow({ version: draft, versions: [draft], suggestedValidFrom: null, onChanged: () => undefined }));
    expect(result.current.issue).toBeNull();
    act(() => result.current.schedule());
    expect(result.current.issue).toBe('versionValidFromRequired');
    act(() => result.current.setValidFrom('2026-10-28T22:00:00.000Z'));
    expect(result.current.issue).toBeNull();
    act(() => result.current.setValidFrom(null));
    expect(result.current.issue).toBe('versionValidFromRequired');
  });
});

describe('usePublishFlow — πρόχειρη χωρίς ημερομηνία ξεκινά από την ΠΡΟΤΑΣΗ, όχι κενή', () => {
  const suggested = '2026-11-07T22:00:00.000Z';

  it('το πεδίο έρχεται συμπληρωμένο και η προσπάθεια δεν βρίσκει εύρημα', () => {
    const { result } = renderHook(() => usePublishFlow({ version: draft, versions: [draft], suggestedValidFrom: suggested, onChanged: () => undefined }));
    expect(result.current.validFrom).toBe(suggested);
    act(() => result.current.schedule());
    expect(result.current.issue).toBeNull();
  });

  it('αποθηκευμένη ημερομηνία ΝΙΚΑ την πρόταση — η πρόταση δεν σβήνει απόφαση ανθρώπου', () => {
    const dated = { ...draft, validFrom: '2026-12-31T22:00:00.000Z' } as PriceListVersionWire;
    const { result } = renderHook(() => usePublishFlow({ version: dated, versions: [dated], suggestedValidFrom: suggested, onChanged: () => undefined }));
    expect(result.current.validFrom).toBe('2026-12-31T22:00:00.000Z');
  });
});
