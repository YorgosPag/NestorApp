/**
 * ⚓ ADR-929 §6.24 — η βαθμονόμηση ως βήμα του ΕΝΟΣ ιστορικού αναίρεσης (Figma: αναιρείς μόνο τη ΔΙΚΗ σου αλλαγή).
 *
 * Κλειδώνει:
 * - μπαίνει στο ιστορικό μόνο μετά το «saved», και το `execute` εκεί είναι ιδεμποτικό (καμία δεύτερη εγγραφή)·
 * - Ctrl+Z ⇒ γράφει το «πριν» από τη μία πόρτα — και για ΠΡΩΤΗ βαθμονόμηση: «χωρίς» + κλίμακα συλλογής όπως ήταν·
 * - Ctrl+Y ⇒ ξανά το «μετά»·
 * - άλλαξε η κατάσταση στο μεταξύ ⇒ ΚΑΜΙΑ εγγραφή + συμβάν (ποτέ σιωπηλά)·
 * - το κουμπί «Αναίρεση» = Ctrl+Z, μόνο όσο η εντολή είναι η τελευταία.
 */

import type { BackgroundTransform, CalibrationData, FloorplanBackground } from '../../providers/types';
import type { CalibrationSnapshot } from '../../geometry/calibration-snapshot';

type Bg = Pick<FloorplanBackground, 'transform' | 'calibration' | 'scale'>;

let mockBackground: Bg | null = null;
const mockCommitCalibration = jest.fn();
const mockCommitPlacement = jest.fn();

jest.mock('../../stores/floorplanBackgroundStore', () => ({
  getFloorBackground: () => mockBackground,
}));
jest.mock('../commit-calibration', () => ({
  commitCalibration: (...args: unknown[]) => mockCommitCalibration(...args),
  commitPlacement: (...args: unknown[]) => mockCommitPlacement(...args),
}));

import { getGlobalCommandHistory } from '../../../core/commands/CommandHistory';
import { EventBus } from '../../../systems/events/EventBus';
import { changeCalibration, undoIfLast } from '../calibration-command';

const FLOOR = 'flr_1';
const OLD: BackgroundTransform = { translateX: 0, translateY: 0, scaleX: 1, scaleY: 1, rotation: 0 };
const NEW: BackgroundTransform = { translateX: 5, translateY: -3, scaleX: 0.025, scaleY: 0.025, rotation: 0 };
const GALLERY = { unitsPerMeter: 50, sourceUnit: 'pixel' as const };

const calibration = (calibratedAt: number): CalibrationData => ({
  method: 'two-point', pointA: { x: 0, y: 0 }, pointB: { x: 100, y: 0 }, realDistance: 2.05, unit: 'm',
  rotationDerived: false, calibratedAt, calibratedBy: 'u', sceneUnits: 'm',
});

/** Η μία πόρτα: γράφει (αισιόδοξα) τη ζητούμενη κατάσταση στο «store» του test. */
function writesTo(status: 'saved' | 'failed' = 'saved') {
  mockCommitCalibration.mockImplementation(async (_f: string, transform: BackgroundTransform, data: CalibrationData) => {
    if (status === 'saved') mockBackground = { transform, calibration: data, scale: GALLERY };
    return { status, overlaysSkipped: 0 };
  });
  mockCommitPlacement.mockImplementation(async (next: CalibrationSnapshot) => {
    mockBackground = { transform: next.transform, calibration: next.calibration, scale: next.scale ?? undefined };
    return { status: 'saved', overlaysSkipped: 0 };
  });
}

const history = getGlobalCommandHistory();

beforeEach(() => {
  jest.clearAllMocks();
  history.clear();
  mockBackground = { transform: OLD, calibration: null, scale: undefined };
  writesTo();
});

describe('changeCalibration — καταγραφή στο ιστορικό', () => {
  it('saved ⇒ μία εντολή στο ιστορικό, χωρίς δεύτερη εγγραφή (ιδεμποτικό execute)', async () => {
    const { result, command } = await changeCalibration(FLOOR, NEW, calibration(1), 'Βαθμονόμηση');
    expect(result.status).toBe('saved');
    expect(command).not.toBeNull();
    expect(history.getLastCommand()).toBe(command);
    expect(mockCommitPlacement).not.toHaveBeenCalled();
  });

  it('🔴 αποτυχία ⇒ τίποτα στο ιστορικό (ό,τι δεν έμεινε δεν αναιρείται)', async () => {
    writesTo('failed');
    const { command } = await changeCalibration(FLOOR, NEW, calibration(1), 'Βαθμονόμηση');
    expect(command).toBeNull();
    expect(history.getLastCommand()).toBeNull();
  });
});

describe('CalibrationChangeCommand — Ctrl+Z / Ctrl+Y', () => {
  it('Ctrl+Z πρώτης βαθμονόμησης ⇒ πίσω σε «χωρίς», με την κλίμακα συλλογής όπως ήταν (καμία)', async () => {
    await changeCalibration(FLOOR, NEW, calibration(1), 'Βαθμονόμηση');
    history.undo();
    expect(mockCommitPlacement).toHaveBeenCalledWith({ floorId: FLOOR, transform: OLD, calibration: null, scale: null });
  });

  it('Ctrl+Z αντικατάστασης ⇒ ξανά η προηγούμενη βαθμονόμηση· Ctrl+Y ⇒ ξανά η νέα', async () => {
    mockBackground = { transform: OLD, calibration: calibration(1), scale: GALLERY };
    await changeCalibration(FLOOR, NEW, calibration(2), 'Βαθμονόμηση');
    history.undo();
    expect(mockCommitPlacement).toHaveBeenLastCalledWith(expect.objectContaining({ transform: OLD, calibration: calibration(1), scale: GALLERY }));
    history.redo();
    expect(mockCommitPlacement).toHaveBeenLastCalledWith(expect.objectContaining({ transform: NEW, calibration: calibration(2) }));
  });

  it('🔴 η κατάσταση άλλαξε στο μεταξύ (άλλη καρτέλα) ⇒ ΚΑΜΙΑ εγγραφή, και το λέει', async () => {
    const onSkipped = jest.fn();
    const off = EventBus.on('floorplan:calibration-history-skipped', onSkipped);
    await changeCalibration(FLOOR, NEW, calibration(1), 'Βαθμονόμηση');
    mockBackground = { transform: { ...NEW, translateX: 42 }, calibration: calibration(7), scale: undefined };
    history.undo();
    expect(mockCommitPlacement).not.toHaveBeenCalled();
    expect(onSkipped).toHaveBeenCalledWith({ floorId: FLOOR, reason: 'changed-meanwhile' });
    off();
  });
});

describe('undoIfLast — το κουμπί «Αναίρεση» = Ctrl+Z', () => {
  it('τελευταία ⇒ αναιρεί· όχι τελευταία ⇒ false, καμία αναίρεση εκτός σειράς', async () => {
    const { command: first } = await changeCalibration(FLOOR, NEW, calibration(1), 'Α');
    if (first === null) throw new Error('expected a command');
    await changeCalibration(FLOOR, OLD, calibration(2), 'Β');
    expect(undoIfLast(first)).toBe(false);
    expect(mockCommitPlacement).not.toHaveBeenCalled();
    const last = history.getLastCommand();
    if (last === null) throw new Error('expected a command');
    expect(undoIfLast(last)).toBe(true);
  });
});
