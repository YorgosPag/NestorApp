/**
 * @fileoverview Data fetcher for UC-011 Admin Project Status (ADR-145)
 * @description Bottom-up discovery: Buildings → Projects → Phases → Units
 *
 * Problem: Some buildings reference projects that DON'T exist
 * in the `projects` collection (seeded/legacy data).
 *
 * Solution: Start from buildings (which ALL have companyId),
 * then resolve projects — not the other way around.
 */

import 'server-only';

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FIELDS } from '@/config/firestore-field-constants';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import type { ProjectInfo, PropertyStats, ProjectWithDetails } from './project-status-types';
import { STATUS_LABELS, EMPTY_STATS } from './project-status-types';

const logger = createModuleLogger('UC_011_DATA_FETCHER');
const BATCH_SIZE = 30;

/**
 * Fetches all project data for a company using bottom-up discovery.
 * Returns enriched project details with building, Gantt, and unit stats.
 */
export async function fetchProjectDetails(
  companyId: string,
  requestId: string
): Promise<ProjectWithDetails[]> {
  const adminDb = getAdminFirestore();

  // STEP 1: Get ALL buildings for this company
  const buildingsSnapshot = await adminDb
    .collection(COLLECTIONS.BUILDINGS)
    .where(FIELDS.COMPANY_ID, '==', companyId)
    .limit(200)
    .get();

  const buildingsByProject = new Map<string, Array<{ id: string; name: string }>>();
  const allBuildingIds: string[] = [];
  const buildingToProject = new Map<string, string>();
  const uniqueProjectIds = new Set<string>();

  for (const doc of buildingsSnapshot.docs) {
    const data = doc.data();
    const projId = (data.projectId as string) ?? 'unknown';
    allBuildingIds.push(doc.id);
    buildingToProject.set(doc.id, projId);
    uniqueProjectIds.add(projId);

    if (!buildingsByProject.has(projId)) {
      buildingsByProject.set(projId, []);
    }
    buildingsByProject.get(projId)!.push({
      id: doc.id,
      name: (data.name as string) ?? doc.id,
    });
  }

  // Also get projects by companyId (for projects without buildings)
  const projectsSnapshot = await adminDb
    .collection(COLLECTIONS.PROJECTS)
    .where(FIELDS.COMPANY_ID, '==', companyId)
    .limit(50)
    .get();

  for (const doc of projectsSnapshot.docs) {
    uniqueProjectIds.add(doc.id);
  }

  logger.info('Bottom-up discovery', {
    requestId,
    totalBuildings: allBuildingIds.length,
    uniqueProjectIds: uniqueProjectIds.size,
    projectsFromCollection: projectsSnapshot.size,
  });

  // STEP 2: Resolve project info
  const projectInfoMap = resolveProjectInfo(
    projectsSnapshot.docs,
    Array.from(uniqueProjectIds),
    buildingsByProject,
    adminDb
  );
  const resolvedInfoMap = await projectInfoMap;

  // STEP 3: Gantt detection
  const { buildingsWithGantt, ganttPhaseCount } = await fetchGanttData(
    allBuildingIds, adminDb, requestId
  );

  // STEP 4: Unit stats
  const propertiesByProject = await fetchPropertyStats(
    allBuildingIds, buildingToProject, adminDb
  );

  logger.info('Enrichment complete', {
    requestId,
    buildingsWithGantt: buildingsWithGantt.size,
    totalPhases: Array.from(ganttPhaseCount.values()).reduce((a, b) => a + b, 0),
  });

  // STEP 5: Assemble
  const projectIdArray = Array.from(uniqueProjectIds);
  const allProjectDetails: ProjectWithDetails[] = [];

  for (const projId of projectIdArray) {
    const info = resolvedInfoMap.get(projId);
    if (!info) continue;

    const buildings = buildingsByProject.get(projId) ?? [];
    const ganttBuildings = buildings
      .filter((b) => buildingsWithGantt.has(b.id))
      .map((b) => ({
        buildingName: b.name,
        phaseCount: ganttPhaseCount.get(b.id) ?? 0,
      }));

    allProjectDetails.push({
      project: info,
      propertyStats: propertiesByProject.get(projId) ?? EMPTY_STATS,
      hasGantt: ganttBuildings.length > 0,
      buildingCount: buildings.length,
      ganttDetails: ganttBuildings,
    });
  }

  return allProjectDetails;
}

// ── Internal helpers ──────────────────────────────────────────────────────

