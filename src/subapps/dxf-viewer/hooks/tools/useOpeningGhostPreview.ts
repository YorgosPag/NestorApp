/**
 * ADR-363 Phase 2 (canvas-wiring follow-up, 2026-05-25) — Opening placement
 * ghost preview hook (RAF-driven).
 *
 * Mirror του `useSlabOpeningGhostPreview` pattern. Activates only όταν ο
 * opening tool βρίσκεται σε phase `awaitingPosition` (host wall locked).
 * Subscribes σε `useCursorWorldPosition` + `ImmediateSnapStore` και ζωγραφίζει
 * τη rectangular cutout outline projected onto the host wall axis, μαζί με
 * προαιρετική quarter-arc swing indicator για door / french-door.
 *
 * Scene-units aware: width / wall thickness είναι σε mm (Nestor convention),
 * το axis όμως ζει σε scene units — `mmToSceneUnits()` τα ευθυγραμμίζει ώστε
 * το ghost να συμπίπτει με την τελική θέση του committed entity rectangle.
 *
 * ADR-040 compliance:
 *   - NO `useSyncExternalStore` σε orchestrators (CanvasSection)
 *   - `getImmediateSnap()` imperative read inside RAF callback
 *   - Ghost renders to preview canvas only (bitmap cache unchanged)
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.4
 * @see docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 */

import { useCallback, useEffect, useRef } from 'react';
import type { Point2D, ViewTransform } from '../../rendering/types/Types';
import type { Point3D } from '../../bim/types/bim-base';
import type { OpeningKind } from '../../bim/types/opening-types';
import type { WallEntity } from '../../bim/types/wall-types';
import type { OpeningParamOverrides } from '../drawing/opening-completion';
import {
  OPENING_KIND_DEFAULTS,
  OPENING_SNAP_INCREMENT_MM,
  isHingedKind,
  isDoubleLeafKind,
} from '../../bim/types/opening-types';
import { useCursorWorldPosition } from '../../systems/cursor/useCursor';
import { getImmediateSnap } from '../../systems/cursor/ImmediateSnapStore';
import { OpeningGhostRenderer } from '../../bim/walls/opening-ghost-renderer';
import { getWallAxisVertices } from '../../bim/geometry/wall-geometry';
import { mmToSceneUnits, type SceneUnits } from '../../utils/scene-units';

const HALF_PI = Math.PI / 2;
const HINGE_ARC_SUBDIVISIONS = 12;

export interface UseOpeningGhostPreviewProps {
  readonly isAwaitingPosition: boolean;
  readonly kind: OpeningKind;
  readonly overrides: OpeningParamOverrides;
  /** Resolver για locked host wall (null όταν `isAwaitingPosition === false`). */
  readonly getHostWall: () => WallEntity | null;
  readonly transform: ViewTransform;
  getCanvas(): HTMLCanvasElement | null;
  getViewportElement?(): HTMLElement | null;
  /** ADR-370 — active scene units για mm→scene conversion. */
  getSceneUnits?(): SceneUnits;
}

export function useOpeningGhostPreview(props: Readonly<UseOpeningGhostPreviewProps>): void {
  const { isAwaitingPosition, kind, overrides, getHostWall, transform, getCanvas, getViewportElement, getSceneUnits } = props;
  // SSoT gate (ADR-040): subscribe to the 60fps cursor stream only while awaiting a position.
  const cursorWorld = useCursorWorldPosition(isAwaitingPosition);
  const rafRef = useRef<number>(0);
  const prevActiveRef = useRef<boolean>(false);

  const drawFrame = useCallback(() => {
    const canvas = getCanvas();
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (!isAwaitingPosition || !cursorWorld) return;
    const hostWall = getHostWall();
    if (!hostWall) return;

    const snapState = getImmediateSnap();
    const effectiveCursor: Point2D =
      snapState?.found === true && snapState.point != null ? snapState.point : cursorWorld;

    const viewportElement = getViewportElement?.() ?? canvas;
    const rect = viewportElement.getBoundingClientRect();
    const viewport = { width: rect.width, height: rect.height };
    const units: SceneUnits = getSceneUnits?.() ?? 'mm';
    const mmFactor = mmToSceneUnits(units);

    const ghost = computeOpeningGhost(hostWall, effectiveCursor, kind, overrides, mmFactor);
    if (!ghost) return;

    new OpeningGhostRenderer(ctx).render({
      vertices: ghost.vertices,
      hingeArcPoints: ghost.hingeArcPoints,
      kind,
      transform,
      viewport,
    });
  }, [isAwaitingPosition, kind, overrides, getHostWall, transform, getCanvas, getViewportElement, cursorWorld, getSceneUnits]);

  // Clear stale ghost on transition out of awaitingPosition.
  useEffect(() => {
    const wasActive = prevActiveRef.current;
    const isActive = isAwaitingPosition;
    if (wasActive && !isActive) {
      const canvas = getCanvas();
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const dpr = window.devicePixelRatio || 1;
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }
      }
    }
    prevActiveRef.current = isActive;
  }, [isAwaitingPosition, getCanvas]);

  // Schedule one draw per cursor / state change while active.
  useEffect(() => {
    if (!isAwaitingPosition) return;
    rafRef.current = requestAnimationFrame(drawFrame);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [isAwaitingPosition, drawFrame]);
}

