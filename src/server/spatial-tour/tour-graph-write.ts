import 'server-only';

/**
 * @fileoverview **Ο ΓΡΑΦΕΑΣ ΤΟΥ ΓΡΑΦΟΥ** — τοποθέτηση/αφαίρεση λήψης, βελάκι, αποσύνδεση: η ΜΟΝΗ πόρτα προς
 * `SpatialTour.levels/nodes` και `TourCapture.nodeId` (ADR-884 Φ2β · §4.9).
 * @related `lib/spatial-tour/tour-graph-edit.ts` (οι καθαρές αλλαγές) · `lib/spatial-tour/spatial-tour-graph.ts` (τα
 *   αναλλοίωτα) · `tour-access-shared.ts` (`locateManagedTour` — η πόρτα του υπευθύνου) · `tour-viewer-stops.ts` (ο αναγνώστης)
 * @module server/spatial-tour/tour-graph-write
 *
 * 🔑 **Μόνο ο υπεύθυνος** (πρότυπο Matterport: ο φωτογράφος ανεβάζει, ο κάτοχος οργανώνει) — καμία νέα αρχή (Φ0.3).
 * 🔑 **Μία συναλλαγή**: περιήγηση + λήψη + (για αφαίρεση) οι άλλες λήψεις του κόμβου διαβάζονται και γράφονται **ατομικά**,
 * με `checkTourGraph` πριν από κάθε εγγραφή (Φ0.2 #5) και `revision + 1`. Παράβαση αναλλοίωτου εδώ = βλάβη του κώδικα ⇒
 * `throw`, ποτέ σιωπηλή εγγραφή· εξαίρεση το όριο κόμβων, που είναι ονομασμένη άρνηση (`graph-full`).
 */

import type { DocumentReference, Firestore, Transaction } from 'firebase-admin/firestore';

import { SUBCOLLECTIONS } from '@/config/firestore-collections';
import { nowISO } from '@/lib/date-local';
import { normalizeAngleRad } from '@/lib/geometry/angle';
import { checkTourGraph } from '@/lib/spatial-tour/spatial-tour-graph';
import { spatialTourFromDocument, tourCaptureFromDocument } from '@/lib/spatial-tour/spatial-tour-from-document';
import {
  linkNodes,
  nameNode,
  placeCapture,
  unlinkNodes,
  unplaceCapture,
  type TourGraphCommand,
  type TourGraphEditResult,
} from '@/lib/spatial-tour/tour-graph-edit';
import {
  calibrateLevel,
  orientNode,
  positionNode,
  setLevelFloorPlan,
  type FloorPlanChoice,
  type TourEditStamp,
} from '@/lib/spatial-tour/tour-plan-edit';
import { removeSeparation, removeSpace, upsertSeparation, upsertSpace } from '@/lib/spatial-tour/tour-space-edit';
import type { TourActor } from '@/lib/spatial-tour/tour-authority';
import { enterpriseIdService } from '@/services/enterprise-id.service';
import type { SpatialTour, TourCapture, TourSubject } from '@/types/spatial-tour';

import { locateManagedTour, refuseTourAccess, type TourAccessRefused } from './tour-access-shared';
import { prepareTourFloorPlan } from './tour-plan-prepare';

type TourGraphWriteOutcome =
  | { readonly kind: 'written' | 'unchanged'; readonly revision: number }
  | TourAccessRefused;

interface TxContext {
  readonly tx: Transaction;
  readonly tourRef: DocumentReference;
  readonly tour: SpatialTour;
  readonly stamp: TourEditStamp;
  /** Η κάτοψη που ετοιμάστηκε **πριν** τη συναλλαγή (εντολή `floorplan`) — `undefined` για κάθε άλλη εντολή. */
  readonly floorPlan?: FloorPlanChoice | null;
}

/**
 * Η αλλαγή, και τι αλλάζει στη λήψη: ο κόμβος της (τοποθέτηση · αφαίρεση — από το `captureNodeId`) ή ρητά πεδία
 * (προσανατολισμός).
 */
