/**
 * @fileoverview Firestore data fetcher for UC-017 Gantt AI (ADR-034 §12)
 * Fetches construction phases, tasks, resource assignments for a building.
 */

import 'server-only';

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FIELDS } from '@/config/firestore-field-constants';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import type {
  ConstructionPhase,
  ConstructionTask,
  ConstructionResourceAssignment,
} from '@/types/building/construction';

const logger = createModuleLogger('UC_017_GANTT_DATA_FETCHER');

export interface GanttScheduleData {
  phases: ConstructionPhase[];
  tasks: ConstructionTask[];
  resourceAssignments: ConstructionResourceAssignment[];
}

/**
 * Fetch all construction schedule data for a building or company.
 * buildingId narrows scope; null fetches across the company (capped at limits).
 */
export async function fetchGanttScheduleData(
  companyId: string,
  buildingId: string | null,
  requestId: string
): Promise<GanttScheduleData> {
  const db = getAdminFirestore();

  const [phases, tasks, resourceAssignments] = await Promise.all([
    fetchPhases(db, companyId, buildingId),
    fetchTasks(db, companyId, buildingId),
    fetchResourceAssignments(db, companyId, buildingId),
  ]);

  logger.info('UC-017 Gantt data fetched', {
    requestId,
    companyId,
    buildingId: buildingId ?? '(all)',
    phases: phases.length,
    tasks: tasks.length,
    assignments: resourceAssignments.length,
  });

  return { phases, tasks, resourceAssignments };
}

// ── Internal ──────────────────────────────────────────────────────────────────

function toFieldFilter(
  db: FirebaseFirestore.Firestore,
  collection: string,
  companyId: string,
  buildingId: string | null
): FirebaseFirestore.Query {
  if (buildingId) {
    // buildingId is globally unique — no need for companyId filter
    return db.collection(collection).where(FIELDS.BUILDING_ID, '==', buildingId);
  }
  return db.collection(collection).where(FIELDS.COMPANY_ID, '==', companyId);
}

async function fetchPhases(
  db: FirebaseFirestore.Firestore,
  companyId: string,
  buildingId: string | null
): Promise<ConstructionPhase[]> {
  const snap = await toFieldFilter(db, COLLECTIONS.CONSTRUCTION_PHASES, companyId, buildingId)
    .limit(200)
    .get();
  const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }) as ConstructionPhase);
  return docs.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

async function fetchTasks(
  db: FirebaseFirestore.Firestore,
  companyId: string,
  buildingId: string | null
): Promise<ConstructionTask[]> {
  const snap = await toFieldFilter(db, COLLECTIONS.CONSTRUCTION_TASKS, companyId, buildingId)
    .limit(500)
    .get();
  const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }) as ConstructionTask);
  return docs.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

async function fetchResourceAssignments(
  db: FirebaseFirestore.Firestore,
  companyId: string,
  buildingId: string | null
): Promise<ConstructionResourceAssignment[]> {
  const snap = await toFieldFilter(db, COLLECTIONS.CONSTRUCTION_RESOURCE_ASSIGNMENTS, companyId, buildingId)
    .limit(300)
    .get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }) as ConstructionResourceAssignment);
}
