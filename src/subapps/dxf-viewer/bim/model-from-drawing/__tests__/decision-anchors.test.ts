/**
 * ADR-929 §6.11 — οι αποφάσεις Δ7 επιβιώνουν όταν η πηγή γραμμών ξαναγεννιέται.
 *
 * Δύο επίπεδα:
 *   · ο ταιριαστής μόνος του (επικάλυψη, ένα-προς-ένα, ορφανές, πλαίσιο πηγής, ιδεμποτία)·
 *   · η πρόταση τοίχων στο σχέδιο δοκιμής: ίδιο σχέδιο μετατοπισμένο λίγα mm ⇒ **άλλα κλειδιά** (το παλιό σφάλμα:
 *     η απόφαση χανόταν), ίδιες αποφάσεις· σχέδιο μετατοπισμένο μακριά ⇒ ορφανές, ορατές, όχι σβησμένες.
 */

import type { Entity } from '../../../types/entities';
import type { Point2D } from '../../../rendering/types/Types';
import type { DetectedRectangle } from '../../walls/wall-in-region';
import {
  decisionAnchorOf,
  decisionAnchorsForKeys,
  imageAnchorFrameId,
  matchDecisionAnchors,
  SCENE_ANCHOR_FRAME,
  type AnchorFrame,
} from '../decision-anchors';
import type { WallProposal, WallProposalInput } from '../wall-proposal';
import { proposeConfirmed } from './confirmed-proposal';
import fixture from './fixtures/floor-plan-lines.json';

const MIN_IOU = 0.5;

/** Αξονικό ορθογώνιο [x,y]→[x+w,y+h]. */
function rect(x: number, y: number, w: number, h: number): DetectedRectangle {
  return {
    polygon: [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }],
    longSide: Math.max(w, h),
    shortSide: Math.min(w, h),
    area: w * h,
  };
}

const keysOf = (rects: readonly DetectedRectangle[]) => new Map(rects.map((r, i) => [r, `k${i}`] as const));

describe('ADR-929 §6.11 — ο ταιριαστής αποφάσεων', () => {
  it('μικρή μετατόπιση: η απόφαση ξαναβρίσκει το ορθογώνιο, με την ΑΠΟΘΗΚΕΥΜΕΝΗ άγκυρα', () => {
    const anchor = decisionAnchorOf(rect(0, 0, 300, 250), SCENE_ANCHOR_FRAME);
    const moved = [rect(4, -3, 302, 249)];
    const d = matchDecisionAnchors(moved, keysOf(moved), [anchor], SCENE_ANCHOR_FRAME, MIN_IOU);
    expect([...d.acceptedKeys]).toEqual(['k0']);
    expect(d.anchorByKey.get('k0')).toBe(anchor);
    expect(d.orphaned).toEqual([]);
  });

  it('χωρίς επικάλυψη: ορφανή — μένει, δεν σβήνεται', () => {
    const anchor = decisionAnchorOf(rect(0, 0, 300, 250), SCENE_ANCHOR_FRAME);
    const far = [rect(5000, 0, 300, 250)];
    const d = matchDecisionAnchors(far, keysOf(far), [anchor], SCENE_ANCHOR_FRAME, MIN_IOU);
    expect(d.acceptedKeys.size).toBe(0);
    expect(d.orphaned).toEqual([anchor]);
    expect(d.anchorByKey.get('k0')).not.toBe(anchor);
  });

  it('επικάλυψη κάτω από το κατώφλι δεν είναι ταυτότητα', () => {
    const anchor = decisionAnchorOf(rect(0, 0, 300, 300), SCENE_ANCHOR_FRAME);
    const half = [rect(150, 0, 300, 300)]; // IoU = 1/3
    const d = matchDecisionAnchors(half, keysOf(half), [anchor], SCENE_ANCHOR_FRAME, MIN_IOU);
    expect(d.acceptedKeys.size).toBe(0);
    expect(d.orphaned).toHaveLength(1);
  });

  it('ένα-προς-ένα: δύο αποφάσεις, ένα ορθογώνιο ⇒ το παίρνει η πιο επικαλυπτόμενη, η άλλη μένει ορφανή', () => {
    const near = decisionAnchorOf(rect(2, 0, 300, 300), SCENE_ANCHOR_FRAME);
    const farther = decisionAnchorOf(rect(60, 0, 300, 300), SCENE_ANCHOR_FRAME);
    const one = [rect(0, 0, 300, 300)];
    const d = matchDecisionAnchors(one, keysOf(one), [farther, near], SCENE_ANCHOR_FRAME, MIN_IOU);
    expect(d.anchorByKey.get('k0')).toBe(near);
    expect(d.orphaned).toEqual([farther]);
  });

  it('πλαίσιο πηγής: νέα κλίμακα της σκηνής (βαθμονόμηση) δεν αλλάζει την ταυτότητα', () => {
    const pixelsAtScale = (s: number): AnchorFrame => ({ id: 'image:bg', toFrame: (p: Point2D) => ({ x: p.x / s, y: p.y / s }) });
    const anchor = decisionAnchorOf(rect(100, 100, 300, 250), pixelsAtScale(1));
    const rescaled = [rect(200, 200, 600, 500)]; // ίδια pixel, διπλάσια μονάδες σκηνής
    const inScene = matchDecisionAnchors(rescaled, keysOf(rescaled), [anchor], SCENE_ANCHOR_FRAME, MIN_IOU);
    const inPixels = matchDecisionAnchors(rescaled, keysOf(rescaled), [anchor], pixelsAtScale(2), MIN_IOU);
    expect(inScene.acceptedKeys.size).toBe(0);
    expect(inPixels.acceptedKeys.has('k0')).toBe(true);
  });

  it('§6.12 — άγκυρα ΑΛΛΗΣ εικόνας, στα ίδια pixel: ορφανή, ποτέ ψευδώς δεμένη', () => {
    const imageOf = (id: string): AnchorFrame => ({ id: imageAnchorFrameId(id), toFrame: (p: Point2D) => p });
    const anchor = decisionAnchorOf(rect(0, 0, 300, 250), imageOf('old'));
    const same = [rect(0, 0, 300, 250)];
    const d = matchDecisionAnchors(same, keysOf(same), [anchor], imageOf('new'), MIN_IOU);
    expect(d.acceptedKeys.size).toBe(0);
    expect(d.orphaned).toEqual([anchor]);
    expect(matchDecisionAnchors(same, keysOf(same), [anchor], imageOf('old'), MIN_IOU).acceptedKeys.has('k0')).toBe(true);
  });

  it('ιδεμποτία: ίδια είσοδος ⇒ ίδια αντιστοίχιση', () => {
    const anchors = [rect(0, 0, 300, 300), rect(400, 0, 300, 300)].map((r) => decisionAnchorOf(r, SCENE_ANCHOR_FRAME));
    const rects = [rect(402, 1, 300, 300), rect(1, 2, 300, 300)];
    const run = () => matchDecisionAnchors(rects, keysOf(rects), anchors, SCENE_ANCHOR_FRAME, MIN_IOU);
    const [a, b] = [run(), run()];
    expect([...a.acceptedKeys]).toEqual([...b.acceptedKeys]);
    expect(a.anchorByKey.get('k0')).toBe(anchors[1]);
    expect(a.anchorByKey.get('k1')).toBe(anchors[0]);
  });
});

