/**
 * ADR-363 — `bim-ortho-reference` tests.
 *
 * Coverage:
 *   - `getBimOrthoReference` resolves the correct anchor per BIM tool / phase.
 *   - `awaitingAlignment` (wall endPoint set) returns null → free side-pick.
 *   - `isBimOrthoTool` membership.
 *   - `applyBimDrawingConstraint` honours the live `cadToggleState` ortho flag
 *     and projects via `hardOrtho`; no-ops for non-BIM tools / missing anchor /
 *     toggles off.
 */

import {
  getBimOrthoReference,
  isBimOrthoTool,
  applyBimDrawingConstraint,
} from '../bim-ortho-reference';
import { wallPreviewStore } from '../../../bim/walls/wall-preview-store';
import { stairPreviewStore } from '../../../bim/stairs/stair-preview-store';
import { beamPreviewStore } from '../../../bim/beams/beam-preview-store';
import { slabPreviewStore } from '../../../bim/slabs/slab-preview-store';
import { cadToggleState } from '../../../systems/constraints/cad-toggle-state';

describe('bim-ortho-reference', () => {
  beforeEach(() => {
    wallPreviewStore.reset();
    stairPreviewStore.reset();
    beamPreviewStore.reset();
    slabPreviewStore.reset();
    cadToggleState.set(false, false);
  });

  describe('isBimOrthoTool', () => {
    it('1. recognises the four anchored BIM tools', () => {
      expect(isBimOrthoTool('wall')).toBe(true);
      expect(isBimOrthoTool('stair')).toBe(true);
      expect(isBimOrthoTool('beam')).toBe(true);
      expect(isBimOrthoTool('slab')).toBe(true);
    });
    it('2. rejects non-anchored / non-BIM tools', () => {
      expect(isBimOrthoTool('column')).toBe(false);
      expect(isBimOrthoTool('opening')).toBe(false);
      expect(isBimOrthoTool('line')).toBe(false);
      expect(isBimOrthoTool('select')).toBe(false);
    });
  });

  describe('getBimOrthoReference — wall', () => {
    it('3. awaitingEnd → startPoint is the anchor', () => {
      wallPreviewStore.set({
        startPoint: { x: 10, y: 20 },
        endPoint: null,
        curveControl: null,
        polylineVertices: [],
        overrides: {},
      });
      expect(getBimOrthoReference('wall')).toEqual({ x: 10, y: 20 });
    });

    it('4. awaitingAlignment (endPoint set) → null (free side-pick)', () => {
      wallPreviewStore.set({
        startPoint: { x: 10, y: 20 },
        endPoint: { x: 100, y: 20 },
        curveControl: null,
        polylineVertices: [],
        overrides: {},
      });
      expect(getBimOrthoReference('wall')).toBeNull();
    });

    it('5. polyline chain → last vertex is the anchor', () => {
      wallPreviewStore.set({
        startPoint: { x: 0, y: 0 },
        endPoint: null,
        curveControl: null,
        polylineVertices: [{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 50, y: 50 }],
        overrides: {},
      });
      expect(getBimOrthoReference('wall')).toEqual({ x: 50, y: 50 });
    });

    it('6. idle → null', () => {
      expect(getBimOrthoReference('wall')).toBeNull();
    });
  });

  describe('getBimOrthoReference — stair / beam / slab', () => {
    it('7. stair → basePoint', () => {
      stairPreviewStore.set({ basePoint: { x: 5, y: 7 }, direction: null });
      expect(getBimOrthoReference('stair')).toEqual({ x: 5, y: 7 });
    });

    it('8. beam straight → startPoint (no end yet)', () => {
      beamPreviewStore.set({ startPoint: { x: 1, y: 2 }, endPoint: null, kind: 'straight', overrides: {} });
      expect(getBimOrthoReference('beam')).toEqual({ x: 1, y: 2 });
    });

    it('9. beam curved → endPoint anchors the control click', () => {
      beamPreviewStore.set({ startPoint: { x: 1, y: 2 }, endPoint: { x: 9, y: 2 }, kind: 'curved', overrides: {} });
      expect(getBimOrthoReference('beam')).toEqual({ x: 9, y: 2 });
    });

    it('10. slab → last polygon vertex', () => {
      slabPreviewStore.set({ vertices: [{ x: 0, y: 0 }, { x: 10, y: 0 }], overrides: {} });
      expect(getBimOrthoReference('slab')).toEqual({ x: 10, y: 0 });
    });

    it('11. non-BIM tool → null', () => {
      expect(getBimOrthoReference('line')).toBeNull();
    });
  });

  describe('applyBimDrawingConstraint', () => {
    it('12. ortho off + polar off → passes the point through', () => {
      wallPreviewStore.set({
        startPoint: { x: 0, y: 0 }, endPoint: null, curveControl: null,
        polylineVertices: [], overrides: {},
      });
      expect(applyBimDrawingConstraint('wall', { x: 100, y: 30 })).toEqual({ x: 100, y: 30 });
    });

    it('13. ortho on → projects onto the dominant axis from the anchor (horizontal)', () => {
      wallPreviewStore.set({
        startPoint: { x: 0, y: 0 }, endPoint: null, curveControl: null,
        polylineVertices: [], overrides: {},
      });
      cadToggleState.set(true, false);
      // |dx|=100 > |dy|=30 → lock to horizontal: y snaps to anchor.y (0).
      expect(applyBimDrawingConstraint('wall', { x: 100, y: 30 })).toEqual({ x: 100, y: 0 });
    });

    it('14. ortho on → vertical lock when dy dominates', () => {
      wallPreviewStore.set({
        startPoint: { x: 0, y: 0 }, endPoint: null, curveControl: null,
        polylineVertices: [], overrides: {},
      });
      cadToggleState.set(true, false);
      // |dy|=100 > |dx|=30 → lock to vertical: x snaps to anchor.x (0).
      expect(applyBimDrawingConstraint('wall', { x: 30, y: 100 })).toEqual({ x: 0, y: 100 });
    });

    it('15. ortho on but no anchor (idle) → passes through', () => {
      cadToggleState.set(true, false);
      expect(applyBimDrawingConstraint('wall', { x: 30, y: 100 })).toEqual({ x: 30, y: 100 });
    });

    it('16. ortho on but non-BIM tool → passes through', () => {
      cadToggleState.set(true, false);
      expect(applyBimDrawingConstraint('line', { x: 30, y: 100 })).toEqual({ x: 30, y: 100 });
    });

    it('17. ortho on during wall awaitingAlignment → free pick (no lock)', () => {
      wallPreviewStore.set({
        startPoint: { x: 0, y: 0 }, endPoint: { x: 100, y: 0 }, curveControl: null,
        polylineVertices: [], overrides: {},
      });
      cadToggleState.set(true, false);
      expect(applyBimDrawingConstraint('wall', { x: 40, y: 25 })).toEqual({ x: 40, y: 25 });
    });
  });
});
