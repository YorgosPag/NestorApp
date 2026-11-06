/**
 * ADR-929 Φ5.2γ — η μία πράξη εγγραφής βαθμονόμησης και η ουρά που μοιράζεται με το autosave.
 *
 * Κλειδώνει: αισιόδοξη εφαρμογή → υιοθέτηση της απάντησης του server · `oldTransform` = ό,τι ΞΕΡΕΙ ο server
 * (ποτέ η αισιόδοξη θέση) · 409 ⇒ θέση του server · άλλο σφάλμα ⇒ επαναφορά · σειριακή ουρά ανά όροφο ·
 * όσο εκκρεμεί βαθμονόμηση το autosave στέλνει τη δεσμευμένη θέση.
 */

const mockPatchCalibration = jest.fn();
const mockGetByFloor = jest.fn();

jest.mock('../floorplan-background-api-client', () => ({
  FloorplanBackgroundApiClient: {
    patchCalibration: (...args: unknown[]) => mockPatchCalibration(...args),
    getByFloor: (...args: unknown[]) => mockGetByFloor(...args),
  },
}));

import { ApiClientError } from '@/lib/api/api-client-types';
import { commitCalibration } from '../commit-calibration';
import {
  enqueueBackgroundWrite,
  getCommittedBackground,
  setCalibrationPending,
  setCommittedBackground,
  snapshotOf,
  transformForAutosave,
} from '../background-write-ledger';
import { useFloorplanBackgroundStore } from '../../stores/floorplanBackgroundStore';
import {
  CALIBRATION_STALE_ERROR_CODE,
  type BackgroundTransform,
  type CalibrationData,
  type FloorplanBackground,
} from '../../providers/types';

const FLOOR = 'flr_1';
const OLD: BackgroundTransform = { translateX: 0, translateY: 0, scaleX: 1, scaleY: 1, rotation: 0 };
const NEW: BackgroundTransform = { translateX: 5, translateY: -3, scaleX: 0.025, scaleY: 0.025, rotation: 0 };
const CALIBRATION: CalibrationData = {
  method: 'two-point', pointA: { x: 0, y: 0 }, pointB: { x: 0, y: 412 }, realDistance: 10.3, unit: 'm',
  rotationDerived: false, calibratedAt: 1, calibratedBy: '', sceneUnits: 'm',
};

function background(transform: BackgroundTransform, calibration: CalibrationData | null): FloorplanBackground {
  return {
    id: 'bg_1', companyId: 'c', floorId: FLOOR, fileId: 'f', providerId: 'image', providerMetadata: {},
    naturalBounds: { width: 1000, height: 800 }, transform, calibration, opacity: 1, visible: true, locked: false,
    createdAt: 0, updatedAt: 0, createdBy: 'u', updatedBy: 'u',
  };
}

function seed(bg: FloorplanBackground): void {
  useFloorplanBackgroundStore.setState((s) => ({ ...s, floors: { [FLOOR]: { background: bg, isLoading: false, error: null } } }));
  setCommittedBackground(FLOOR, snapshotOf(bg));
}

const current = () => useFloorplanBackgroundStore.getState().floors[FLOOR]?.background;

beforeEach(() => {
  mockPatchCalibration.mockReset();
  mockGetByFloor.mockReset();
  seed(background(OLD, null));
});

describe('commitCalibration', () => {
  it('επιτυχία ⇒ η απάντηση του server γίνεται η αλήθεια (store + δεσμευμένο)', async () => {
    const saved = { ...background(NEW, { ...CALIBRATION, calibratedBy: 'user_real' }), updatedBy: 'user_real' };
    mockPatchCalibration.mockResolvedValue({ background: saved, remap: { overlaysRemapped: 2, overlaysSkipped: 0, atomicWithBackground: true } });
    const result = await commitCalibration(FLOOR, NEW, CALIBRATION);
    expect(result).toEqual({ status: 'saved', overlaysSkipped: 0 });
    expect(mockPatchCalibration).toHaveBeenCalledWith('bg_1', { oldTransform: OLD, newTransform: NEW, calibration: CALIBRATION });
    expect(current()?.calibration?.calibratedBy).toBe('user_real');
    expect(getCommittedBackground(FLOOR)?.transform).toEqual(NEW);
  });

  it('🔴 άλλο σφάλμα ⇒ επαναφορά της προηγούμενης θέσης και χωρίς βαθμονόμηση', async () => {
    mockPatchCalibration.mockRejectedValue(new ApiClientError('boom', 500, 'HTTP_500'));
    const result = await commitCalibration(FLOOR, NEW, CALIBRATION);
    expect(result.status).toBe('failed');
    expect(current()?.transform).toEqual(OLD);
    expect(current()?.calibration).toBeNull();
  });

  it('409 CALIBRATION_STALE ⇒ υιοθετείται η θέση που έχει ο server', async () => {
    const elsewhere = { ...OLD, translateX: 77 };
    mockPatchCalibration.mockRejectedValue(new ApiClientError('stale', 409, CALIBRATION_STALE_ERROR_CODE));
    mockGetByFloor.mockResolvedValue({ background: background(elsewhere, null) });
    const result = await commitCalibration(FLOOR, NEW, CALIBRATION);
    expect(result.status).toBe('conflict');
    expect(current()?.transform).toEqual(elsewhere);
    expect(getCommittedBackground(FLOOR)?.transform).toEqual(elsewhere);
  });

  it('το oldTransform είναι ό,τι ΞΕΡΕΙ ο server, ακόμα κι αν το store έχει ήδη άλλη (αισιόδοξη) θέση', async () => {
    useFloorplanBackgroundStore.getState().setTransform(FLOOR, { translateX: 999 });
    mockPatchCalibration.mockResolvedValue({ background: background(NEW, CALIBRATION), remap: { overlaysRemapped: 0, overlaysSkipped: 0, atomicWithBackground: true } });
    await commitCalibration(FLOOR, NEW, CALIBRATION);
    expect(mockPatchCalibration.mock.calls[0][1].oldTransform).toEqual(OLD);
  });
});

describe('background-write-ledger', () => {
  it('οι εγγραφές ενός ορόφου εκτελούνται με τη σειρά, και μια αποτυχία δεν σταματά την ουρά', async () => {
    const order: string[] = [];
    let release: () => void = () => undefined;
    const gate = new Promise<void>((r) => { release = r; });
    const first = enqueueBackgroundWrite(FLOOR, async () => { await gate; order.push('a'); });
    const failing = enqueueBackgroundWrite(FLOOR, async () => { order.push('b'); throw new Error('x'); });
    const third = enqueueBackgroundWrite(FLOOR, async () => { order.push('c'); });
    release();
    await first;
    await expect(failing).rejects.toThrow('x');
    await third;
    expect(order).toEqual(['a', 'b', 'c']);
  });

  it('όσο εκκρεμεί βαθμονόμηση, το autosave στέλνει τη δεσμευμένη θέση — όχι την αισιόδοξη', () => {
    setCalibrationPending(FLOOR, true);
    expect(transformForAutosave(FLOOR, NEW)).toEqual(OLD);
    setCalibrationPending(FLOOR, false);
    expect(transformForAutosave(FLOOR, NEW)).toEqual(NEW);
  });
});
