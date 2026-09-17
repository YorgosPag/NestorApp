/**
 * =============================================================================
 * BACKFILL: η αρχική ομάδα των έργων που γεννήθηκαν πριν το Β14 (ADR-862 Φ0)
 * =============================================================================
 *
 * Μετρημένο 2026-09-17: **8** έργα, **0** μέλη, και **1** από τα 2 δοχεία `SUPERSEDED` χωρίς
 * `projectId`. Η γέννηση του έργου (Β14) κλείνει το πρόβλημα **από εδώ και πέρα**· αυτό το
 * αρχείο κλείνει το **παρελθόν**, με την **ίδια** πολιτική και τον **ίδιο** γραφέα:
 *
 *   1. για κάθε έργο → `initialProjectTeam` (ο δημιουργός) → `enrollProjectMembers`
 *      με `enrollment: 'backfill'`
 *   2. για κάθε δοχείο **ήδη** στο CDE χωρίς έργο → `sealContainerProject`
 *
 * 🔑 **Ιδεμπότητο**: δεύτερη εκτέλεση = **0** εγγραφές (ο γραφέας κρίνει μέσα σε συναλλαγή).
 * 🔑 **Το dry-run ρωτά την ίδια κρίση** (`previewEnrollments` · `sealContainerProject({dryRun})`)
 *    — ποτέ δεύτερη υλοποίηση που θα μπορούσε να διαφωνήσει με την εκτέλεση.
 *
 * @module api/admin/migrations/backfill-project-members/backfill-project-members-operations
 */

import 'server-only';

import { trimmedStringOrNull as text } from '@/lib/type-guards';

import type { Firestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { CDE_STATES } from '@/config/iso19650-constants';
import {
  enrollProjectMembers,
  previewEnrollments,
  type ProjectEnrollmentRequest,
} from '@/lib/auth/project-member-write';
import { initialProjectTeam } from '@/lib/auth/project-staffing-policy';
import { sealContainerProject } from '@/services/iso19650/container-custody';

export interface ProjectTeamBackfillReport {
  readonly projectsScanned: number;
  readonly membersEnrolled: number;
  readonly alreadyMembers: number;
  /** Έργα που **δεν** μπορούν να αποκτήσουν ομάδα — ονομασμένα, ποτέ σιωπηλά. */
  readonly projectsWithoutOwner: readonly string[];
  readonly containersScanned: number;
  readonly containersSealed: readonly { readonly fileId: string; readonly projectId: string }[];
  readonly containersUnresolved: readonly { readonly fileId: string; readonly why: string }[];
}


/** Τα αιτήματα ένταξης όλων των έργων — **η ίδια** πολιτική με τη γέννηση. */
async function teamRequests(
  db: Firestore,
): Promise<{ requests: ProjectEnrollmentRequest[]; scanned: number; withoutOwner: string[] }> {
  // tenant-scope-exempt: μετανάστευση super-admin (ADR-703) πάνω σε ΟΛΟΥΣ τους μισθωτές· ο
  //   μισθωτής κάθε μέλους είναι το `companyId` ΤΟΥ ΕΡΓΟΥ, ποτέ του καλούντος.
  const snapshot = await db.collection(COLLECTIONS.PROJECTS).get();
  const requests: ProjectEnrollmentRequest[] = [];
  const withoutOwner: string[] = [];

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const companyId = text(data.companyId);
    const createdBy = text(data.createdBy);
    if (companyId === null || createdBy === null) {
      withoutOwner.push(doc.id);
      continue;
    }
    for (const seat of initialProjectTeam({ companyId, projectId: doc.id, createdBy })) {
      requests.push({ ...seat, companyId, projectId: doc.id, enrollment: 'backfill', addedBy: createdBy });
    }
  }
  return { requests, scanned: snapshot.size, withoutOwner };
}

async function backfillTeams(db: Firestore, dryRun: boolean) {
  const { requests, scanned, withoutOwner } = await teamRequests(db);
  let enrolled = 0;
  let already = 0;
  // Ένα έργο ανά συναλλαγή: αποτυχία σε ένα δεν ακυρώνει τα υπόλοιπα, και η επανάληψη ξαναπιάνει μόνο ό,τι λείπει.
  for (const request of requests) {
    const [result] = dryRun
      ? (await previewEnrollments(db, [request])).map((p) => (p.alreadyMember ? 'already' : 'new'))
      : (await enrollProjectMembers(db, [request])).map((o) => (o.outcome === 'enrolled' ? 'new' : 'already'));
    if (result === 'new') enrolled += 1;
    else already += 1;
  }
  return { scanned, enrolled, already, withoutOwner };
}

async function backfillContainers(db: Firestore, dryRun: boolean) {
  // tenant-scope-exempt: μετανάστευση super-admin σε όλους τους μισθωτές· η σφράγιση ελέγχει
  //   τον μισθωτή σε ΚΑΘΕ κρίκο της αλυσίδας (`resolveContainerProject`).
  const snapshot = await db
    .collection(COLLECTIONS.FILES)
    .where('cdeState', 'in', Object.keys(CDE_STATES))
    .get();
  const sealed: { fileId: string; projectId: string }[] = [];
  const unresolved: { fileId: string; why: string }[] = [];

  for (const doc of snapshot.docs) {
    if (text(doc.data().projectId) !== null) continue;
    const seal = await sealContainerProject(db, doc.id, { dryRun });
    if (seal.outcome === 'sealed') sealed.push({ fileId: doc.id, projectId: seal.projectId });
    else if (seal.outcome === 'unchanged' && seal.resolution.outcome === 'none') {
      unresolved.push({ fileId: doc.id, why: seal.resolution.why });
    }
  }
  return { scanned: snapshot.size, sealed, unresolved };
}

/** **Η μετανάστευση** — ομάδες πρώτα, δοχεία μετά (η ορατότητα χρειάζεται και τα δύο). */
export async function backfillProjectTeams(
  db: Firestore,
  { dryRun }: { dryRun: boolean },
): Promise<ProjectTeamBackfillReport> {
  const teams = await backfillTeams(db, dryRun);
  const containers = await backfillContainers(db, dryRun);
  return {
    projectsScanned: teams.scanned,
    membersEnrolled: teams.enrolled,
    alreadyMembers: teams.already,
    projectsWithoutOwner: teams.withoutOwner,
    containersScanned: containers.scanned,
    containersSealed: containers.sealed,
    containersUnresolved: containers.unresolved,
  };
}
