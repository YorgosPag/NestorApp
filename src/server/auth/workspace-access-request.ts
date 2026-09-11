import 'server-only';

/**
 * @fileoverview **Ο ΚΥΚΛΟΣ ΖΩΗΣ ΤΟΥ ΑΙΤΗΜΑΤΟΣ ΕΝΤΑΞΗΣ** — άνοιγμα, απόφαση, ανάγνωση (ADR-660 §6).
 * @related server/auth/pending-registration.ts (ο μόνος που ανοίγει) ·
 *          app/api/admin/set-user-claims (έγκριση) · app/api/admin/workspace-access-requests (απόρριψη)
 * @module server/auth/workspace-access-request
 *
 * 🔑 **ΕΝΑ αίτημα ανά (χώρος, πρόσωπο), ντετερμινιστικό id** ⇒ δύο συνδέσεις ταυτόχρονα ανοίγουν
 * **ένα** — χωρίς ερώτημα, μέσα στο ίδιο transaction με το `users/{uid}` (N.7.2 #2-#3).
 *
 * 🔒 **ΜΟΝΟ `pending →`**: απόφαση πάνω σε ήδη αποφασισμένο αίτημα **δεν** το ξαναγράφει. Και
 * **απορριφθέν αίτημα δεν ξανανοίγει μόνο του** σε κάθε σύνδεση (Atlassian: *«once denied, the
 * user can't request access again»* χωρίς ενέργεια διαχειριστή) — αλλιώς κάθε είσοδος θα
 * ξαναενοχλούσε άνθρωπο που έχει ήδη απαντήσει.
 *
 * 🔒 Η συλλογή είναι **deny-all** για πελάτες: η λίστα του διαχειριστή **και** η κατάσταση του
 * αιτούντα περνούν από διαδρομές διακομιστή. Ελάχιστη επιφάνεια κανόνων.
 */

import {
  FieldValue as AdminFieldValue,
  type DocumentReference,
  type DocumentData,
  type Transaction,
} from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { generateDeterministicWorkspaceAccessRequestId } from '@/services/enterprise-id.service';
import {
  isWorkspaceAccessRequestStatus,
  type OwnWorkspaceAccessState,
  type WorkspaceAccessDecision,
  type WorkspaceAccessRequestStatus,
  type WorkspaceAccessRequestView,
} from '@/types/workspace-access-request';

/** Όσα αιτήματα διαβάζει μια λίστα διαχειριστή — ο χώρος έχει λίγους αιτούντες· φραγμένο ρητά. */
const PENDING_LIST_LIMIT = 500;

function requestRef(companyId: string, uid: string): DocumentReference {
  return getAdminFirestore()
    .collection(COLLECTIONS.WORKSPACE_ACCESS_REQUESTS)
    .doc(generateDeterministicWorkspaceAccessRequestId(companyId, uid));
}

/** Ό,τι χρειάζεται το transaction από το υπάρχον αίτημα — διαβάζεται **πριν** από κάθε γραφή. */
export interface AccessRequestSnapshot {
  readonly ref: DocumentReference;
  readonly status: WorkspaceAccessRequestStatus | null;
  readonly notified: boolean;
}

export async function readAccessRequestInTx(tx: Transaction, companyId: string, uid: string): Promise<AccessRequestSnapshot> {
  const ref = requestRef(companyId, uid);
  const snap = await tx.get(ref);
  const data = snap.exists ? snap.data() : undefined;
  return {
    ref,
    status: isWorkspaceAccessRequestStatus(data?.status) ? data.status : null,
    notified: Boolean(data?.notifiedAt),
  };
}

export interface AccessRequestOpening {
  readonly companyId: string;
  readonly uid: string;
  readonly email: string;
  readonly displayName: string | null;
  readonly authProvider: string | null;
}

/**
 * **Άνοιξε — ΜΟΝΟ αν δεν υπάρχει.** Εκκρεμές χωρίς ειδοποίηση παίρνει τη σφραγίδα της·
 * αποφασισμένο **μένει ως έχει**.
 *
 * @returns `firstNotification` = αυτή η κλήση κέρδισε την **πρώτη** ειδοποίηση διαχειριστή.
 */
