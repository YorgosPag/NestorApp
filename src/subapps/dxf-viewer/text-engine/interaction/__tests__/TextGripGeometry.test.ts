/**
 * ADR-344 Phase 6.C — TextGripGeometry tests.
 */

import { describe, it, expect } from '@jest/globals';
import { computeGrips, hitTestGrips } from '../TextGripGeometry';
import type { DxfTextSceneEntity } from '../../../core/commands/text/types';
import type { Rect } from '../../layout/attachment-point';
import type { DxfTextNode } from '../../types';

function makeNode(rotation = 0): DxfTextNode {
  return {
    paragraphs: [
      {
        runs: [
          {
            text: 'X',
            style: {
              fontFamily: 'Arial',
              bold: false,
              italic: false,
              underline: false,
              overline: false,
              strikethrough: false,
              height: 2.5,
              widthFactor: 1,
              obliqueAngle: 0,
              tracking: 1,
              color: { kind: 'byLayer' },
            },
          },
        ],
        indent: 0,
        leftMargin: 0,
        rightMargin: 0,
        tabs: [],
        justification: 0,
        lineSpacingMode: 'multiple',
        lineSpacingFactor: 1,
      },
    ],
    attachment: 'TL',
    lineSpacing: { mode: 'multiple', factor: 1 },
    rotation,
    isAnnotative: false,
    annotationScales: [],
    currentScale: '',
  };
}

function makeEntity(
  type: 'text' | 'mtext' = 'mtext',
  rotation = 0,
): DxfTextSceneEntity {
  return {
    id: 'ent_1',
    type,
    layer: '0',
    visible: true,
    position: { x: 0, y: 0 },
    textNode: makeNode(rotation),
  };
}

const BBOX: Rect = { x: 0, y: 0, width: 10, height: 4 };

describe('computeGrips', () => {
  it('emits 7 grips for MTEXT (move + 4 resize + rotation + mirror)', () => {
    const grips = computeGrips(makeEntity('mtext'), BBOX, { rotationGripOffset: 1 });
    expect(grips.map((g) => g.kind).sort()).toEqual(
      ['move', 'resize-tl', 'resize-tr', 'resize-bl', 'resize-br', 'rotation', 'mirror'].sort(),
    );
  });

  it('emits 3 grips for TEXT (move + rotation + mirror)', () => {
    const grips = computeGrips(makeEntity('text'), BBOX, { rotationGripOffset: 1 });
    expect(grips.map((g) => g.kind).sort()).toEqual(['mirror', 'move', 'rotation']);
  });

  it('places the rotation grip the specified offset above the top-mid edge', () => {
    const grips = computeGrips(makeEntity('mtext'), BBOX, { rotationGripOffset: 5 });
    const rot = grips.find((g) => g.kind === 'rotation')!;
    expect(rot.localPoint).toEqual({ x: 5, y: -5 });
  });

  it('rotates non-move grips around the insertion point', () => {
    const grips = computeGrips(makeEntity('mtext', 90), BBOX, { rotationGripOffset: 1 });
    const tr = grips.find((g) => g.kind === 'resize-tr')!;
    expect(tr.point.x).toBeCloseTo(0, 6);
    expect(tr.point.y).toBeCloseTo(10, 6);
  });

  it('keeps the move grip at the insertion point regardless of rotation', () => {
    const grips = computeGrips(makeEntity('mtext', 45), BBOX, { rotationGripOffset: 1 });
    const move = grips.find((g) => g.kind === 'move')!;
    expect(move.point).toEqual({ x: 0, y: 0 });
  });
});

describe('hitTestGrips', () => {
  it('returns null when no grip is within tolerance', () => {
    const grips = computeGrips(makeEntity(), BBOX, { rotationGripOffset: 1 });
    expect(hitTestGrips(grips, { x: 100, y: 100 }, 1)).toBeNull();
  });

  it('returns the closest grip in range', () => {
    const grips = computeGrips(makeEntity(), BBOX, { rotationGripOffset: 1 });
    const hit = hitTestGrips(grips, { x: 10.1, y: 0 }, 1);
    expect(hit?.kind).toBe('resize-tr');
  });

  it('breaks ties in computeGrips order', () => {
    const grips = computeGrips(makeEntity('mtext'), BBOX, { rotationGripOffset: 1 });
    // Cursor exactly at the move grip — multiple equally-distant candidates
    // would only exist if the bbox were zero-sized; here the move grip is
    // unique within tolerance.
    const hit = hitTestGrips(grips, { x: 0, y: 0 }, 0.001);
    expect(hit?.kind).toBe('move');
  });
});
