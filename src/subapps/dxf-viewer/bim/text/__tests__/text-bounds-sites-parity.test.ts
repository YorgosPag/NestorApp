/**
 * ADR-557 Φ-attachment (Φάση B) — bounds-site SSoT parity.
 *
 * Before Φάση B, THREE independent call-sites re-derived a text's bounding box, each with
 * its OWN convention (all attachment/rotation-blind, disagreeing with the culling path that
 * already used `textBoxAABB`):
 *   - `types/entity-bounds.ts` (selection extent / zoom-to-fit) — monospace box DOWNWARD
 *   - `systems/zoom/utils/bounds-entity.ts` (zoom system) — CHAR_WIDTH_WIDE box UPWARD, no MTEXT
 *   - `utils/SmartBoundsManager.ts` (smart fit-to-view) — NO text case at all → text excluded
 *
 * All three now route through the ONE box SSoT (`textBoxAABB(projectSceneTextToDxf(...))`). This
 * contract pins every site to the SSoT for TEXT + MTEXT, and guards that rotation is honoured
 * (the legacy formulas ignored it), so a future regression to a bespoke formula fails here.
 */

import type { Entity, TextEntity, MTextEntity } from '../../../types/entities';
import { getEntityRenderBounds } from '../../../types/entity-bounds';
import { getEntityBounds as getZoomEntityBounds } from '../../../systems/zoom/utils/bounds-entity';
import { SmartBoundsManager } from '../../../utils/SmartBoundsManager';
import { textBoxAABB } from '../text-box';
import { projectSceneTextToDxf } from '../project-scene-text';
// Pin the stub monospace font (0.6 ratio) so the measured advance is deterministic (jsdom canvas
// would otherwise feed machine-dependent metrics), matching the sibling text-box.test.ts.
import { installStubFont } from '../../../text-engine/fonts/__tests__/_stub-font';

let __stubCleanup: () => void;
beforeAll(() => { __stubCleanup = installStubFont(); });
afterAll(() => __stubCleanup());

function textEntity(extra: Partial<TextEntity> = {}): TextEntity {
  return { id: 't1', type: 'text', layerId: 'lyr_test', position: { x: 0, y: 0 }, text: 'DDD', height: 10, ...extra };
}
function mtextEntity(extra: Partial<MTextEntity> = {}): MTextEntity {
  return { id: 'm1', type: 'mtext', layerId: 'lyr_test', position: { x: 0, y: 0 }, text: 'DDD', height: 10, width: 50, ...extra };
}

/** The single source of truth every site must reproduce. */
function ssotAABB(entity: Entity & { id: string }) {
  return textBoxAABB(projectSceneTextToDxf(entity, entity.id));
}

const near = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) < eps;

describe('ADR-557 Φάση B — bounds sites route through the text-box SSoT', () => {
  it.each([
    ['TEXT', textEntity()],
    ['MTEXT (wide frame → hugs)', mtextEntity()],
    ['TEXT rotated 30°', textEntity({ rotation: 30 })],
    ['TEXT widthFactor 2', textEntity({ widthFactor: 2 })],
  ] as const)('%s — entity-bounds ≡ SSoT', (_label, entity) => {
    const expected = ssotAABB(entity);
    expect(getEntityRenderBounds(entity)).toEqual(expected);
  });

  it.each([
    ['TEXT', textEntity()],
    ['MTEXT', mtextEntity()],
    ['TEXT rotated 30°', textEntity({ rotation: 30 })],
  ] as const)('%s — zoom bounds-entity ≡ SSoT (as {min,max})', (_label, entity) => {
    const b = ssotAABB(entity);
    expect(getZoomEntityBounds(entity)).toEqual({
      min: { x: b.minX, y: b.minY },
      max: { x: b.maxX, y: b.maxY },
    });
  });

  it.each([
    ['TEXT', textEntity()],
    ['MTEXT', mtextEntity()],
    ['TEXT rotated 30°', textEntity({ rotation: 30 })],
  ] as const)('%s — SmartBoundsManager scene bounds ≡ SSoT (+width/height)', (_label, entity) => {
    const b = ssotAABB(entity);
    const scene = new SmartBoundsManager().calculateSceneBounds({ entities: [entity] });
    expect(scene).not.toBeNull();
    expect(scene).toEqual({
      minX: b.minX, minY: b.minY, maxX: b.maxX, maxY: b.maxY,
      width: b.maxX - b.minX, height: b.maxY - b.minY,
    });
  });

  it('rotation is honoured — a rotated text yields a DIFFERENT box than an unrotated one', () => {
    // The legacy formulas were rotation-blind (identical bounds for any rotation). Guard the fix.
    const flat = getEntityRenderBounds(textEntity());
    const spun = getEntityRenderBounds(textEntity({ rotation: 45 }));
    const identical =
      near(flat.minX, spun.minX) && near(flat.minY, spun.minY) &&
      near(flat.maxX, spun.maxX) && near(flat.maxY, spun.maxY);
    expect(identical).toBe(false);
  });
});
