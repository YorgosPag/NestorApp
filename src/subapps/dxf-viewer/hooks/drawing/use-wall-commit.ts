/**
 * ADR-363 — Wall Tool commit builders (extracted from `useWallTool.ts` for
 * N.7.1 file-size compliance). One sub-hook owns the four build-and-commit
 * paths (straight / curved / polyline / on-entity); behavior is identical to
 * the inlined callbacks — same SSoT builders, same validator-abort semantics,
 * same "reset to awaitingStart" continuous-chain tail.
 *
 * @see ./useWallTool.ts
 * @see ./wall-completion.ts (buildDefaultWallParams / buildWallEntity SSoT)
 * @see ../../bim/walls/wall-from-entity.ts (on-entity geometry bridge)
 */

import { useCallback, type Dispatch, type SetStateAction } from 'react';
import type { Point2D } from '../../rendering/types/Types';
import type { Point3D } from '../../bim/types/bim-base';
import type { WallEntity } from '../../bim/types/wall-types';
import type { Entity } from '../../types/entities';
import { isWallEntity } from '../../types/entities';
import { buildWallForLine, buildWallsForClosed } from '../../bim/walls/wall-from-entity';
import { buildWallFillingRect, type DetectedRectangle } from '../../bim/walls/wall-in-region';
import { extendFillingWallToNeighbors } from '../../bim/walls/wall-region-autojoin';
import type { PerimeterFacesResult } from '../../bim/walls/perimeter-from-faces';
import { EventBus } from '../../systems/events/EventBus';
import { alignmentPointForWallJustification, buildAnchoredWallParams, buildDefaultWallParams, buildWallEntity, resolveWallGridBindings, resolveWallThicknessMm, type SceneUnits } from './wall-completion';
import { INITIAL_STATE, type WallToolState } from './wall-tool-types';
import { sceneSnapTargetsStore, selectGhostMembers } from '../../bim/framing/scene-snap-targets';
import { isMemberCollinearOverlap } from '../../bim/framing/linear-member-face-snap';
import { resolveWallOpeningConflictForHost } from '../../bim/walls/wall-opening-conflict';
import { getGlobalGuideStore } from '../../systems/guides/guide-store';
import { axisHostTolScene } from '../../bim/hosting/resolve-axis-bindings';

export interface WallCommitContext {
  readonly currentLevelId: string;
  readonly onWallCreated?: (entity: WallEntity) => void;
  readonly getSceneUnits?: () => SceneUnits;
  /**
   * Live scene entities — used by the region/perimeter fill paths to auto-join a
   * filling wall to its neighbours (Revit "Allow Join"). Omit ⇒ no auto-join.
   */
  readonly getSceneEntities?: () => readonly Entity[];
  readonly setState: Dispatch<SetStateAction<WallToolState>>;
}

export interface WallCommitApi {
  /** Straight 3-click commit (start + end + optional lateral alignment point). */
  commitStraightFromState(
    s: WallToolState,
    endPoint: Readonly<Point2D>,
    alignmentPoint?: Readonly<Point2D> | null,
  ): boolean;
  /** Curved 3-click commit (start + end + quadratic Bezier control). */
  commitCurvedFromState(s: WallToolState, controlPoint: Readonly<Point2D>): boolean;
  /** Polyline N-click commit (Enter to finish, ≥2 vertices). */
  commitPolylineFromState(s: WallToolState): boolean;
  /** ADR-363 Phase 1J on-entity commit (pick-side click → wall(s)). */
  commitOnEntity(s: WallToolState, sidePoint: Readonly<Point2D>): boolean;
  /**
   * ADR-363 Phase 1K in-region commit: ONE filling wall per detected rectangle
   * (length = long side, thickness = short side). Multiple rects (box-select).
   * Clears `regionPicks`, stays in-region (continuous chain). Returns true if
   * ≥1 wall was built.
   */
  commitInRegionRects(s: WallToolState, rects: readonly DetectedRectangle[]): boolean;
  /**
   * ADR-363 «Τοίχος από περίγραμμα»: build one filling wall per leg rect across all
   * analysed perimeters (length = long side, thickness = short side) and surface a
   * non-blocking toast («Δημιουργήθηκαν N· αγνοήθηκαν X») via EventBus. Reuses the
   * in-region build + miter-recompute path. Returns true if ≥1 wall was built.
   */
  commitPerimeterFaces(s: WallToolState, result: PerimeterFacesResult): boolean;
}

