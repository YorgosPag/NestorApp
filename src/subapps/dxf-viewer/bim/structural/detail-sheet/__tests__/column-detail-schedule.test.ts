/**
 * ADR-457 Slice 4 — column-detail-schedule unit tests.
 *
 * Verifies the steel take-off table emits a header, one row per reinforcement
 * family (longitudinal + stirrups/spiral), a total row and the ρ / α footer,
 * pulls its numbers from the quantities/confinement SSoT, and stays empty for
 * unsupported inputs.
 */

import { buildColumnScheduleRegion } from '../column-detail-schedule';
import type { DetailScheduleLabels, RectMm } from '../detail-sheet-types';
import type { ColumnParams } from '../../../types/column-types';

const REGION: RectMm = { x: 290, y: 12, w: 116, h: 168 };

const LABELS: DetailScheduleLabels = {
  mark: 'Στοιχείο', diameter: 'Ø', count: 'Πλήθος', length: 'Μήκος (m)', weight: 'Βάρος (kg)',
  longitudinal: 'Διαμήκεις', stirrups: 'Συνδετήρες', spiral: 'Σπείρα', total: 'Σύνολο',
  ratio: 'ρ', confinement: 'α',
};

const BASE: ColumnParams = {
  kind: 'rectangular',
  position: { x: 0, y: 0, z: 0 },
  anchor: 'center',
  width: 400,
  depth: 400,
  height: 3000,
  rotation: 0,
  baseBinding: 'storey-floor',
  topBinding: 'storey-ceiling',
  baseOffset: 0,
  topOffset: 0,
  reinforcement: {
    longitudinal: { diameterMm: 16, count: 8 },
    stirrups: { diameterMm: 8, spacingMm: 200, spacingCriticalMm: 100, type: 'closed-hooked' },
    coverMm: 25,
  },
};

function texts(params: ColumnParams): string[] {
  return buildColumnScheduleRegion(params, REGION, LABELS).primitives
    .filter((p): p is Extract<typeof p, { kind: 'text' }> => p.kind === 'text')
    .map((p) => p.text);
}

describe('buildColumnScheduleRegion (ADR-457 Slice 4)', () => {
  it('emits header + longitudinal + stirrups + total + ρ/α footer', () => {
    const t = texts(BASE);
    expect(t).toContain('Στοιχείο');     // header
    expect(t).toContain('Διαμήκεις');    // longitudinal row
    expect(t).toContain('Συνδετήρες');   // stirrups row
    expect(t).toContain('Σύνολο');       // total row
    expect(t).toContain('Ø16');          // longitudinal diameter cell
    expect(t).toContain('8');            // longitudinal count cell
    expect(t.some((s) => /^ρ = \d+\.\d{2}%$/.test(s))).toBe(true);
    expect(t.some((s) => /^α = \d+\.\d{2}$/.test(s))).toBe(true);
  });

  it('draws horizontal rules separating the table sections', () => {
    const lines = buildColumnScheduleRegion(BASE, REGION, LABELS).primitives.filter((p) => p.kind === 'line');
    expect(lines.length).toBeGreaterThanOrEqual(2); // under header + above total
  });

  it('labels the transverse row «Σπείρα» when the stirrup type is spiral', () => {
    const spiral: ColumnParams = {
      ...BASE,
      reinforcement: { ...BASE.reinforcement!, stirrups: { ...BASE.reinforcement!.stirrups, type: 'spiral' } },
    };
    const t = texts(spiral);
    expect(t).toContain('Σπείρα');
    expect(t).not.toContain('Συνδετήρες');
  });

  it('ADR-460 — builds schedule for a non-rectangular (circular) column; empty when reinforcement missing', () => {
    expect(buildColumnScheduleRegion({ ...BASE, kind: 'circular' }, REGION, LABELS).primitives.length).toBeGreaterThan(0);
    expect(buildColumnScheduleRegion({ ...BASE, reinforcement: undefined }, REGION, LABELS).primitives).toHaveLength(0);
  });
});
