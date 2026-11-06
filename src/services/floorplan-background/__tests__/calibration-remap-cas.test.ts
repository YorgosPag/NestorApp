/**
 * ADR-929 Φ5.2γ — η εγγραφή βαθμονόμησης στον server: έλεγχος σύγκρουσης **μέσα** στη συναλλαγή,
 * `calibratedBy` από την ταυτότητα του αιτήματος, και η ίδια κλίμακα για τη συλλογή (μόνο εικόνες).
 *
 * ΤΙ ΗΤΑΝ: η υπηρεσία εμπιστευόταν το `oldTransform` του πελάτη και μετακινούσε τα overlays με αυτό. Αν η
 * θέση είχε αλλάξει από άλλη καρτέλα, η αναπροσαρμογή ήταν σιωπηλά λάθος. Και το `calibratedBy` ήταν `''`.
 */

const mockTxGet = jest.fn();
const mockTxUpdate = jest.fn();
const BG_REF = { path: 'floorplan_backgrounds/bg_1' };
const OVERLAY_QUERY = { path: 'floorplan_overlays?bg_1' };

jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminFirestore: () => ({
    collection: () => ({ doc: () => BG_REF, where: () => ({ where: () => OVERLAY_QUERY }) }),
    runTransaction: async (cb: (tx: unknown) => Promise<unknown>) => cb({ get: mockTxGet, update: mockTxUpdate }),
  }),
}));

import { CalibrationRemapService } from '../calibration-remap.service';
import { BackgroundLockedError, CalibrationStaleError } from '../background-ownership';
import type { BackgroundTransform, CalibrationData } from '@/subapps/dxf-viewer/floorplan-background/providers/types';

const COMPANY = 'comp_1';
const OLD: BackgroundTransform = { translateX: 0, translateY: 0, scaleX: 1, scaleY: 1, rotation: 0 };
const NEW: BackgroundTransform = { translateX: 5, translateY: -3, scaleX: 0.025, scaleY: 0.025, rotation: 0 };
const CALIBRATION: CalibrationData = {
  method: 'two-point',
  pointA: { x: 100, y: 100 },
  pointB: { x: 100, y: 512 },
  realDistance: 10.3,
  unit: 'm',
  rotationDerived: false,
  calibratedAt: 1,
  calibratedBy: 'forged-by-client',
  sceneUnits: 'm',
};

function row(extra: Record<string, unknown> = {}) {
  return {
    companyId: COMPANY,
    transform: OLD,
    locked: false,
    providerId: 'image',
    naturalBounds: { width: 1000, height: 800 },
    ...extra,
  };
}

function primeReads(bg: Record<string, unknown>) {
  mockTxGet.mockImplementation(async (target: unknown) =>
    target === BG_REF ? { exists: true, data: () => bg } : { docs: [] });
}

const INPUT = {
  companyId: COMPANY,
  backgroundId: 'bg_1',
  oldTransform: OLD,
  newTransform: NEW,
  calibration: CALIBRATION,
  updatedBy: 'user_real',
};

function backgroundWrite(): Record<string, unknown> {
  const call = mockTxUpdate.mock.calls.find(([ref]) => ref === BG_REF);
  if (!call) throw new Error('background was not written');
  return call[1] as Record<string, unknown>;
}

beforeEach(() => {
  mockTxGet.mockReset();
  mockTxUpdate.mockReset();
});

describe('CalibrationRemapService.applyCalibration — έλεγχος σύγκρουσης', () => {
  it('ίδια θέση με τον server ⇒ γράφει θέση + βαθμονόμηση στη συναλλαγή', async () => {
    primeReads(row());
    const result = await CalibrationRemapService.applyCalibration(INPUT);
    expect(result).toEqual({ overlaysRemapped: 0, overlaysSkipped: 0, atomicWithBackground: true });
    expect(backgroundWrite().transform).toEqual(NEW);
  });

  it('🔴 ο server έχει άλλη θέση ⇒ CalibrationStaleError, ΚΑΜΙΑ εγγραφή', async () => {
    primeReads(row({ transform: { ...OLD, translateX: 42 } }));
    await expect(CalibrationRemapService.applyCalibration(INPUT)).rejects.toBeInstanceOf(CalibrationStaleError);
    expect(mockTxUpdate).not.toHaveBeenCalled();
  });

  it('κλειδωμένο υπόβαθρο ⇒ BackgroundLockedError μέσα στη συναλλαγή', async () => {
    primeReads(row({ locked: true }));
    await expect(CalibrationRemapService.applyCalibration(INPUT)).rejects.toBeInstanceOf(BackgroundLockedError);
    expect(mockTxUpdate).not.toHaveBeenCalled();
  });
});

describe('CalibrationRemapService.applyCalibration — τι γράφεται', () => {
  it('calibratedBy από την ταυτότητα του αιτήματος, ποτέ από τον πελάτη', async () => {
    primeReads(row());
    await CalibrationRemapService.applyCalibration(INPUT);
    expect((backgroundWrite().calibration as CalibrationData).calibratedBy).toBe('user_real');
  });

  it('εικόνα ⇒ η ίδια κλίμακα και για τη συλλογή (pixel ανά μέτρο)', async () => {
    primeReads(row());
    await CalibrationRemapService.applyCalibration(INPUT);
    const scale = backgroundWrite().scale as { unitsPerMeter: number; sourceUnit: string; calibratedBy: string };
    expect(scale.sourceUnit).toBe('pixel');
    expect(scale.unitsPerMeter).toBeCloseTo(40, 9); // 0,025 m/px ⇒ 40 px/m
    expect(scale.calibratedBy).toBe('user_real');
  });

  it('PDF ⇒ καμία κλίμακα συλλογής (δηλωμένο όριο [Α] του raster-pixel-scale)', async () => {
    primeReads(row({ providerId: 'pdf-page' }));
    await CalibrationRemapService.applyCalibration(INPUT);
    expect(backgroundWrite()).not.toHaveProperty('scale');
  });
});
