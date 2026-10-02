/**
 * ADR-245 / ADR-266 — SSoT για τη μετατροπή εγγράφων Firestore σε
 * `ConstructionPhase` / `ConstructionTask`.
 *
 * Ο ίδιος πεδίο-προς-πεδίο mapper ήταν γραμμένος **δύο φορές** (στο GET του
 * `construction-phases` και στο POST του `construction-baselines`, όπου φτιάχνεται
 * το στιγμιότυπο). Δεν είναι ίδια «μορφή» — είναι **ίδια απάντηση**: το baseline
 * πρέπει να παγώσει *ακριβώς* ό,τι θα διάβαζε το GET, αλλιώς η σύγκριση
 * «baseline vs actual» συγκρίνει δύο διαφορετικά σχήματα. Ένα πεδίο που θα
 * προστεθεί σε έναν μόνο mapper είναι σιωπηλή απόκλιση, όχι σφάλμα μεταγλώττισης.
 *
 * Φάση και εργασία διαφέρουν σε **τρία** πεδία (`status` άλλης ένωσης, `phaseId`,
 * `dependencies`) — τα υπόλοιπα 18 είναι κοινά και ζουν σε μία συνάρτηση.
 *
 * @module lib/api/construction-doc-mappers
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import { FIELDS } from '@/config/firestore-field-constants';
import { normalizeToISO } from '@/lib/date-local';
import type { AdminFirestore } from '@/lib/api/building-scoped-route';
import { isLegalStage } from '@/lib/objective-value/objective-value-stages';
import type { ConstructionPhase, ConstructionTask } from '@/types/building/construction';

/** Δομικός τύπος — χρειάζονται μόνο `id` + `data()`, καμία εξάρτηση από firebase-admin. */
interface ConstructionDocLike {
  readonly id: string;
  data(): unknown;
}

/** Ό,τι μοιράζονται φάση και εργασία: τα πάντα εκτός από το `status` και τα ειδικά της εργασίας. */
type ConstructionCommonFields = Omit<ConstructionPhase, 'status'>;

function mapCommonConstructionFields(doc: ConstructionDocLike): ConstructionCommonFields {
  const d = doc.data() as Omit<ConstructionPhase, 'id' | 'status'>;
  return {
    id: doc.id,
    buildingId: d.buildingId,
    companyId: d.companyId,
    name: d.name,
    code: d.code,
    order: d.order,
    plannedStartDate: d.plannedStartDate,
    plannedEndDate: d.plannedEndDate,
    actualStartDate: d.actualStartDate,
    actualEndDate: d.actualEndDate,
    progress: d.progress ?? 0,
    barColor: d.barColor,
    description: d.description,
    delayReason: d.delayReason ?? null,
    delayNote: d.delayNote ?? null,
    createdAt: normalizeToISO(d.createdAt) ?? undefined,
    updatedAt: normalizeToISO(d.updatedAt) ?? undefined,
    createdBy: d.createdBy,
    updatedBy: d.updatedBy,
  };
}

/** Η ετικέτα νόμου (ADR-898 Φ4) διαβάζεται **αυστηρά**: άγνωστη τιμή ⇒ `null`, ποτέ στάδιο που δεν δηλώθηκε. */
export function mapConstructionPhaseDoc(doc: ConstructionDocLike): ConstructionPhase {
  const { status, legalStage } = doc.data() as Pick<ConstructionPhase, 'status'> & { readonly legalStage?: unknown };
  return { ...mapCommonConstructionFields(doc), status, legalStage: isLegalStage(legalStage) ? legalStage : null };
}

export function mapConstructionTaskDoc(doc: ConstructionDocLike): ConstructionTask {
  const d = doc.data() as Pick<ConstructionTask, 'status' | 'phaseId' | 'dependencies'>;
  return {
    ...mapCommonConstructionFields(doc),
    status: d.status,
    phaseId: d.phaseId,
    dependencies: d.dependencies ?? [],
  };
}

export interface PhasesAndTasks {
  readonly phases: ConstructionPhase[];
  readonly tasks: ConstructionTask[];
}

/**
 * Οι φάσεις ενός κτηρίου, ταξινομημένες κατά `order` — **μόνες τους** (ADR-898 Φ4: το στάδιο του νόμου διαβάζει
 * μόνο φάσεις· οι εργασίες θα ήταν άσκοπη ανάγνωση). Το ίδιο ερώτημα με το {@link fetchPhasesAndTasks}, που το καλεί.
 */
export async function fetchConstructionPhases(adminDb: AdminFirestore, buildingId: string): Promise<ConstructionPhase[]> {
  const snapshot = await adminDb
    .collection(COLLECTIONS.CONSTRUCTION_PHASES)
    .where(FIELDS.BUILDING_ID, '==', buildingId)
    .orderBy('order', 'asc')
    .get();
  return snapshot.docs.map(mapConstructionPhaseDoc);
}

/**
 * Παράλληλη ανάγνωση φάσεων + εργασιών ενός κτηρίου, ταξινομημένων κατά `order`.
 * Η ταξινόμηση είναι μέρος του συμβολαίου: το Gantt την εμπιστεύεται και δεν
 * ξανα-ταξινομεί στον πελάτη.
 */
export async function fetchPhasesAndTasks(
  adminDb: AdminFirestore,
  buildingId: string,
): Promise<PhasesAndTasks> {
  const [phases, tasksSnapshot] = await Promise.all([
    fetchConstructionPhases(adminDb, buildingId),
    adminDb
      .collection(COLLECTIONS.CONSTRUCTION_TASKS)
      .where(FIELDS.BUILDING_ID, '==', buildingId)
      .orderBy('order', 'asc')
      .get(),
  ]);

  return { phases, tasks: tasksSnapshot.docs.map(mapConstructionTaskDoc) };
}
