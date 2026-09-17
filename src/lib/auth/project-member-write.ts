/**
 * =============================================================================
 * Ο ΕΝΑΣ ΓΡΑΦΕΑΣ ΤΗΣ ΕΝΤΑΞΗΣ ΣΕ ΕΡΓΟ (ADR-862 Φ0 Β14)
 * =============================================================================
 *
 * **Το ερώτημα**: *«κάνε αυτόν τον άνθρωπο μέλος αυτού του έργου — μία φορά»*.
 * **Ο απαντητής**: αυτό το αρχείο. Κανένα άλλο (CHECK 3.88 Κ1).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΓΕΝΝΗΘΗΚΕ
 * ─────────────────────────────────────────────────────────────────────────────
 * Μετρημένο 2026-09-17: **0** έγγραφα μέλους σε **8** έργα. Η μόνη πόρτα εγγραφής ήταν η
 * χειροκίνητη διαχείριση ρόλων, οπότε ο κριτής (`decideContainerAccess`, βήμα 4) έκρυβε
 * **κάθε** αρχείο σε φάση CDE ακόμη και από τον δημιουργό του έργου. Η γέννηση του έργου
 * χρειάζεται **δεύτερο** καλούντα — και δεύτερος καλών χωρίς κοινό γραφέα θα ήταν
 * δεύτερος γραφέας (ADR-749).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔑 ΙΔΕΜΠΟΤΗΤΑ ΜΕΣΑ ΣΤΗ ΣΥΝΑΛΛΑΓΗ, ΟΧΙ «ΕΛΕΓΞΕ-ΚΑΙ-ΓΡΑΨΕ»
 * ─────────────────────────────────────────────────────────────────────────────
 * Ο προκάτοχος (`assignMember`) ρωτούσε «υπάρχει;» και **μετά** έγραφε, σε δύο
 * ξεχωριστές κλήσεις: δύο ταυτόχρονα αιτήματα έβλεπαν και τα δύο «όχι» και έγραφαν **δύο**
 * έγγραφα — και ο αναγνώστης (`limit(1)`) θα διάλεγε **τυχαία** ποιο ισχύει.
 * Το κλειδί δεν μπορεί να είναι το `uid` (N.6 · ADR-787 §5.1), άρα η μοναδικότητα
 * εγγυάται από τη **συναλλαγή**: στο Admin SDK οι αναγνώσεις ερωτημάτων μέσα σε
 * `runTransaction` κλειδώνουν, και σύγκρουση **ξανατρέχει** το σώμα.
 *
 * ⚠️ **ΔΥΟ ΦΑΣΕΙΣ, ΟΧΙ ΜΙΑ ΣΥΝΑΡΤΗΣΗ**: το Firestore απαιτεί **όλες** τις αναγνώσεις μιας
 * συναλλαγής **πριν** από κάθε εγγραφή. Η γέννηση του έργου διαβάζει μέλη, **μετά** γράφει
 * το έργο, **μετά** τα μέλη — γι' αυτό η κρίση ({@link planEnrollments}) χωρίζεται από
 * την εγγραφή ({@link writeEnrollments}).
 *
 * @module lib/auth/project-member-write
 * @see lib/auth/project-member-read — ο αδελφός αναγνώστης
 * @see lib/auth/project-staffing-policy — ποιος μπαίνει στη γέννηση
 * @see ADR-862 Φ0 Β14 · N.6 · N.7.2 #2-#3
 */

import 'server-only';

import type { DocumentReference, Firestore, Transaction } from 'firebase-admin/firestore';

import { FieldValue } from '@/lib/firebaseAdmin';
import { generateMemberId } from '@/services/enterprise-id.service';
import type { CdeAudience } from '@/types/container-access';
import type { ProjectMemberEnrollment } from '@/types/project-member-enrollment';

import { memberByUidQuery, projectMembersCollection } from './project-member-ref';

// =============================================================================
// Η ΕΙΣΟΔΟΣ ΚΑΙ Η ΕΚΒΑΣΗ
// =============================================================================

/** Ένα αίτημα ένταξης — **ολόκληρο**, ώστε ο γραφέας να μη μαντεύει τίποτα. */
export interface ProjectEnrollmentRequest {
  /** Ο μισθωτής του **έργου** — ποτέ του αιτούντος (ADR-862 §2.3, Κ-3). */
  readonly companyId: string;
  readonly projectId: string;
  readonly uid: string;
  /** Ρόλος έργου από το `role-catalogue.ts` (`isProjectRole`). */
  readonly roleId: string;
  readonly permissionSetIds?: readonly string[];
  /** Απόν ⇒ **δεν γράφεται** (conditional spread) — «δεν δηλώθηκε» ≠ «δηλώθηκε κενό». */
  readonly cdeAudience?: CdeAudience;
  readonly taskTeamId?: string;
  readonly enrollment: ProjectMemberEnrollment;
  /** Ποιος το έκανε — `uid` ανθρώπου, ποτέ κενό. */
  readonly addedBy: string;
}

