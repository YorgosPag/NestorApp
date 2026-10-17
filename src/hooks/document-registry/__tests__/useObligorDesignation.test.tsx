/**
 * @fileoverview ADR-915 §26 — `useObligorDesignation`: **κανένας αγώνας**. Δύο γρήγορες επιλογές στο ΙΔΙΟ ακίνητο φτάνουν
 *   στον διακομιστή **με τη σειρά** τους (η τελευταία του ανθρώπου = η τελευταία που γράφεται), και μια παλιά απάντηση
 *   δεν σβήνει τη νεότερη εκκρεμότητα.
 */

import { act, renderHook } from '@testing-library/react';

import { useObligorDesignation } from '../useObligorDesignation';
import { fixtureResponse } from '@/lib/document-validity/__tests__/registry-fixture';
import type { ObligorDesignationSave } from '@/services/document-registry/document-registry.client';

const calls: { propertyId: string; contactId: string | null; resolve: (save: ObligorDesignationSave) => void }[] = [];
jest.mock('@/services/document-registry/document-registry.client', () => ({
  saveObligorDesignation: (propertyId: string, contactId: string | null) =>
    new Promise<ObligorDesignationSave>((resolve) => { calls.push({ propertyId, contactId, resolve }); }),
}));
jest.mock('@/providers/NotificationProvider', () => ({ useNotifications: () => ({ error: jest.fn(), success: jest.fn() }) }));
jest.mock('@/i18n/hooks/useTranslation', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

/** p6 με δύο ιδιοκτήτες, ώστε η αισιόδοξη επιλογή να είναι έγκυρη. */
function registryOf() {
  const base = fixtureResponse();
  return { ...base, properties: { ...base.properties, p6: { ...base.properties.p6, ownerContactIds: ['cont_alpha', 'cont_gamma'] } } };
}

beforeEach(() => { calls.length = 0; });

it('δύο επιλογές στο ίδιο ακίνητο ⇒ η δεύτερη ΠΕΡΙΜΕΝΕΙ την πρώτη· η εκκρεμότητα σβήνει μόνο με τη νεότερη', async () => {
  const revalidate = jest.fn(async () => undefined);
  const { result } = renderHook(() => useObligorDesignation(registryOf(), revalidate));
  act(() => { result.current.designate('p6', 'cont_alpha'); });
  act(() => { result.current.designate('p6', 'cont_gamma'); });
  await act(async () => { await Promise.resolve(); });
  expect(calls.map((call) => call.contactId)).toEqual(['cont_alpha']);
  expect(result.current.registry.properties.p6.obligorLead).toMatchObject({ contactId: 'cont_gamma', basis: 'explicit' });

  await act(async () => { calls[0].resolve({ kind: 'saved' }); });
  expect(calls.map((call) => call.contactId)).toEqual(['cont_alpha', 'cont_gamma']);
  expect(result.current.pending.has('p6')).toBe(true);

  await act(async () => { calls[1].resolve({ kind: 'saved' }); });
  expect(result.current.pending.has('p6')).toBe(false);
  expect(revalidate).toHaveBeenCalledTimes(2);
});

it('αισιόδοξη επιλογή ΜΗ ιδιοκτήτη ⇒ ΔΕΝ εμφανίζεται (ο κριτής θα την απέρριπτε)', () => {
  const { result } = renderHook(() => useObligorDesignation(registryOf(), jest.fn(async () => undefined)));
  act(() => { result.current.designate('p6', 'cont_stranger'); });
  expect(result.current.registry.properties.p6.obligorLead).toEqual(registryOf().properties.p6.obligorLead);
});
