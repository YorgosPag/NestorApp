/**
 * Κοινό στήσιμο υποβάθρου ορόφου για τα tests (ADR-340 · ADR-929): ΕΝΑΣ ορισμός του `FloorplanBackground` με ουδέτερες
 * προεπιλογές, ώστε κάθε σουίτα να γράφει μόνο ό,τι μετρά γι' αυτήν (θέση, βαθμονόμηση, ταυτότητα εικόνας) — όχι
 * αντίγραφα του ίδιου κυριολεκτικού αντικειμένου (CHECK 3.28).
 *
 * Το `seedFloorBackground` γράφει στο ΠΡΑΓΜΑΤΙΚΟ store, ώστε ο κώδικας υπό δοκιμή να διαβάζει μέσα από το ίδιο
 * `getFloorBackground` με την παραγωγή (κανένα `jest.mock` του store).
 *
 * Μόνο για tests — ο φάκελος `testing/` εξαιρείται από το knip.
 */

import type { CalibrationData, FloorplanBackground } from '../providers/types';
import { useFloorplanBackgroundStore } from '../stores/floorplanBackgroundStore';

/** Βαθμονόμηση δύο σημείων με ουδέτερες τιμές: αρκεί ότι **υπάρχει** (`isRasterPlacementCalibrated`). */
export const TEST_CALIBRATION: CalibrationData = {
  method: 'two-point', pointA: { x: 0, y: 0 }, pointB: { x: 1, y: 0 }, realDistance: 1, unit: 'm',
  rotationDerived: false, calibratedAt: 0, calibratedBy: 'u',
};

/** Υπόβαθρο εικόνας με ταυτοτική θέση και χωρίς βαθμονόμηση· `overrides` για ό,τι μετρά στη σουίτα. */
export function testFloorplanBackground(overrides: Partial<FloorplanBackground> = {}): FloorplanBackground {
  return {
    id: 'bg_test', companyId: 'co', floorId: 'flr_test', fileId: 'file_test', providerId: 'image', providerMetadata: {},
    naturalBounds: { width: 1000, height: 800 },
    transform: { translateX: 0, translateY: 0, scaleX: 1, scaleY: 1, rotation: 0 },
    calibration: null, opacity: 1, visible: true, locked: false,
    createdAt: 0, updatedAt: 0, createdBy: 'u', updatedBy: 'u',
    ...overrides,
  };
}

/** Το υπόβαθρο γίνεται το (μοναδικό) υπόβαθρο του ορόφου του, στο πραγματικό store. */
export function seedFloorBackground(background: FloorplanBackground): void {
  useFloorplanBackgroundStore.setState((s) => ({
    ...s,
    floors: { [background.floorId]: { background, isLoading: false, error: null } },
  }));
}
