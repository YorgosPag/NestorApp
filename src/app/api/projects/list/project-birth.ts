/**
 * =============================================================================
 * Η ΓΕΝΝΗΣΗ ΤΟΥ ΕΡΓΟΥ — ΕΡΓΟ ΚΑΙ ΟΜΑΔΑ ΣΕ ΜΙΑ ΣΥΝΑΛΛΑΓΗ (ADR-862 Φ0 Β14)
 * =============================================================================
 *
 * 🔴 **Η βλάβη που κλείνει**: μέχρι το Β14 το έργο γραφόταν με σκέτο `.set()` και **κανείς**
 * δεν γινόταν μέλος του. Ο κριτής (`decideContainerAccess`, βήμα 4) έκρυβε κάθε αρχείο σε
 * φάση CDE **ακόμη και από τον δημιουργό**. Μετρημένο 2026-09-17: 8 έργα, 0 μέλη.
 *
 * 🏆 **Πέρα από τους μεγάλους**: Procore / ACC / ProjectWise κάνουν τον δημιουργό
 * διαχειριστή του έργου **ως συνέπεια** της δημιουργίας. Εδώ είναι **ατομικό**: έργο χωρίς
 * την αρχική του ομάδα **δεν μπορεί να υπάρξει** ούτε για ένα millisecond. Αν αποτύχει η
 * εγγραφή του μέλους, **δεν** γράφεται ούτε το έργο (άγκυρα Α28).
 *
 * ⚠️ **Μόνο οι δύο εγγραφές που ορίζουν την ταυτότητα του έργου μπαίνουν εδώ.** Ίχνος,
 * πλοήγηση και cache μένουν **μετά**, στον handler: μια συναλλαγή ξανατρέχει σε σύγκρουση,
 * άρα κάθε παρενέργεια μέσα της θα έφευγε **πολλές** φορές (δόγμα `recordTrace`, ADR-862 §5.7).
 *
 * @module api/projects/list/project-birth
 * @see lib/auth/project-staffing-policy — ποιοι μπαίνουν
 * @see lib/auth/project-member-write — πώς γράφονται
 */

import 'server-only';

import type { Firestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { ENTITY_TYPES } from '@/config/domain-constants';
import { EntityAuditService } from '@/services/entity-audit.service';
import type { AuditFieldChange } from '@/types/audit-trail';
import {
  planEnrollments,
  writeEnrollments,
  type ProjectEnrollmentOutcome,
} from '@/lib/auth/project-member-write';
import { initialProjectTeam, type ProjectBirthFacts } from '@/lib/auth/project-staffing-policy';

export interface ProjectBirthRequest extends ProjectBirthFacts {
  /** Το έγγραφο του έργου, **έτοιμο** — ο handler έχει ήδη εφαρμόσει την πολιτική (ADR-284). */
  readonly document: Readonly<Record<string, unknown>>;
  /** Το ίχνος ADR-195 της δημιουργίας — ο handler ξέρει τα πεδία, η γέννηση το καταγράφει. */
  readonly audit: {
    readonly entityName: string;
    readonly changes: readonly AuditFieldChange[];
    readonly performedByName: string | null | undefined;
  };
}

/**
 * **Η ΜΙΑ γέννηση έργου** — η μόνη εγγραφή νέου `projects/{id}` (CHECK 3.88 Κ2).
 *
 * @returns Οι εκβάσεις ένταξης της αρχικής ομάδας, για το ίχνος του handler.
 */
export async function writeProjectBirth(
  db: Firestore,
  request: ProjectBirthRequest,
): Promise<readonly ProjectEnrollmentOutcome[]> {
  const team = await commitBirth(db, request);
  // 📜 ADR-195 — **μετά** το commit: μια συναλλαγή ξανατρέχει, και η εγγραφή ιστορικού μέσα
  //    της θα έφευγε πολλές φορές. Αν αποτύχει εδώ, το έργο ΚΑΙ η ομάδα του υπάρχουν ήδη.
  await EntityAuditService.recordChange({
    entityType: ENTITY_TYPES.PROJECT,
    entityId: request.projectId,
    entityName: request.audit.entityName,
    action: 'created',
    changes: [...request.audit.changes],
    performedBy: request.createdBy,
    performedByName: request.audit.performedByName ?? null,
    companyId: request.companyId,
  });
  return team;
}

/** Η συναλλαγή: έργο + αρχική ομάδα. */
function commitBirth(
  db: Firestore,
  request: ProjectBirthRequest,
): Promise<readonly ProjectEnrollmentOutcome[]> {
  const projectRef = db.collection(COLLECTIONS.PROJECTS).doc(request.projectId);
  const team = initialProjectTeam(request).map((seat) => ({
    ...seat,
    companyId: request.companyId,
    projectId: request.projectId,
    addedBy: request.createdBy,
  }));

  return db.runTransaction(async (transaction) => {
    // (1) Όλες οι αναγνώσεις πρώτα — κανόνας του Firestore για τις συναλλαγές.
    const plans = await planEnrollments(transaction, db, team);
    // (2) 🔑 `create`, όχι `set`: ένα id που συγκρούεται **αποτυγχάνει** αντί να πατήσει
    //     σιωπηλά υπάρχον έργο.
    transaction.create(projectRef, request.document);
    // (3) Η αρχική ομάδα, στην ίδια ατομική μονάδα.
    return writeEnrollments(transaction, plans);
  });
}
