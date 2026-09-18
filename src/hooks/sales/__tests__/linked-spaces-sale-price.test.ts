/**
 * Άγκυρα — ADR-777 §8.60.14.14 (Φάση 4, Δ): **η ΠΡΟΤΕΙΝΟΜΕΝΗ τιμή πώλησης ενός παρακολουθήματος.**
 *
 * 🔴 Το περιστατικό: ο διάλογος πώλησης πρότεινε ως **τιμή πώλησης** μιας θέσης το `priceSortKey`
 * — την κύρια τιμή **όποιου** ρόλου. Θέση που νοικιάζεται 60 €/μήνα ⇒ «πώληση 60 €», που μετά
 * **αθροιζόταν** στο σύνολο των παρακολουθημάτων. Η ερώτηση είναι «πόσο **πουλιέται**;» ⇒ ρόλος
 * `sale`, ρητά· απουσία ⇒ κενό πεδίο (0 = «δεν ορίστηκε»), **ποτέ** ποσό άλλης μονάδας.
 */

import { renderHook, waitFor } from '@testing-library/react';
import type { BatchResolveResponse } from '@/types/spaces';
import type { Property } from '@/types/property';

const post = jest.fn<Promise<BatchResolveResponse>, [string, unknown]>();
jest.mock('@/lib/api/enterprise-api-client', () => ({
  apiClient: { post: (url: string, body: unknown) => post(url, body) },
}));

import { useLinkedSpacesForSale } from '../useLinkedSpacesForSale';

const UNIT = {
  id: 'prop_1',
  linkedSpaces: [
    { spaceId: 'park_rent', spaceType: 'parking', inclusion: 'optional', allocationCode: 'P-1' },
    { spaceId: 'park_sale', spaceType: 'parking', inclusion: 'optional', allocationCode: 'P-2' },
    { spaceId: 'stor_none', spaceType: 'storage', inclusion: 'optional', allocationCode: 'S-1' },
  ],
} as unknown as Property;

beforeEach(() => {
  post.mockResolvedValue({
    notFound: [],
    spaces: [
      { id: 'park_rent', spaceType: 'parking', area: 12, commercialStatus: 'for-rent', commercial: { rentPrice: 60 } },
      { id: 'park_sale', spaceType: 'parking', area: 12, commercialStatus: 'for-sale', commercial: { askingPrice: 12_000 } },
      { id: 'stor_none', spaceType: 'storage', area: 5, commercialStatus: 'for-sale' },
    ],
  });
});

async function resolved() {
  const { result } = renderHook(() => useLinkedSpacesForSale(UNIT));
  await waitFor(() => expect(result.current.spaces).toHaveLength(3));
  return Object.fromEntries(result.current.spaces.map((s) => [s.spaceId, s.salePrice]));
}

describe('Δ. Η ΠΡΟΤΕΙΝΟΜΕΝΗ ΤΙΜΗ ΠΩΛΗΣΗΣ ΡΩΤΑ ΤΟΝ ΡΟΛΟ `sale`', () => {
  it('🔴 Δ1 — θέση προς ενοίκιο 60 €/μήνα ⇒ ΚΑΜΙΑ πρόταση πώλησης (όχι «60 €»)', async () => {
    expect((await resolved()).park_rent).toBe(0);
  });

  it('Δ2 — θέση προς πώληση ⇒ η ζητούμενη τιμή της', async () => {
    expect((await resolved()).park_sale).toBe(12_000);
  });

  it('Δ3 — χωρίς τιμή ⇒ κενό πεδίο (0 = «δεν ορίστηκε»)', async () => {
    expect((await resolved()).stor_none).toBe(0);
  });
});