export function openAccessRequestInTx(
  tx: Transaction,
  snapshot: AccessRequestSnapshot,
  opening: AccessRequestOpening,
): { readonly status: WorkspaceAccessRequestStatus; readonly firstNotification: boolean } {
  if (snapshot.status === null) {
    tx.create(snapshot.ref, {
      id: snapshot.ref.id,
      companyId: opening.companyId,
      requesterUid: opening.uid,
      requesterEmail: opening.email,
      requesterName: opening.displayName,
      authProvider: opening.authProvider,
      status: 'pending' satisfies WorkspaceAccessRequestStatus,
      requestedAt: AdminFieldValue.serverTimestamp(),
      notifiedAt: AdminFieldValue.serverTimestamp(),
      decidedAt: null,
      decidedBy: null,
    });
    return { status: 'pending', firstNotification: true };
  }
  if (snapshot.status === 'pending' && !snapshot.notified) {
    tx.update(snapshot.ref, { notifiedAt: AdminFieldValue.serverTimestamp() });
    return { status: 'pending', firstNotification: true };
  }
  return { status: snapshot.status, firstNotification: false };
}

export type AccessDecisionOutcome =
  | { readonly kind: 'decided'; readonly request: WorkspaceAccessRequestView }
  /** Δεν υπάρχει αίτημα — π.χ. διαχειριστής που προσθέτει χρήστη χωρίς να τον ζητήσει εκείνος. */
  | { readonly kind: 'absent' }
  /** Ήδη αποφασισμένο — **καμία** γραφή (ιδεμποτησία, και ποτέ ανατροπή απόφασης σιωπηλά). */
  | { readonly kind: 'already'; readonly status: WorkspaceAccessRequestStatus };

function toIso(value: unknown): string | null {
  return typeof value === 'object' && value !== null && typeof (value as { toDate?: unknown }).toDate === 'function'
    ? (value as { toDate: () => Date }).toDate().toISOString()
    : null;
}

function toView(id: string, data: DocumentData): WorkspaceAccessRequestView | null {
  if (!isWorkspaceAccessRequestStatus(data.status) || typeof data.requesterUid !== 'string') return null;
  return {
    id,
    companyId: String(data.companyId ?? ''),
    requesterUid: data.requesterUid,
    requesterEmail: String(data.requesterEmail ?? ''),
    requesterName: typeof data.requesterName === 'string' ? data.requesterName : null,
    authProvider: typeof data.authProvider === 'string' ? data.authProvider : null,
    status: data.status,
    requestedAt: toIso(data.requestedAt),
    decidedAt: toIso(data.decidedAt),
    decidedBy: typeof data.decidedBy === 'string' ? data.decidedBy : null,
  };
}

/** **Απόφαση διαχειριστή** — transaction, **μόνο** πάνω σε εκκρεμές. */
export async function decideAccessRequest(input: {
  readonly companyId: string;
  readonly uid: string;
  readonly decision: WorkspaceAccessDecision;
  readonly decidedBy: string;
}): Promise<AccessDecisionOutcome> {
  const ref = requestRef(input.companyId, input.uid);
  return getAdminFirestore().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const view = snap.exists ? toView(snap.id, snap.data() ?? {}) : null;
    if (view === null) return { kind: 'absent' };
    if (view.status !== 'pending') return { kind: 'already', status: view.status };

    tx.update(ref, { status: input.decision, decidedAt: AdminFieldValue.serverTimestamp(), decidedBy: input.decidedBy });
    return { kind: 'decided', request: { ...view, status: input.decision, decidedBy: input.decidedBy } };
  });
}

/** **Τα εκκρεμή αιτήματα ΑΥΤΟΥ του χώρου** — ποτέ άλλου (η παλιά λίστα έβλεπε όλη την πλατφόρμα). */
export async function listPendingAccessRequests(companyId: string): Promise<WorkspaceAccessRequestView[]> {
  const snap = await getAdminFirestore()
    .collection(COLLECTIONS.WORKSPACE_ACCESS_REQUESTS)
    .where('companyId', '==', companyId)
    .where('status', '==', 'pending')
    .limit(PENDING_LIST_LIMIT)
    .get();
  return snap.docs.flatMap((doc) => {
    const view = toView(doc.id, doc.data());
    return view === null ? [] : [view];
  });
}

/** **Τι απέγινε το ΔΙΚΟ ΜΟΥ αίτημα;** — για την οθόνη αναμονής του αιτούντα. */
export async function readOwnAccessState(companyId: string, uid: string): Promise<OwnWorkspaceAccessState> {
  const snap = await requestRef(companyId, uid).get();
  const status = snap.exists ? snap.get('status') : undefined;
  return isWorkspaceAccessRequestStatus(status) ? status : 'none';
}
