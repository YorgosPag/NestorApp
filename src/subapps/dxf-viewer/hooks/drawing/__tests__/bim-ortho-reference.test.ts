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
  getWallFaceRelativeBaseAngle,
  resolveWallFaceRelativePolar,
} from '../bim-ortho-reference';
import { wallPreviewStore } from '../../../bim/walls/wall-preview-store';
import { stairPreviewStore } from '../../../bim/stairs/stair-preview-store';
import { beamPreviewStore } from '../../../bim/beams/beam-preview-store';
import { slabPreviewStore } from '../../../bim/slabs/slab-preview-store';
import { cadToggleState } from '../../../systems/constraints/cad-toggle-state';
import { polarTrackingStore } from '../../../systems/constraints/polar-tracking-store';
import {
  setColumnPlacementAnchor,
  clearColumnPlacementAnchor,
} from '../../../systems/cursor/ColumnPlacementAnchorStore';
import { setColumnRotationLock, clearColumnRotationLock } from '../../../systems/cursor/ColumnRotationStore';
import { setColumnTopLeanLock, clearColumnTopLeanLock } from '../../../systems/cursor/ColumnTopLeanStore';
import {
  setPlacementTrackingAnchor,
  clearPlacementTrackingAnchor,
} from '../../../systems/cursor/PlacementTrackingAnchorStore';

