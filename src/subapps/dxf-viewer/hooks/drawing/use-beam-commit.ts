/**
 * ADR-363 Phase 5 / ADR-528 — Beam Tool commit handlers.
 *
 * Extracted from `useBeamTool.ts` (SSoT, N.7.1 file-size split). Owns every
 * build+commit path of the beam tool; the orchestrator (`useBeamTool`) keeps
 * the FSM state and the click pipeline and delegates the actual entity
 * construction here. ZERO duplicate beam construction — all paths route
 * through `buildBeamEntity` / `buildDefaultBeamParams` (`beam-completion.ts`).
 *
 * Paths:
 *   - `commitTwoClickFromState`  — straight/cantilever 2-click.
 *   - `commitCurvedFromState`    — curved 3-click (start/end/control).
 *   - `commitForWall` / `commitFromWall` — «Δοκάρι από τοίχο» (2D + 3D bridge).
 *   - `resolveStartAnchor`       — ADR-398 §Smart ghost face-snap of the start.
 *   - `commitSpanFromState`      — ADR-528 per-bay auto-span single-click.
 *   - `commitSpanChain`          — ADR-528 §whole-line Shift+click (N bays).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.7 §6 Phase 5
 * @see docs/centralized-systems/reference/adrs/ADR-528-beam-auto-span-between-structural-members.md
 */

import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import type { Point2D } from '../../rendering/types/Types';
import type { Point3D } from '../../bim/types/bim-base';
import { DEFAULT_BEAM_WIDTH_MM } from '../../bim/types/beam-types';
import type { BeamParams } from '../../bim/types/beam-types';
import { resolveBimCursorSnap } from '../../bim/placement/bim-cursor-snap';
import { buildMemberMagnetOptions } from '../../bim/placement/member-magnet-opts';
import { isBeamCollinearOverlap } from '../../bim/beams/beam-beam-face-snap';
import {
  buildAnchoredBeamParams,
  buildBeamEntity,
  buildDefaultBeamParams,
} from './beam-completion';
import { sceneSnapTargetsStore, selectGhostMembers } from '../../bim/framing/scene-snap-targets';
import { resolveBeamSpanChain, collectSpanSupportOutlines } from '../../bim/framing/beam-span-snap';
import { beamPreviewStore } from '../../bim/beams/beam-preview-store';
import type { SceneUnits } from '../../utils/scene-units';
import type { Entity } from '../../types/entities';
import type { WallEntity } from '../../bim/types/wall-types';
import { pickWallEntityAt, buildBeamFromWall } from '../../bim/beams/beam-from-wall';
import { TOLERANCE_CONFIG } from '../../config/tolerance-config';
import { INITIAL_STATE, type BeamToolState } from './beam-tool-state';

export interface UseBeamCommitDeps {
  readonly stateRef: MutableRefObject<BeamToolState>;
  readonly setState: Dispatch<SetStateAction<BeamToolState>>;
  readonly currentLevelId: string;
  readonly getSceneUnits?: () => SceneUnits;
  readonly getSceneEntities?: () => readonly Entity[];
  readonly onBeamCreated?: (entity: import('../../bim/types/beam-types').BeamEntity) => void;
}

export interface UseBeamCommitResult {
  resetToAwaitingStart(s: BeamToolState): void;
  commitTwoClickFromState(s: BeamToolState, endPoint: Readonly<Point2D>): boolean;
  commitCurvedFromState(s: BeamToolState, controlPoint: Readonly<Point2D>): boolean;
  commitForWall(s: BeamToolState, wall: WallEntity): boolean;
  commitFromWall(s: BeamToolState, point: Readonly<Point2D>): boolean;
  resolveStartAnchor(point: Readonly<Point2D>): { start: Point2D; anchored: boolean; spanEnd?: Point2D };
  commitSpanFromState(s: BeamToolState, start: Readonly<Point2D>, end: Readonly<Point2D>): boolean;
  commitSpanChain(s: BeamToolState, point: Readonly<Point2D>): boolean;
}

