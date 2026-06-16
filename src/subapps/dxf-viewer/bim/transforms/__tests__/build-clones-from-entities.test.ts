/**
 * Tests — buildClonesFromEntities (ADR-466 clipboard paste path).
 *
 * The in-floor `buildBimCopyClones` is covered by bim-copy-builder.test.ts; this
 * file exercises the snapshot-based core used by cross-floor paste.
 */
import { buildClonesFromEntities } from '../bim-copy-builder';
import type { SceneEntity } from '../../../core/commands/interfaces';
import type { WallEntity } from '../../types/wall-types';

function makeWall(id = 'wall_src'): WallEntity {
  return {
    id,
    type: 'wall',
    kind: 'straight',
    layerId: 'L',
    params: {
      category: 'exterior',
      start: { x: 0, y: 0, z: 0 },
      end: { x: 4000, y: 0, z: 0 },
      height: 3000,
      thickness: 250,
      flip: false,
    },
    geometry: { bbox: { min: { x: 0, y: -125 }, max: { x: 4000, y: 125 } } },
    validation: { hasCodeViolations: false, violationKeys: [], lastValidatedAt: null },
  } as unknown as WallEntity;
}

function makeLine(id = 'line_1'): SceneEntity {
  return { id, type: 'line', params: { start: { x: 0, y: 0 }, end: { x: 1, y: 1 } } } as unknown as SceneEntity;
}

const PASTE_IN_PLACE = { kind: 'translate', delta: { x: 0, y: 0 } } as const;

describe('ADR-466 — buildClonesFromEntities', () => {
  it('clones a BIM entity with a fresh kind-specific id', () => {
    const wall = makeWall();
    const result = buildClonesFromEntities([wall as unknown as SceneEntity], PASTE_IN_PLACE);
    expect(result.clones).toHaveLength(1);
    expect(result.clones[0].id).not.toBe('wall_src');
    expect(result.clones[0].id.startsWith('wall_')).toBe(true);
    expect(result.skipped).toEqual([]);
  });

  it('paste-in-place keeps the source geometry unchanged', () => {
    const result = buildClonesFromEntities([makeWall() as unknown as SceneEntity], PASTE_IN_PLACE);
    const params = (result.clones[0] as unknown as { params: { start: { x: number }; end: { x: number } } }).params;
    expect(params.start.x).toBe(0);
    expect(params.end.x).toBe(4000);
  });

  it('non-BIM (DXF) sources are returned in skipped, not cloned', () => {
    const result = buildClonesFromEntities([makeLine()], PASTE_IN_PLACE);
    expect(result.clones).toHaveLength(0);
    expect(result.skipped).toEqual(['line_1']);
  });

  it('mixed selection clones only the BIM entity', () => {
    const result = buildClonesFromEntities(
      [makeWall() as unknown as SceneEntity, makeLine()],
      PASTE_IN_PLACE,
    );
    expect(result.clones).toHaveLength(1);
    expect(result.skipped).toEqual(['line_1']);
  });
});
