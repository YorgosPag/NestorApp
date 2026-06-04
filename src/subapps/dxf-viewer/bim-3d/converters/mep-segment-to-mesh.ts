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
import { resolveSegmentSection } from '../../bim/types/mep-segment-types';
import { ROUND_PROFILE_SEGMENTS } from '../../bim/geometry/shared/round-profile';
import { useMepSegmentTrimStore } from '../../bim/mep-fittings/mep-segment-trim-store';
import { sceneUnitsToMeters } from '../../utils/scene-units';
import { getElementMaterial3D, getSystemTintedMaterial3D } from '../materials/MaterialCatalog3D';
import { tagMesh } from './bim-three-shape-helpers';

/** mm → Three.js world metres (shared constant, same as all other converters). */
const MM_TO_M = 0.001;

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
  const { startPoint, endPoint } = segment.params;

  // Scale canvas-world axis vertices to Three.js world metres.
  const sceneToM = sceneUnitsToMeters(segment.params.sceneUnits ?? 'mm');
  let sx = startPoint.x * sceneToM;
  let sy = startPoint.y * sceneToM;
  let ex = endPoint.x * sceneToM;
  let ey = endPoint.y * sceneToM;

  // ADR-408 Φ11 — shorten the run at any fitting on its ends (metres), so the 3D
  // pipe butts against the elbow/tee torus instead of poking through it. Trim is a
  // physical mm length (scene-derived store, read synchronously). Clamped to 90%.
  const trim = useMepSegmentTrimStore.getState().getTrim(segment.id);
  if (trim && (trim.startMm > 0 || trim.endMm > 0)) {
    const fullLen = Math.hypot(ex - sx, ey - sy);
    if (fullLen > 1e-9) {
      const ax = (ex - sx) / fullLen;
      const ay = (ey - sy) / fullLen;
      let startM = Math.max(0, trim.startMm) * MM_TO_M;
      let endM = Math.max(0, trim.endMm) * MM_TO_M;
      const maxTrim = fullLen * 0.9;
      if (startM + endM > maxTrim) {
        const k = maxTrim / (startM + endM);
        startM *= k;
        endM *= k;
      }
      sx += ax * startM; sy += ay * startM;
      ex -= ax * endM; ey -= ay * endM;
    }
  }

  // plan X,Y → world X,−Z (Three.js Y-up: plan Y = north → world −Z).
  const dxWorld = ex - sx;
  const dzWorld = -(ey - sy); // world Z component: note negative
  const lenPlan = Math.hypot(dxWorld, dzWorld);
  if (lenPlan < 1e-9) return null;

  const section = resolveSegmentSection(segment.params);
  const { widthMm, heightMm } = section;
  if (widthMm < 1 || heightMm < 1) return null;

  // ── Elevation: the section is centred on the (absolute) centreline elevation. ──
  const centreWorldY = segment.params.centerlineElevationMm * MM_TO_M + buildingBaseElevationM;

  // World axis direction (horizontal — pipes/ducts run flat in plan-space).
  const ux = dxWorld / lenPlan; // world X component of axis dir
  const uz = dzWorld / lenPlan; // world Z component of axis dir

  let geo: THREE.BufferGeometry;

  if (section.diameterMm !== null) {
    // ── Round pipe/duct → a SMOOTH cylinder. CylinderGeometry gives radial-smooth
    //    side normals + flat caps — the SAME primitive the fitting bodies use
    //    (coupling / elbow tube). The old ExtrudeGeometry of an N-gon profile baked
    //    per-FACE (flat) normals, so a round run looked faceted next to the smooth
    //    elbow/coupling. Now the run and its fittings render with one continuous
    //    surface. `ROUND_PROFILE_SEGMENTS` keeps the 2D glyph + 3D side count in sync.
    const rM = (section.diameterMm * MM_TO_M) / 2;
    geo = new THREE.CylinderGeometry(rM, rM, lenPlan, ROUND_PROFILE_SEGMENTS);
    // Orient the cylinder's local +Y axis → world axis dir, centred at the segment
    // midpoint (CylinderGeometry is centred on its origin, spanning ±length/2 in Y).
    const q = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(ux, 0, uz),
    );
    const m = new THREE.Matrix4().makeRotationFromQuaternion(q);
    m.setPosition((sx + ex) / 2, centreWorldY, -(sy + ey) / 2);
    geo.applyMatrix4(m);
  } else {
    // ── Rectangular duct → swept rect profile via ExtrudeGeometry. Sharp faceted
    //    edges are CORRECT for a box duct (a rect duct has flat walls + crisp arrises).
    const rectPts = buildRectProfile(widthMm, heightMm);
    const shape = new THREE.Shape();
    shape.moveTo(rectPts[0].x, rectPts[0].y);
    for (let i = 1; i < rectPts.length; i++) shape.lineTo(rectPts[i].x, rectPts[i].y);
    shape.closePath();
    geo = new THREE.ExtrudeGeometry(shape, { depth: lenPlan, bevelEnabled: false });

    // Basis matrix (beam-ishape pattern): local X (width) → perp (90° CCW in XZ),
    // local Y (height) → world up, local Z (extrude) → axis dir. Origin at the start
    // point @ centreline Y (the section is centred on (0,0) in its frame).
    const m = new THREE.Matrix4().makeBasis(
      new THREE.Vector3(-uz, 0, ux),
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(ux, 0, uz),
    );
    m.setPosition(sx, centreWorldY, -sy);
    geo.applyMatrix4(m);
  }

  // ── Material by domain (ADR-408 Φ8) or by system colour (Φ9/Φ10) ───────────
  // A segment joined to a pipe network paints with the System's tinted PBR;
  // unassigned (or colour-by-system OFF ⇒ undefined) keeps the domain default.
  const domainMatType = segment.params.domain === 'pipe' ? 'mep-pipe' : 'mep-duct';
  const material = systemColor !== undefined
    ? getSystemTintedMaterial3D(domainMatType, systemColor)
    : getElementMaterial3D(domainMatType);

  const mesh = new THREE.Mesh(geo, material);

  // ── userData (entityId pattern matching all other 3D converters) ───────────
  mesh.userData['entityId'] = segment.id;

  const matId = segment.params.material ?? `elem-mep-${segment.params.domain}`;
  const tagged = tagMesh(mesh, segment.id, 'mep-segment', matId, levelId);

  return tagged;
}
