/**
 * ADR-408 Φ5 — MEP system colour SSoT tests (palette pick + colour index).
 */

import {
  MEP_SYSTEM_PALETTE,
  pickNextSystemColor,
  buildEntitySystemColorIndex,
  buildEntitySystemColorIntIndex,
  resolveEntitySystemColor,
  hexToThreeInt,
  hexToRgba,
} from '../mep-system-color';
import type { MepSystemEntity, MepSystemParams } from '../../types/mep-system-types';

function sys(id: string, color: string | undefined, members: string[], source: string): MepSystemEntity {
  const params: MepSystemParams = {
    systemType: 'electrical-circuit',
    name: id,
    systemClassification: 'lighting',
    sourceEntityId: source,
    sourceConnectorId: 'out1',
    members: members.map((entityId) => ({ entityId, connectorId: 'c1' })),
    ...(color ? { color } : {}),
  };
  return { id, params };
}

describe('pickNextSystemColor', () => {
  it('returns the first palette colour when there are no systems', () => {
    expect(pickNextSystemColor([])).toBe(MEP_SYSTEM_PALETTE[0]);
  });

  it('avoids an already-used colour (least-used wins)', () => {
    const used = MEP_SYSTEM_PALETTE[0]!;
    const next = pickNextSystemColor([sys('s1', used, [], 'p1')]);
    expect(next).not.toBe(used);
    expect(next).toBe(MEP_SYSTEM_PALETTE[1]);
  });
});

describe('buildEntitySystemColorIndex', () => {
  it('maps source + members to the system colour', () => {
    const color = '#2563eb';
    const index = buildEntitySystemColorIndex([sys('s1', color, ['fx1', 'fx2'], 'pnl1')]);
    expect(resolveEntitySystemColor('pnl1', index)).toBe(color);
    expect(resolveEntitySystemColor('fx1', index)).toBe(color);
    expect(resolveEntitySystemColor('fx2', index)).toBe(color);
    expect(resolveEntitySystemColor('unrelated', index)).toBeNull();
  });

  it('falls back to a deterministic palette colour when none stored', () => {
    const index = buildEntitySystemColorIndex([sys('s1', undefined, ['fx1'], 'pnl1')]);
    const c = resolveEntitySystemColor('fx1', index);
    expect(c).not.toBeNull();
    expect(MEP_SYSTEM_PALETTE).toContain(c);
  });
});

describe('colour conversions', () => {
  it('hexToThreeInt parses #rrggbb and rejects junk', () => {
    expect(hexToThreeInt('#2563eb')).toBe(0x2563eb);
    expect(hexToThreeInt('2563eb')).toBe(0x2563eb);
    expect(hexToThreeInt('nope')).toBeNull();
  });

  it('buildEntitySystemColorIntIndex yields THREE ints', () => {
    const intIndex = buildEntitySystemColorIntIndex([sys('s1', '#2563eb', ['fx1'], 'pnl1')]);
    expect(intIndex.get('fx1')).toBe(0x2563eb);
    expect(intIndex.get('pnl1')).toBe(0x2563eb);
  });

  it('hexToRgba builds an rgba string', () => {
    expect(hexToRgba('#2563eb', 0.18)).toBe('rgba(37, 99, 235, 0.18)');
  });
});