interface EditPlan {
  readonly result: TourGraphEditResult;
  readonly captureRef: DocumentReference | null;
  readonly captureFields?: Readonly<Record<string, unknown>>;
}

async function readCapture(ctx: TxContext, captureId: string): Promise<{ readonly ref: DocumentReference; readonly capture: TourCapture } | null> {
  const ref = ctx.tourRef.collection(SUBCOLLECTIONS.TOUR_CAPTURES).doc(captureId);
  const snap = await ctx.tx.get(ref);
  const capture = snap.exists ? tourCaptureFromDocument(snap.data(), captureId) : null;
  return capture === null ? null : { ref, capture };
}

/** Πόσες **άλλες** λήψεις κάθονται στον ίδιο κόμβο — αν καμία, ο κόμβος φεύγει μαζί με την τελευταία. */
async function othersOnNode(ctx: TxContext, nodeId: string, captureId: string): Promise<number> {
  // tenant-scope-exempt: υποσυλλογή ΚΑΤΩ από ΜΙΑ περιήγηση που ο υπεύθυνος ήδη πέρασε (`locateManagedTour`, ADR-884 Φ2β).
  const snap = await ctx.tx.get(ctx.tourRef.collection(SUBCOLLECTIONS.TOUR_CAPTURES).where('nodeId', '==', nodeId).limit(2));
  return snap.docs.filter((doc) => doc.id !== captureId).length;
}

/** Οι εντολές που αγγίζουν **μόνο** τον γράφο — καμία ανάγνωση λήψης. */
function planGraphOnly(ctx: TxContext, command: TourGraphCommand): TourGraphEditResult | null {
  switch (command.op) {
    case 'link': return linkNodes(ctx.tour, command.fromNodeId, command.toNodeId, command.bearingRad);
    case 'unlink': return unlinkNodes(ctx.tour, command.fromNodeId, command.toNodeId);
    case 'name': return nameNode(ctx.tour, command.nodeId, command.room);
    case 'floorplan': return setLevelFloorPlan(ctx.tour, command.levelKey, ctx.floorPlan ?? null, ctx.stamp);
    case 'calibrate': return calibrateLevel(ctx.tour, command.levelKey, command.metresPerPixel, ctx.stamp);
    case 'position': return positionNode(ctx.tour, command.nodeId, command.point);
    // Γ3γ-2α — το id το κόβει ο ΠΕΛΑΤΗΣ (Figma/Linear)· ο κριτής ελέγχει πρόθεμα/UUID και ξανακρίνει ό,τι έστειλε η οθόνη.
    case 'space': return upsertSpace(ctx.tour, command, ctx.stamp);
    case 'unspace': return removeSpace(ctx.tour, command.levelKey, command.spaceId);
    case 'separate': return upsertSeparation(ctx.tour, command, ctx.stamp);
    case 'unseparate': return removeSeparation(ctx.tour, command.levelKey, command.separationId);
    default: return null;
  }
}

/**
 * **Προσανατολισμός**: η λήψη πρέπει να κάθεται σε σημείο· τα βελάκια του σημείου στρέφονται κατά τη **διαφορά** και η λήψη
 * γράφει το νέο heading — στην **ίδια** συναλλαγή, αλλιώς τα βελάκια θα μετακινούνταν μέσα στη φωτογραφία.
 */
function planOrient(capture: TourCapture, ref: DocumentReference, ctx: TxContext, headingRad: number): EditPlan | TourAccessRefused {
  if (capture.nodeId === null) return refuseTourAccess('capture-unplaced');
  const heading = normalizeAngleRad(headingRad);
  const result = orientNode(ctx.tour, capture.nodeId, heading - capture.headingRad);
  return { result, captureRef: ref, captureFields: { headingRad: heading, headingSource: 'manual' } };
}

