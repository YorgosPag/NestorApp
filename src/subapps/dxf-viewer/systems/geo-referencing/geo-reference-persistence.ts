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

/** Read the project's raw ADR-369 geo fields once. */
async function readProjectGeoDoc(projectId: string): Promise<ProjectGeoDoc> {
  const snap = await getDoc(doc(db, COLLECTIONS.PROJECTS, projectId));
  return snap.exists() ? (snap.data() as ProjectGeoDoc) : {};
}

/**
 * One-shot read of the project's geo-reference. Returns `null` when the project is not
 * geo-referenced (no planar base point) or the doc is missing.
 */
export async function loadProjectGeoReference(projectId: string): Promise<GeoReference | null> {
  const data = await readProjectGeoDoc(projectId);
  return geoReferenceFromProject({ basePoint: data.basePoint, northRotation: data.northRotation });
}

/**
 * Persist a runtime {@link GeoReference} onto the project (ADR-369 metres). The current
 * `basePoint.z` elevation datum is READ FIRST and preserved — the planar transform never
 * touches Z, and a Firestore `basePoint` map write would otherwise clobber it.
 * `description` is an optional Revit-style audit note.
 */
export async function persistProjectGeoReference(
  projectId: string,
  geo: GeoReference,
  description?: string,
): Promise<void> {
  const existing = await readProjectGeoDoc(projectId);
  const existingZ = typeof existing.basePoint?.z === 'number' ? existing.basePoint.z : 0;
  const patch = geoReferenceToProjectPatch(geo, existingZ, description);
  await updateProjectWithPolicy({
    projectId,
    updates: { basePoint: patch.basePoint, northRotation: patch.northRotation },
  });
}

/**
 * Clear the project's planar geo-reference (Revit «reset shared coordinates»): drop
 * `basePoint.x/y` + zero `northRotation`, while PRESERVING the `basePoint.z` elevation
 * datum. After this, `geoReferenceFromProject` returns `null` → identity render.
 */
export async function clearProjectGeoReference(projectId: string): Promise<void> {
  const existing = await readProjectGeoDoc(projectId);
  const z = typeof existing.basePoint?.z === 'number' ? existing.basePoint.z : 0;
  await updateProjectWithPolicy({
    projectId,
    updates: { basePoint: { z }, northRotation: 0 },
  });
}
