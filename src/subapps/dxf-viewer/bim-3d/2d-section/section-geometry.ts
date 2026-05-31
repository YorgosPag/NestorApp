/**
 * ADR-366 §A.3 Q3 Phase 7.0B — 2D Section Panel geometry builder.
 *
 * Builds 2D section meshes (filled rects + outlines) σε section space
 * (h horizontal, y vertical, σε world meters). Color-coded per element type
 * via SSoT `SECTION_2D_PANEL_COLORS` tokens.
 *
 * Port από `C:\genarc\src\engines\viewport\sectionGeometry.ts` (170 LOC,
 * PORT_WITH_ADAPTATION per SPEC-3D-004A §3.2) με:
 *   - input arrays of Nestor *Plan adapters (όχι GenArc records)
 *   - LOUPE_COLOR_* → SECTION_2D_PANEL_COLORS Nestor SSoT
 *   - userData tagging διατηρείται για picking (Phase 7.0B+ selection sync)
 *
 * @see SPEC-3D-004A §3.2 — GenArc port reference
 * @see ADR-366 §A.3 Q3
 */

import * as THREE from 'three';
import { SECTION_2D_PANEL_COLORS } from '../../config/color-config';
import {
  wallSection,
  columnSection,
  beamSection,
  slabSection,
  openingSection,
  clipByOpenings,
  type SectionAxis,
  type SectionRect,
  type WallPlan,
  type ColumnPlan,
  type BeamPlan,
  type SlabPlan,
  type OpeningPlan,
} from './section-intersect';

/**
 * Returned scene data for the panel renderer.
 * - `root`: Three.Group containing όλα τα meshes + outlines στο XY plane (z=0)
 * - `bbox`: union of all rects, για frame-to-fit
 * - `dispose`: releases geometries + materials
 */
export interface SectionPanelScene {
  readonly root: THREE.Group;
  readonly bbox: THREE.Box3;
  readonly dispose: () => void;
}

export type SectionElementType = 'wall' | 'column' | 'beam' | 'slab' | 'opening';

// ─── Materials ───────────────────────────────────────────────────────────────

interface SectionMaterials {
  readonly wall: THREE.MeshBasicMaterial;
  readonly column: THREE.MeshBasicMaterial;
  readonly beam: THREE.MeshBasicMaterial;
  readonly slab: THREE.MeshBasicMaterial;
  readonly selected: THREE.MeshBasicMaterial;
  readonly outline: THREE.LineBasicMaterial;
}

function buildMaterials(): SectionMaterials {
  return {
    wall: new THREE.MeshBasicMaterial({ color: SECTION_2D_PANEL_COLORS.wall }),
    column: new THREE.MeshBasicMaterial({ color: SECTION_2D_PANEL_COLORS.column }),
    beam: new THREE.MeshBasicMaterial({ color: SECTION_2D_PANEL_COLORS.beam }),
    slab: new THREE.MeshBasicMaterial({ color: SECTION_2D_PANEL_COLORS.slab }),
    selected: new THREE.MeshBasicMaterial({ color: SECTION_2D_PANEL_COLORS.selected }),
    outline: new THREE.LineBasicMaterial({ color: SECTION_2D_PANEL_COLORS.outline }),
  };
}

// ─── Rect → mesh + outline ───────────────────────────────────────────────────

function addFilledRect(
  rect: SectionRect,
  fill: THREE.MeshBasicMaterial,
  outlineMat: THREE.LineBasicMaterial,
  group: THREE.Group,
  geos: THREE.BufferGeometry[],
  bbox: THREE.Box3,
  elementId: string,
  elementType: SectionElementType,
): void {
  const w = rect.hMax - rect.hMin;
  const h = rect.yMax - rect.yMin;
  if (w < 1e-6 || h < 1e-6) return;
  const cx = (rect.hMin + rect.hMax) / 2;
  const cy = (rect.yMin + rect.yMax) / 2;

  const geo = new THREE.PlaneGeometry(w, h);
  const mesh = new THREE.Mesh(geo, fill);
  mesh.position.set(cx, cy, 0);
  mesh.userData['bimId'] = elementId;
  mesh.userData['bimType'] = elementType;
  group.add(mesh);

  const edgeGeo = new THREE.EdgesGeometry(geo);
  const outline = new THREE.LineSegments(edgeGeo, outlineMat);
  outline.position.set(cx, cy, 0.001);
  outline.userData['bimId'] = elementId;
  outline.userData['bimType'] = elementType;
  group.add(outline);

  geos.push(geo, edgeGeo);
  bbox.expandByPoint(new THREE.Vector3(rect.hMin, rect.yMin, 0));
  bbox.expandByPoint(new THREE.Vector3(rect.hMax, rect.yMax, 0));
}

