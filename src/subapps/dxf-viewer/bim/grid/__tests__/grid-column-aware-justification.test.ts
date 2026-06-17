/**
 * ADR-441 — tests column-aware justification (full bearing: δοκάρι/τοίχος ευθυγραμμίζεται
 * με την κολόνα στήριξης, ΔΕΝ προεξέχει). End-to-end μέσω builders.
 * @see ../grid-column-aware-justification.ts
 */

import { resolveColumnAwareJustification } from '../grid-column-aware-justification';
import { buildColumnGridFromGuides } from '../../columns/column-from-grid';
import { buildBeamGridFromGuides } from '../../beams/beam-from-grid';
import { buildWallGridFromGuides } from '../../walls/wall-from-grid';
import { type AxisGuideReader } from '../../foundations/foundation-from-grid';
import type { Guide } from '../../../systems/guides/guide-types';
import type { GuideBinding } from '../../hosting/guide-binding-types';

const guide = (id: string, axis: Guide['axis'], offset: number): Guide =>
  ({
    id, axis, offset, visible: true, label: null, style: null,
    locked: false, createdAt: '', parentId: null, groupId: null,
  } as Guide);

function reader(guides: readonly Guide[]): AxisGuideReader {
  return { getGuidesByAxis: (axis) => guides.filter((g) => g.axis === axis) };
}

const X3 = [guide('x0', 'X', 0), guide('x1', 'X', 4000), guide('x2', 'X', 8000)];
const Y3 = [guide('y0', 'Y', 0), guide('y1', 'Y', 4000), guide('y2', 'Y', 8000)];
const R = () => reader([...X3, ...Y3]);

const extendOf = (bindings: readonly GuideBinding[] | undefined, slot: string) =>
  bindings?.find((b) => b.slot === slot)?.extend;

describe('resolveColumnAwareJustification (pure)', () => {
  const vertBindings: GuideBinding[] = [
    { guideId: 'x0', slot: 'start-x' },
    { guideId: 'x0', slot: 'end-x' },
    { guideId: 'y0', slot: 'start-y' },
    { guideId: 'y1', slot: 'end-y' },
  ];

  it('χωρίς κολόνες → fallback (mode του χρήστη)', () => {
    expect(resolveColumnAwareJustification(vertBindings, [], 'center')).toBe('center');
  });

  it('κολόνα inner στον ίδιο X-άξονα → κληρονομεί την έδρασή της (right=inner αριστερά)', () => {
    const cols = buildColumnGridFromGuides(R(), {}, '0', 'mm', undefined, 'inner').columns;
    // ΟΛΕΣ οι x0 κολόνες έχουν anchor με dx=-0.5 → justification 'right'.
    expect(resolveColumnAwareJustification(vertBindings, cols, 'center')).toBe('right');
  });

  it('κολόνα center → center (καμία εκκεντρότητα)', () => {
    const cols = buildColumnGridFromGuides(R(), {}, '0', 'mm', undefined, 'center').columns;
    expect(resolveColumnAwareJustification(vertBindings, cols, 'right')).toBe('center');
  });

  it('ΟΡΙΖΟΝΤΙΟ segment + κολόνα inner στον κάτω Y-άξονα → κληρονομεί left (όχι right!)', () => {
    // Regression για το anchor↔justification per-direction bug (Y normal=+1 → αντίστροφο).
    const horizBindings: GuideBinding[] = [
      { guideId: 'y0', slot: 'start-y' },
      { guideId: 'y0', slot: 'end-y' },
      { guideId: 'x0', slot: 'start-x' },
      { guideId: 'x1', slot: 'end-x' },
    ];
    const cols = buildColumnGridFromGuides(R(), {}, '0', 'mm', undefined, 'inner').columns;
    expect(resolveColumnAwareJustification(horizBindings, cols, 'center')).toBe('left');
  });
});

describe('full bearing — το σενάριο του χρήστη (κολόνες inner → δοκάρια "center")', () => {
  it('τα δοκάρια ΑΓΝΟΟΥΝ το center & κληρονομούν inner → δεν προεξέχουν', () => {
    const cols = buildColumnGridFromGuides(R(), {}, '0', 'mm', undefined, 'inner').columns;
    // Ο χρήστης ζητά δοκάρια "center", αλλά υπάρχουν περιμετρικές κολόνες inner.
    const beams = buildBeamGridFromGuides(R(), {}, '0', 'mm', cols, 'center').beams;
    const firstVertical = beams[0]; // x0, περιμετρικό
    // Column-aware: κληρονόμησε inner → perpendicular extend +half (ΟΧΙ 0 του center).
    const ext = extendOf(firstVertical.guideBindings, 'start-x');
    expect(ext).toBeDefined();
    expect(ext as number).toBeGreaterThan(0);
    expect(firstVertical.params.startPoint.x).toBeGreaterThan(0);
  });

  it('εσωτερικό δοκάρι (κολόνες center εκεί) μένει κεντραρισμένο', () => {
    const cols = buildColumnGridFromGuides(R(), {}, '0', 'mm', undefined, 'inner').columns;
    const beams = buildBeamGridFromGuides(R(), {}, '0', 'mm', cols, 'center').beams;
    // Μεσαίος κατακόρυφος (x1): οι x1 κολόνες είναι εσωτερικές → anchor center → δοκάρι center.
    const mid = beams.find((b) => b.guideBindings?.some((bd) => bd.slot === 'start-x' && bd.guideId === 'x1'));
    expect(extendOf(mid?.guideBindings, 'start-x')).toBeUndefined();
  });

  it('τοίχοι "outer" + κολόνες inner → οι τοίχοι κληρονομούν inner (δεν βγαίνουν έξω)', () => {
    const cols = buildColumnGridFromGuides(R(), {}, '0', 'mm', undefined, 'inner').columns;
    const walls = buildWallGridFromGuides(R(), {}, '0', 'mm', cols, 'outer').walls;
    const firstVertical = walls[0];
    // inner αριστερά → σώμα +X → start.x > 0 (ΟΧΙ <0 που θα έδινε το outer).
    expect(firstVertical.params.start.x).toBeGreaterThan(0);
  });

  it('ΟΡΙΖΟΝΤΙΑ δοκάρια (μικρές πλευρές) κληρονομούν σωστά → full bearing (regression)', () => {
    const cols = buildColumnGridFromGuides(R(), {}, '0', 'mm', undefined, 'inner').columns;
    const beams = buildBeamGridFromGuides(R(), {}, '0', 'mm', cols, 'center').beams;
    // Οριζόντιο δοκάρι στον κάτω περιμετρικό Y-άξονα (y0).
    const horizBottom = beams.find((b) => {
      const sy = b.guideBindings?.find((x) => x.slot === 'start-y');
      const ey = b.guideBindings?.find((x) => x.slot === 'end-y');
      return !!sy && !!ey && sy.guideId === ey.guideId && sy.guideId === 'y0';
    });
    expect(horizBottom).toBeDefined();
    // inner κάτω → σώμα +Y → start.y > 0 (ΟΧΙ 0 του center, ΟΧΙ <0 του λάθος mapping).
    expect(horizBottom!.params.startPoint.y).toBeGreaterThan(0);
    expect(extendOf(horizBottom!.guideBindings, 'start-y')).toBeGreaterThan(0);
  });
});