// ─── Pure helpers (scene-unit aware) ─────────────────────────────────────────

interface OpeningGhostShape {
  readonly vertices: ReadonlyArray<{ x: number; y: number }>;
  readonly hingeArcPoints?: ReadonlyArray<{ x: number; y: number }>;
}

function computeOpeningGhost(
  hostWall: WallEntity,
  cursorScene: Readonly<Point2D>,
  kind: OpeningKind,
  overrides: OpeningParamOverrides,
  mmFactor: number,
): OpeningGhostShape | null {
  const axisVertices = getWallAxisVertices(hostWall.params, hostWall.kind);
  if (axisVertices.length < 2) return null;

  const defaults = OPENING_KIND_DEFAULTS[kind];
  const widthMm = overrides.width ?? defaults.width;
  const thicknessMm = hostWall.params.thickness;
  const halfWidthScene = (widthMm / 2) * mmFactor;
  const halfThicknessScene = (thicknessMm / 2) * mmFactor;
  const snapIncrementScene = OPENING_SNAP_INCREMENT_MM * mmFactor;

  const cursorOffsetScene = projectPointToPolylineOffset(cursorScene, axisVertices);
  const totalLengthScene = polylineLength(axisVertices);
  const centeredOffsetScene = cursorOffsetScene - halfWidthScene;
  const snappedOffsetScene = snapToIncrement(centeredOffsetScene, snapIncrementScene);
  const widthScene = widthMm * mmFactor;
  const maxOffsetScene = Math.max(0, totalLengthScene - widthScene);
  const clampedOffsetScene = Math.max(0, Math.min(snappedOffsetScene, maxOffsetScene));
  const centerOffsetScene = clampedOffsetScene + halfWidthScene;

  const { point: center, ux, uy } = walkPolylineToDistance(axisVertices, centerOffsetScene);
  // Perpendicular (CCW 90°): (-uy, ux).
  const px = -uy;
  const py = ux;

  const vertices = [
    { x: center.x - ux * halfWidthScene - px * halfThicknessScene, y: center.y - uy * halfWidthScene - py * halfThicknessScene },
    { x: center.x + ux * halfWidthScene - px * halfThicknessScene, y: center.y + uy * halfWidthScene - py * halfThicknessScene },
    { x: center.x + ux * halfWidthScene + px * halfThicknessScene, y: center.y + uy * halfWidthScene + py * halfThicknessScene },
    { x: center.x - ux * halfWidthScene + px * halfThicknessScene, y: center.y - uy * halfWidthScene + py * halfThicknessScene },
  ];

  const hingeArcPoints = isHingedKind(kind)
    ? buildGhostHingeArc(kind, center, ux, uy, px, py, halfWidthScene, widthScene, overrides)
    : undefined;

  return { vertices, hingeArcPoints };
}

