/**
 * ADR-369 / ADR-650 M10 — boundary between the durable Project geo-reference fields
 * (METRES, ADR-369 3-tier Revit reference) and the runtime {@link GeoReference}
 * (canonical mm). This is the ONLY place metres↔mm conversion for geo-referencing
 * happens — the pure transform (`geo-transform.ts`) stays unit-agnostic mm, the topo
 * render path stays canonical mm, and the Project doc stays ADR-369 metres.
 *
 * ## Field mapping (Revit-canonical, ADR-369 §Q3 activated by M10)
 *   - `Project.basePoint.x/y` = ΕΓΣΑ WORLD coordinates (metres) of the project **local
 *     origin** (0,0) — i.e. the Revit «Project Base Point» expressed in shared coords.
 *     This is the geo-reference translation. (`basePoint.z` stays the elevation datum.)
 *   - `Project.northRotation` = local→world rotation (degrees). Revit «Angle to True
 *     North».
 *   - `Project.surveyPoint` = the geodetic benchmark/datum (z for MSL elevation, optional
 *     x/y as the control point, `reference` = EGSA87/WGS84…, `sourceDocument`). Consumed
 *     by IFC export (`ifc-spatial-hierarchy.buildSite`), NOT by the planar transform.
 *
 * Before M10, `basePoint.x/y` were «deferred until a separate ADR exposes lat/lon»
 * (see `ifc-spatial-hierarchy.ts`). M10 is that ADR: it activates the planar pair.
 *
 * @see ./geo-transform.ts — the pure rigid transform consuming {@link GeoReference}
 * @see ../../../types/project-elevation.schemas.ts — the Zod schemas (metres)
 */

import type { ProjectBasePoint } from '@/types/project-elevation.schemas';
import type { GeoReference } from './geo-transform';
import { isIdentityGeoReference } from './geo-transform';

/** ADR-462 canonical-mm scale — geometry authored in metres is baked ×1000. */
const M_TO_MM = 1000;
const MM_TO_M = 0.001;

/** The minimal durable geo-reference fields as they live on the `Project` doc. */
export interface ProjectGeoReferenceFields {
  readonly basePoint?: ProjectBasePoint;
  readonly northRotation?: number;
}

/**
 * Build the runtime {@link GeoReference} (canonical mm) from the Project's ADR-369
 * fields. Returns `null` when the project is NOT geo-referenced (no planar
 * `basePoint.x/y`) — callers treat `null` as identity so a non-geo-referenced project
 * renders unchanged (backward compatible).
 */
export function geoReferenceFromProject(
  fields: ProjectGeoReferenceFields | null | undefined,
): GeoReference | null {
  const bp = fields?.basePoint;
  if (!bp || typeof bp.x !== 'number' || typeof bp.y !== 'number') return null;
  return {
    originWorld: { x: bp.x * M_TO_MM, y: bp.y * M_TO_MM },
    rotationDeg: fields?.northRotation ?? 0,
  };
}

/** The ADR-369 patch pieces a save must write for a runtime {@link GeoReference}. */
export interface GeoReferencePatch {
  /** METRES — origin world coords + preserved elevation datum `z`. */
  readonly basePoint: ProjectBasePoint;
  /** DEGREES — local→world rotation. */
  readonly northRotation: number;
}

/**
 * Convert a runtime {@link GeoReference} (mm) back to the Project's ADR-369 fields
 * (metres) for persistence. `existingZ` preserves the elevation datum already on
 * `basePoint.z` (the transform is planar and never touches it). `description` is an
 * optional audit note (e.g. "γωνία οικοπέδου ΒΔ", Revit-style).
 */
export function geoReferenceToProjectPatch(
  geo: GeoReference,
  existingZ = 0,
  description?: string,
): GeoReferencePatch {
  return {
    basePoint: {
      z: existingZ,
      x: geo.originWorld.x * MM_TO_M,
      y: geo.originWorld.y * MM_TO_M,
      ...(description ? { description } : {}),
    },
    northRotation: geo.rotationDeg,
  };
}

/** `true` when the project has no meaningful geo-reference to persist (identity). */
export function isProjectGeoReferenced(
  fields: ProjectGeoReferenceFields | null | undefined,
): boolean {
  const geo = geoReferenceFromProject(fields);
  return geo !== null && !isIdentityGeoReference(geo);
}