/** Η αλλαγή, και τι αλλάζει στη λήψη — ό,τι χρειάζεται για την εγγραφή. */
async function planCommand(ctx: TxContext, command: TourGraphCommand): Promise<EditPlan | TourAccessRefused> {
  const graphOnly = planGraphOnly(ctx, command);
  if (graphOnly !== null) return { result: graphOnly, captureRef: null };
  if (command.op !== 'place' && command.op !== 'unplace' && command.op !== 'orient') throw new Error(`Unplanned tour graph command: ${command.op}`);
  const found = await readCapture(ctx, command.captureId);
  if (found === null) return refuseTourAccess('capture-absent');
  if (command.op === 'orient') return planOrient(found.capture, found.ref, ctx, command.headingRad);
  if (command.op === 'place') {
    return { result: placeCapture(ctx.tour, found.capture, command.target, enterpriseIdService.generateTourNodeId()), captureRef: found.ref };
  }
  const others = found.capture.nodeId === null ? 0 : await othersOnNode(ctx, found.capture.nodeId, found.ref.id);
  return { result: unplaceCapture(ctx.tour, found.capture, others), captureRef: found.ref };
}

function applyEdit(ctx: TxContext, plan: EditPlan): TourGraphWriteOutcome {
  const { result } = plan;
  if (result.kind === 'refused') return refuseTourAccess(result.reason);
  if (result.kind === 'unchanged') return { kind: 'unchanged', revision: ctx.tour.revision };
  const violations = checkTourGraph(result.graph);
  if (violations.some((v) => v.kind === 'too-many-nodes' || v.kind === 'too-many-shapes')) return refuseTourAccess('graph-full');
  if (violations.length > 0) throw new Error(`Tour graph violates invariants: ${violations.map((v) => v.kind).join(',')}`);
  const revision = ctx.tour.revision + 1;
  ctx.tx.update(ctx.tourRef, { levels: result.graph.levels, nodes: result.graph.nodes, revision, updatedAt: ctx.stamp.at, updatedBy: ctx.stamp.uid });
  if (plan.captureRef !== null && result.captureNodeId !== undefined) ctx.tx.update(plan.captureRef, { nodeId: result.captureNodeId });
  if (plan.captureRef !== null && plan.captureFields !== undefined) ctx.tx.update(plan.captureRef, plan.captureFields);
  return { kind: 'written', revision };
}

/** Η κάτοψη της εντολής `floorplan`, κριμένη και έτοιμη — `undefined` για κάθε άλλη εντολή, `null` για «χωρίς κάτοψη». */
async function preparedFloorPlan(
  db: Firestore,
  tour: SpatialTour,
  command: TourGraphCommand,
): Promise<FloorPlanChoice | TourAccessRefused | null | undefined> {
  if (command.op !== 'floorplan') return undefined;
  return command.plan === null ? null : prepareTourFloorPlan(db, tour, command.plan);
}

/** **Άλλαξε τον γράφο** — μόνο ο υπεύθυνος, σε μία συναλλαγή. */
export async function writeTourGraph(
  db: Firestore,
  input: { readonly subject: TourSubject; readonly actor: TourActor; readonly command: TourGraphCommand },
): Promise<TourGraphWriteOutcome> {
  const managed = await locateManagedTour(db, input.subject, input.actor);
  if (managed.kind === 'refused') return managed;
  const { tourRef } = managed;
  const floorPlan = await preparedFloorPlan(db, managed.tour, input.command);
  if (floorPlan != null && 'kind' in floorPlan) return floorPlan;
  const stamp: TourEditStamp = { uid: input.actor.listing.uid, at: nowISO() };
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(tourRef);
    const tour = snap.exists ? spatialTourFromDocument(snap.data(), tourRef.id) : null;
    if (tour === null) return refuseTourAccess(snap.exists ? 'tour-unreadable' : 'tour-absent');
    const ctx: TxContext = { tx, tourRef, tour, stamp, floorPlan };
    const plan = await planCommand(ctx, input.command);
    if ('kind' in plan) return plan;
    return applyEdit(ctx, plan);
  });
}
