/**
 * mep-segment-to-mesh — MEP duct/pipe segment → THREE.Mesh (ADR-408 Φ8).
 *
 * Sweeps the cross-section profile along the segment axis using the same
 * basis-matrix technique as `buildSweptIBeamGeometry`. The section is centred
 * vertically on `centerlineElevationMm` (Revit "Middle Elevation") — UNLIKE
 * beam (top face) / fixture (ceiling) / panel (mid box via body height).
 *
 * Two section kinds (mirror of beam sectionKind):
 *   - `'rectangular'` → w × h rect profile (box duct)
 *   - `'round'`       → circular N-gon profile (round duct / pipe)
 *
 * Coordinate convention (same as BimToThreeConverter):
 *   DXF plan: X = East, Y = North (canvas world, m when sceneUnits='m')
 *   Three.js world (Y-up): x = East, y = Up, z = −North
 *
 * Units-safe: axis vertices (startPoint/endPoint) are in canvas world coords
 * and are scaled to metres via `sceneUnitsToMeters`. Scalar mm params
 * (width/height/diameter, centerlineElevationMm) are always stored as mm and
 * MUST be multiplied by MM_TO_M before entering Three.js. This mirrors the
 * `panelToMesh` (stair-safe) pattern — NOT the legacy `fixtureToMesh` bug.
 *
 * @see ./beam-ishape-geometry.ts  — basis-matrix sweep template
 * @see ./bim-three-point-converters.ts — units-safe panelToMesh pattern
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md §Φ8
 */

import * as THREE from 'three';
import type { MepSegmentEntity } from '../../bim/types/mep-segment-types';
import { resolveSegmentSection, resolveSegmentEndpointElevationsMm } from '../../bim/types/mep-segment-types';
import { ROUND_PROFILE_SEGMENTS } from '../../bim/geometry/shared/round-profile';
import { useMepSegmentTrimStore } from '../../bim/mep-fittings/mep-segment-trim-store';
import { sceneUnitsToMeters } from '../../utils/scene-units';
import { getElementMaterial3D, getSystemTintedMaterial3D } from '../materials/MaterialCatalog3D';
import { resolveSegmentClassificationColor, hexToThreeInt } from '../../bim/mep-systems/mep-system-color';
import { tagMesh } from './bim-three-shape-helpers';

/** mm → Three.js world metres (shared constant, same as all other converters). */
const MM_TO_M = 0.001;

/**
 * SSoT for a segment's two axis endpoints in Three.js world space (m, Y-up),
 * UNTRIMMED (the raw 2-click axis ends — where the Revit shape handles sit). Plan
 * X,Y are scaled canvas→metres; the per-endpoint elevation (mm) gives the world Y
 * (the run may slope/rise). plan Y (north) → world −Z. Consumed BOTH by the swept
 * mesh below AND by the 3D gizmo endpoint handles (ADR-408 Φ-D), so the handle sits
 * exactly on the pipe end in every scene unit / building datum.
 */
export function segmentAxisEndpointsWorld(
  params: MepSegmentEntity['params'],
  buildingBaseElevationM = 0,
): { startW: THREE.Vector3; endW: THREE.Vector3 } {
  const sceneToM = sceneUnitsToMeters(params.sceneUnits ?? 'mm');
  const elev = resolveSegmentEndpointElevationsMm(params);
  const startW = new THREE.Vector3(
    params.startPoint.x * sceneToM,
    elev.startMm * MM_TO_M + buildingBaseElevationM,
    -(params.startPoint.y * sceneToM),
  );
  const endW = new THREE.Vector3(
    params.endPoint.x * sceneToM,
    elev.endMm * MM_TO_M + buildingBaseElevationM,
    -(params.endPoint.y * sceneToM),
  );
  return { startW, endW };
}

/**
 * Build a rect cross-section profile (w × h, centred on origin) as a closed
 * CCW polygon in the section-frame (x = width u, y = height v), scaled to
 * metres. Returns at least 4 points.
 */
function buildRectProfile(widthMm: number, heightMm: number): ReadonlyArray<{ x: number; y: number }> {
  const hw = (widthMm * MM_TO_M) / 2;
  const hh = (heightMm * MM_TO_M) / 2;
  // CCW: bottom-left → bottom-right → top-right → top-left
  return [
    { x: -hw, y: -hh },
    { x:  hw, y: -hh },
    { x:  hw, y:  hh },
    { x: -hw, y:  hh },
  ];
}

/**
 * MEP segment (duct or pipe) → THREE.Mesh via swept cross-section.
 *
 * The swept solid is centred vertically on
 *   `centerlineElevationMm * MM_TO_M + buildingBaseElevationM`
 * so the ExtrudeGeometry origin (section centroid @ section Y = 0) is placed
 * there, with the section occupying ±halfHeight in Y.
 *
 * Returns null for:
 *   - degenerate axis (start === end or distance < 1e-9 m)
 *   - degenerate section (width/height/diameter < 1 mm effective)
 *
 * @param segment              The MepSegmentEntity to convert.
 * @param floorElevationMm     Floor elevation of the host storey (mm). Unused
 *                             here (centreline elevation is absolute, not
 *                             floor-relative) but accepted for API symmetry with
 *                             the other sync* callers.
 * @param levelId              Optional storey levelId for userData tagging.
 * @param buildingBaseElevationM  Building datum offset (m) — same param as all
 *                             other per-floor converters in BimSceneLayer.
 */
