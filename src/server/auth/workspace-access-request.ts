import 'server-only';

/**
 * @fileoverview **Ο ΚΥΚΛΟΣ ΖΩΗΣ ΤΟΥ ΑΙΤΗΜΑΤΟΣ ΕΝΤΑΞΗΣ** — απόφαση και ανάγνωση (ADR-660 §6 · ADR-853 Α4).
 * @related app/api/admin/set-user-claims (έγκριση) · app/api/admin/workspace-access-requests (απόρριψη) ·
 *          app/api/auth/workspace-access-request (η κατάσταση του ίδιου του αιτούντα)
 * @module server/auth/workspace-access-request
 *
 * 🔒 **ΜΟΝΟ `pending →`**: απόφαση πάνω σε ήδη αποφασισμένο αίτημα **δεν** το ξαναγράφει.
 *
 * 🔒 Η συλλογή είναι **deny-all** για πελάτες: η λίστα του διαχειριστή **και** η κατάσταση του
 * αιτούντα περνούν από διαδρομές διακομιστή. Ελάχιστη επιφάνεια κανόνων.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 ADR-853 Α4 — ΤΟ ΑΙΤΗΜΑ **ΠΑΓΩΣΕ**: ΚΑΝΕΙΣ ΔΕΝ ΤΟ ΑΝΟΙΓΕΙ ΠΙΑ
 * ─────────────────────────────────────────────────────────────────────────────
 * Μέχρι σήμερα το άνοιγμα γινόταν **αυτόματα σε κάθε σύνδεση χωρίς χώρο**, προς
 * την **σταθερή** εταιρεία του `getCompanyId()` — δηλαδή κανείς δεν αποφάσιζε ότι
 * ο άνθρωπος ανήκει εκεί (περιστατικό 2026-09-11, ADR-853 §1). Η ένταξη σε ξένο
 * χώρο ξεκινά πλέον **από τον χώρο**, με **πρόσκληση** (ADR-853 Α1).
 *
 * ⚠️ **ΓΙ' ΑΥΤΟ ΤΟ `openAccessRequestInTx` ΚΑΙ ΤΟ `readAccessRequestInTx` ΔΙΑΓΡΑΦΗΚΑΝ.**
 * Δεν «έμειναν για μελλοντική χρήση»: μια εξαγόμενη συνάρτηση χωρίς καλούντα είναι
 * **νεκρός κώδικας** (CHECK 3.22) — και, χειρότερα, **ανοιχτή πόρτα** που ο επόμενος
 * θα καλούσε νομίζοντας ότι είναι ο δρόμος. Τα **υπάρχοντα** εκκρεμή αιτήματα
 * κρίνονται κανονικά από τη λίστα και την απόφαση παρακάτω.
 *
 * 🔶 Το ρητό *«ζητώ είσοδο»* (ADR-660 §6.6) μένει **ανοιχτό με λόγο**: κανένα από τα
 * έξι επαγγελματικά προϊόντα της έρευνας (GitHub · Autodesk · BIMcloud · Maxon ·
 * Zillow · Idealista) δεν το έχει — ADR-853 Α1.
 */

