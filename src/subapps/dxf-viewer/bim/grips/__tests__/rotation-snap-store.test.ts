/**
 * ADR-397 — `rotation-snap-store` helper tests.
 *
 * `collectEntityGripWorldPoints` is the SSoT projection (grip list → rotation
 * snap-target inputs) shared by BOTH arming sites: the await-base ENTER
 * (`grip-mouse-handlers`) and the centre-pick (`seedRotateFreeStep` via
 * `useUnifiedGripInteraction`). Keeping them on one projection is what lets the
 * rotation-CENTRE pick magnetise to the entity's grips for EVERY entity (text
 * included) exactly like the free-rotate spin.
 */

import { collectEntityGripWorldPoints } from '../rotation-snap-store';

type Grip = { source?: string; entityId?: string; gripIndex: number; position: { x: number; y: number } };

const grip = (source: string, entityId: string, gripIndex: number, x: number, y: number): Grip =>
  ({ source, entityId, gripIndex, position: { x, y } });

describe('collectEntityGripWorldPoints (ADR-397)', () => {
  it('keeps only the DXF grips of the target entity and maps to {entityId,gripIndex,point}', () => {
    const grips: Grip[] = [
      grip('dxf', 'txt1', 0, 10, 20),   // ✓ target
      grip('dxf', 'txt1', 1, 30, 40),   // ✓ target
      grip('dxf', 'col9', 0, 99, 99),   // ✗ other entity
      grip('overlay', 'txt1', 2, 1, 1), // ✗ overlay source
    ];
    const out = collectEntityGripWorldPoints(grips, 'txt1');
    expect(out).toEqual([
      { entityId: 'txt1', gripIndex: 0, point: { x: 10, y: 20 } },
      { entityId: 'txt1', gripIndex: 1, point: { x: 30, y: 40 } },
    ]);
  });

  it('is entity-agnostic — works identically for a text and a column id', () => {
    const grips: Grip[] = [grip('dxf', 'col9', 3, 5, 6)];
    expect(collectEntityGripWorldPoints(grips, 'col9')).toEqual([
      { entityId: 'col9', gripIndex: 3, point: { x: 5, y: 6 } },
    ]);
  });

  it('returns [] when the entity has no DXF grips in the list', () => {
    expect(collectEntityGripWorldPoints([grip('dxf', 'a', 0, 0, 0)], 'missing')).toEqual([]);
    expect(collectEntityGripWorldPoints([], 'x')).toEqual([]);
  });
});