// ─── Inputs ──────────────────────────────────────────────────────────────────

/**
 * Active cutting plane info για section build. axis + position σε plan-space
 * meters (Nestor convention — x-east, y-north).
 */
export interface SectionPlaneInput {
  readonly axis: SectionAxis;
  readonly position: number;
}

/**
 * Input set of BIM elements (post-adapter, plan-space). The renderer scans
 * όλα και προσθέτει όσα τέμνονται από την cutting plane.
 */
export interface SectionEntitiesInput {
  readonly walls: readonly WallPlan[];
  readonly columns: readonly ColumnPlan[];
  readonly beams: readonly BeamPlan[];
  readonly slabs: readonly SlabPlan[];
  readonly openings: readonly OpeningPlan[];
}

// ─── Main builder ────────────────────────────────────────────────────────────

export function buildSectionPanelScene(
  plane: SectionPlaneInput,
  entities: SectionEntitiesInput,
  selectedBimIds: readonly string[],
): SectionPanelScene {
  const mats = buildMaterials();
  const root = new THREE.Group();
  const bbox = new THREE.Box3();
  const geos: THREE.BufferGeometry[] = [];
  const { axis, position: pos } = plane;

  // Group openings by host wall για clipByOpenings subtraction.
  const openingsByWall = new Map<string, OpeningPlan[]>();
  for (const op of entities.openings) {
    const list = openingsByWall.get(op.wallId) ?? [];
    list.push(op);
    openingsByWall.set(op.wallId, list);
  }

  // Walls (με opening subtraction)
  for (const wall of entities.walls) {
    const wRect = wallSection(wall, axis, pos);
    if (!wRect) continue;
    const wallOpenings = openingsByWall.get(wall.id) ?? [];
    const gaps: { yMin: number; yMax: number }[] = [];
    for (const op of wallOpenings) {
      const oRect = openingSection(op, axis, pos);
      if (oRect) gaps.push({ yMin: oRect.yMin, yMax: oRect.yMax });
    }
    const fill = selectedBimIds.includes(wall.id) ? mats.selected : mats.wall;
    for (const r of clipByOpenings(wRect, gaps)) {
      addFilledRect(r, fill, mats.outline, root, geos, bbox, wall.id, 'wall');
    }
  }

  // Columns
  for (const col of entities.columns) {
    const rect = columnSection(col, axis, pos);
    if (!rect) continue;
    const fill = selectedBimIds.includes(col.id) ? mats.selected : mats.column;
    addFilledRect(rect, fill, mats.outline, root, geos, bbox, col.id, 'column');
  }

  // Beams
  for (const beam of entities.beams) {
    const rect = beamSection(beam, axis, pos);
    if (!rect) continue;
    const fill = selectedBimIds.includes(beam.id) ? mats.selected : mats.beam;
    addFilledRect(rect, fill, mats.outline, root, geos, bbox, beam.id, 'beam');
  }

  // Slabs
  for (const slab of entities.slabs) {
    const rect = slabSection(slab, axis, pos);
    if (!rect) continue;
    const fill = selectedBimIds.includes(slab.id) ? mats.selected : mats.slab;
    addFilledRect(rect, fill, mats.outline, root, geos, bbox, slab.id, 'slab');
  }

  function dispose(): void {
    geos.forEach((g) => g.dispose());
    mats.wall.dispose();
    mats.column.dispose();
    mats.beam.dispose();
    mats.slab.dispose();
    mats.selected.dispose();
    mats.outline.dispose();
  }

  return { root, bbox, dispose };
}
