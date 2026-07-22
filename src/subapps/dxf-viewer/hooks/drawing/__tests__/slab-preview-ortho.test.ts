/**
 * ADR-363 §ortho-wins — the polygon-sketch PREVIEW (slab/roof/column-from-polygon) must honour
 * ORTHO (F8). Regression guard for «η σχεδίαση ΠΛΑΚΑΣ δεν σέβεται το ΟΡΘΟ» (2026-07-22, screenshot):
 * `resolvePolygonPreviewCursor` re-read the immediate OSNAP/grid snap via `resolveEffectivePreviewCursor`
 * and DISCARDED the ortho lock baked into the cursor upstream → diagonal ghost, even though the slab
 * COMMIT (`applyBimDrawingConstraint`) locked to H/V. Here we drive the real `generateSlabPreview`
 * branch and assert the rubber-band's live vertex is axis-aligned with the anchor under ORTHO
 * (and free when ORTHO is off) — i.e. preview ≡ commit.
 */

import { generatePreviewEntity } from '../drawing-preview-generator';
import { slabPreviewStore } from '../../../bim/slabs/slab-preview-store';
import { cadToggleState } from '../../../systems/constraints/cad-toggle-state';

// Force the "effective cursor" (immediate OSNAP/grid read) to an OFF-AXIS point — the exact
// value that used to leak past ORTHO into the ghost.
jest.mock('../../../systems/cursor/ImmediateSnapStore', () => ({
  getImmediateSnap: () => ({ found: true, point: { x: 137, y: 20 }, mode: 'grid' }),
}));

// Vertex face-snap is a pass-through here (no scene targets) — isolates the ortho constraint.
jest.mock('../../../bim/placement/polygon-vertex-snap', () => ({
  resolvePolygonVertexSnap: (p: { x: number; y: number }) => ({ point: p, faceFrame: undefined, targetId: undefined }),
}));

const ANCHOR = { x: 0, y: 0 };
const RAW_CURSOR = { x: 999, y: 999 }; // irrelevant — the mocked immediate snap wins

function lastGhostVertex() {
  // awaitingNextVertex with one committed vertex → rubber-band line [anchor, cursor].
  const preview = generatePreviewEntity('slab', [ANCHOR], RAW_CURSOR, false, jest.fn(), 'mm');
  const verts = (preview as { vertices?: Array<{ x: number; y: number }> }).vertices;
  if (!verts) throw new Error('expected a polyline preview with vertices');
  return verts[verts.length - 1];
}

beforeEach(() => {
  slabPreviewStore.set({ vertices: [ANCHOR], overrides: {} });
});

afterEach(() => {
  cadToggleState.set(false, false);
  slabPreviewStore.reset();
});

describe('slab preview — ORTHO wins over the immediate-snap cursor', () => {
  it('ORTHO on → live vertex locks to the H axis of the anchor (y === anchor.y)', () => {
    cadToggleState.set(true, false); // F8 on
    // effective snap = (137, 20); |dx| > |dy| → horizontal lock → (137, 0).
    expect(lastGhostVertex()).toEqual({ x: 137, y: 0 });
  });

  it('ORTHO off → live vertex keeps the (off-axis) snapped cursor (unchanged behaviour)', () => {
    cadToggleState.set(false, false);
    expect(lastGhostVertex()).toEqual({ x: 137, y: 20 });
  });
});
