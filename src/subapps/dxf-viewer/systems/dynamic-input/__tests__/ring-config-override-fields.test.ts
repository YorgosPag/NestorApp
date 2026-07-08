/**
 * Unit tests — createOverrideRingFields (ADR-513 SSoT): γενικευμένα numeric override-πεδία
 * δαχτυλιδιού (τοίχος πάχος/ύψος, δοκός πλάτος/ύψος). Ασκεί bridge-vs-preview reader, merge-preserve
 * writer, και το `RingFieldDef` που δομεί (lock/seed/commit) με fake stores (μηδέν DOM/store deps).
 */

import { createOverrideRingFields, type RingUnitContext } from '../ring-config';

interface FakeOverrides {
  thickness?: number;
  height?: number;
}

const CTX: RingUnitContext = { displayUnit: 'mm', sceneUnits: 'mm' };

/** Fake preview store (πάντα παρόν). */
function makePreview(overrides: FakeOverrides) {
  return { get: () => ({ overrides }) };
}

/** Fake bridge store· `captured` καταγράφει τα writes (mirror του live tool publisher). */
function makeBridge(
  overrides: FakeOverrides | null,
  captured?: { value: FakeOverrides | null },
) {
  const handle =
    overrides === null
      ? null
      : { overrides, setParamOverrides: (o: FakeOverrides) => { if (captured) captured.value = o; } };
  return { get: () => handle };
}

describe('createOverrideRingFields — reader', () => {
  it('currentOverrides = preview fallback όταν δεν υπάρχει ενεργό bridge handle', () => {
    const { currentOverrides } = createOverrideRingFields(
      makeBridge(null),
      makePreview({ thickness: 100 }),
    );
    expect(currentOverrides()).toEqual({ thickness: 100 });
  });

  it('currentOverrides = bridge overrides όταν υπάρχει handle (bridge > preview)', () => {
    const { currentOverrides } = createOverrideRingFields(
      makeBridge({ thickness: 250 }),
      makePreview({ thickness: 100 }),
    );
    expect(currentOverrides()).toEqual({ thickness: 250 });
  });
});

describe('createOverrideRingFields — writer', () => {
  it('setOverride διατηρεί τα υπάρχοντα overrides + γράφει το κλειδί', () => {
    const captured: { value: FakeOverrides | null } = { value: null };
    const { setOverride } = createOverrideRingFields(
      makeBridge({ height: 3000 }, captured),
      makePreview({}),
    );
    setOverride('thickness', 200);
    expect(captured.value).toEqual({ height: 3000, thickness: 200 });
  });

  it('setOverride = no-op όταν δεν υπάρχει ενεργό bridge handle', () => {
    const { setOverride } = createOverrideRingFields(makeBridge(null), makePreview({}));
    expect(() => setOverride('thickness', 200)).not.toThrow();
  });
});

describe('createOverrideRingFields — numericOverrideField', () => {
  const build = (overrides: FakeOverrides | null, captured?: { value: FakeOverrides | null }) =>
    createOverrideRingFields(makeBridge(overrides, captured), makePreview({})).numericOverrideField({
      key: 'thickness',
      labelKey: 'tools.wall.ringThickness',
      resolveSeedMm: (o) => o.thickness ?? 150,
    });

  it('key + labelKey + kind numeric', () => {
    const field = build(null);
    expect(field.key).toBe('thickness');
    expect(field.labelKey).toBe('tools.wall.ringThickness');
    expect(field.kind).toBe('numeric');
  });

  it('seed = resolveSeedMm(currentOverrides) σε display units', () => {
    expect(build({ thickness: 220 }).seed(CTX)).toContain('220');
    expect(build(null).seed(CTX)).toContain('150'); // default μέσω resolver
  });

  it('isLocked ⇔ το κλειδί έχει οριστεί στα overrides', () => {
    expect(build(null).isLocked()).toBe(false);
    expect(build({ thickness: 220 }).isLocked()).toBe(true);
  });

  it('commitNumeric = fromDisplay(value) → setOverride', () => {
    const captured: { value: FakeOverrides | null } = { value: null };
    build({}, captured).commitNumeric?.(240, CTX);
    expect(captured.value).toEqual({ thickness: 240 });
  });
});