describe('bim-ortho-reference', () => {
  beforeEach(() => {
    wallPreviewStore.reset();
    stairPreviewStore.reset();
    beamPreviewStore.reset();
    slabPreviewStore.reset();
    cadToggleState.set(false, false);
    clearColumnPlacementAnchor();
    clearColumnRotationLock();
    clearColumnTopLeanLock();
    clearPlacementTrackingAnchor();
    // ADR-508 relative-polar tests rely on a deterministic 15° increment / no extras.
    polarTrackingStore.setIncrementAngle(15);
    polarTrackingStore.setAdditionalAngles([]);
  });

  describe('isBimOrthoTool', () => {
    it('1. recognises the anchored BIM tools (incl. column, ADR-363 §column-ortho)', () => {
      expect(isBimOrthoTool('wall')).toBe(true);
      expect(isBimOrthoTool('stair')).toBe(true);
      expect(isBimOrthoTool('beam')).toBe(true);
      expect(isBimOrthoTool('slab')).toBe(true);
      expect(isBimOrthoTool('column')).toBe(true);
    });
    it('2. rejects non-anchored / non-BIM tools', () => {
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

    // ADR-363 §wall-ortho-tracking — 1ο σημείο (awaitingStart) πέφτει στο hover-acquired anchor.
    it('6a. awaitingStart + hover tracking anchor → anchor (OTRACK για το 1ο σημείο)', () => {
      setPlacementTrackingAnchor({ x: 250, y: 90 }); // κέντρο διπλανής κολόνας (osnap)
      expect(getBimOrthoReference('wall')).toEqual({ x: 250, y: 90 });
    });
    it('6b. awaitingStart χωρίς tracking anchor → null (καμία osnap σε οντότητα)', () => {
      expect(getBimOrthoReference('wall')).toBeNull();
    });
    it('6c. awaitingEnd (startPoint set) → startPoint ΥΠΕΡΙΣΧΥΕΙ του tracking anchor', () => {
      setPlacementTrackingAnchor({ x: 999, y: 999 });
      wallPreviewStore.set({
        startPoint: { x: 10, y: 20 }, endPoint: null, curveControl: null,
        polylineVertices: [], overrides: {},
      });
      expect(getBimOrthoReference('wall')).toEqual({ x: 10, y: 20 });
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

  describe('getBimOrthoReference — column (ADR-363 §column-ortho)', () => {
    it('11a. no previous column (fresh) → null (1st column unconstrained)', () => {
      expect(getBimOrthoReference('column')).toBeNull();
    });
    it('11b. previous column placed → its centre is the anchor', () => {
      setColumnPlacementAnchor({ x: 300, y: 120 });
      expect(getBimOrthoReference('column')).toEqual({ x: 300, y: 120 });
    });
    it('11c. rotation phase (position locked) → null (2nd click sets ANGLE, not position)', () => {
      setColumnPlacementAnchor({ x: 300, y: 120 });
      setColumnRotationLock({ x: 300, y: 120 }, 'center');
      expect(getBimOrthoReference('column')).toBeNull();
    });
    it('11d. top-lean phase (position locked) → null', () => {
      setColumnPlacementAnchor({ x: 300, y: 120 });
      setColumnTopLeanLock({ x: 300, y: 120 }, 'center', 0);
      expect(getBimOrthoReference('column')).toBeNull();
    });
    it('11e. ortho ON → next column locks H/V to the previous column', () => {
      setColumnPlacementAnchor({ x: 0, y: 0 });
      cadToggleState.set(true, false);
      // |dx|=100 > |dy|=30 → horizontal lock: y snaps to anchor.y (0).
      expect(applyBimDrawingConstraint('column', { x: 100, y: 30 })).toEqual({ x: 100, y: 0 });
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

  // ─── ADR-508 — relative-polar-to-face (wall 2nd click) ─────────────────────
  /** Anchor the wall start at origin with a captured perpendicular-to-face angle. */
  const anchorWall = (faceAngle: number | null): void => {
    wallPreviewStore.set({
      startPoint: { x: 0, y: 0 }, endPoint: null, curveControl: null,
      polylineVertices: [], overrides: {},
      startAnchored: faceAngle !== null,
      startFaceAngle: faceAngle,
    });
  };
  /** Cursor `deg` degrees from origin at `dist`. */
  const at = (deg: number, dist = 100): { x: number; y: number } => {
    const r = (deg * Math.PI) / 180;
    return { x: dist * Math.cos(r), y: dist * Math.sin(r) };
  };

  describe('getWallFaceRelativeBaseAngle', () => {
    it('18. non-wall tool → null', () => {
      anchorWall(90);
      expect(getWallFaceRelativeBaseAngle('beam')).toBeNull();
    });
    it('19. start not face-anchored → null', () => {
      wallPreviewStore.set({
        startPoint: { x: 0, y: 0 }, endPoint: null, curveControl: null,
        polylineVertices: [], overrides: {}, startAnchored: false, startFaceAngle: null,
      });
      expect(getWallFaceRelativeBaseAngle('wall')).toBeNull();
    });
    it('20. anchored awaitingEnd → returns the captured face angle', () => {
      anchorWall(90);
      expect(getWallFaceRelativeBaseAngle('wall')).toBe(90);
    });
    it('21. awaitingAlignment (endPoint set) → null', () => {
      wallPreviewStore.set({
        startPoint: { x: 0, y: 0 }, endPoint: { x: 100, y: 0 }, curveControl: null,
        polylineVertices: [], overrides: {}, startAnchored: true, startFaceAngle: 90,
      });
      expect(getWallFaceRelativeBaseAngle('wall')).toBeNull();
    });
  });

  describe('resolveWallFaceRelativePolar', () => {
    it('22. not anchored → null', () => {
      anchorWall(null);
      expect(resolveWallFaceRelativePolar({ x: 3, y: 100 })).toBeNull();
    });
    it('23. ortho on → null (explicit world H/V lock wins)', () => {
      anchorWall(90);
      cadToggleState.set(true, false);
      expect(resolveWallFaceRelativePolar({ x: 3, y: 100 })).toBeNull();
    });
    it('24. perpendicular-to-face is the 0° relative snap (the flush case)', () => {
      // Horizontal existing face ⇒ perpendicular outward = 90° (north).
      anchorWall(90);
      const res = resolveWallFaceRelativePolar(at(88, 100)); // ~2° off north
      expect(res).not.toBeNull();
      expect(res!.result.isSnapped).toBe(true);
      expect(res!.result.snappedAngle).toBe(90);
      expect(res!.result.point.x).toBeCloseTo(0); // locked onto the perpendicular
    });
    it('25. tilted face (perp=120°): snaps perpendicular AND parallel relative to it', () => {
      anchorWall(120); // face oriented 30°, perpendicular = 120°
      const perp = resolveWallFaceRelativePolar(at(121));
      expect(perp!.result.snappedAngle).toBe(120); // 0° relative = perpendicular
      const parallel = resolveWallFaceRelativePolar(at(31)); // ~ face direction (120-90)
      expect(parallel!.result.snappedAngle).toBe(30); // 90° relative = parallel to face
    });
    it('26. free angle between increments → not snapped (light magnet)', () => {
      anchorWall(90);
      const res = resolveWallFaceRelativePolar(at(82)); // 8° from north, 7° from 90-15
      expect(res!.result.isSnapped).toBe(false);
    });
    it('29. worldPerPixel quantizes the LENGTH in zoom-adaptive steps (reuse alignment SSoT)', () => {
      anchorWall(90); // perpendicular = north
      // worldPerPixel=4 ⇒ adaptiveDistanceStep = niceRound(4·25=100) = 100.
      const res = resolveWallFaceRelativePolar(at(89.7, 237), 4); // ~north, 237 long
      expect(res!.result.snappedAngle).toBe(90); // angle still perpendicular
      expect(res!.result.point.x).toBeCloseTo(0);
      expect(res!.result.point.y).toBeCloseTo(200); // 237 → nearest 100-step = 200
      expect(res!.result.distance).toBe(200);
    });
    it('30. omitting worldPerPixel leaves the raw (un-quantized) length', () => {
      anchorWall(90);
      const res = resolveWallFaceRelativePolar(at(90, 237)); // exactly north
      expect(res!.result.point.y).toBeCloseTo(237); // no length snap
    });
  });

  describe('applyBimDrawingConstraint — face-relative precedence (ADR-508)', () => {
    it('27. anchored wall constrains the 2nd click even with polar OFF', () => {
      anchorWall(90);
      // No toggle on, but face-anchored ⇒ auto magnet locks ~north onto perpendicular.
      expect(applyBimDrawingConstraint('wall', at(88, 100)).x).toBeCloseTo(0);
    });
    it('28. ortho ON overrides the face-relative magnet', () => {
      anchorWall(120); // would otherwise snap perpendicular at 120°
      cadToggleState.set(true, false);
      // |dy|>|dx| at (10, 100) ⇒ ortho vertical lock: x→0, y→100 (NOT the 120° ray).
      expect(applyBimDrawingConstraint('wall', { x: 10, y: 100 })).toEqual({ x: 0, y: 100 });
    });
  });
});
