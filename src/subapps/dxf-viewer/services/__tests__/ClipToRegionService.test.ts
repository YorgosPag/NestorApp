/**
 * ADR-345 Fase 5.5 — Tests for ClipToRegionService.clipText() with textNode.
 *
 * Covers the duck-typing fix: ribbon-drawn TEXT entities carry
 * textNode (DxfTextNode AST) instead of a flat `text: string`.
 */

import { describe, it, expect } from '@jest/globals';
import { ClipToRegionService, type ClipRect } from '../ClipToRegionService';
import type { TextEntity, MTextEntity, HatchEntity, Entity } from '../../types/entities';
import type { DxfTextNode } from '../../text-engine/types';

const rect: ClipRect = { xMin: 0, yMin: 0, xMax: 100, yMax: 100 };

function makeTextNode(text: string, height = 2.5): DxfTextNode {
  return {
    paragraphs: [
      {
        runs: [{ text, style: { fontFamily: 'Arial', bold: false, italic: false, underline: false, overline: false, strikethrough: false, height, widthFactor: 1, obliqueAngle: 0, tracking: 1, color: { kind: 'ByLayer' } } }],
        indent: 0, leftMargin: 0, rightMargin: 0, tabs: [], justification: 0, lineSpacingMode: 'multiple', lineSpacingFactor: 1,
      },
    ],
    attachment: 'TL',
    lineSpacing: { mode: 'multiple', factor: 1 },
    rotation: 0,
    isAnnotative: false,
    annotationScales: [],
    currentScale: '',
  };
}

const svc = new ClipToRegionService();

describe('ClipToRegionService.clipText — textNode entities', () => {
  it('keeps fully-inside ribbon textNode entity unchanged (position retained)', () => {
    const entity: TextEntity = {
      id: 'e1', type: 'text', layerId: 'lyr_0', visible: true,
      position: { x: 10, y: 50 },
      textNode: makeTextNode('AB', 2.5),
    } as unknown as TextEntity;

    const result = svc.clip({ entities: [entity] }, rect);
    expect(result.entities).toHaveLength(1);
  });

  it('returns empty array when entity position is completely outside rect', () => {
    const entity: TextEntity = {
      id: 'e2', type: 'text', layerId: 'lyr_0', visible: true,
      position: { x: 200, y: 200 },
      textNode: makeTextNode('AB', 2.5),
    } as unknown as TextEntity;

    const result = svc.clip({ entities: [entity] }, rect);
    expect(result.entities).toHaveLength(0);
  });

  it('trims single-run textNode text when partially outside', () => {
    // charW = 2.5 * 0.6 = 1.5. Position x=98 → first char occupies [98,99.5], second [99.5,101]
    // Only first char fully inside rect (xMax=100). Second char corner at x=101 > 100.
    const entity: TextEntity = {
      id: 'e3', type: 'text', layerId: 'lyr_0', visible: true,
      position: { x: 98, y: 50 },
      textNode: makeTextNode('AB', 2.5),
    } as unknown as TextEntity;

    const result = svc.clip({ entities: [entity] }, rect);
    // 'A' is fully inside, 'B' is clipped
    expect(result.entities).toHaveLength(1);
    const clipped = result.entities[0] as TextEntity;
    const para = clipped.textNode?.paragraphs[0];
    expect(para?.runs[0]).toBeDefined();
    const run = para?.runs[0];
    expect('text' in (run as object)).toBe(true);
    if ('text' in (run as object)) {
      expect((run as { text: string }).text).toBe('A');
    }
  });

  it('uses DEFAULT_FONT_SIZE (12) when run height is 0', () => {
    // height=0 → charH=12, charW=7.2. 'A' at x=5 → corners at [5, 12.2] horizontally (fully inside 100).
    const entity: TextEntity = {
      id: 'e4', type: 'text', layerId: 'lyr_0', visible: true,
      position: { x: 5, y: 50 },
      textNode: makeTextNode('A', 0),
    } as unknown as TextEntity;

    const result = svc.clip({ entities: [entity] }, rect);
    expect(result.entities).toHaveLength(1);
  });

  it('falls back to legacy e.text when no textNode', () => {
    const entity: TextEntity = {
      id: 'e5', type: 'text', layerId: 'lyr_0', visible: true,
      position: { x: 10, y: 50 },
      text: 'Hello',
      height: 2.5,
    } as unknown as TextEntity;

    const result = svc.clip({ entities: [entity] }, rect);
    expect(result.entities).toHaveLength(1);
  });

  it('moves insertion point only for multi-run mtext (conservative path)', () => {
    const multiRunNode: DxfTextNode = {
      paragraphs: [
        {
          runs: [
            { text: 'Hello', style: { fontFamily: 'Arial', bold: false, italic: false, underline: false, overline: false, strikethrough: false, height: 2.5, widthFactor: 1, obliqueAngle: 0, tracking: 1, color: { kind: 'ByLayer' } } },
            { text: ' World', style: { fontFamily: 'Arial', bold: true, italic: false, underline: false, overline: false, strikethrough: false, height: 2.5, widthFactor: 1, obliqueAngle: 0, tracking: 1, color: { kind: 'ByLayer' } } },
          ],
          indent: 0, leftMargin: 0, rightMargin: 0, tabs: [], justification: 0, lineSpacingMode: 'multiple', lineSpacingFactor: 1,
        },
      ],
      attachment: 'TL',
      lineSpacing: { mode: 'multiple', factor: 1 },
      rotation: 0,
      isAnnotative: false,
      annotationScales: [],
      currentScale: '',
    };

    const entity: MTextEntity = {
      id: 'e6', type: 'mtext', layerId: 'lyr_0', visible: true,
      position: { x: 50, y: 50 },
      textNode: multiRunNode,
    } as unknown as MTextEntity;

    const result = svc.clip({ entities: [entity] }, rect);
    // Multi-run: conservative path → entity kept, full textNode preserved
    expect(result.entities).toHaveLength(1);
    const out = result.entities[0] as MTextEntity;
    expect(out.textNode?.paragraphs[0].runs).toHaveLength(2);
  });
});

