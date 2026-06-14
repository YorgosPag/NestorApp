/**
 * ADR-457 Slice 4 — column-detail-titleblock unit tests.
 *
 * Verifies the title-block (drawing data) field list emits label + value rows
 * for section / height / concrete / steel / cover and the reinforcement
 * callouts, with the values pulled from the column params + SSoT formatters.
 */

import { buildColumnTitleBlockRegion } from '../column-detail-titleblock';
import type { DetailTitleBlockLabels, RectMm } from '../detail-sheet-types';
import type { ColumnParams } from '../../../types/column-types';

const REGION: RectMm = { x: 290, y: 184, w: 116, h: 87 };

const LABELS: DetailTitleBlockLabels = {
  section: 'Διατομή (mm)', height: 'Ύψος (mm)', concrete: 'Σκυρόδεμα', steel: 'Χάλυβας',
  cover: 'Επικάλυψη (mm)', longitudinal: 'Διαμήκης οπλισμός', stirrups: 'Συνδετήρες',
};

const BASE: ColumnParams = {
  kind: 'rectangular',
  position: { x: 0, y: 0, z: 0 },
  anchor: 'center',
  width: 400,
  depth: 600,
  height: 3000,
  rotation: 0,
  concreteGrade: 'C30/37',
  reinforcement: {
    longitudinal: { diameterMm: 16, count: 8 },
    stirrups: { diameterMm: 8, spacingMm: 200, spacingCriticalMm: 100, type: 'closed-hooked' },
    coverMm: 25,
  },
};

function texts(params: ColumnParams): string[] {
  return buildColumnTitleBlockRegion(params, REGION, LABELS).primitives
    .filter((p): p is Extract<typeof p, { kind: 'text' }> => p.kind === 'text')
    .map((p) => p.text);
}

describe('buildColumnTitleBlockRegion (ADR-457 Slice 4)', () => {
  it('emits the section / height / concrete / steel field values', () => {
    const t = texts(BASE);
    expect(t).toContain('Διατομή (mm)');
    expect(t).toContain('400×600');   // width×depth
    expect(t).toContain('3000');      // height
    expect(t).toContain('C30/37');    // concrete grade from params
    expect(t).toContain('B500C');     // steel grade (REBAR_GRADE SSoT)
  });

  it('emits the reinforcement callouts (cover + longitudinal + stirrups)', () => {
    const t = texts(BASE);
    expect(t).toContain('25');          // cover
    expect(t).toContain('8Ø16');        // formatLongitudinalLabel
    expect(t).toContain('Ø8/100-200');  // formatStirrupsLabel
  });

  it('falls back to the default concrete grade when params omit it', () => {
    const t = texts({ ...BASE, concreteGrade: undefined });
    expect(t).toContain('C25/30'); // DEFAULT_CONCRETE_GRADE
  });

  it('omits reinforcement rows when the column has none', () => {
    const t = texts({ ...BASE, reinforcement: undefined });
    expect(t).toContain('400×600');     // still shows section
    expect(t).not.toContain('8Ø16');    // no longitudinal callout
  });

  it('returns empty for a non-rectangular column', () => {
    expect(buildColumnTitleBlockRegion({ ...BASE, kind: 'circular' }, REGION, LABELS).primitives).toHaveLength(0);
  });
});