import {
  FieldValue as AdminFieldValue,
  type DocumentReference,
  type DocumentData,
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

/** Πόσα αιτήματα του **ίδιου ανθρώπου** διαβάζονται — ένας άνθρωπος δεν ζήτησε ποτέ 50 χώρους. */
const OWN_REQUESTS_LIMIT = 50;

function requestRef(companyId: string, uid: string): DocumentReference {
  return getAdminFirestore()
    .collection(COLLECTIONS.WORKSPACE_ACCESS_REQUESTS)
    .doc(generateDeterministicWorkspaceAccessRequestId(companyId, uid));
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

/**
 * **Η ΣΕΙΡΑ ΠΡΟΤΕΡΑΙΟΤΗΤΑΣ — γραμμένη, όχι υπονοούμενη.**
 *
 * Ένας άνθρωπος μπορεί να έχει αιτήματα σε **περισσότερους από έναν** χώρους. Η οθόνη
 * αναμονής ρωτά **ένα** πράγμα (*«περιμένω;»*), οπότε κάποιος πρέπει να διαλέξει — και
 * το να διαλέγει **σιωπηλά** το πρώτο έγγραφο που γύρισε η Firestore θα ήταν απάντηση
 * που αλλάζει χωρίς να αλλάξει τίποτα.
 *
 * | # | κατάσταση | γιατί πρώτη |
 * |---|---|---|
 * | 1 | `pending` | **ζωντανή** ερώτηση — μόνο αυτή δικαιολογεί οθόνη αναμονής |
 * | 2 | `approved` | κάποιος είπε **ναι**· αν τα claims δεν ήρθαν ακόμη, το λέμε σωστά |
 * | 3 | `denied` | απαντήθηκε αρνητικά — ο άνθρωπος **δικαιούται** να το μάθει (Ε-2 §5: η άρνηση είναι **ειπωμένη**) |
 * | 4 | `withdrawn` | το απέσυρε ο ίδιος |
 * | 5 | `none` | δεν ζήτησε ποτέ |
 *
 * ⚠️ Εξάγεται **επίτηδες**: μια σειρά προτεραιότητας που δεν μπορεί να ελεγχθεί χωριστά
 * θα ελεγχόταν μόνο μέσω Firestore — δηλαδή δεν θα ελεγχόταν.
 */
export function collapseOwnAccessStates(statuses: readonly unknown[]): OwnWorkspaceAccessState {
  const known = statuses.filter(isWorkspaceAccessRequestStatus);
  const order: readonly WorkspaceAccessRequestStatus[] = ['pending', 'approved', 'denied', 'withdrawn'];
  return order.find((candidate) => known.includes(candidate)) ?? 'none';
}

/**
 * **Τι απέγινε το ΔΙΚΟ ΜΟΥ αίτημα;** — για την οθόνη αναμονής του αιτούντα.
 *
 * 🔴 **ΔΕΝ δέχεται πια `companyId`** (ADR-853 Α4). Ο καλών του έδινε τη **σταθερή**
 * εταιρεία, δηλαδή ρωτούσε *«τι απέγινε το αίτημά μου στην ΠΑΓΩΝΗΣ;»* για **κάθε**
 * άνθρωπο της πλατφόρμας. Χωρίς σταθερή εταιρεία το ερώτημα **χάνει το υποκείμενό
 * του** — και η θεραπεία **δεν** είναι να το στείλει ο πελάτης: θα ήταν τέταρτο,
 * αναξιόπιστο κανάλι χώρου (CHECK 3.58, κλειστό σύνολο **τριών**).
 *
 * 🔓 **Γιατί είναι ΝΟΜΙΜΑ cross-tenant** (η δήλωση ζει στο σημείο χρήσης, παρακάτω):
 * η ερώτηση **ΕΙΝΑΙ** *«τι ζήτησα **εγώ**, οπουδήποτε;»*. Ένα `where('companyId')` θα
 * την έκανε *«τι ζήτησα εκεί που ξέρω ήδη;»* — δηλαδή θα **επανέφερε** ακριβώς τη
 * σταθερή εταιρεία που αυτό το ADR αφαιρεί. Ο άξονας απομόνωσης είναι το
 * `requesterUid`, που έρχεται από **υπογεγραμμένο** token και ποτέ από τον πελάτη·
 * το ερώτημα δεν μπορεί να επιστρέψει αίτημα **άλλου** ανθρώπου. Ίδιο σχήμα και ίδιος
 * λόγος με το `listMemberWorkspaces` (ADR-787 §5.1).
 */
export async function readOwnAccessState(uid: string): Promise<OwnWorkspaceAccessState> {
  // tenant-scope-exempt: «τι ζήτησα ΕΓΩ, οπουδήποτε» — άξονας απομόνωσης το requesterUid
  //   από υπογεγραμμένο token, ποτέ από τον πελάτη· ένα where('companyId') θα επανέφερε
  //   τη σταθερή εταιρεία που αφαιρεί το ADR-853 Α4. Πλήρες σκεπτικό στο JSDoc παραπάνω.
  const snap = await getAdminFirestore()
    .collection(COLLECTIONS.WORKSPACE_ACCESS_REQUESTS)
    .where('requesterUid', '==', uid)
    .limit(OWN_REQUESTS_LIMIT)
    .get();
  return collapseOwnAccessStates(snap.docs.map((doc) => doc.get('status')));
}
