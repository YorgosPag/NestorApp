/**
 * ADR-459 Phase 2 — foundation↔column attach coordinator (explicit FK detection).
 *
 * Pure pairing προς τις δύο κατευθύνσεις (νέο πέδιλο → κολόνες· νέα κολόνα →
 * πέδιλο), idempotent (αγγίζει μόνο κολόνες χωρίς footingId). Fixtures cast μέσω
 * `as unknown as Entity` (ίδιο pattern με τον graph test).
 */

import {
  findColumnsOnFooting,
  findFootingForColumn,
} from '../foundation-column-attach-coordinator';
import type { Entity } from '../../../types/entities';

const square = (cx: number, cy: number, half: number) => ({
  vertices: [
    { x: cx - half, y: cy - half, z: 0 },
    { x: cx + half, y: cy - half, z: 0 },
    { x: cx + half, y: cy + half, z: 0 },
    { x: cx - half, y: cy + half, z: 0 },
  ],
});

const pad = {
  id: 'F1',
  type: 'foundation',
  params: { kind: 'pad', topElevationMm: -1000, thicknessMm: 500 },
  geometry: { footprint: square(0, 0, 1000) },
} as unknown as Entity;

const columnAt = (id: string, cx: number, footingId?: string): Entity =>
  ({
    id,
    type: 'column',
    params: { kind: 'rectangular', baseBinding: 'storey-floor', baseOffset: 0, height: 3000, footingId },
    geometry: { footprint: square(cx, 0, 200) },
  } as unknown as Entity);

describe('findColumnsOnFooting (νέο πέδιλο → κολόνες)', () => {
  it('returns columns whose base sits on the footing, skipping the off-footing one', () => {
    const cols = findColumnsOnFooting(pad, [pad, columnAt('C1', 0), columnAt('C2', 5000)]);
    expect(cols).toEqual(['C1']);
  });

  it('idempotent — skips a column that already has a footingId', () => {
    const cols = findColumnsOnFooting(pad, [pad, columnAt('C1', 0, 'F1')]);
    expect(cols).toEqual([]);
  });

  it('non-footing entity → empty', () => {
    expect(findColumnsOnFooting(columnAt('C1', 0), [columnAt('C1', 0)])).toEqual([]);
  });
});

describe('findFootingForColumn (νέα κολόνα → πέδιλο)', () => {
  it('returns the footing under a fresh column', () => {
    expect(findFootingForColumn(columnAt('C1', 0), [pad, columnAt('C1', 0)])).toBe('F1');
  });

  it('returns null for a column off any footing', () => {
    expect(findFootingForColumn(columnAt('C2', 5000), [pad])).toBeNull();
  });

  it('idempotent — returns null when the column already has a footingId', () => {
    expect(findFootingForColumn(columnAt('C1', 0, 'F1'), [pad])).toBeNull();
  });
});
