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
import { checkTourGraph } from '@/lib/spatial-tour/spatial-tour-graph';
import { spatialTourFromDocument, tourCaptureFromDocument } from '@/lib/spatial-tour/spatial-tour-from-document';
import {
  linkNodes,
  placeCapture,
  unlinkNodes,
  unplaceCapture,
  type TourGraphCommand,
  type TourGraphEditResult,
} from '@/lib/spatial-tour/tour-graph-edit';
import type { TourActor } from '@/lib/spatial-tour/tour-authority';
import { enterpriseIdService } from '@/services/enterprise-id.service';
import type { SpatialTour, TourCapture, TourSubject } from '@/types/spatial-tour';

import { locateManagedTour, refuseTourAccess, type TourAccessRefused } from './tour-access-shared';

type TourGraphWriteOutcome =
  | { readonly kind: 'written' | 'unchanged'; readonly revision: number }
  | TourAccessRefused;

interface TxContext {
  readonly tx: Transaction;
  readonly tourRef: DocumentReference;
  readonly tour: SpatialTour;
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

/** Η αλλαγή, και ποια λήψη αλλάζει κόμβο — ό,τι χρειάζεται για την εγγραφή. */
async function planCommand(
  ctx: TxContext,
  command: TourGraphCommand,
): Promise<{ readonly result: TourGraphEditResult; readonly captureRef: DocumentReference | null } | TourAccessRefused> {
  if (command.op === 'link') return { result: linkNodes(ctx.tour, command.fromNodeId, command.toNodeId, command.bearingRad), captureRef: null };
  if (command.op === 'unlink') return { result: unlinkNodes(ctx.tour, command.fromNodeId, command.toNodeId), captureRef: null };
  const found = await readCapture(ctx, command.captureId);
  if (found === null) return refuseTourAccess('capture-absent');
  if (command.op === 'place') {
    return { result: placeCapture(ctx.tour, found.capture, command.target, enterpriseIdService.generateTourNodeId()), captureRef: found.ref };
  }
  const others = found.capture.nodeId === null ? 0 : await othersOnNode(ctx, found.capture.nodeId, found.ref.id);
  return { result: unplaceCapture(ctx.tour, found.capture, others), captureRef: found.ref };
}

function applyEdit(ctx: TxContext, plan: { readonly result: TourGraphEditResult; readonly captureRef: DocumentReference | null }, actorUid: string): TourGraphWriteOutcome {
  const { result } = plan;
  if (result.kind === 'refused') return refuseTourAccess(result.reason);
  if (result.kind === 'unchanged') return { kind: 'unchanged', revision: ctx.tour.revision };
  const violations = checkTourGraph(result.graph);
  if (violations.some((v) => v.kind === 'too-many-nodes')) return refuseTourAccess('graph-full');
  if (violations.length > 0) throw new Error(`Tour graph violates invariants: ${violations.map((v) => v.kind).join(',')}`);
  const revision = ctx.tour.revision + 1;
  ctx.tx.update(ctx.tourRef, { levels: result.graph.levels, nodes: result.graph.nodes, revision, updatedAt: nowISO(), updatedBy: actorUid });
  if (plan.captureRef !== null && result.captureNodeId !== undefined) ctx.tx.update(plan.captureRef, { nodeId: result.captureNodeId });
  return { kind: 'written', revision };
}

/** **Άλλαξε τον γράφο** — μόνο ο υπεύθυνος, σε μία συναλλαγή. */
export async function writeTourGraph(
  db: Firestore,
  input: { readonly subject: TourSubject; readonly actor: TourActor; readonly command: TourGraphCommand },
): Promise<TourGraphWriteOutcome> {
  const managed = await locateManagedTour(db, input.subject, input.actor);
  if (managed.kind === 'refused') return managed;
  const { tourRef } = managed;
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(tourRef);
    const tour = snap.exists ? spatialTourFromDocument(snap.data(), tourRef.id) : null;
    if (tour === null) return refuseTourAccess(snap.exists ? 'tour-unreadable' : 'tour-absent');
    const ctx: TxContext = { tx, tourRef, tour };
    const plan = await planCommand(ctx, input.command);
    if ('kind' in plan) return plan;
    return applyEdit(ctx, plan, input.actor.listing.uid);
  });
}