function buildGhostHingeArc(
  kind: OpeningKind,
  center: { readonly x: number; readonly y: number },
  ux: number,
  uy: number,
  px: number,
  py: number,
  halfWidthScene: number,
  widthScene: number,
  overrides: OpeningParamOverrides,
): ReadonlyArray<{ x: number; y: number }> {
  const handing = overrides.handing ?? 'left';
  const openDirection = overrides.openDirection ?? 'inward';
  const handingSign = handing === 'right' ? 1 : -1;
  const swingSign = openDirection === 'outward' ? -1 : 1;

  const hingeX = center.x + ux * (handingSign * halfWidthScene);
  const hingeY = center.y + uy * (handingSign * halfWidthScene);
  const startVecX = -handingSign * ux;
  const startVecY = -handingSign * uy;
  const perpX = swingSign * px;
  const perpY = swingSign * py;

  const points: Array<{ x: number; y: number }> = [];
  for (let i = 0; i <= HINGE_ARC_SUBDIVISIONS; i++) {
    const t = (i / HINGE_ARC_SUBDIVISIONS) * HALF_PI;
    const cos = Math.cos(t);
    const sin = Math.sin(t);
    points.push({
      x: hingeX + widthScene * (cos * startVecX + sin * perpX),
      y: hingeY + widthScene * (cos * startVecY + sin * perpY),
    });
  }

  if (isDoubleLeafKind(kind)) {
    const hinge2X = center.x + ux * (-handingSign * halfWidthScene);
    const hinge2Y = center.y + uy * (-handingSign * halfWidthScene);
    const startVec2X = handingSign * ux;
    const startVec2Y = handingSign * uy;
    for (let i = HINGE_ARC_SUBDIVISIONS; i >= 0; i--) {
      const t = (i / HINGE_ARC_SUBDIVISIONS) * HALF_PI;
      const cos = Math.cos(t);
      const sin = Math.sin(t);
      points.push({
        x: hinge2X + widthScene * (cos * startVec2X + sin * perpX),
        y: hinge2Y + widthScene * (cos * startVec2Y + sin * perpY),
      });
    }
  }
  return points;
}

function projectPointToPolylineOffset(
  point: Readonly<Point2D>,
  vertices: readonly Point3D[],
): number {
  let arcOffset = 0;
  let bestOffset = 0;
  let bestDist2 = Infinity;
  for (let i = 0; i < vertices.length - 1; i++) {
    const a = vertices[i];
    const b = vertices[i + 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const segLen = Math.hypot(dx, dy);
    if (segLen < 1e-6) continue;
    const ux = dx / segLen;
    const uy = dy / segLen;
    const vx = point.x - a.x;
    const vy = point.y - a.y;
    const t = Math.max(0, Math.min(vx * ux + vy * uy, segLen));
    const ex = point.x - (a.x + ux * t);
    const ey = point.y - (a.y + uy * t);
    const dist2 = ex * ex + ey * ey;
    if (dist2 < bestDist2) {
      bestDist2 = dist2;
      bestOffset = arcOffset + t;
    }
    arcOffset += segLen;
  }
  return Math.max(0, Math.min(bestOffset, arcOffset));
}

function walkPolylineToDistance(
  vertices: readonly Point3D[],
  distance: number,
): { point: { x: number; y: number }; ux: number; uy: number } {
  let remaining = distance;
  for (let i = 0; i < vertices.length - 1; i++) {
    const a = vertices[i];
    const b = vertices[i + 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const segLen = Math.hypot(dx, dy);
    if (segLen < 1e-6) continue;
    const ux = dx / segLen;
    const uy = dy / segLen;
    if (remaining <= segLen) {
      const t = remaining / segLen;
      return { point: { x: a.x + dx * t, y: a.y + dy * t }, ux, uy };
    }
    remaining -= segLen;
  }
  const n = vertices.length;
  const a = vertices[n - 2];
  const b = vertices[n - 1];
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const segLen = Math.hypot(dx, dy) || 1;
  return { point: { x: b.x, y: b.y }, ux: dx / segLen, uy: dy / segLen };
}

function polylineLength(vertices: readonly Point3D[]): number {
  let len = 0;
  for (let i = 1; i < vertices.length; i++) {
    len += Math.hypot(vertices[i].x - vertices[i - 1].x, vertices[i].y - vertices[i - 1].y);
  }
  return len;
}

function snapToIncrement(value: number, increment: number): number {
  if (increment <= 0) return value;
  return Math.round(value / increment) * increment;
}