export function mepSegmentToMesh(
  segment: MepSegmentEntity,
  floorElevationMm = 0,
  levelId?: string,
  buildingBaseElevationM = 0,
  systemColor?: number,
): THREE.Mesh | null {
  // ── True 3D endpoints (ADR-408 Φ-A) — shared SSoT with the gizmo handles (Φ-D). ──
  const { startW, endW } = segmentAxisEndpointsWorld(segment.params, buildingBaseElevationM);

  // ADR-408 Φ11 — shorten the run at any fitting on its ends (metres), so the 3D
  // pipe butts against the elbow/tee body instead of poking through it. Trim is a
  // physical mm length (scene-derived store, read synchronously), applied along the
  // TRUE 3D axis (so a sloped run trims correctly). Clamped to 90%.
  let fullLen = startW.distanceTo(endW);
  if (fullLen < 1e-9) return null;
  const dir = endW.clone().sub(startW).divideScalar(fullLen);
  const trim = useMepSegmentTrimStore.getState().getTrim(segment.id);
  if (trim && (trim.startMm > 0 || trim.endMm > 0)) {
    let startM = Math.max(0, trim.startMm) * MM_TO_M;
    let endM = Math.max(0, trim.endMm) * MM_TO_M;
    const maxTrim = fullLen * 0.9;
    if (startM + endM > maxTrim) {
      const k = maxTrim / (startM + endM);
      startM *= k;
      endM *= k;
    }
    startW.addScaledVector(dir, startM);
    endW.addScaledVector(dir, -endM);
    fullLen = startW.distanceTo(endW);
    if (fullLen < 1e-9) return null;
  }

  const section = resolveSegmentSection(segment.params);
  const { widthMm, heightMm } = section;
  if (widthMm < 1 || heightMm < 1) return null;

  const len = fullLen;
  const mid = startW.clone().add(endW).multiplyScalar(0.5);

  let geo: THREE.BufferGeometry;

  if (section.diameterMm !== null) {
    // ── Round pipe/duct → a SMOOTH cylinder swept along the TRUE 3D axis. The
    //    cylinder's local +Y is rotated onto the (possibly inclined) axis dir and
    //    centred at the 3D midpoint. `ROUND_PROFILE_SEGMENTS` keeps the 2D glyph +
    //    3D side count in sync.
    const rM = (section.diameterMm * MM_TO_M) / 2;
    geo = new THREE.CylinderGeometry(rM, rM, len, ROUND_PROFILE_SEGMENTS);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    const m = new THREE.Matrix4().makeRotationFromQuaternion(q);
    m.setPosition(mid);
    geo.applyMatrix4(m);
  } else {
    // ── Rectangular duct → swept rect profile via ExtrudeGeometry along the 3D axis.
    //    Basis: local Z (extrude) → axis dir; local X (width) → a HORIZONTAL
    //    perpendicular (cross(worldUp, axis)); local Y (height) → cross(z, x), the
    //    tilt-following "up". Near-vertical axis (cross ≈ 0) falls back to world +X.
    const rectPts = buildRectProfile(widthMm, heightMm);
    const shape = new THREE.Shape();
    shape.moveTo(rectPts[0].x, rectPts[0].y);
    for (let i = 1; i < rectPts.length; i++) shape.lineTo(rectPts[i].x, rectPts[i].y);
    shape.closePath();
    geo = new THREE.ExtrudeGeometry(shape, { depth: len, bevelEnabled: false });

    const zAxis = dir.clone();
    let xAxis = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), zAxis);
    if (xAxis.lengthSq() < 1e-9) xAxis = new THREE.Vector3(1, 0, 0); // axis is vertical
    xAxis.normalize();
    const yAxis = new THREE.Vector3().crossVectors(zAxis, xAxis).normalize();
    const m = new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis);
    m.setPosition(startW); // extrude origin at the (trimmed) start; profile centred at (0,0)
    geo.applyMatrix4(m);
  }

  // ── Material by domain (ADR-408 Φ8), system colour (Φ9/Φ10) or classification
  //    hint (Φ14) ──────────────────────────────────────────────────────────────
  // System colour wins (joined to a pipe network); else the instance
  // classification hint tints the PBR (drainage = brown) so a standalone drainage
  // run reads correctly in 3D; else the per-domain default. ONE colour SSoT shared
  // with the 2D renderer (`resolveSegmentClassificationColor`).
  const domainMatType = segment.params.domain === 'pipe' ? 'mep-pipe' : 'mep-duct';
  const classHex = resolveSegmentClassificationColor(segment.params.classification);
  const classInt = classHex ? hexToThreeInt(classHex) : null;
  const tintInt = systemColor ?? classInt ?? undefined;
  const material = tintInt !== undefined
    ? getSystemTintedMaterial3D(domainMatType, tintInt)
    : getElementMaterial3D(domainMatType);

  const mesh = new THREE.Mesh(geo, material);

  // ── userData (entityId pattern matching all other 3D converters) ───────────
  mesh.userData['entityId'] = segment.id;

  const matId = segment.params.material ?? `elem-mep-${segment.params.domain}`;
  const tagged = tagMesh(mesh, segment.id, 'mep-segment', matId, levelId);

  return tagged;
}
