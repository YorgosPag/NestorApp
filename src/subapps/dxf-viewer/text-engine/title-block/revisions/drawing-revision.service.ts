/**
 * ADR-651 Φάση Η — **η ιστορία αναθεωρήσεων ενός έργου** (Firestore, server-only).
 *
 * Επίπεδο: **ανά έργο** (Revit Sheet Issues/Revisions — απόφαση Giorgio 2026-07-14). Ο πίνακας
 * είναι **append-only**: μια αναθεώρηση καταχωρείται, δεν ενημερώνεται και δεν διαγράφεται —
 * αυτό ΕΙΝΑΙ το ιστορικό (γι' αυτό δεν εμπλέκεται το `entity_audit_trail` του ADR-195, που
 * είναι audit **πεδίων οντοτήτων**: άλλο επίπεδο, και ratchet-protected).
 *
 * **Idempotency δομική, όχι από τύχη** (N.7.2 #3): το doc id είναι **ντετερμινιστικό** ανά
 * `(projectId, snapshot.digest)`. Δύο κλικ «Νέα αναθεώρηση» χωρίς ενδιάμεση αλλαγή σχεδίου ⇒
 * ίδιο digest ⇒ **ίδιο doc id** ⇒ το service βρίσκει την υπάρχουσα εγγραφή και την επιστρέφει
 * (`created: false`). Καμία διπλή «2η Αναθεώρηση», ακόμη και με διπλό κλικ ή δύο καρτέλες.
 *
 * Ταυτότητες: enterprise id + `setDoc` (N.6 — ποτέ `addDoc`). Tenant isolation: το `companyId`
 * έρχεται **πάντα** από τα claims του route, ποτέ από το body.
 *
 * @module text-engine/title-block/revisions/drawing-revision.service
 */

import 'server-only';

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { generateDeterministicDrawingRevisionId } from '@/services/enterprise-id.service';
import { createModuleLogger } from '@/lib/telemetry';
import { nowISO } from '@/lib/date-local';
import { nextRevisionNumber } from './revision-numbering';
import type { CreateRevisionInput, DrawingRevision, RevisionSnapshot } from './revision.types';

const logger = createModuleLogger('DrawingRevisionService');

/** Ποιος καταχωρεί την αναθεώρηση — από τα claims, ποτέ από το body. */
export interface RevisionActor {
  readonly companyId: string;
  readonly userId: string;
  readonly userName: string;
}

export interface CreateRevisionResult {
  readonly revision: DrawingRevision;
  /** `false` ⇒ υπήρχε ήδη ίδια αναθεώρηση (idempotent no-op — δεν γράφτηκε τίποτα). */
  readonly created: boolean;
}

function revisionCollection() {
  return getAdminFirestore().collection(COLLECTIONS.DRAWING_REVISIONS);
}

/** Το σταθερό id μιας αναθεώρησης: ίδιο έργο + ίδιο αποτύπωμα σχεδίου ⇒ ίδιο doc. */
function revisionDocId(projectId: string, digest: string): string {
  return generateDeterministicDrawingRevisionId(`${projectId}|${digest}`);
}

function toRevision(data: FirebaseFirestore.DocumentData): DrawingRevision {
  return {
    id: String(data.id),
    companyId: String(data.companyId),
    projectId: String(data.projectId),
    number: Number(data.number),
    issuedAt: String(data.issuedAt),
    authorId: String(data.authorId),
    authorName: String(data.authorName ?? ''),
    description: String(data.description ?? ''),
    snapshot: (data.snapshot ?? { sheets: [], digest: '' }) as RevisionSnapshot,
  };
}

/**
 * Η ιστορία ενός έργου, **αύξουσα κατά αριθμό** (1η, 2η, 3η…).
 *
 * Η ταξινόμηση γίνεται στη μνήμη (οι αναθεωρήσεις ενός έργου είναι δεκάδες, όχι χιλιάδες)
 * ώστε το query να μένει `where(companyId) + where(projectId)` — κανένα composite index,
 * καμία νέα καταχώρηση στο `firestore.indexes.json`.
 */
export async function listRevisions(
  companyId: string,
  projectId: string,
): Promise<DrawingRevision[]> {
  const snapshot = await revisionCollection()
    .where('companyId', '==', companyId) // tenant isolation (CHECK 3.10)
    .where('projectId', '==', projectId)
    .get();

  return snapshot.docs
    .map((doc) => toRevision(doc.data()))
    .sort((a, b) => a.number - b.number);
}

/** Η τελευταία (τρέχουσα) αναθεώρηση — αυτή που τυπώνεται στην πινακίδα. */
export async function latestRevision(
  companyId: string,
  projectId: string,
): Promise<DrawingRevision | null> {
  const revisions = await listRevisions(companyId, projectId);
  return revisions.length > 0 ? revisions[revisions.length - 1] : null;
}

/**
 * Καταχώρηση νέας αναθεώρησης. Ο **αριθμός** παράγεται εδώ (server = η πηγή αλήθειας της
 * ιστορίας), ποτέ από τον client. Η **περιγραφή** έρχεται εγκεκριμένη από τον χρήστη (AI
 * πρόταση ή χειροκίνητη — ποτέ αυτόματη εγγραφή, Απόφαση #9).
 */
export async function createRevision(
  input: CreateRevisionInput,
  actor: RevisionActor,
): Promise<CreateRevisionResult> {
  const id = revisionDocId(input.projectId, input.snapshot.digest);
  const ref = revisionCollection().doc(id);

  const existing = await ref.get();
  if (existing.exists) {
    logger.info('Revision already recorded — idempotent no-op', { id, projectId: input.projectId });
    return { revision: toRevision(existing.data() as FirebaseFirestore.DocumentData), created: false };
  }

  const history = await listRevisions(actor.companyId, input.projectId);
  const revision: DrawingRevision = {
    id,
    companyId: actor.companyId,
    projectId: input.projectId,
    number: nextRevisionNumber(history),
    issuedAt: nowISO(), // SSoT date-local (ADR-314 Φ C.1) — ποτέ inline ISO timestamp
    authorId: actor.userId,
    authorName: actor.userName,
    description: input.description,
    snapshot: input.snapshot,
  };

  await ref.set(revision); // N.6 — setDoc με enterprise id (ποτέ addDoc)
  logger.info('Revision recorded', { id, number: revision.number, projectId: input.projectId });
  return { revision, created: true };
}