async function resolveProjectInfo(
  projectDocs: FirebaseFirestore.QueryDocumentSnapshot[],
  allProjectIds: string[],
  buildingsByProject: Map<string, Array<{ id: string; name: string }>>,
  adminDb: FirebaseFirestore.Firestore
): Promise<Map<string, ProjectInfo>> {
  const map = new Map<string, ProjectInfo>();

  // Index from collection query
  for (const doc of projectDocs) {
    const data = doc.data();
    const status = (data.status as string) ?? null;
    map.set(doc.id, {
      projectId: doc.id,
      name: (data.name ?? data.title ?? 'Χωρίς όνομα') as string,
      status,
      statusLabel: status ? (STATUS_LABELS[status] ?? status) : null,
      address: (data.address as string) ?? null,
      description: (data.description as string) ?? null,
      progress: typeof data.progress === 'number' ? data.progress : 0,
      updatedAt: (data.updatedAt as string) ?? (data.lastModified as string) ?? null,
    });
  }

  // Fetch missing project docs (referenced by buildings but not in companyId query)
  const missingIds = allProjectIds.filter((id) => !map.has(id));
  for (let i = 0; i < missingIds.length; i += BATCH_SIZE) {
    const batch = missingIds.slice(i, i + BATCH_SIZE);
    const refs = batch.map((id) => adminDb.collection(COLLECTIONS.PROJECTS).doc(id));
    const docs = await adminDb.getAll(...refs);
    for (const doc of docs) {
      if (!doc.exists) {
        const buildings = buildingsByProject.get(doc.id) ?? [];
        const buildingNames = buildings.map((b) => b.name).join(', ');
        map.set(doc.id, {
          projectId: doc.id,
          name: buildingNames || doc.id.slice(0, 8),
          status: null, statusLabel: null, address: null,
          description: null, progress: 0, updatedAt: null,
        });
        continue;
      }
      const data = doc.data()!;
      const status = (data.status as string) ?? null;
      map.set(doc.id, {
        projectId: doc.id,
        name: (data.name ?? data.title ?? 'Χωρίς όνομα') as string,
        status,
        statusLabel: status ? (STATUS_LABELS[status] ?? status) : null,
        address: (data.address as string) ?? null,
        description: (data.description as string) ?? null,
        progress: typeof data.progress === 'number' ? data.progress : 0,
        updatedAt: (data.updatedAt as string) ?? (data.lastModified as string) ?? null,
      });
    }
  }

  return map;
}

async function fetchGanttData(
  allBuildingIds: string[],
  adminDb: FirebaseFirestore.Firestore,
  requestId: string
): Promise<{ buildingsWithGantt: Set<string>; ganttPhaseCount: Map<string, number> }> {
  const buildingsWithGantt = new Set<string>();
  const ganttPhaseCount = new Map<string, number>();

  for (let i = 0; i < allBuildingIds.length; i += BATCH_SIZE) {
    const batch = allBuildingIds.slice(i, i + BATCH_SIZE);
    if (batch.length === 0) continue;

    const snapshot = await adminDb
      .collection(COLLECTIONS.CONSTRUCTION_PHASES)
      .where(FIELDS.BUILDING_ID, 'in', batch)
      .limit(1000)
      .get();

    for (const doc of snapshot.docs) {
      const bId = doc.data().buildingId as string;
      buildingsWithGantt.add(bId);
      ganttPhaseCount.set(bId, (ganttPhaseCount.get(bId) ?? 0) + 1);
    }
  }

  return { buildingsWithGantt, ganttPhaseCount };
}

async function fetchPropertyStats(
  allBuildingIds: string[],
  buildingToProject: Map<string, string>,
  adminDb: FirebaseFirestore.Firestore
): Promise<Map<string, PropertyStats>> {
  const propertiesByProject = new Map<string, PropertyStats>();

  for (let i = 0; i < allBuildingIds.length; i += BATCH_SIZE) {
    const batch = allBuildingIds.slice(i, i + BATCH_SIZE);
    if (batch.length === 0) continue;

    const snapshot = await adminDb
      .collection(COLLECTIONS.PROPERTIES)
      .where(FIELDS.BUILDING_ID, 'in', batch)
      .limit(2000)
      .get();

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const bId = data.buildingId as string;
      const projId = buildingToProject.get(bId);
      if (!projId) continue;

      if (!propertiesByProject.has(projId)) {
        propertiesByProject.set(projId, { total: 0, sold: 0, available: 0, reserved: 0, other: 0 });
      }
      const stats = propertiesByProject.get(projId)!;
      stats.total++;
      const propertyStatus = ((data.status ?? '') as string).toLowerCase();
      if (propertyStatus === 'sold' || propertyStatus === 'πωλημένο') stats.sold++;
      else if (propertyStatus === 'available' || propertyStatus === 'διαθέσιμο') stats.available++;
      else if (propertyStatus === 'reserved' || propertyStatus === 'κρατημένο') stats.reserved++;
      else stats.other++;
    }
  }

  return propertiesByProject;
}
