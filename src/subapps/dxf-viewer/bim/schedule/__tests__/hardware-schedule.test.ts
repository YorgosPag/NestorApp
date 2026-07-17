/**
 * Tests για ADR-674 Φ Β — the HARDWARE SCHEDULE preset (Revit "Door Hardware
 * Schedule" parity). Locks the design: ONE ROW PER OPENING (not per component),
 * a readable `hardwareSet` breakdown column, a `pieces` total, and the shared
 * metal `hardwareMaterial`. The priced per-component explosion lives in the BOQ
 * (Phase C) — this schedule is the readable take-off.
 *
 * The preset reuses `resolveOpeningHardwareSet()` (the ADR-674 Φ Α SSoT) and the
 * candidate route excludes hardware-less kinds (fixed / bay-window /
 * overhead-door / revolving-door) via `openingHasOperableHardware`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-674-opening-hardware-take-off.md
 * @see ../../family-types/opening-hardware-set.ts
 */

import type { OpeningEntity, OpeningKind } from '../../types/opening-types';
import type { OpeningHardwareComponent } from '../../family-types/opening-hardware-set';
import { getPreset } from '../schedule-presets';
import type { AnyBimEntity } from '../schedule-presets';
import { buildSchedule } from '../schedule-builder';
import type { ScheduleLookups } from '../types';

// ─── Lookups ──────────────────────────────────────────────────────────────

const HARDWARE_LABEL_EL: Readonly<Record<OpeningHardwareComponent, string>> = {
  'lever': 'Χειρολαβή',
  'pull-handle': 'Χερούλι συρόμενου',
  'knob': 'Πόμολο',
  'window-handle': 'Χειρολαβή παραθύρου',
  'lockset': 'Κλειδαριά',
  'hinge': 'Μεντεσές',
  'flush-bolt': 'Σύρτης',
  'sliding-track': 'Μηχανισμός συρόμενου',
  'friction-stay': 'Μηχανισμός ανάκλισης',
};

const lookups: ScheduleLookups = {
  floor: () => 'F',
  material: (id) => (id ? `M:${id}` : ''),
  floorFinish: () => undefined,
  translateHardwareComponent: (c) => HARDWARE_LABEL_EL[c],
};

// ─── Fixtures ─────────────────────────────────────────────────────────────

function emptyValidation() {
  return { hasCodeViolations: false, violationKeys: [], lastValidatedAt: null };
}

function makeOpening(
  id: string,
  kind: OpeningKind,
  paramOverrides: Record<string, unknown> = {},
): OpeningEntity {
  return {
    id,
    type: 'opening',
    kind,
    floorId: 'floor-1',
    params: {
      kind,
      wallId: 'wall-1',
      offsetFromStart: 500,
      width: 900,
      height: 2100,
      sillHeight: kind === 'window' ? 900 : 0,
      ...paramOverrides,
    },
    geometry: {
      position: { x: 1000, y: 0 },
      rotation: 0,
      outline: { vertices: [] },
      bbox: { min: { x: 0, y: 0 }, max: { x: 900, y: 2100 } },
      area: 1.89,
      perimeter: 6,
    },
    validation: emptyValidation(),
  } as unknown as OpeningEntity;
}

// ─── Preset mapping (one row per opening) ───────────────────────────────────

describe('hardware preset — one row per opening (ADR-674 Φ Β)', () => {
  test('door breakdown lists each component ×N, ending "Μεντεσές ×3"', () => {
    const door = makeOpening('h1', 'door');
    const cells = getPreset('hardware').map(door, lookups);
    expect(cells.hardwareSet).toBe('Χειρολαβή ×1 · Κλειδαριά ×1 · Μεντεσές ×3');
    expect(String(cells.hardwareSet)).toContain('Μεντεσές ×3');
  });

  test('pieces = Σ quantities (door: 1 + 1 + 3 = 5)', () => {
    const door = makeOpening('h2', 'door');
    const cells = getPreset('hardware').map(door, lookups);
    expect(cells.pieces).toBe(5);
  });

  test('window pieces = 3 (window-handle ×1 + hinge ×2)', () => {
    const window = makeOpening('h3', 'window');
    const cells = getPreset('hardware').map(window, lookups);
    expect(cells.hardwareSet).toBe('Χειρολαβή παραθύρου ×1 · Μεντεσές ×2');
    expect(cells.pieces).toBe(3);
  });

  test('hardwareMaterial resolves to the shared metal default', () => {
    const door = makeOpening('h4', 'door');
    const cells = getPreset('hardware').map(door, lookups);
    expect(cells.hardwareMaterial).toBe('M:mat-metal');
  });

  test('hardwareMaterial honours a per-part hardware override', () => {
    const door = makeOpening('h5', 'door', { materials: { hardware: 'mat-brass' } });
    const cells = getPreset('hardware').map(door, lookups);
    expect(cells.hardwareMaterial).toBe('M:mat-brass');
  });

  test('hardware columns = mark/floor/kind/hardwareSet/pieces/hardwareMaterial', () => {
    const keys = getPreset('hardware').columns.map((c) => c.key);
    expect(keys).toEqual([
      'mark',
      'floor',
      'kind',
      'hardwareSet',
      'pieces',
      'hardwareMaterial',
    ]);
  });

  test('breakdown falls back to raw component enum when no translator wired', () => {
    const door = makeOpening('h6', 'door');
    const cells = getPreset('hardware').map(door, {
      ...lookups,
      translateHardwareComponent: undefined,
    });
    expect(cells.hardwareSet).toBe('lever ×1 · lockset ×1 · hinge ×3');
  });
});

// ─── Candidate selection (hardware-less kinds excluded) ─────────────────────

describe('hardware schedule — candidate selection (ADR-674 Φ Β)', () => {
  test('fixed + bay-window are excluded; operable openings are kept', () => {
    const entities: AnyBimEntity[] = [
      makeOpening('door-1', 'door'),
      makeOpening('sliding-1', 'sliding-window'),
      makeOpening('fixed-1', 'fixed'),
      makeOpening('bay-1', 'bay-window'),
    ];
    const schedule = buildSchedule(entities, { entityType: 'hardware', filters: {} }, lookups);
    const ids = schedule.rows.map((r) => r.entityId);
    expect(ids).toEqual(['door-1', 'sliding-1']);
    expect(ids).not.toContain('fixed-1');
    expect(ids).not.toContain('bay-1');
  });

  test('non-opening entities never enter the hardware schedule', () => {
    const wall = {
      id: 'wall-x',
      type: 'wall',
      kind: 'exterior',
      floorId: 'floor-1',
      params: { material: 'mat-concrete-c25', category: 'structural' },
      geometry: { area: 0, volume: 0, length: 0 },
    } as unknown as AnyBimEntity;
    const schedule = buildSchedule(
      [wall, makeOpening('door-2', 'door')],
      { entityType: 'hardware', filters: {} },
      lookups,
    );
    expect(schedule.rows.map((r) => r.entityId)).toEqual(['door-2']);
  });
});
