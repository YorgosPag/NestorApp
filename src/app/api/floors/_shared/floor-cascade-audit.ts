/**
 * @fileoverview **Η γραμμή ιστορικού μιας ΠΑΡΑΓΩΓΗΣ γραφής** των αλυσίδων ορόφου — ένα σημείο για όλες.
 * @related ADR-195 (Entity Audit Trail) · ADR-450/451/461 (στοίβα) · ADR-903 §6 (φιλοξενούμενα)
 * @module api/floors/_shared/floor-cascade-audit
 *
 * 🔴 **ΓΙΑΤΙ ΥΠΑΡΧΕΙ (2026-10-05)**: τέσσερις αλυσίδες είχαν η καθεμία το δικό της `recordCascadeAudit`, και
 * όλες έγραφαν με `performedBy` τον **άνθρωπο**. Αποτέλεσμα: «ο Γιώργος άλλαξε τη στάθμη του 3ου» ενώ άγγιξε
 * το ύψος του 1ου — και όταν η παράγωγη γραφή έπεφτε στον **ίδιο** όροφο, η σύμπτυξη συνεδρίας
 * (`coalesce-edit-sessions.ts`) τη συγχώνευε με ό,τι πληκτρολόγησε.
 *
 * 🔑 **Εκτελεστής ≠ εμπνευστής.** Η γραμμή έχει `performedBy` τη **μηχανή** (ποια διεργασία υπολόγισε την τιμή)
 * και `cause` τον **άνθρωπο** και την πράξη του (ποιος το προκάλεσε). Η Salesforce χρεώνει την αυτοματοποίηση
 * στον χρήστη και χάνει τη διάκριση· η Revit κρατά μόνο `LastChangedBy`. Εδώ κρατιούνται και τα δύο.
 *
 * ⚠️ Το `updatedBy` **του εγγράφου** μένει ο άνθρωπος: είναι σφραγίδα «ποιανού πράξη το άγγιξε τελευταία»,
 * όχι ιστορικό.
 *
 * ⚠️ Δηλωμένος στο `AUDIT_RECORDER_DELEGATES` του CHECK 3.17.
 */

import 'server-only';

import { SYSTEM_IDENTITY } from '@/config/domain-constants';
import type { AuthContext } from '@/lib/auth';
import { EntityAuditService, resolveUserDisplayName } from '@/services/entity-audit.service';
import type { AuditCause, AuditEntityType, AuditFieldChange } from '@/types/audit-trail';

/** Ποια διεργασία της μηχανής έγραψε — ο αναγνώστης τη μεταφράζει από την ταυτότητα (`audit-actor.ts`). */
export type FloorCascadeProcess =
  | typeof SYSTEM_IDENTITY.FLOOR_STACK_ID
  | typeof SYSTEM_IDENTITY.FLOOR_REF_ID;

/** Ό,τι χρειάζεται μια αλυσίδα για να σφραγίσει το έγγραφο **και** να αποδώσει τη γραμμή της. */
export interface FloorCascadeActor {
  /** Ο άνθρωπος — γράφεται στο `updatedBy` κάθε εγγράφου που αγγίζει η αλυσίδα. */
  readonly updatedBy: string;
  /** Η πράξη του — γράφεται στο `cause` κάθε παράγωγης γραμμής. */
  readonly cause: AuditCause;
}

export interface FloorCascadeActorInput {
  readonly ctx: Pick<AuthContext, 'uid' | 'email'>;
  readonly entityType: AuditEntityType;
  readonly entityId: string;
  readonly entityName: string | null;
  /** Η γραμμή της ανθρώπινης πράξης· `null` όταν εκείνη δεν έγραψε (ή δεν επέστρεψε) γραμμή. */
  readonly auditId: string | null;
}

/** Ο δράστης μιας αλυσίδας. Το όνομα λύνεται **μία** φορά, όχι ανά παράγωγη γραμμή. */
export async function buildFloorCascadeActor(input: FloorCascadeActorInput): Promise<FloorCascadeActor> {
  const { ctx, entityType, entityId, entityName, auditId } = input;
  return {
    updatedBy: ctx.uid,
    cause: {
      auditId,
      initiatedBy: ctx.uid,
      initiatedByName: await resolveUserDisplayName(ctx.uid, ctx.email ?? null),
      entityType,
      entityId,
      entityName,
    },
  };
}

/** Μία παράγωγη γραφή: το έγγραφο που άλλαξε και τι άλλαξε πάνω του. */
export interface DerivedWrite {
  readonly entityType: AuditEntityType;
  readonly entityId: string;
  readonly entityName: string | null;
  readonly changes: readonly AuditFieldChange[];
}

/** Η αλλαγή ενός πεδίου όπως τη γράφει μια αλυσίδα· η ετικέτα λύνεται ζωντανά στον αναγνώστη. */
export function derivedChange(
  field: string,
  oldValue: AuditFieldChange['oldValue'],
  newValue: AuditFieldChange['newValue'],
): AuditFieldChange {
  return { field, oldValue, newValue, label: field };
}

/**
 * Γράφει μία γραμμή ανά έγγραφο που άλλαξε, με εκτελεστή τη μηχανή και αιτία την ανθρώπινη πράξη.
 *
 * Καλείται **μετά** το commit της παρτίδας: ίχνος για γραφή που δεν έγινε είναι ψέμα.
 */
export async function recordDerivedWrites(
  process: FloorCascadeProcess,
  writes: readonly DerivedWrite[],
  actor: FloorCascadeActor,
  companyId: string,
): Promise<void> {
  await Promise.all(
    writes.map((write) =>
      EntityAuditService.recordChange({
        entityType: write.entityType,
        entityId: write.entityId,
        entityName: write.entityName,
        action: 'updated',
        changes: [...write.changes],
        performedBy: process,
        performedByName: SYSTEM_IDENTITY.DISPLAY_NAME,
        cause: actor.cause,
        companyId,
      }),
    ),
  );
}