/**
 * ADR-363 / ADR-419 — continuous-chain tail after a SUCCESSFUL commit: reset the
 * in-progress geometry but PRESERVE every user-selected mode selector so the next
 * click keeps the SAME tool configuration. The preserved set is the SSoT for "what
 * survives a commit": `kind`, `placementMode`, `regionMethod`, `overrides`.
 *
 * Dropping `regionMethod` here was the «in-region "κλικ μέσα" δουλεύει μία φορά,
 * μετά αγνοεί τα κλικ μέχρι hard-refresh» regression: ADR-419 added `regionMethod`
 * to the state machine but the per-commit reset still spread only the pre-ADR-419
 * fields, so the method silently fell back to the INITIAL_STATE default ('lines')
 * and the 'inside'/'box' methods stopped matching on the second click.
 */
function continueChain(s: WallToolState): WallToolState {
  return {
    ...INITIAL_STATE,
    kind: s.kind,
    placementMode: s.placementMode,
    regionMethod: s.regionMethod,
    overrides: s.overrides,
    phase: 'awaitingStart',
  };
}

/**
 * Memoized commit builders for the wall tool. Each function mirrors the
 * inlined `useCallback` it replaced, including its dependency array, so the
 * tool's React identity/perf profile is unchanged.
 */
export function useWallCommit(ctx: WallCommitContext): WallCommitApi {
  const { currentLevelId, onWallCreated, getSceneUnits, getSceneEntities, setState } = ctx;

  // ── commit (straight) ────────────────────────────────────────────────────
  const commitStraightFromState = useCallback(
    (
      s: WallToolState,
      endPoint: Readonly<Point2D>,
      alignmentPoint?: Readonly<Point2D> | null,
    ): boolean => {
      if (s.startPoint === null) return false;
      const sceneUnits = getSceneUnits?.() ?? 'mm';
      // ADR-508 / ADR-398 §3.10 — preview === commit: διάβασε τους ΙΔΙΟΥΣ snap στόχους με το ghost
      // από το ΚΟΙΝΟ scene store· τοίχος = wall+beam+slab μέλη.
      const targets = sceneSnapTargetsStore.get();
      // ADR-508 — μπλόκαρε commit όταν ο τοίχος θα κείτεται ομοαξονικά/πάνω σε υφιστάμενο
      // μέλος (duplication· το 🔴 ghost ήταν ήδη το feedback). Mirror του δοκαριού.
      if (isMemberCollinearOverlap(s.startPoint, endPoint, selectGhostMembers(targets, ['wall', 'beam', 'slab']))) {
        return false;
      }
      // ADR-508 — params: explicit alignmentPoint (legacy/dynamic-input precision) >
      // startAnchored (face-snapped start: centerline ή — §end-reference — location-line justification
      // για κορυφή 3-tier ώστε το pivot να μένει στην κορυφή) > free auto-flush σε κολόνα.
      const params =
        alignmentPoint != null
          ? buildDefaultWallParams(s.startPoint, endPoint, s.overrides, sceneUnits, alignmentPoint)
          : s.startAnchored
            ? buildDefaultWallParams(
                s.startPoint, endPoint, s.overrides, sceneUnits,
                alignmentPointForWallJustification(s.startPoint, endPoint, s.startJustification),
              )
            : buildAnchoredWallParams(s.startPoint, endPoint, s.overrides, sceneUnits, targets.footprints);
      const result = buildWallEntity(params, currentLevelId, 'straight', sceneUnits);
      if (!result.ok) {
        setState({ ...s, error: result.hardErrors[0] ?? null });
        return false;
      }
      // ADR-508 §opening-conflict — μπλόκαρε commit όταν ο κάθετος τοίχος θα έκοβε άνοιγμα host τοίχου
      // (3D: κατακόρυφη ΚΑΙ οριζόντια τομή με το κενό). Ίδιο μονοπάτι με το short-end overlap· το 🔴
      // ghost ήταν ήδη το feedback. Host = ο LOCKED snapped reference (`s.anchoredHostId`, μηδέν
      // re-derive) → preview === commit μέσω του ΙΔΙΟΥ host.
      const hostWall = s.anchoredHostId
        ? targets.wallEntities.find((w) => w.id === s.anchoredHostId) ?? null
        : null;
      if (resolveWallOpeningConflictForHost(
        s.startPoint, result.entity, resolveWallThicknessMm(s.overrides), hostWall, targets.openings,
      )) {
        return false;
      }
      // ADR-441 Slice WALL — host-on-snap: αν τα άκρα της location-line πέφτουν σε άξονες
      // κανάβου, «κρέμασε» τον τοίχο ώστε να ακολουθεί (Revit wall-on-grid). Το extend
      // κρατά τη Finish-Face παρειά στον άξονα.
      const bindings = resolveWallGridBindings(
        s.startPoint,
        endPoint,
        params,
        getGlobalGuideStore(),
        axisHostTolScene(sceneUnits),
        sceneUnits,
      );
      const entity = bindings.length > 0 ? { ...result.entity, guideBindings: bindings } : result.entity;
      onWallCreated?.(entity);
      setState(continueChain(s));
      return true;
    },
    [currentLevelId, onWallCreated, getSceneUnits, setState],
  );

  // ── commit (curved) ──────────────────────────────────────────────────────
  const commitCurvedFromState = useCallback(
    (s: WallToolState, controlPoint: Readonly<Point2D>): boolean => {
      if (s.startPoint === null || s.endPoint === null) return false;
      const sceneUnits = getSceneUnits?.() ?? 'mm';
      const base = buildDefaultWallParams(s.startPoint, s.endPoint, s.overrides, sceneUnits);
      const curveControl: Point3D = { x: controlPoint.x, y: controlPoint.y, z: 0 };
      const params = { ...base, curveControl };
      const result = buildWallEntity(params, currentLevelId, 'curved', sceneUnits);
      if (!result.ok) {
        setState({ ...s, error: result.hardErrors[0] ?? null });
        return false;
      }
      onWallCreated?.(result.entity);
      setState(continueChain(s));
      return true;
    },
    [currentLevelId, onWallCreated, getSceneUnits, setState],
  );

  // ── commit (polyline) ────────────────────────────────────────────────────
  const commitPolylineFromState = useCallback(
    (s: WallToolState): boolean => {
      const verts = s.polylineVertices;
      if (verts.length < 2) return false;
      const sceneUnits = getSceneUnits?.() ?? 'mm';
      const startPt = verts[0];
      const endPt = verts[verts.length - 1];
      const base = buildDefaultWallParams(startPt, endPt, s.overrides, sceneUnits);
      const polylineVertices: Point3D[] = verts.map((v) => ({ x: v.x, y: v.y, z: 0 }));
      const params = { ...base, polylineVertices };
      const result = buildWallEntity(params, currentLevelId, 'polyline', sceneUnits);
      if (!result.ok) {
        setState({ ...s, error: result.hardErrors[0] ?? null });
        return false;
      }
      onWallCreated?.(result.entity);
      setState(continueChain(s));
      return true;
    },
    [currentLevelId, onWallCreated, getSceneUnits, setState],
  );

  // ── commit (on-entity, ADR-363 Phase 1J) ─────────────────────────────────
  /**
   * Commit the on-entity placement from the second (side) click. Line source →
   * one wall; closed source → one wall per perimeter edge. Each built entity is
   * emitted via `onWallCreated` (the caller's `addWallToScene` recomputes miter
   * joins across all walls). Returns to `awaitingStart` (continuous chain).
   */
  const commitOnEntity = useCallback(
    (s: WallToolState, sidePoint: Readonly<Point2D>): boolean => {
      if (!s.pickedSource) return false;
      const sceneUnits = getSceneUnits?.() ?? 'mm';
      if (s.pickedSource.kind === 'line') {
        const entity = buildWallForLine(
          s.pickedSource.start,
          s.pickedSource.end,
          sidePoint,
          s.overrides,
          sceneUnits,
          currentLevelId,
        );
        if (entity) onWallCreated?.(entity);
      } else {
        const walls = buildWallsForClosed(
          s.pickedSource.polygon,
          sidePoint,
          s.overrides,
          sceneUnits,
          currentLevelId,
        );
        for (const w of walls) onWallCreated?.(w);
      }
      setState(continueChain(s));
      return true;
    },
    [currentLevelId, onWallCreated, getSceneUnits, setState],
  );

  // ── shared rect→wall build (in-region + outer-perimeter) ─────────────────
  // One filling wall per detected rectangle; returns how many passed the validator.
  // Each `onWallCreated` recomputes neighbour miter trims (addWallToScene), so the
  // whole batch is mitred/bevelled once the last leg lands.
  const buildFillingWalls = useCallback(
    (s: WallToolState, rects: readonly DetectedRectangle[]): number => {
      const sceneUnits = getSceneUnits?.() ?? 'mm';
      // ADR-363 Phase 1K — Revit "Allow Join": extend each filling wall's endpoints
      // to coincident neighbour centrelines so they connect cleanly instead of
      // butting at the bounding line (= the neighbour's face) and being trimmed back.
      // Neighbours = existing scene walls + siblings already built in THIS batch.
      const sceneWalls = (getSceneEntities?.() ?? []).filter(isWallEntity);
      const batch: WallEntity[] = [];
      let built = 0;
      for (const rect of rects) {
        const raw = buildWallFillingRect(rect, s.overrides, sceneUnits, currentLevelId);
        if (!raw) continue;
        const entity = extendFillingWallToNeighbors(raw, [...sceneWalls, ...batch], sceneUnits);
        batch.push(entity);
        onWallCreated?.(entity);
        built++;
      }
      return built;
    },
    [currentLevelId, onWallCreated, getSceneUnits, getSceneEntities],
  );

  // ── commit (in-region, ADR-363 Phase 1K) ─────────────────────────────────
  const commitInRegionRects = useCallback(
    (s: WallToolState, rects: readonly DetectedRectangle[]): boolean => {
      const built = buildFillingWalls(s, rects);
      if (built === 0) {
        // Validator rejected every rect (e.g. short side > MAX_WALL_THICKNESS_MM).
        setState({ ...s, regionPicks: [], error: 'wall.validation.hardErrors.thicknessExceedsMax' });
        return false;
      }
      setState(continueChain(s));
      return true;
    },
    [buildFillingWalls, setState],
  );

  // ── commit (outer-perimeter, ADR-363 «Τοίχος από περίγραμμα») ─────────────
  const commitPerimeterFaces = useCallback(
    (s: WallToolState, result: PerimeterFacesResult): boolean => {
      const built = buildFillingWalls(s, result.rects);
      // Garbage shapes (triangle/free line) + validator-rejected legs are surfaced
      // as the "ignored" count so the user always gets Revit-style feedback.
      const ignored = result.ignoredCount + (result.rects.length - built);
      EventBus.emit('bim:walls-from-perimeter', { built, ignored });
      if (built === 0) {
        setState({ ...s, regionPicks: [], error: null });
        return false;
      }
      setState(continueChain(s));
      return true;
    },
    [buildFillingWalls, setState],
  );

  return {
    commitStraightFromState,
    commitCurvedFromState,
    commitPolylineFromState,
    commitOnEntity,
    commitInRegionRects,
    commitPerimeterFaces,
  };
}
