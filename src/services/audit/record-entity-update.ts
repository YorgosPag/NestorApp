/**
 * @fileoverview **Η γραμμή ιστορικού μιας ανθρώπινης ενημέρωσης οντότητας** — ΕΝΑΣ γραφέας για κάθε `PATCH`.
 * @related ADR-195 (Entity Audit Trail) · ADR-332 D29 · `config/audit-tracked-fields.ts`
 * @module services/audit/record-entity-update
 *
 * 🔴 **ΓΙΑΤΙ ΥΠΑΡΧΕΙ (2026-10-05)**: γεννήθηκε ως `recordBuildingUpdate` για τους δύο κλάδους του
 * `PATCH /api/buildings`. Το `PATCH /api/floors` είχε τη **δική του** εκδοχή της ίδιας πράξης — χειρόγραφη
 * διαφορά, εκτός μητρώου, στο βιβλίο του καλούντος. Αντί για δεύτερο γραφέα, ο πρώτος γενικεύτηκε.
 *
 * 🔑 **Το μητρώο το διαλέγει ο τύπος της οντότητας**, όχι ο καλών (`getTrackedFieldsForEntityAuditType`):
 * δεν γίνεται να διαφορίσεις όροφο με το μητρώο του κτιρίου.
 *
 * 🔑 **Η διαφορά κρίνεται απέναντι στο αποθηκευμένο έγγραφο**, όχι από τα κλειδιά του αιτήματος: η αυτόματη
 * αποθήκευση στέλνει **όλα** τα πεδία σε κάθε κύκλο, και μια γραμμή ανά κλειδί θα γέμιζε το ιστορικό φαντάσματα.
 * Καμία διαφορά ⇒ καμία γραμμή.
 *
 * 🔑 **Μία γραμμή ανά αποθήκευση, και το βιβλίο δεν ξαναγράφεται ποτέ.** Η πυκνότητα της αυτόματης αποθήκευσης
 * λύνεται στην **ανάγνωση** (`services/audit/coalesce-edit-sessions.ts`).
 *
 * ⚠️ Δηλωμένος στο `AUDIT_RECORDER_DELEGATES` του CHECK 3.17 (`scripts/check-entity-audit-coverage.js`): όποιος
 * τον καλεί μετρά ως καλυμμένος **όσο αυτό το αρχείο όντως γράφει**.
 */

import 'server-only';

import { getTrackedFieldsForEntityAuditType } from '@/config/audit-tracked-fields';
import type { AuthContext } from '@/lib/auth';
import { createModuleLogger } from '@/lib/telemetry';
import { EntityAuditService } from '@/services/entity-audit.service';
import type { AuditEntityType, AuditFieldChange } from '@/types/audit-trail';

const logger = createModuleLogger('RecordEntityUpdate');

export interface EntityUpdateAuditInput {
  readonly entityType: AuditEntityType;
  readonly entityId: string;
  /** Το έγγραφο **πριν** τη γραφή. */
  readonly before: Readonly<Record<string, unknown>>;
  /** Ό,τι **γράφτηκε** — μερικό: πεδία που λείπουν δεν κρίνονται. */
  readonly written: Readonly<Record<string, unknown>>;
  readonly ctx: AuthContext;
  /** Πεδίο → όνομα προς εμφάνιση της τιμής του (ξένα κλειδιά). Η τιμή μένει η ταυτότητα. */
  readonly resolvers?: Readonly<Record<string, (value: unknown) => Promise<string | null>>>;
}

export interface EntityUpdateAuditResult {
  /** Η γραμμή που γράφτηκε· `null` ⇒ καμία (καμία διαφορά, ή το βιβλίο αρνήθηκε). */
  readonly auditId: string | null;
  readonly changes: readonly AuditFieldChange[];
}

const NOTHING_RECORDED: EntityUpdateAuditResult = { auditId: null, changes: [] };

function textOf(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null;
}

/**
 * Γράφει τη γραμμή ιστορικού της αλλαγής — ή τίποτα, αν δεν άλλαξε παρακολουθούμενο πεδίο.
 *
 * ⚠️ Το βιβλίο είναι του **μισθωτή του εγγράφου**, όχι του καλούντος: ο super admin που διορθώνει έγγραφο άλλης
 * εταιρείας γράφει στο ιστορικό **εκείνης**. **Δεν πετά** (`recordChange` καταπίνει και καταγράφει).
 *
 * @returns το `auditId` της γραμμής — η **αιτία** για ό,τι παράγωγο γραφτεί εξαιτίας αυτής της πράξης.
 */
export async function recordEntityUpdate(input: EntityUpdateAuditInput): Promise<EntityUpdateAuditResult> {
  const { entityType, entityId, before, written, ctx } = input;
  const trackedFields = getTrackedFieldsForEntityAuditType(entityType);
  if (!trackedFields) {
    logger.error('Οντότητα χωρίς μητρώο παρακολουθούμενων πεδίων — η γραμμή δεν γράφτηκε', { entityType, entityId });
    return NOTHING_RECORDED;
  }

  const changes = await EntityAuditService.diffFieldsWithResolution(
    { ...before },
    { ...written },
    trackedFields,
    { ...input.resolvers },
  );
  if (changes.length === 0) return NOTHING_RECORDED;

  const auditId = await EntityAuditService.recordChange({
    entityType,
    entityId,
    entityName: textOf(written.name) ?? textOf(before.name),
    action: 'updated',
    changes,
    performedBy: ctx.uid,
    performedByName: ctx.email ?? null,
    companyId: textOf(before.companyId) ?? ctx.companyId,
  });
  return { auditId, changes };
}