export type ProjectEnrollmentOutcome =
  /** Γράφτηκε νέο έγγραφο. */
  | { readonly outcome: 'enrolled'; readonly uid: string; readonly memberId: string }
  /** Ήταν **ήδη** μέλος — καμία εγγραφή (ιδεμποτησία, όχι αποτυχία). */
  | { readonly outcome: 'already-member'; readonly uid: string; readonly memberId: string };

/** Το σχέδιο **μετά** την ανάγνωση, **πριν** την εγγραφή. */
export interface EnrollmentPlan {
  readonly request: ProjectEnrollmentRequest;
  /** `null` ⇒ δεν υπάρχει ⇒ θα γραφτεί εδώ· αλλιώς το υπάρχον έγγραφο. */
  readonly existing: DocumentReference | null;
  readonly target: DocumentReference;
}

// =============================================================================
// ΦΑΣΗ 1 — Η ΚΡΙΣΗ (ΜΟΝΟ ΑΝΑΓΝΩΣΕΙΣ)
// =============================================================================

/**
 * Διαβάζει, **μέσα στη συναλλαγή**, αν κάθε άνθρωπος είναι ήδη μέλος.
 *
 * ⚠️ Δύο αιτήματα για τον **ίδιο** `uid` στην ίδια κλήση συγχωνεύονται σε **ένα**:
 * αλλιώς και τα δύο θα έβλεπαν «δεν υπάρχει» και θα έγραφαν δύο έγγραφα.
 */
export async function planEnrollments(
  transaction: Transaction,
  db: Firestore,
  requests: readonly ProjectEnrollmentRequest[],
): Promise<readonly EnrollmentPlan[]> {
  const unique = uniqueByMember(requests);
  return Promise.all(
    unique.map(async (request) => {
      const members = projectMembersCollection(db, request.companyId, request.projectId);
      const snapshot = await transaction.get(memberByUidQuery(members, request.uid));
      const existing = snapshot.docs[0]?.ref ?? null;
      return { request, existing, target: existing ?? members.doc(generateMemberId()) };
    }),
  );
}

function uniqueByMember(
  requests: readonly ProjectEnrollmentRequest[],
): readonly ProjectEnrollmentRequest[] {
  const seen = new Map<string, ProjectEnrollmentRequest>();
  for (const request of requests) {
    const key = `${request.companyId}:${request.projectId}:${request.uid}`;
    if (!seen.has(key)) seen.set(key, request);
  }
  return [...seen.values()];
}

// =============================================================================
// ΦΑΣΗ 2 — Η ΕΓΓΡΑΦΗ
// =============================================================================

/** Γράφει ό,τι έκρινε η {@link planEnrollments}. Καμία ανάγνωση εδώ. */
export function writeEnrollments(
  transaction: Transaction,
  plans: readonly EnrollmentPlan[],
): readonly ProjectEnrollmentOutcome[] {
  return plans.map(({ request, existing, target }) => {
    if (existing !== null) {
      return { outcome: 'already-member', uid: request.uid, memberId: existing.id };
    }
    // 🔑 `create`, όχι `set`: αν ένα id συγκρουστεί (θεωρητικά), η συναλλαγή **αποτυγχάνει**
    //    αντί να αντικαταστήσει σιωπηλά το μέλος κάποιου άλλου.
    transaction.create(target, projectMemberDocument(request));
    return { outcome: 'enrolled', uid: request.uid, memberId: target.id };
  });
}

/**
 * **Το ΕΝΑ σχήμα** του εγγράφου μέλους.
 *
 * ⚠️ `effectivePermissions: []` επίτηδες: ο προ-υπολογισμός δεν έχει γραφέα (ADR-244), και
 * ο αναγνώστης κρίνει από `roleId` + `permissionSetIds`. Ψεύτικη τιμή εδώ θα ήταν
 * δεδομένο που κανείς δεν τίμησε.
 */
export function projectMemberDocument(request: ProjectEnrollmentRequest): Record<string, unknown> {
  return {
    uid: request.uid,
    companyId: request.companyId,
    projectId: request.projectId,
    roleId: request.roleId,
    permissionSetIds: [...(request.permissionSetIds ?? [])],
    effectivePermissions: [],
    enrollment: request.enrollment,
    addedAt: FieldValue.serverTimestamp(),
    addedBy: request.addedBy,
    ...(request.taskTeamId === undefined ? {} : { taskTeamId: request.taskTeamId }),
    ...(request.cdeAudience === undefined ? {} : { cdeAudience: request.cdeAudience }),
  };
}

// =============================================================================
// ΑΛΛΑΓΗ ΚΑΙ ΑΠΟΧΩΡΗΣΗ — ΙΔΙΑ ΠΟΡΤΑ, ΙΔΙΑ ΣΥΝΑΛΛΑΓΗ
// =============================================================================

/** Ποιο μέλος — ο τριπλός δείκτης, ποτέ λιγότερο. */
export interface ProjectMemberKey {
  readonly companyId: string;
  readonly projectId: string;
  readonly uid: string;
}

/** Τα πεδία που **επιτρέπεται** να αλλάξουν σε υπάρχον μέλος. */
export interface ProjectMemberChanges {
  readonly roleId?: string;
  readonly permissionSetIds?: readonly string[];
  readonly taskTeamId?: string;
  readonly cdeAudience?: CdeAudience;
}

