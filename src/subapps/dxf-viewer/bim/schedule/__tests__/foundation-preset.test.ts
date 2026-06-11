/**
 * ADR-441 Slice 4 — foundation schedule preset + NET pre-pass tests.
 *
 * Επαληθεύει: (1) registry wiring (getPreset('foundation') → FOUNDATION_COLUMNS),
 * (2) mapFoundation cells, (3) `applyFoundationGridNet` μειώνει τον όγκο grid strips
 * (de-dup κόμβων) ενώ αφήνει standalone/non-foundation ως έχουν.
 */

import { buildSchedule, getPreset, type AnyBimEntity } from '../index';
import { FOUNDATION_COLUMNS } from '../schedule-preset-columns';
import type { ScheduleConfig, ScheduleLookups } from '../types';
import { applyFoundationGridNet } from '../../../hooks/data/foundation-boq-feed';
import { buildStripGridFromGuides, type AxisGuideReader } from '../../foundations/foundation-from-grid';
import type { Guide } from '../../../systems/guides/guide-types';
import type { FoundationEntity } from '../../types/foundation-types';

const lookups: ScheduleLookups = {
  floor: (id) => (id ? `Όροφος ${id}` : ''),
  material: (id) => (id ? `Υλικό:${id}` : ''),
  floorFinish: () => undefined,
};

const guide = (id: string, axis: Guide['axis'], offset: number): Guide =>
  ({
    id, axis, offset, visible: true, label: null, style: null,
    locked: false, createdAt: '', parentId: null, groupId: null,
  } as Guide);

function grid2x2(): FoundationEntity[] {
  const guides = [
    guide('x0', 'X', 0), guide('x1', 'X', 4000),
    guide('y0', 'Y', 0), guide('y1', 'Y', 4000),
  ];
  const r: AxisGuideReader = { getGuidesByAxis: (axis) => guides.filter((g) => g.axis === axis) };
  return [...buildStripGridFromGuides(r, {}, '0', 'mm').strips];
}

describe('foundation schedule preset', () => {
  it('getPreset("foundation") → FOUNDATION_COLUMNS', () => {
    expect(getPreset('foundation').columns).toBe(FOUNDATION_COLUMNS);
  });

  it('mapFoundation → σωστά cells (kind/width/thickness/area/volume)', () => {
    const strips = grid2x2();
    const schedule = buildSchedule(strips, { entityType: 'foundation', filters: {} } as ScheduleConfig, lookups);
    expect(schedule.rows).toHaveLength(4);
    const cells = schedule.rows[0].cells;
    expect(cells.kind).toBe('strip');
    expect(cells.width).toBe(600);
    expect(cells.thickness).toBe(400);
    expect(typeof cells.volume).toBe('number');
  });
});

describe('applyFoundationGridNet — pre-pass', () => {
  it('μειώνει τον συνολικό όγκο grid strips (de-dup κόμβων)', () => {
    const strips = grid2x2();
    const gross = strips.reduce((s, e) => s + e.geometry.volume, 0);
    const net = applyFoundationGridNet(strips) as FoundationEntity[];
    const netSum = net.reduce((s, e) => s + e.geometry.volume, 0);
    expect(netSum).toBeLessThan(gross);
    expect(netSum).toBeCloseTo(3.84, 1); // union total 2×2
  });

  it('< 2 grid strips → passthrough (καμία αλλαγή)', () => {
    const [one] = grid2x2();
    const out = applyFoundationGridNet([one]);
    expect(out[0]).toBe(one);
  });

  it('non-foundation entities αμετάβλητα', () => {
    const fake = { id: 'w1', type: 'wall', kind: 'standard' } as unknown as AnyBimEntity;
    const out = applyFoundationGridNet([fake, ...grid2x2()]);
    expect(out[0]).toBe(fake);
  });
});
