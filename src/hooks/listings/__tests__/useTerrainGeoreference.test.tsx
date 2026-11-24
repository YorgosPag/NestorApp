/**
 * @jest-environment jsdom
 *
 * ADR-920 §14.12 φάση Α — `useTerrainGeoreference`: πότε ρωτά την πόρτα.
 * Άγκυρες: Μ = ΜΙΑ ανάγνωση στο πρώτο φόρτωμα (ζωντανό εύρημα 8α: έφευγαν δύο `GET ?view=georeference`) ·
 * Ξ = ξαναδιαβάζει όταν ο φάκελος ξαναδιαβαστεί.
 */

import { renderHook, waitFor } from '@testing-library/react';

import type { OwnerTerrainTarget } from '@/services/listings/plot-outline.client';

import { useTerrainGeoreference } from '../useTerrainGeoreference';

const fetchTerrainGeoreference = jest.fn();
jest.mock('@/services/listings/terrain-georeference.client', () => ({
  fetchTerrainGeoreference: (...args: unknown[]) => fetchTerrainGeoreference(...args),
  amendTerrainGeoreference: jest.fn(),
}));

const TARGET: OwnerTerrainTarget = { kind: 'owner-property', ownerPropertyId: 'ownp_1' };

/** Η «αναθεώρηση» όπως τη δίνει το `PlotOutlineTab`: `null` όσο ο φάκελος φορτώνει, μετά το αντικείμενο της κατάστασης. */
const renderWith = (initial: unknown) =>
  renderHook(({ revision }: { revision: unknown }) => useTerrainGeoreference(TARGET, revision), {
    initialProps: { revision: initial },
  });

beforeEach(() => {
  fetchTerrainGeoreference.mockReset();
  fetchTerrainGeoreference.mockResolvedValue({ ok: true, georeference: null });
});

describe('useTerrainGeoreference — πότε ρωτά την πόρτα', () => {
  it('Μ1 — όσο ο φάκελος φορτώνει (`null`) ΔΕΝ ρωτά, και μένει «φορτώνει»', async () => {
    const { result } = renderWith(null);
    await Promise.resolve();
    expect(fetchTerrainGeoreference).not.toHaveBeenCalled();
    expect(result.current.view).toEqual({ kind: 'loading' });
  });

  it('Μ2 — πρώτο φόρτωμα (φορτώνει → έτοιμο) = ΜΙΑ ανάγνωση, όχι δύο', async () => {
    const { result, rerender } = renderWith(null);
    rerender({ revision: { kind: 'ready' } });
    await waitFor(() => expect(result.current.view).toEqual({ kind: 'ready', georeference: null }));
    expect(fetchTerrainGeoreference).toHaveBeenCalledTimes(1);
    expect(fetchTerrainGeoreference).toHaveBeenCalledWith(TARGET);
  });

  it('Μ3 — ίδια αναθεώρηση σε νέα απόδοση ⇒ καμία νέα ανάγνωση', async () => {
    const revision = { kind: 'ready' };
    const { rerender } = renderWith(revision);
    await waitFor(() => expect(fetchTerrainGeoreference).toHaveBeenCalledTimes(1));
    rerender({ revision });
    await Promise.resolve();
    expect(fetchTerrainGeoreference).toHaveBeenCalledTimes(1);
  });

  it('Ξ1 — ο φάκελος ξαναδιαβάστηκε (νέο αντικείμενο) ⇒ ξαναδιαβάζεται και η γεωαναφορά', async () => {
    const { rerender } = renderWith({ kind: 'ready' });
    await waitFor(() => expect(fetchTerrainGeoreference).toHaveBeenCalledTimes(1));
    rerender({ revision: { kind: 'ready' } });
    await waitFor(() => expect(fetchTerrainGeoreference).toHaveBeenCalledTimes(2));
  });

  it('Ξ2 — και ο αποτυχημένος φάκελος είναι «διαβάστηκε»: η γεωαναφορά ρωτά την πόρτα μόνη της', async () => {
    const { rerender } = renderWith(null);
    rerender({ revision: { kind: 'failed' } });
    await waitFor(() => expect(fetchTerrainGeoreference).toHaveBeenCalledTimes(1));
  });
});