export function useBeamCommit(deps: UseBeamCommitDeps): UseBeamCommitResult {
  const { stateRef, setState, currentLevelId, getSceneUnits, getSceneEntities, onBeamCreated } = deps;

  // SSoT reset μετά από commit (συνεχής αλυσίδα): καθάρισμα preview store (next mousemove = cursor dot,
  // όχι stale ghost) + setState σε awaitingStart διατηρώντας kind/placementMode/overrides. **ΕΝΑ σημείο** —
  // πριν ήταν αντιγραμμένο inline σε 2-click/curved/span commits (N.0.2 dedup, Giorgio SSoT audit).
  const resetToAwaitingStart = useCallback((s: BeamToolState) => {
    beamPreviewStore.set({ startPoint: null, endPoint: null, kind: s.kind, overrides: s.overrides });
    setState({ ...INITIAL_STATE, kind: s.kind, placementMode: s.placementMode, overrides: s.overrides, phase: 'awaitingStart' });
  }, [setState]);

  const commitTwoClickFromState = useCallback(
    (s: BeamToolState, endPoint: Readonly<Point2D>): boolean => {
      if (s.startPoint === null) return false;
      const sceneUnits = getSceneUnits?.() ?? 'mm';
      // ADR-363 §5.7 — edge-anchored placement (location line = παρειά, Revit-style)
      // + side-face auto-flush. Τα column footprints διαβάζονται από το preview store
      // (συγχρονισμένα στο 1ο κλικ μέσω `syncSceneTargetsToStore`) ώστε το justification να
      // είναι ΤΑΥΤΟΣΗΜΟ με το preview WYSIWYG ghost (preview === commit).
      // Straight/cantilever μόνο· curved κρατά centerline (commitCurvedFromState).
      // ADR-398 §Smart beam ghost — αν το start κλειδώθηκε από face-snap (centerline),
      // commit centerline (ΟΧΙ location-line auto-flush) ώστε commit === preview.
      const preview = beamPreviewStore.get();
      // ADR-398 §3.10 — face-snap στόχοι από το ΚΟΙΝΟ scene store (preview === commit)· δοκάρι = beam+slab.
      const targets = sceneSnapTargetsStore.get();
      // ADR-398 §3.6 — ΑΠΑΓΟΡΕΥΣΗ τοποθέτησης δοκαριού ομοαξονικά/πάνω σε υφιστάμενο
      // (duplication — «extend instead»). Το κόκκινο awaitingEnd ghost ήδη το δείχνει·
      // εδώ μπλοκάρεται το commit (silent — ο χρήστης σύρει αλλού). Κάθετο Τ-framing OK.
      if (isBeamCollinearOverlap(s.startPoint, endPoint, selectGhostMembers(targets, ['beam', 'slab']))) {
        return false;
      }
      const params = preview.startAnchored
        ? buildDefaultBeamParams(s.startPoint, endPoint, s.kind, s.overrides, sceneUnits)
        : buildAnchoredBeamParams(s.startPoint, endPoint, s.kind, s.overrides, sceneUnits, targets.footprints);
      const result = buildBeamEntity(params, currentLevelId, sceneUnits);
      if (!result.ok) {
        setState({ ...s, error: result.hardErrors[0] ?? null });
        return false;
      }
      onBeamCreated?.(result.entity);
      resetToAwaitingStart(s); // SSoT: cursor dot στο επόμενο mousemove (όχι stale ghost) + awaitingStart
      return true;
    },
    [currentLevelId, getSceneUnits, onBeamCreated, resetToAwaitingStart, setState],
  );

  const commitCurvedFromState = useCallback(
    (s: BeamToolState, controlPoint: Readonly<Point2D>): boolean => {
      if (s.startPoint === null || s.endPoint === null) return false;
      const sceneUnits = getSceneUnits?.() ?? 'mm';
      const base = buildDefaultBeamParams(s.startPoint, s.endPoint, 'curved', s.overrides, sceneUnits);
      const curveControl: Point3D = { x: controlPoint.x, y: controlPoint.y, z: 0 };
      const params: BeamParams = { ...base, kind: 'curved', curveControl };
      const result = buildBeamEntity(params, currentLevelId, sceneUnits);
      if (!result.ok) {
        setState({ ...s, error: result.hardErrors[0] ?? null });
        return false;
      }
      onBeamCreated?.(result.entity);
      resetToAwaitingStart(s); // SSoT: cursor dot στο επόμενο mousemove (όχι stale ghost) + awaitingStart
      return true;
    },
    [currentLevelId, getSceneUnits, onBeamCreated, resetToAwaitingStart, setState],
  );

  // ── from-wall commit core (shared by 2D point-pick + 3D mesh-pick) ────────
  // Builds ONE beam on the wall's axis via the SSoT `buildBeamFromWall` and
  // appends it through `onBeamCreated`. The wall is resolved upstream (2D: by
  // point hit-test; 3D: by raycast id), so this core never re-picks — ZERO
  // duplication between the two entry points.
  const commitForWall = useCallback(
    (s: BeamToolState, wall: WallEntity): boolean => {
      const sceneUnits = getSceneUnits?.() ?? 'mm';
      const result = buildBeamFromWall(wall, s.overrides, currentLevelId, sceneUnits);
      if (!result.ok) {
        setState({ ...s, error: result.hardErrors[0] ?? null });
        return false;
      }
      onBeamCreated?.(result.entity);
      // Continuous: stay in awaitingStart for the next wall pick.
      setState({ ...s, phase: 'awaitingStart', startPoint: null, endPoint: null, error: null });
      return true;
    },
    [currentLevelId, getSceneUnits, onBeamCreated, setState],
  );

  // ── from-wall commit (2D: 1-click pick a wall → beam on its axis) ─────────
  const commitFromWall = useCallback(
    (s: BeamToolState, point: Readonly<Point2D>): boolean => {
      const entities = getSceneEntities?.() ?? [];
      // Tolerance mirrors the click-time snap tolerance used elsewhere (world units).
      const tol = TOLERANCE_CONFIG.HIT_TEST_FALLBACK;
      const wall = pickWallEntityAt(point, entities, tol);
      if (!wall) {
        setState({ ...s, error: 'tools.beam.errorNoWall' });
        return false;
      }
      return commitForWall(s, wall);
    },
    [getSceneEntities, commitForWall, setState],
  );

  // ADR-398 §Smart beam ghost — το 1ο κλικ κλειδώνει το START. Αν ο κέρσορας
  // κούμπωνε σε παρειά κολόνας (face-snap), κλειδώνουμε στο προτεινόμενο centerline
  // (ΟΧΙ στον raw cursor) + σημαία `anchored` ώστε το 2ο κλικ να τραβά centerline
  // (χωρίς location-line auto-flush). Καλεί τον ΙΔΙΟ resolver με το preview (το store
  // έχει ήδη συγχρονισμένες κολόνες) → preview === commit.
  const resolveStartAnchor = useCallback(
    (point: Readonly<Point2D>): { start: Point2D; anchored: boolean; spanEnd?: Point2D } => {
      const widthMm = stateRef.current.overrides.width ?? DEFAULT_BEAM_WIDTH_MM;
      const sceneUnits = getSceneUnits?.() ?? 'mm';
      // ADR-398 §3.10 — snap σε τοίχους+δοκάρια+πλάκες+γραμμές (Giorgio 2026-06-24 «ίδια με κολόνα»·
      // preview === commit· ΙΔΙΟ target set με το `makeBeamGhostBeforeClick`).
      const targets = sceneSnapTargetsStore.get();
      // ADR-398 §3.13/§3.15 — Polar/Rect Magnet opts (ΙΔΙΑ με το preview `makeBeamGhostBeforeClick`) →
      // το magnet κούμπωμα στο 1ο κλικ ταυτίζεται με το φάντασμα (preview ≡ commit).
      const magnetOpts = buildMemberMagnetOptions(widthMm, sceneUnits);
      // ADR-514 Φ3 — «Ένας Εγκέφαλος Έλξης»: ΕΝΑ unified entry (toolKind:'beam', kinds beam+slab).
      // ⚠️ ADR-514 §2 — ο `point` έρχεται ήδη OSNAP-snapped από το click pipeline → ΧΩΡΙΣ findSnapPoint
      // (anti double-snap). ΙΔΙΟ entry με το preview (`makeBeamGhostBeforeClick`) → preview ≡ commit.
      // ADR-528 — auto-span gating ΙΔΙΟ με το preview (kind !== 'curved') → preview ≡ commit by construction.
      const snap = resolveBimCursorSnap({ toolKind: 'beam', cursor: point, targets, sceneUnits, memberWidthMm: widthMm, memberKinds: ['wall', 'beam', 'slab', 'line'], magnetOpts, beamSpanGhost: stateRef.current.kind !== 'curved' });
      if (snap.kind === 'member-placement') {
        // ADR-528 — πλήρες auto-span (γέφυρα δύο μελών): single-click → commit ΚΑΙ τα δύο άκρα flush.
        if (snap.placement.span) {
          return { start: snap.placement.start, anchored: true, spanEnd: snap.placement.end };
        }
        return { start: snap.placement.start, anchored: true };
      }
      return { start: { x: point.x, y: point.y }, anchored: false };
    },
    [stateRef, getSceneUnits],
  );

  // ── ADR-528 auto-span single-click commit ─────────────────────────────────
  // SSoT (ADR-528 — μηδέν διπλότυπο build): χτίζει + append-άρει ΕΝΑ centerline δοκάρι (start→end ήδη flush
  // στις παρειές, ΟΧΙ location-line auto-flush). Επιστρέφει το αποτέλεσμα ώστε ο caller να χειριστεί
  // error/state. Μοιράζεται από per-bay (`commitSpanFromState`) ΚΑΙ whole-line (`commitSpanChain`).
  const appendCenterlineBeam = useCallback(
    (s: BeamToolState, start: Readonly<Point2D>, end: Readonly<Point2D>, sceneUnits: SceneUnits) => {
      const params = buildDefaultBeamParams(start, end, s.kind, s.overrides, sceneUnits);
      const result = buildBeamEntity(params, currentLevelId, sceneUnits);
      if (result.ok) onBeamCreated?.(result.entity);
      return result;
    },
    [currentLevelId, onBeamCreated],
  );

  // Όταν ο cursor αναγνωρίσει το ζεύγος μελών (νοητή ευθεία), το ΠΡΩΤΟ κλικ commit-άρει ολόκληρο το δοκάρι
  // του φατνώματος. Το weld το αναλαμβάνει ο `useStructuralAutoAttach` στο entity-created. Mirror ADR-525.
  const commitSpanFromState = useCallback(
    (s: BeamToolState, start: Readonly<Point2D>, end: Readonly<Point2D>): boolean => {
      const result = appendCenterlineBeam(s, start, end, getSceneUnits?.() ?? 'mm');
      if (!result.ok) {
        setState({ ...s, error: result.hardErrors[0] ?? null });
        return false;
      }
      resetToAwaitingStart(s);
      return true;
    },
    [getSceneUnits, appendCenterlineBeam, resetToAwaitingStart, setState],
  );

  // ── ADR-528 §whole-line (Shift) — όλη η σειρά συγγραμμικών στηρίξεων με ΕΝΑ κλικ ──
  // Στατικά = συνεχής δοκός N ανοιγμάτων → N διακριτά δοκάρια (1-2, 2-3, 3-4…), καθένα flush στις
  // παρειές του (EC2/EC8: κόμβος δοκού-υποστυλώματος σε ΚΑΘΕ ενδιάμεση κολόνα). Ίδιος resolver/στηρίξεις
  // με το preview (`collectSpanSupportOutlines`) → preview ≡ commit. Weld αυτόματο. `false` αν δεν υπάρχει
  // ευθεία (ο caller πέφτει στο per-bay / face-snap).
  const commitSpanChain = useCallback(
    (s: BeamToolState, point: Readonly<Point2D>): boolean => {
      const sceneUnits = getSceneUnits?.() ?? 'mm';
      const bays = resolveBeamSpanChain(point, collectSpanSupportOutlines(sceneSnapTargetsStore.get()), sceneUnits);
      const any = bays.reduce((acc, bay) => appendCenterlineBeam(s, bay.start, bay.end, sceneUnits).ok || acc, false);
      if (!any) return false;
      resetToAwaitingStart(s);
      return true;
    },
    [getSceneUnits, appendCenterlineBeam, resetToAwaitingStart],
  );

  return {
    resetToAwaitingStart,
    commitTwoClickFromState,
    commitCurvedFromState,
    commitForWall,
    commitFromWall,
    resolveStartAnchor,
    commitSpanFromState,
    commitSpanChain,
  };
}
