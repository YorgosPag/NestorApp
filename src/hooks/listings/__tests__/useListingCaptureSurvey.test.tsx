/**
 * @fileoverview 🧭 **Η ΑΓΚΥΡΑ ΤΗΣ ΑΤΟΜΙΚΗΣ ΑΠΟΘΗΚΕΥΣΗΣ** — σημεία λήψης και βορράς σε **ΕΝΑ** PATCH (ADR-897 Φ5.2).
 * @related hooks/listings/useListingCaptureSpots (`useListingCaptureSurvey`) · hooks/listings/useDeclaredFileIds
 *
 *   Α1 — μία αποθήκευση ⇒ **ένα** `updateProperty` με **και τα δύο** πεδία (ποτέ δύο αιτήματα που αγωνίζονται);
 *   Α2 — αποτυχία ⇒ **και τα δύο** γυρίζουν πίσω (ποτέ μισοαποθηκευμένη αποτύπωση);
 *   Α3 — το αισιόδοξο αποσύρεται **μόνο** όταν το έγγραφο συμφωνήσει **και στα δύο** πεδία.
 *
 * ⚠️ Ψεύτικο είναι **μόνο** το σύνορο (ο γραφέας)· ο κύκλος ζωής είναι ο πραγματικός.
 * ⛔ **ΜΕΤΑΛΛΑΞΗ**: γράψε τον βορρά με δεύτερη κλήση `updateProperty` ⇒ Α1 κοκκινίζει.
 */

import { act, renderHook, waitFor } from '@testing-library/react';

import { useListingCaptureSurvey } from '@/hooks/listings/useListingCaptureSpots';
import { readCaptureSurvey } from '@/lib/listings/capture-survey';

const updateProperty = jest.fn<Promise<{ success: boolean }>, [string, Record<string, unknown>]>();
jest.mock('@/services/properties.service', () => ({
  updateProperty: (id: string, updates: Record<string, unknown>) => updateProperty(id, updates),
}));

const PROPERTY_ID = 'prop_capture_survey';
const SPOT = { floorplanFileId: 'plan_a', x: 0.4, y: 0.6, headingRad: 1, fovRad: 1.2 };

beforeEach(() => updateProperty.mockReset());

describe('useListingCaptureSurvey', () => {
  it('Α1 — ΕΝΑ PATCH με σημεία ΚΑΙ βορρά', async () => {
    updateProperty.mockResolvedValue({ success: true });
    const { result } = renderHook(() => useListingCaptureSurvey(PROPERTY_ID, undefined, undefined));

    await act(() => result.current.commit(readCaptureSurvey({ photo_1: SPOT }, { plan_a: 0.5 })));

    expect(updateProperty).toHaveBeenCalledTimes(1);
    expect(updateProperty).toHaveBeenCalledWith(PROPERTY_ID, {
      publishedPhotoCaptureSpots: { photo_1: SPOT },
      publishedFloorplanNorth: { plan_a: 0.5 },
    });
  });

  it('Α2 — αποτυχία ⇒ ΚΑΙ ΤΑ ΔΥΟ γυρίζουν πίσω', async () => {
    updateProperty.mockRejectedValue(new Error('denied'));
    const { result } = renderHook(() => useListingCaptureSurvey(PROPERTY_ID, { photo_1: SPOT }, { plan_a: 0.5 }));

    await act(() => result.current.commit(readCaptureSurvey({}, {})));

    expect(result.current.failed).toBe(true);
    expect(result.current.declared.spots.get('photo_1')).toEqual(SPOT);
    expect(result.current.declared.north.get('plan_a')).toBe(0.5);
  });

  it('Α3 — το αισιόδοξο μένει μέχρι να συμφωνήσουν ΚΑΙ ΤΑ ΔΥΟ πεδία', async () => {
    updateProperty.mockResolvedValue({ success: true });
    const view = renderHook(
      ({ spots, north }: { spots: unknown; north: unknown }) => useListingCaptureSurvey(PROPERTY_ID, spots, north),
      { initialProps: { spots: undefined as unknown, north: undefined as unknown } },
    );
    await act(() => view.result.current.commit(readCaptureSurvey({ photo_1: SPOT }, { plan_a: 0.5 })));

    // Έφτασαν μόνο τα σημεία — ο βορράς του αισιόδοξου πρέπει να ΜΕΙΝΕΙ ορατός.
    view.rerender({ spots: { photo_1: SPOT }, north: undefined });
    expect(view.result.current.declared.north.get('plan_a')).toBe(0.5);

    // Έφτασαν και τα δύο ⇒ το αισιόδοξο αποσύρεται, και μια μεταγενέστερη αλλαγή από αλλού φαίνεται.
    view.rerender({ spots: { photo_1: SPOT }, north: { plan_a: 0.5 } });
    view.rerender({ spots: { photo_1: SPOT }, north: { plan_a: 2 } });
    await waitFor(() => expect(view.result.current.declared.north.get('plan_a')).toBe(2));
  });
});
