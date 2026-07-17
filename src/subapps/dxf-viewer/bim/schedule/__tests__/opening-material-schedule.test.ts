/**
 * Tests για ADR-672 Φ Γ (BOQ/schedule hookup) — per-part opening materials
 * (frame/leaf/glass/hardware) feeding the door/window schedule presets.
 *
 * Locks the design decided in ADR-672: the door preset exposes
 * frameMaterial/leafMaterial/hardwareMaterial (no glass — doors are solid),
 * the window preset exposes frameMaterial/glassMaterial/hardwareMaterial (no
 * leaf). Both route through `resolveOpeningMaterial()` (the ADR-611 SSoT),
 * called WITHOUT typeParams — same call shape as the 3D attach pipeline
 * (`bim-three-wall-opening-attach.ts`).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-672-hardware-3d-geometry.md
 * @see ../family-types/resolve-opening-material.ts
 */

import type { OpeningEntity, OpeningKind } from '../../types/opening-types';
import { getPreset } from '../schedule-presets';
import type { ScheduleLookups } from '../types';

// ─── Lookups ──────────────────────────────────────────────────────────────

const lookups: ScheduleLookups = {
  floor: () => 'F',
  material: (id) => (id ? `M:${id}` : ''),
  floorFinish: () => undefined,
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

// ─── Door preset ──────────────────────────────────────────────────────────

describe('door preset — per-part materials (ADR-672 Φ Γ)', () => {
  test('resolves frame/leaf/hardware from params.materials, bmat_* passes through', () => {
    const door = makeOpening('d1', 'door', {
      materials: { frame: 'mat-aluminum', leaf: 'bmat_custom1', hardware: 'mat-brass' },
    });
    const preset = getPreset('door');
    const cells = preset.map(door, lookups);
    expect(cells.frameMaterial).toBe('M:mat-aluminum');
    expect(cells.leafMaterial).toBe('M:bmat_custom1');
    expect(cells.hardwareMaterial).toBe('M:mat-brass');
  });

  test('legacy single `material` folds to frame+leaf, hardware stays default (zero regression)', () => {
    const door = makeOpening('d2', 'door', { material: 'mat-wood' });
    const preset = getPreset('door');
    const cells = preset.map(door, lookups);
    expect(cells.frameMaterial).toBe('M:mat-wood');
    expect(cells.leafMaterial).toBe('M:mat-wood');
    expect(cells.hardwareMaterial).toBe('M:mat-metal');
  });

  test('no material info at all → part defaults (wood/wood/metal)', () => {
    const door = makeOpening('d3', 'door');
    const preset = getPreset('door');
    const cells = preset.map(door, lookups);
    expect(cells.frameMaterial).toBe('M:mat-wood');
    expect(cells.leafMaterial).toBe('M:mat-wood');
    expect(cells.hardwareMaterial).toBe('M:mat-metal');
  });

  test('door columns expose frame/leaf/hardware, no glass column', () => {
    const keys = getPreset('door').columns.map((c) => c.key);
    expect(keys).toContain('frameMaterial');
    expect(keys).toContain('leafMaterial');
    expect(keys).toContain('hardwareMaterial');
    expect(keys).not.toContain('glassMaterial');
    expect(keys).not.toContain('material');
  });
});

// ─── Window preset ────────────────────────────────────────────────────────

describe('window preset — per-part materials (ADR-672 Φ Γ)', () => {
  test('resolves glass from params.materials.glass, frame/hardware stay default', () => {
    const window = makeOpening('w1', 'window', {
      materials: { glass: 'mat-glass-low-e' },
    });
    const preset = getPreset('window');
    const cells = preset.map(window, lookups);
    expect(cells.glassMaterial).toBe('M:mat-glass-low-e');
    expect(cells.frameMaterial).toBe('M:mat-wood');
    expect(cells.hardwareMaterial).toBe('M:mat-metal');
  });

  test('instance materials override — instance wins last', () => {
    const window = makeOpening('w2', 'window', {
      material: 'mat-wood', // legacy → frame+leaf
      materials: { frame: 'mat-pvc' }, // per-part override wins for frame
    });
    const preset = getPreset('window');
    const cells = preset.map(window, lookups);
    expect(cells.frameMaterial).toBe('M:mat-pvc');
  });

  test('window columns expose frame/glass/hardware, no leaf column', () => {
    const keys = getPreset('window').columns.map((c) => c.key);
    expect(keys).toContain('frameMaterial');
    expect(keys).toContain('glassMaterial');
    expect(keys).toContain('hardwareMaterial');
    expect(keys).not.toContain('leafMaterial');
    expect(keys).not.toContain('material');
  });
});
