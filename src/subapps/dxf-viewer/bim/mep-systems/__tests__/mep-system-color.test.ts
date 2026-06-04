/**
 * ADR-408 Φ5 — MEP system colour SSoT tests (palette pick + colour index).
 */

import {
  MEP_SYSTEM_PALETTE,
  pickNextSystemColor,
  buildEntitySystemColorIndex,
  buildEntitySystemColorIntIndex,
  resolveEntitySystemColor,
  resolveFittingSystemColor,
  classificationDefaultColor,
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
  it('colours members only — NOT the source panel (Revit: equipment has no circuit colour)', () => {
    const color = '#2563eb';
    const index = buildEntitySystemColorIndex([sys('s1', color, ['fx1', 'fx2'], 'pnl1')]);
    expect(resolveEntitySystemColor('pnl1', index)).toBeNull(); // source panel stays neutral
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

describe('resolveFittingSystemColor (ADR-408 Φ11 — fitting inherits its pipes)', () => {
  it('returns the colour of the first incident pipe that belongs to a system', () => {
    const index = buildEntitySystemColorIndex([sys('s1', '#2563eb', ['pipeA', 'pipeB'], 'src1')]);
    // First incident unassigned, second is a member → the member colour wins.
    expect(resolveFittingSystemColor(['loose', 'pipeB'], index)).toBe('#2563eb');
  });

  it('returns null when none of the incident pipes belong to a system', () => {
    const index = buildEntitySystemColorIndex([sys('s1', '#2563eb', ['pipeA'], 'src1')]);
    expect(resolveFittingSystemColor(['x', 'y'], index)).toBeNull();
    expect(resolveFittingSystemColor([], index)).toBeNull();
  });

  it('is generic over the colour representation (THREE int index for 3D)', () => {
    const intIndex = buildEntitySystemColorIntIndex([sys('s1', '#2563eb', ['pipeA'], 'src1')]);
    expect(resolveFittingSystemColor(['pipeA'], intIndex)).toBe(0x2563eb);
  });
});

describe('colour conversions', () => {
  it('hexToThreeInt parses #rrggbb and rejects junk', () => {
    expect(hexToThreeInt('#2563eb')).toBe(0x2563eb);
    expect(hexToThreeInt('2563eb')).toBe(0x2563eb);
    expect(hexToThreeInt('nope')).toBeNull();
  });

  it('buildEntitySystemColorIntIndex yields THREE ints for members only', () => {
    const intIndex = buildEntitySystemColorIntIndex([sys('s1', '#2563eb', ['fx1'], 'pnl1')]);
    expect(intIndex.get('fx1')).toBe(0x2563eb);
    expect(intIndex.get('pnl1')).toBeUndefined(); // source panel not coloured
  });

  it('hexToRgba builds an rgba string', () => {
    expect(hexToRgba('#2563eb', 0.18)).toBe('rgba(37, 99, 235, 0.18)');
  });
});

describe('classificationDefaultColor (ADR-408 Φ9/Φ10)', () => {
  it('maps plumbing classifications to industry-convention colours', () => {
    expect(classificationDefaultColor('domestic-cold-water')).toBe('#2563eb'); // blue
    expect(classificationDefaultColor('domestic-hot-water')).toBe('#dc2626'); // red
    expect(classificationDefaultColor('sanitary-drainage')).toBe('#b45309'); // brown
    expect(classificationDefaultColor('hydronic-supply')).toBe('#dc2626'); // red
    expect(classificationDefaultColor('hydronic-return')).toBe('#2563eb'); // blue
  });

  it('returns a palette colour (so colour-by-system stays consistent)', () => {
    expect(MEP_SYSTEM_PALETTE).toContain(classificationDefaultColor('domestic-cold-water'));
    expect(MEP_SYSTEM_PALETTE).toContain(classificationDefaultColor('sanitary-drainage'));
  });
});
