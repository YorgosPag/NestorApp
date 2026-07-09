/**
 * OpeningHost — SSoT host-abstraction (ADR-615).
 *
 * Decouples the opening geometry/grip pipeline from the concrete `WallEntity`
 * type so an opening can be placed WITHOUT a BIM wall ("self-hosted" /
 * free-standing κούφωμα on top of imported DXF lines). Two providers feed a
 * SINGLE downstream geometry engine (`computeOpeningGeometry` et al.) — zero
 * duplicate geometry logic, zero ripple on the ~40 existing wall call-sites
 * (they keep passing `WallEntity`; `resolveOpeningHost()` normalizes it).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-615-free-standing-self-hosted-opening.md §Decision 1
 */

import type { Point3D } from '../types/bim-base';
import type { WallEntity } from '../types/wall-types';
import type { OpeningParams } from '../types/opening-types';
import { getWallAxisVertices } from './wall-geometry';
import { mmToSceneUnits, type SceneUnits } from '../../utils/scene-units';

/**
 * Default "wall thickness" a self-hosted opening symbol shows when the user
 * has not specified `OpeningSelfHost.hostThicknessMm` — a typical interior
 * partition thickness (mm).
 */
export const DEFAULT_SELF_HOST_THICKNESS_MM = 100;

/**
 * Thin host-abstraction consumed by `computeOpeningGeometry` (and the
 * sibling `projectPointToWallOffsetMm` / `wallAxisPointAtOffsetMm` helpers).
 * Everything the geometry engine needs from "whatever the opening sits on",
 * independent of whether that thing is a real `WallEntity` or a synthetic
 * self-host.
 */
export interface OpeningHost {
  /** Host/opening axis polyline, ALREADY expressed in SCENE units. */
  readonly axisVerticesScene: readonly Point3D[];
  /** mm — cross-section thickness the opening cuts through. */
  readonly thicknessMm: number;
  readonly sceneUnits: SceneUnits;
  /**
   * Miter-accurate outer face points. Absent (self-host) ⇒ callers fall back
   * to the existing `axis ± thickness/2` outline construction.
   */
  readonly outerEdgePoints?: readonly Point3D[];
  /** Miter-accurate inner face points. Absent ⇒ same axis±t/2 fallback. */
  readonly innerEdgePoints?: readonly Point3D[];
  /** mm — host length along the axis (offset clamp / grip bounds). */
  readonly lengthMm: number;
  /** Host wall id, or `null` when self-hosted (no BIM wall backs this opening). */
  readonly hostId: string | null;
}

/**
 * Adapter — wraps an existing `WallEntity` as an `OpeningHost`. Pure
 * pass-through of already-computed wall geometry; zero change to `WallEntity`
 * itself and zero behavioural change for the ~40 existing wall-hosted
 * call-sites.
 */
export function wallAsOpeningHost(wall: WallEntity): OpeningHost {
  return {
    axisVerticesScene: getWallAxisVertices(wall.params, wall.kind),
    thicknessMm: wall.params.thickness,
    sceneUnits: wall.params.sceneUnits ?? 'mm',
    outerEdgePoints: wall.geometry?.outerEdge?.points,
    innerEdgePoints: wall.geometry?.innerEdge?.points,
    // WallGeometry.length is in METRES (m) — geometry engine works in mm.
    lengthMm: wall.geometry.length * 1000,
    hostId: wall.id,
  };
}

/**
 * Synthesizes a straight 2-vertex axis (in SCENE units) centred on
 * `params.selfHost.anchor`, for a self-hosted opening (no BIM wall). Outer /
 * inner edges are left `undefined` — the geometry engine's existing
 * `axis ± thickness/2` fallback produces the outline.
 *
 * Caller MUST ensure `params.selfHost` is set (see `isSelfHostedOpening`).
 */
export function selfOpeningHost(params: OpeningParams, sceneUnits: SceneUnits): OpeningHost {
  const selfHost = params.selfHost;
  if (!selfHost) {
    throw new Error('selfOpeningHost: params.selfHost is required (isSelfHostedOpening guard).');
  }
  const mmFactor = mmToSceneUnits(sceneUnits);
  const dirX = Math.cos(selfHost.rotationRad);
  const dirY = Math.sin(selfHost.rotationRad);
  const halfScene = (params.width / 2) * mmFactor;
  const anchorX = selfHost.anchor.x * mmFactor;
  const anchorY = selfHost.anchor.y * mmFactor;
  const v0: Point3D = { x: anchorX - dirX * halfScene, y: anchorY - dirY * halfScene };
  const v1: Point3D = { x: anchorX + dirX * halfScene, y: anchorY + dirY * halfScene };

  return {
    axisVerticesScene: [v0, v1],
    thicknessMm: selfHost.hostThicknessMm,
    sceneUnits,
    outerEdgePoints: undefined,
    innerEdgePoints: undefined,
    lengthMm: params.width,
    hostId: null,
  };
}

/**
 * Discriminates `OpeningHost` from `WallEntity` at the geometry engine's
 * union call-sites — no `any`, structural check via a field only `OpeningHost`
 * carries.
 */
export function isOpeningHost(x: WallEntity | OpeningHost): x is OpeningHost {
  return 'axisVerticesScene' in x;
}

/**
 * Zero-ripple normalize (ADR-615 §Decision 1). Callers that historically
 * received `WallEntity` and now accept `WallEntity | OpeningHost` call this
 * ONCE at the entry point to obtain a uniform `OpeningHost` — existing
 * wall-hosted call-sites are byte-identical downstream.
 */
export function resolveOpeningHost(x: WallEntity | OpeningHost): OpeningHost {
  return isOpeningHost(x) ? x : wallAsOpeningHost(x);
}
