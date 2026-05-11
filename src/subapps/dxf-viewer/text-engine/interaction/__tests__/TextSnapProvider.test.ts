/**
 * ADR-344 Phase 6.B — TextSnapProvider tests.
 */

import { describe, it, expect } from '@jest/globals';
import {
  getTextSnapPoints,
  toSnapCandidates,
  type TextSnapKind,
} from '../TextSnapProvider';
import { ExtendedSnapType } from '../../../snapping/extended-types';
import type { DxfTextSceneEntity } from '../../../core/commands/text/types';
import type { Rect } from '../../layout/attachment-point';
import type { DxfTextNode } from '../../types';

function makeNode(rotation = 0): DxfTextNode {
  return {
    paragraphs: [
      {
        runs: [
          {
            text: 'A',
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

function makeEntity(over: Partial<DxfTextSceneEntity> = {}): DxfTextSceneEntity {
  return {
    id: 'ent_1',
    type: 'text',
    layer: '0',
    visible: true,
    position: { x: 0, y: 0 },
    textNode: makeNode(),
    ...over,
  };
}

const BBOX: Rect = { x: 0, y: 0, width: 10, height: 4 };

describe('getTextSnapPoints — taxonomy', () => {
  it('returns exactly 8 snap points', () => {
    const points = getTextSnapPoints(makeEntity(), BBOX);
    expect(points).toHaveLength(8);
  });

  it('emits each kind exactly once in canonical order', () => {
    const expected: readonly TextSnapKind[] = [
      'insertion',
      'corner-tl',
      'corner-tr',
      'corner-bl',
      'corner-br',
      'center',
      'edge-top-mid',
      'edge-bottom-mid',
    ];
    const got = getTextSnapPoints(makeEntity(), BBOX).map((p) => p.kind);
    expect(got).toEqual(expected);
  });

  it('maps each kind to the correct ExtendedSnapType', () => {
    const map = new Map(
      getTextSnapPoints(makeEntity(), BBOX).map((p) => [p.kind, p.snapType]),
    );
    expect(map.get('insertion')).toBe(ExtendedSnapType.INSERTION);
    expect(map.get('center')).toBe(ExtendedSnapType.CENTER);
    expect(map.get('edge-top-mid')).toBe(ExtendedSnapType.MIDPOINT);
    expect(map.get('edge-bottom-mid')).toBe(ExtendedSnapType.MIDPOINT);
    expect(map.get('corner-tl')).toBe(ExtendedSnapType.ENDPOINT);
    expect(map.get('corner-br')).toBe(ExtendedSnapType.ENDPOINT);
  });

  it('descriptions reflect entity type (TEXT vs MTEXT)', () => {
    const text = getTextSnapPoints(makeEntity({ type: 'text' }), BBOX)[0];
    const mtext = getTextSnapPoints(makeEntity({ type: 'mtext' }), BBOX)[0];
    expect(text.description).toMatch(/TEXT/);
    expect(mtext.description).toMatch(/MTEXT/);
  });
});

describe('getTextSnapPoints — geometry (no rotation)', () => {
  it('insertion point matches entity.position exactly', () => {
    const entity = makeEntity({ position: { x: 7, y: 5 } });
    const insertion = getTextSnapPoints(entity, BBOX)[0];
    expect(insertion.point).toEqual({ x: 7, y: 5 });
  });

  it('corners sit at the bbox extents', () => {
    const points = getTextSnapPoints(makeEntity(), BBOX);
    const byKind = new Map(points.map((p) => [p.kind, p.point]));
    expect(byKind.get('corner-tl')).toEqual({ x: 0, y: 0 });
    expect(byKind.get('corner-tr')).toEqual({ x: 10, y: 0 });
    expect(byKind.get('corner-bl')).toEqual({ x: 0, y: 4 });
    expect(byKind.get('corner-br')).toEqual({ x: 10, y: 4 });
  });

  it('center sits at the bbox centroid', () => {
    const points = getTextSnapPoints(makeEntity(), BBOX);
    const center = points.find((p) => p.kind === 'center')!;
    expect(center.point).toEqual({ x: 5, y: 2 });
  });

  it('top/bottom mids sit at the edge midpoints', () => {
    const points = getTextSnapPoints(makeEntity(), BBOX);
    const top = points.find((p) => p.kind === 'edge-top-mid')!;
    const bot = points.find((p) => p.kind === 'edge-bottom-mid')!;
    expect(top.point).toEqual({ x: 5, y: 0 });
    expect(bot.point).toEqual({ x: 5, y: 4 });
  });
});

describe('getTextSnapPoints — rotation', () => {
  it('insertion point is rotation-invariant', () => {
    const points = getTextSnapPoints(
      makeEntity({ position: { x: 3, y: 4 }, textNode: makeNode(90) }),
      BBOX,
    );
    expect(points[0].point).toEqual({ x: 3, y: 4 });
  });

  it('rotates non-insertion points around the insertion point', () => {
    const entity = makeEntity({ position: { x: 0, y: 0 }, textNode: makeNode(90) });
    // Top-right corner local (10, 0) → rotated 90° CCW around origin → (0, 10).
    const points = getTextSnapPoints(entity, BBOX);
    const tr = points.find((p) => p.kind === 'corner-tr')!;
    expect(tr.point.x).toBeCloseTo(0, 6);
    expect(tr.point.y).toBeCloseTo(10, 6);
  });

  it('exposes pre-rotation localPoint untouched', () => {
    const entity = makeEntity({ textNode: makeNode(45) });
    const points = getTextSnapPoints(entity, BBOX);
    const tr = points.find((p) => p.kind === 'corner-tr')!;
    expect(tr.localPoint).toEqual({ x: 10, y: 0 });
  });
});

describe('toSnapCandidates', () => {
  it('maps each TextSnapPoint to a SnapCandidate with the right entityId', () => {
    const points = getTextSnapPoints(makeEntity(), BBOX);
    const candidates = toSnapCandidates(points, { x: 0, y: 0 }, 'ent_42');
    expect(candidates).toHaveLength(8);
    expect(candidates.every((c) => c.entityId === 'ent_42')).toBe(true);
  });

  it('computes distance from the cursor', () => {
    const points = getTextSnapPoints(makeEntity({ position: { x: 0, y: 0 } }), BBOX);
    const candidates = toSnapCandidates(points, { x: 0, y: 0 }, 'ent_1');
    const insertionCandidate = candidates[0];
    expect(insertionCandidate.distance).toBe(0);
    const trCandidate = candidates.find((c) => c.description.includes('top-right'))!;
    expect(trCandidate.distance).toBeCloseTo(10, 6);
  });

  it('assigns INSERTION the highest priority of the three priority tiers', () => {
    const points = getTextSnapPoints(makeEntity(), BBOX);
    const candidates = toSnapCandidates(points, { x: 0, y: 0 }, 'ent_1');
    const byKind = (kind: TextSnapKind) =>
      candidates.find((c) =>
        c.description.includes(
          kind === 'insertion'
            ? 'insertion'
            : kind === 'center'
              ? 'center'
              : 'top-right',
        ),
      )!.priority;
    // INSERTION (2) is lower-numbered (higher priority) than CENTER (3).
    expect(byKind('insertion')).toBeLessThan(byKind('center'));
  });
});
