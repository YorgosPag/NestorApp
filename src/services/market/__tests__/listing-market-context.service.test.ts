/**
 * @jest-environment node
 *
 * ADR-889 Φ5 — η σύνθεση «συμβόλαια + ζώνη αντικειμενικής αξίας» της σελίδας αγγελίας: η ζώνη υπάρχει σε **κάθε**
 * παραλλαγή, και αποτυχία στις ζώνες **δεν** ρίχνει τα συμβόλαια.
 */

import { listing } from '@/lib/demand/__tests__/demand-fixtures';
import type { ValueZoneVerdict } from '@/lib/market/value-zone-at-point';

const mockValueZone = jest.fn<Promise<ValueZoneVerdict>, [unknown]>();
jest.mock('@/services/market/value-zones.reader', () => ({
  readValueZoneAt: (position: unknown) => mockValueZone(position),
}));
jest.mock('@/services/market/market-transactions.reader', () => ({
  readAreaRows: jest.fn(),
  readAreaSummary: jest.fn(),
}));
jest.mock('@/services/places/admin-boundaries.reader', () => ({
  readAdminAreaDirectory: jest.fn(),
}));

import { loadListingMarketContext } from '../listing-market-context.service';

const READY: ValueZoneVerdict = {
  kind: 'ready',
  zone: { id: 4953, name: 'Θ', price: 3850, validFrom: '2022-01-01' },
  nearEdge: false,
  fronts: [],
};

describe('loadListingMarketContext — ζώνη αντικειμενικής αξίας', () => {
  it('η ζώνη φτάνει και όταν η αγγελία δεν έχει περιοχή για συμβόλαια', async () => {
    mockValueZone.mockResolvedValue(READY);
    const subject = listing({ id: 'prop_1', adminArea: null });
    expect(await loadListingMarketContext(subject)).toEqual({ kind: 'no-area', valueZone: READY });
    expect(mockValueZone).toHaveBeenCalledWith(subject.position);
  });

  it('ζώνες μη διαθέσιμες ⇒ valueZone: unavailable — η απάντηση ΔΕΝ πέφτει', async () => {
    mockValueZone.mockResolvedValue({ kind: 'unavailable' });
    const context = await loadListingMarketContext(listing({ id: 'prop_2', adminArea: null }));
    expect(context).toEqual({ kind: 'no-area', valueZone: { kind: 'unavailable' } });
  });
});