export type ProjectMemberMutationOutcome =
  /**
   * Άλλαξε/αφαιρέθηκε· `previous` = το έγγραφο **πριν**, `applied` = **μόνο** ό,τι γράφτηκε
   * (κενό σε αφαίρεση) — για το ίχνος, χωρίς `undefined`.
   */
  | {
      readonly outcome: 'mutated';
      readonly previous: Readonly<Record<string, unknown>>;
      readonly applied: Readonly<Record<string, unknown>>;
    }
  /** Δεν υπάρχει τέτοιο μέλος. */
  | { readonly outcome: 'absent' }
  /** Καμία αλλαγή δηλώθηκε — τίποτα δεν γράφτηκε. */
  | { readonly outcome: 'nothing-to-change' };

/** Αλλαγή ρόλου / συνόλων / ομάδας / ακροατηρίου **υπάρχοντος** μέλους. */
export function updateProjectMember(
  db: Firestore,
  key: ProjectMemberKey,
  changes: ProjectMemberChanges,
): Promise<ProjectMemberMutationOutcome> {
  const updates = definedChanges(changes);
  if (Object.keys(updates).length === 0) return Promise.resolve({ outcome: 'nothing-to-change' });
  return mutateExisting(db, key, updates, (transaction, ref) => transaction.update(ref, updates));
}

/**
 * Αφαίρεση μέλους.
 * ⚠️ Σήμερα **διαγραφή** — δηλωμένο όριο του Β14: το ιστορικό ανάκλησης (`revokedAt`) μπαίνει
 * με τη Φ1, μαζί με τα `engagements` που το απαιτούν ήδη (ADR-862 §5.3.1).
 */
export function removeProjectMember(
  db: Firestore,
  key: ProjectMemberKey,
): Promise<ProjectMemberMutationOutcome> {
  return mutateExisting(db, key, {}, (transaction, ref) => transaction.delete(ref));
}

function definedChanges(changes: ProjectMemberChanges): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(changes)
      .filter(([, value]) => value !== undefined)
      .map(([field, value]) => [field, Array.isArray(value) ? [...value] : value]),
  );
}

function mutateExisting(
  db: Firestore,
  key: ProjectMemberKey,
  applied: Readonly<Record<string, unknown>>,
  write: (transaction: Transaction, ref: DocumentReference) => void,
): Promise<ProjectMemberMutationOutcome> {
  return db.runTransaction(async (transaction) => {
    const members = projectMembersCollection(db, key.companyId, key.projectId);
    const snapshot = await transaction.get(memberByUidQuery(members, key.uid));
    const doc = snapshot.docs[0];
    if (doc === undefined) return { outcome: 'absent' };
    write(transaction, doc.ref);
    return { outcome: 'mutated', previous: doc.data(), applied };
  });
}

// =============================================================================
// Η ΠΡΟΕΠΙΣΚΟΠΗΣΗ — ΙΔΙΑ ΚΡΙΣΗ, ΚΑΜΙΑ ΕΓΓΡΑΦΗ (dry-run μεταναστεύσεων)
// =============================================================================

export interface EnrollmentPreview {
  readonly uid: string;
  readonly projectId: string;
  readonly alreadyMember: boolean;
}

/**
 * Τι **θα** έκανε η ένταξη — με την **ίδια** {@link planEnrollments}, ώστε το dry-run να μη
 * μπορεί να διαφωνήσει με την εκτέλεση (δεύτερη υλοποίηση της κρίσης = δεύτερη απάντηση).
 */
export function previewEnrollments(
  db: Firestore,
  requests: readonly ProjectEnrollmentRequest[],
): Promise<readonly EnrollmentPreview[]> {
  return db.runTransaction(
    async (transaction) => {
      const plans = await planEnrollments(transaction, db, requests);
      return plans.map(({ request, existing }) => ({
        uid: request.uid,
        projectId: request.projectId,
        alreadyMember: existing !== null,
      }));
    },
    { readOnly: true },
  );
}

// =============================================================================
// Η ΣΥΝΤΟΜΗ ΠΟΡΤΑ — ΜΙΑ ΣΥΝΑΛΛΑΓΗ ΓΙΑ ΟΣΟΥΣ ΔΕΝ ΓΡΑΦΟΥΝ ΤΙΠΟΤΑ ΑΛΛΟ
// =============================================================================

/**
 * Κρίση + εγγραφή σε **δική τους** συναλλαγή.
 *
 * ⛔ Όποιος γράφει **και** άλλο έγγραφο ατομικά μαζί με τα μέλη (η γέννηση του έργου)
 * καλεί τις δύο φάσεις **μέσα στη δική του** συναλλαγή — όχι αυτή εδώ.
 */
export function enrollProjectMembers(
  db: Firestore,
  requests: readonly ProjectEnrollmentRequest[],
): Promise<readonly ProjectEnrollmentOutcome[]> {
  return db.runTransaction(async (transaction) => {
    const plans = await planEnrollments(transaction, db, requests);
    return writeEnrollments(transaction, plans);
  });
}
