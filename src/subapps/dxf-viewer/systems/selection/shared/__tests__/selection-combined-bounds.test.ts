/**
 * ADR-394 — Unit tests for calculateCombinedEntityBounds.
 *
 * Verifies the combined-AABB SSoT used by 'Z' (Fit to View Selected) merges
 * DXF, BIM, and mixed selections, and returns null for empty / boundless sets.
 */

import { calculateCombinedEntityBounds, calculateEntityBounds } from '../selection-duplicate-utils';
import type { AnySceneEntity } from '../../../../types/scene';
import { calculateVerticesBounds } from '../../../../utils/geometry/GeometryUtils';
import { projectSceneTextToDxf, type TextSceneShape } from '../../../../bim/text/project-scene-text';
import { resolveTextBox } from '../../../../bim/text/text-box';
import { RECT_CORNERS, rectCornerWorld } from '../../../../bim/grips/rect-frame';

const line = (id: string, x1: number, y1: number, x2: number, y2: number) =>
  ({ id, type: 'line', start: { x: x1, y: y1 }, end: { x: x2, y: y2 } }) as unknown as AnySceneEntity;

const circle = (id: string, cx: number, cy: number, r: number) =>
  ({ id, type: 'circle', center: { x: cx, y: cy }, radius: r }) as unknown as AnySceneEntity;

const wall = (id: string, minX: number, minY: number, maxX: number, maxY: number) =>
  ({
    id,
    type: 'wall',
    geometry: { bbox: { min: { x: minX, y: minY, z: 0 }, max: { x: maxX, y: maxY, z: 3 } } },
  }) as unknown as AnySceneEntity;

/** Minimal single-run textNode (AST) as produced by CreateTextCommand. */
const textNode = (content: string, height: number) =>
  ({ paragraphs: content.split('\n').map(line => ({ runs: [{ text: line, style: { height } }] })) }) as unknown;

/** In-app TEXT: content + height live ONLY in `textNode` (no flat `text`/`height`). */
const inAppText = (id: string, x: number, y: number, content: string, height: number) =>
  ({ id, type: 'text', position: { x, y }, textNode: textNode(content, height) }) as unknown as AnySceneEntity;

/** In-app MTEXT: content in `textNode`, plus a real `width` frame. */
const inAppMText = (id: string, x: number, y: number, content: string, height: number, width: number) =>
  ({ id, type: 'mtext', position: { x, y }, textNode: textNode(content, height), width }) as unknown as AnySceneEntity;

/** Imported TEXT: legacy flat fields (no textNode). */
const flatText = (id: string, x: number, y: number, content: string, height: number) =>
  ({ id, type: 'text', position: { x, y }, text: content, height }) as unknown as AnySceneEntity;

/** Expected AABB = the SAME SSoT visual box the 2D grips/hover/hit-test emit. */
const expectedTextBounds = (entity: AnySceneEntity) => {
  const shape = entity as unknown as TextSceneShape;
  const frame = resolveTextBox(projectSceneTextToDxf(shape, (entity as { id: string }).id));
  return calculateVerticesBounds(RECT_CORNERS.map(corner => rectCornerWorld(frame, corner)));
};

describe('calculateCombinedEntityBounds (ADR-394)', () => {
  it('merges two DXF lines into one AABB', () => {
    const result = calculateCombinedEntityBounds([line('a', 0, 0, 10, 5), line('b', -3, 2, 4, 20)]);
    expect(result).toEqual({ min: { x: -3, y: 0 }, max: { x: 10, y: 20 } });
  });

  it('handles a single DXF circle (center ± radius)', () => {
    const result = calculateCombinedEntityBounds([circle('c', 100, 50, 25)]);
    expect(result).toEqual({ min: { x: 75, y: 25 }, max: { x: 125, y: 75 } });
  });

  it('projects a BIM wall geometry.bbox onto XY', () => {
    const result = calculateCombinedEntityBounds([wall('w', 10, 20, 30, 40)]);
    expect(result).toEqual({ min: { x: 10, y: 20 }, max: { x: 30, y: 40 } });
  });

  it('merges a mixed DXF + BIM selection', () => {
    const result = calculateCombinedEntityBounds([line('a', 0, 0, 5, 5), wall('w', 10, 20, 30, 40)]);
    expect(result).toEqual({ min: { x: 0, y: 0 }, max: { x: 30, y: 40 } });
  });

  it('returns null for an empty selection', () => {
    expect(calculateCombinedEntityBounds([])).toBeNull();
  });

  it('skips entities that yield no bounds and returns null when none do', () => {
    const boundless = { id: 'x', type: 'xline' } as unknown as AnySceneEntity;
    expect(calculateCombinedEntityBounds([boundless])).toBeNull();
  });

  it('ignores boundless entities while keeping valid ones', () => {
    const boundless = { id: 'x', type: 'xline' } as unknown as AnySceneEntity;
    const result = calculateCombinedEntityBounds([boundless, line('a', 1, 1, 2, 8)]);
    expect(result).toEqual({ min: { x: 1, y: 1 }, max: { x: 2, y: 8 } });
  });

  // ADR-557 / ADR-394 — text authored via the Text tool stores content only in `textNode`.
  // The bounds MUST equal the SSoT visual box the grips/hover/hit-test use, so Z frames
  // exactly the drawn glyphs (raw flat `text` was undefined → null → Z did nothing; a
  // char-count heuristic never matched the real font box → "fit" undershot).
  describe('text/mtext (visual-box SSoT parity)', () => {
    it('in-app text (content ONLY in textNode) == the grip/hover visual box', () => {
      const entity = inAppText('t', 100, 200, 'ABC', 10);
      const result = calculateEntityBounds(entity);
      expect(result).not.toBeNull();
      expect(result).toEqual(expectedTextBounds(entity));
    });

    it('yields a non-degenerate box for a single in-app text (Z fills the view)', () => {
      const result = calculateEntityBounds(inAppText('t', 0, 0, 'Hello', 5));
      expect(result).not.toBeNull();
      expect(result!.max.x).toBeGreaterThan(result!.min.x);
      expect(result!.max.y).toBeGreaterThan(result!.min.y);
    });

    it('returns non-null combined bounds for a single in-app text (Z works)', () => {
      expect(calculateCombinedEntityBounds([inAppText('t', 0, 0, 'Hello', 5)])).not.toBeNull();
    });

    it('in-app MTEXT (textNode + width frame) == the grip/hover visual box', () => {
      const entity = inAppMText('m', 0, 0, 'Multi\nLine', 8, 120);
      const result = calculateEntityBounds(entity);
      expect(result).not.toBeNull();
      expect(result).toEqual(expectedTextBounds(entity));
    });

    it('still handles legacy imported text with a flat `text` field', () => {
      const entity = flatText('t', 50, 50, 'XY', 4);
      const result = calculateEntityBounds(entity);
      expect(result).not.toBeNull();
      expect(result).toEqual(expectedTextBounds(entity));
    });

    it('merges a mixed text + line + wall selection into one AABB', () => {
      const result = calculateCombinedEntityBounds([
        inAppText('t', 0, 5, 'A', 5),
        line('l', 10, 0, 12, 8),
        wall('w', -4, -2, 3, 40),
      ]);
      expect(result).not.toBeNull();
      // Wall/line dominate the extremes; the text keeps the box valid.
      expect(result!.min.x).toBeLessThanOrEqual(-4);
      expect(result!.max.y).toBeGreaterThanOrEqual(40);
    });
  });
});
