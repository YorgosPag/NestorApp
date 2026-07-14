'use client';

/**
 * ADR-650 M10 — geo-reference durable I/O against the `Project` doc (ADR-369 fields).
 *
 * Read/write the canonical geo-reference on `projects/{id}` (`basePoint` = origin world
 * coords in METRES, `northRotation` = degrees). The runtime store (`geo-reference-store`)
 * mirrors it in canonical mm; this module is the ONLY Firestore/API boundary. Mirrors the
 * `OpeningTagStyleHost` precedent (one-shot `getDoc` hydrate + `updateProjectWithPolicy`
 * write) so geo-referencing edits land on the same project document.
 *
 * @see ./geo-reference-schema.ts — metres↔mm conversion (pure)
 * @see ../../../app/GeoReferenceHost.tsx — the hydration lifecycle owner
 */

import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import { updateProjectWithPolicy } from '@/services/projects/project-mutation-gateway';
import type { ProjectBasePoint } from '@/types/project-elevation.schemas';
import { geoReferenceFromProject, geoReferenceToProjectPatch } from './geo-reference-schema';
import type { GeoReference } from './geo-transform';

interface ProjectGeoDoc {
  readonly basePoint?: ProjectBasePoint;
  readonly northRotation?: number;
}

/**
 * One-shot read of the project's geo-reference. Returns `null` when the project is not
 * geo-referenced (no planar base point) or the doc is missing.
 */
export async function loadProjectGeoReference(projectId: string): Promise<GeoReference | null> {
  const snap = await getDoc(doc(db, COLLECTIONS.PROJECTS, projectId));
  const data = snap.exists() ? (snap.data() as ProjectGeoDoc) : {};
  return geoReferenceFromProject({ basePoint: data.basePoint, northRotation: data.northRotation });
}

/**
 * Persist a runtime {@link GeoReference} onto the project (ADR-369 metres). `existingZ`
 * preserves the elevation datum already on `basePoint.z` (the planar transform never
 * touches it). `description` is an optional Revit-style audit note.
 */
export async function persistProjectGeoReference(
  projectId: string,
  geo: GeoReference,
  existingZ = 0,
  description?: string,
): Promise<void> {
  const patch = geoReferenceToProjectPatch(geo, existingZ, description);
  await updateProjectWithPolicy({
    projectId,
    updates: { basePoint: patch.basePoint, northRotation: patch.northRotation },
  });
}
