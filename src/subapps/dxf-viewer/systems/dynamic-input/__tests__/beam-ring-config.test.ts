/**
 * Unit tests — beam-ring-config (ADR-513): διάταξη δαχτυλιδιού ΔΟΚΟΥ (Μήκος / Γωνία / Πλάτος / Ύψος),
 * full parity με τον τοίχο. Μήκος/Γωνία = ΚΟΙΝΟΙ builders (`DynamicInputLockStore`)· Πλάτος/Ύψος =
 * beam overrides μέσω `beamToolBridgeStore.setParamOverrides` (ίδιο idiom με `wallToolBridgeStore`).
 */

import { BEAM_RING_CONFIG } from '../beam-ring-config';
import { beamToolBridgeStore, type BeamToolBridgeHandle } from '../../../bim/beams/beam-tool-bridge-store';
import type { BeamParamOverrides } from '../../../hooks/drawing/beam-completion';
import { DEFAULT_BEAM_DEPTH_MM, DEFAULT_BEAM_WIDTH_MM } from '../../../bim/types/beam-types';
import type { RingUnitContext } from '../ring-config';

const CTX: RingUnitContext = { displayUnit: 'mm', sceneUnits: 'mm' };

/** Δημοσίευσε ένα fake bridge handle που καταγράφει τα writes (mirror του live useBeamTool publisher). */
function publishHandle(overrides: BeamParamOverrides, captured?: { value: BeamParamOverrides | null }): void {
  const handle: BeamToolBridgeHandle = {
    overrides,
    setParamOverrides: (o) => {
      if (captured) captured.value = o;
    },
    getSceneUnits: () => 'mm',
  };
  beamToolBridgeStore.set(handle);
}

describe('BEAM_RING_CONFIG layout', () => {
  afterEach(() => beamToolBridgeStore.set(null));

  it('έχει 4 πεδία: Μήκος(top) / Γωνία(right) / Πλάτος(left) / Ύψος(bottom)', () => {
    const byKey = new Map(BEAM_RING_CONFIG.fields.map((f) => [f.key, f]));
    expect(BEAM_RING_CONFIG.fields).toHaveLength(4);
    expect(byKey.get('length')?.position).toBe('top');
    expect(byKey.get('angle')?.position).toBe('right');
    expect(byKey.get('width')?.position).toBe('left');
    expect(byKey.get('depth')?.position).toBe('bottom');
  });

  it('όλα τα πεδία είναι numeric (καμία επιλογή/select στη δοκό)', () => {
    expect(BEAM_RING_CONFIG.fields.every((f) => f.kind === 'numeric')).toBe(true);
  });

  it('aria-label = δαχτυλίδι δοκού', () => {
    expect(BEAM_RING_CONFIG.ariaLabelKey).toBe('tools.beam.ringLabel');
  });

  it('labels = tools.beam.ring* (i18n keys, μηδέν hardcoded string)', () => {
    const byKey = new Map(BEAM_RING_CONFIG.fields.map((f) => [f.key, f]));
    expect(byKey.get('length')?.labelKey).toBe('tools.beam.ringLength');
    expect(byKey.get('angle')?.labelKey).toBe('tools.beam.ringAngle');
    expect(byKey.get('width')?.labelKey).toBe('tools.beam.ringWidth');
    expect(byKey.get('depth')?.labelKey).toBe('tools.beam.ringDepth');
  });
});

describe('beam width field (override → beamToolBridgeStore SSoT)', () => {
  afterEach(() => beamToolBridgeStore.set(null));

  const width = () => BEAM_RING_CONFIG.fields.find((f) => f.key === 'width')!;

  it('seed = default πλάτος όταν δεν υπάρχει override (mm display = identity)', () => {
    expect(width().seed(CTX)).toContain(String(DEFAULT_BEAM_WIDTH_MM));
  });

  it('seed = το override όταν έχει οριστεί', () => {
    publishHandle({ width: 300 });
    expect(width().seed(CTX)).toContain('300');
  });

  it('isLocked ⇔ έχει οριστεί override πλάτους', () => {
    expect(width().isLocked()).toBe(false);
    publishHandle({ width: 300 });
    expect(width().isLocked()).toBe(true);
  });

  it('commitNumeric γράφει το πλάτος μέσω setParamOverrides (ίδιο SSoT με το ribbon)', () => {
    const captured: { value: BeamParamOverrides | null } = { value: null };
    publishHandle({}, captured);
    width().commitNumeric?.(320, CTX);
    expect(captured.value).toEqual({ width: 320 });
  });
});

describe('beam depth field (override → beamToolBridgeStore SSoT)', () => {
  afterEach(() => beamToolBridgeStore.set(null));

  const depth = () => BEAM_RING_CONFIG.fields.find((f) => f.key === 'depth')!;

  it('seed = default ύψος όταν δεν υπάρχει override', () => {
    expect(depth().seed(CTX)).toContain(String(DEFAULT_BEAM_DEPTH_MM));
  });

  it('isLocked ⇔ έχει οριστεί override ύψους', () => {
    expect(depth().isLocked()).toBe(false);
    publishHandle({ depth: 600 });
    expect(depth().isLocked()).toBe(true);
  });

  it('commitNumeric διατηρεί τα υπάρχοντα overrides + γράφει το ύψος', () => {
    const captured: { value: BeamParamOverrides | null } = { value: null };
    publishHandle({ width: 300 }, captured);
    depth().commitNumeric?.(700, CTX);
    expect(captured.value).toEqual({ width: 300, depth: 700 });
  });
});