describe('ADR-929 §6.11 — αποφάσεις στο σχέδιο δοκιμής μετά από αναπαραγωγή', () => {
  const ENTITIES = fixture.entities as unknown as readonly Entity[];
  const colorOf = (e: Entity): string | null => (e as { color?: string }).color?.toLowerCase() ?? null;
  const inputOf = (entities: readonly Entity[], overrides: Partial<WallProposalInput> = {}): WallProposalInput => ({
    entities, wallColorHex: '#003fff', colorOf, sceneUnits: 'mm', levelId: 'lvl', ...overrides,
  });
  const shifted = (dx: number, dy: number): Entity[] =>
    ENTITIES.map((e) => {
      const raw = e as unknown as Record<string, unknown>;
      const move = (p: unknown) => {
        const q = p as Point2D;
        return { x: q.x + dx, y: q.y + dy };
      };
      const out: Record<string, unknown> = { ...raw };
      for (const field of ['start', 'end', 'center']) if (raw[field]) out[field] = move(raw[field]);
      return out as unknown as Entity;
    });
  const undecided = (p: WallProposal) => p.items.filter((i) => i.status === 'needs-decision').map((i) => i.key);

  const base = proposeConfirmed(inputOf(ENTITIES));
  const decided = decisionAnchorsForKeys(base.decisions, undecided(base));

  it('το σχέδιο δοκιμής έχει αμφίσημα ορθογώνια να αποφασιστούν', () => {
    expect(decided.length).toBeGreaterThan(0);
    expect(decided).toHaveLength(undecided(base).length);
  });

  it('μετατόπιση 3 mm: τα κλειδιά αλλάζουν, οι αποφάσεις ΜΕΝΟΥΝ', () => {
    const next = proposeConfirmed(inputOf(shifted(3, -2), { acceptedDecisions: decided }));
    expect(next.items.map((i) => i.key)).not.toEqual(base.items.map((i) => i.key));
    expect(next.items.filter((i) => i.status === 'needs-decision')).toEqual([]);
    expect(next.decisions.acceptedKeys.size).toBe(decided.length);
    expect(next.decisions.orphaned).toEqual([]);
  });

  it('σχέδιο αλλού: καμία απόφαση δεν εφαρμόζεται σιωπηλά, όλες ορφανές και ορατές', () => {
    const next = proposeConfirmed(inputOf(shifted(100_000, 0), { acceptedDecisions: decided }));
    expect(undecided(next)).toHaveLength(decided.length);
    expect(next.decisions.orphaned).toEqual(decided);
  });
});