function makeHatch(paths: Array<Array<{ x: number; y: number }>>): HatchEntity {
  return { id: 'h1', type: 'hatch', layerId: 'lyr_0', visible: true, boundaryPaths: paths } as unknown as HatchEntity;
}

function makeWall(min: { x: number; y: number }, max: { x: number; y: number }): Entity {
  return { id: 'w1', type: 'wall', layerId: 'lyr_0', visible: true, geometry: { bbox: { min, max } } } as unknown as Entity;
}

describe('ClipToRegionService.clipHatch — γραμμοσκιάσεις (Α: γεωμετρικό clip)', () => {
  it('fully-inside hatch kept (outer loop retained)', () => {
    const hatch = makeHatch([[{ x: 10, y: 10 }, { x: 90, y: 10 }, { x: 90, y: 90 }, { x: 10, y: 90 }]]);
    const result = svc.clip({ entities: [hatch] }, rect);
    expect(result.entities).toHaveLength(1);
    expect((result.entities[0] as HatchEntity).boundaryPaths[0]).toHaveLength(4);
  });

  it('partially-outside hatch → outer loop clipped to rect bounds', () => {
    const hatch = makeHatch([[{ x: 50, y: 50 }, { x: 150, y: 50 }, { x: 150, y: 150 }, { x: 50, y: 150 }]]);
    const result = svc.clip({ entities: [hatch] }, rect);
    expect(result.entities).toHaveLength(1);
    const outer = (result.entities[0] as HatchEntity).boundaryPaths[0];
    expect(outer.length).toBeGreaterThanOrEqual(3);
    for (const p of outer) {
      expect(p.x).toBeGreaterThanOrEqual(0); expect(p.x).toBeLessThanOrEqual(100);
      expect(p.y).toBeGreaterThanOrEqual(0); expect(p.y).toBeLessThanOrEqual(100);
    }
  });

  it('fully-outside hatch → dropped', () => {
    const hatch = makeHatch([[{ x: 200, y: 200 }, { x: 300, y: 200 }, { x: 300, y: 300 }, { x: 200, y: 300 }]]);
    const result = svc.clip({ entities: [hatch] }, rect);
    expect(result.entities).toHaveLength(0);
  });

  it('island loops preserved alongside clipped outer', () => {
    const hatch = makeHatch([
      [{ x: 10, y: 10 }, { x: 90, y: 10 }, { x: 90, y: 90 }, { x: 10, y: 90 }],
      [{ x: 30, y: 30 }, { x: 60, y: 30 }, { x: 60, y: 60 }, { x: 30, y: 60 }],
    ]);
    const result = svc.clip({ entities: [hatch] }, rect);
    expect((result.entities[0] as HatchEntity).boundaryPaths.length).toBe(2);
  });
});

describe('ClipToRegionService.bboxCull — BIM δομικά (Β: all-or-nothing)', () => {
  it('BIM wall fully inside → kept whole', () => {
    const wall = makeWall({ x: 20, y: 20 }, { x: 80, y: 80 });
    const result = svc.clip({ entities: [wall] }, rect);
    expect(result.entities).toHaveLength(1);
  });

  it('BIM wall partially overlapping → kept whole (not cut)', () => {
    const wall = makeWall({ x: 80, y: 80 }, { x: 180, y: 180 });
    const result = svc.clip({ entities: [wall] }, rect);
    expect(result.entities).toHaveLength(1);
    // Geometry untouched — bbox identical to the original (all-or-nothing).
    expect((result.entities[0] as unknown as { geometry: { bbox: { max: { x: number } } } }).geometry.bbox.max.x).toBe(180);
  });

  it('BIM wall fully outside → dropped', () => {
    const wall = makeWall({ x: 200, y: 200 }, { x: 260, y: 260 });
    const result = svc.clip({ entities: [wall] }, rect);
    expect(result.entities).toHaveLength(0);
  });

  it('xline (infinite construction line) far outside → kept', () => {
    const xline = { id: 'x1', type: 'xline', layerId: 'lyr_0', visible: true, basePoint: { x: 500, y: 500 }, direction: { x: 1, y: 0 } } as unknown as Entity;
    const result = svc.clip({ entities: [xline] }, rect);
    expect(result.entities).toHaveLength(1);
  });
});
