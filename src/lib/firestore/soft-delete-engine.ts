/**
 * Soft-Delete Engine — SSOT για τον κύκλο ζωής μιας εγγραφής: κάδος **και** αρχείο
 *
 * ONE mechanism for ALL entities. No copy-paste.
 *
 * Δύο έννοιες, μία μηχανή (ADR-281 · ADR-329 §3.9):
 *   ΚΑΔΟΣ  — «θέλω να φύγει»: αναστρέψιμο ως την προθεσμία, μετά οριστική διαγραφή.
 *   ΑΡΧΕΙΟ — «αποσύρθηκε, αλλά το αναφέρουν άλλοι»: μένει για πάντα, εκτός καθημερινής λίστας.
 *
 * Μεταβάσεις (όλες εδώ, πουθενά αλλού):
 *   softDelete()         ζωντανό | αρχείο → κάδος      (status='deleted')
 *   restoreFromTrash()   κάδος → ό,τι ήταν πριν
 *   archive()            ζωντανό → αρχείο              (status='archived')
 *                        κάδος → αρχείο                ΜΟΝΟ με `fromTrash` (εκκαθάριση)
 *   restoreFromArchive() αρχείο → ό,τι ήταν πριν       (ιστορικό: status_changed, όχι restored)
 *                        εκτός αν η οντότητα δηλώσει άλλη κατάσταση επιστροφής (`lifecycle-effects`)
 *   permanentDelete()    κάδος → οριστική διαγραφή     (executeDeletion, ADR-226)
 *
 * Και οι δύο αποσύρσεις γράφουν στο ΙΔΙΟ πεδίο (`status`) ⇒ μια εγγραφή δεν είναι ποτέ
 * ταυτόχρονα στον κάδο και στο αρχείο. Το `previousStatus` κρατά πάντα την τελευταία
 * **ζωντανή** κατάσταση, όσες αποσύρσεις κι αν μεσολαβήσουν.
 *
 * @module lib/firestore/soft-delete-engine
 * @enterprise ADR-281 — SSOT Soft-Delete System
 */

import "server-only";

import { FieldValue } from "firebase-admin/firestore";
import { TRASHED_STATUS } from "./soft-delete-config";
import { executeDeletion } from "./deletion-guard";
import { conditionalBlockMessage } from "./deletion-common";
import { extractEntityName, loadLifecycleTarget, type LifecycleTarget } from "./lifecycle-target";
import { ARCHIVE, RETIREMENTS, TRASH, type Retirement } from "./lifecycle-retirements";
import { LIFECYCLE_EFFECTS, type ReinstatePatch } from "./lifecycle-effects";
import { SYSTEM_IDENTITY, isSystemActorId } from "@/config/domain-constants";
import { EntityAuditService, resolveUserDisplayName } from "@/services/entity-audit.service";
import { isCdcAuditDuplicate } from "@/config/audit-cdc-coverage";
// Imported from its defining module rather than through `ApiErrorHandler`,
// which re-exports it but pulls in the whole `next/server` surface with it.
import { ApiError } from "@/lib/api/api-error-types";
import { createModuleLogger } from "@/lib/telemetry";
import { getErrorMessage } from "@/lib/error-utils";
import type { AuditAction, AuditCause, AuditFieldChange } from "@/types/audit-trail";
import type { LifecycleOutcome, SoftDeletableEntityType } from "@/types/soft-deletable";

const logger = createModuleLogger("SoftDeleteEngine");

/**
 * Καταγραφή αλλαγής κύκλου ζωής στο audit trail (fire-and-forget).
 *
 * ADR-195 Phase 3 — αυτός ο engine εξυπηρετεί **όλες** τις soft-deletable
 * οντότητες, αλλά μόνο οι επαφές έχουν CDC Firestore trigger. Για εκείνες, μια
 * service-side εγγραφή `soft_deleted`/`restored` θα ήταν καθαρό διπλότυπο του
 * `cdc` record. Το μητρώο `audit-cdc-coverage` είναι η ΜΟΝΑΔΙΚΗ πηγή αυτής της
 * γνώσης — μην βάλεις `if (entityType === 'contact')` εδώ.
 *
 * Το `deleted` (οριστική διαγραφή) δεν σιγάζεται ΠΟΤΕ: εκεί η service εγγραφή
 * μεταφέρει forensic δεδομένα που ο CDC δεν μπορεί να παραγάγει.
 */
function recordLifecycleAudit(
  input: Parameters<typeof EntityAuditService.recordChange>[0],
): void {
  if (isCdcAuditDuplicate(input.entityType, input.action)) {
    logger.debug("Audit skipped — CDC trigger already records this event", {
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
    });
    return;
  }

  EntityAuditService.recordChange(input).catch((err) => {
    logger.error("Audit trail failed (non-blocking)", {
      entityType: input.entityType,
      entityId: input.entityId,
      error: getErrorMessage(err),
    });
  });
}

/** Ποιος εκτελεί: άνθρωπος ή διεργασία της μηχανής. */
interface LifecycleActor {
  readonly uid: string;
  readonly name?: string | null;
  /** Η ανθρώπινη πράξη πίσω από γραφή της μηχανής (ADR-195: εκτελεστής ≠ εμπνευστής). */
  readonly cause?: AuditCause;
}

/** Το όνομα του δράστη όπως σφραγίζεται στο έγγραφο· η μηχανή δεν είναι χρήστης προς αναζήτηση. */
async function resolveActorName(actor: LifecycleActor): Promise<string | null> {
  if (isSystemActorId(actor.uid)) return SYSTEM_IDENTITY.DISPLAY_NAME;
  return resolveUserDisplayName(actor.uid, actor.name ?? null);
}

/** Οι σφραγίδες `_lastModified*` — ο CDC αποδίδει τη γραφή στον πραγματικό δράστη (ADR-195 Phase 1). */
function performerStamps(uid: string, resolvedName: string | null): Record<string, unknown> {
  return {
    updatedAt: FieldValue.serverTimestamp(),
    _lastModifiedBy: uid,
    _lastModifiedByName: resolvedName,
    _lastModifiedAt: FieldValue.serverTimestamp(),
  };
}

/**
 * Γράφει τη γραμμή ιστορικού μιας μετάβασης `status`.
 *
 * @param alsoChanged ό,τι άλλο άλλαξε **στην ίδια εγγραφή** (δήλωση της οντότητας,
 *                    `lifecycle-effects`) — ίδιο γεγονός, ίδια γραμμή
 */
function recordStatusTransition(
  entityType: SoftDeletableEntityType,
  entityId: string,
  target: LifecycleTarget,
  transition: { action: AuditAction; from: string; to: string },
  actor: LifecycleActor,
  companyId: string,
  alsoChanged: readonly AuditFieldChange[] = [],
): void {
  recordLifecycleAudit({
    entityType,
    entityId,
    entityName: extractEntityName(target.data),
    action: transition.action,
    changes: [
      { field: "status", oldValue: transition.from, newValue: transition.to, label: "status" },
      ...alsoChanged,
    ],
    performedBy: actor.uid,
    performedByName: isSystemActorId(actor.uid) ? SYSTEM_IDENTITY.DISPLAY_NAME : (actor.name ?? null),
    ...(actor.cause ? { cause: actor.cause } : {}),
    companyId: (target.data?.companyId as string | undefined) ?? companyId,
  });
}

/**
 * Τρέχει ό,τι δήλωσε η οντότητα ότι ακολουθεί μια μετάβαση (π.χ. η δημόσια αγγελία ενός
 * ακινήτου), με το έγγραφο **όπως είναι πλέον**.
 *
 * Awaited: ο άνθρωπος που είδε «επιτυχία» δικαιούται ο κόσμος να έχει ήδη αλλάξει. Αλλά
 * **δεν πετά ποτέ** — η μετάβαση έγινε, και η αποτυχία μιας παρενέργειας δεν την ακυρώνει.
 */
async function settleLifecycleEffects(
  target: LifecycleTarget,
  entityType: SoftDeletableEntityType,
  entityId: string,
  written: Record<string, unknown>,
): Promise<void> {
  const effect = LIFECYCLE_EFFECTS[entityType]?.afterLifecycleChange;
  if (!effect) return;

  try {
    await effect(target.docRef.firestore, entityId, { ...target.data, ...written });
  } catch (err) {
    logger.error("Lifecycle effect failed (non-blocking)", {
      entityType,
      entityId,
      error: getErrorMessage(err),
    });
  }
}

/**
 * Απόσυρση: μετακινεί την εγγραφή στον κάδο ή στο αρχείο.
 *
 * Ιδεμποτική: εγγραφή που είναι ήδη εκεί ⇒ επιτυχία, καμία γραφή, καμία γραμμή.
 * Όταν η εγγραφή έρχεται από την **άλλη** απόσυρση, το `previousStatus` της μένει
 * ανέγγιχτο (η τελευταία ζωντανή κατάσταση) και οι σφραγίδες της άλλης σβήνονται.
 */
async function retire(
  target: LifecycleTarget,
  into: Retirement,
  entityType: SoftDeletableEntityType,
  entityId: string,
  actor: LifecycleActor,
  companyId: string,
): Promise<void> {
  const current = target.data?.status as string | undefined;

  if (current === into.status) {
    logger.info(`Retire idempotent — ${entityType} already in ${into.place}`, { entityId });
    return;
  }

  const comingFrom = RETIREMENTS.find((r) => r.status === current);
  const previousStatus = comingFrom
    ? ((target.data?.previousStatus as string | undefined) || target.config.defaultRestoreStatus)
    : (current ?? target.config.defaultRestoreStatus);

  logger.info(`Moving ${entityType} to ${into.place}`, { entityId, companyId, previousStatus });

  await target.docRef.update({
    status: into.status,
    previousStatus,
    [into.atField]: FieldValue.serverTimestamp(),
    [into.byField]: actor.uid,
    ...(comingFrom
      ? { [comingFrom.atField]: FieldValue.delete(), [comingFrom.byField]: FieldValue.delete() }
      : {}),
    ...performerStamps(actor.uid, await resolveActorName(actor)),
  });

  recordStatusTransition(
    entityType,
    entityId,
    target,
    { action: into.action, from: current ?? previousStatus, to: into.status },
    actor,
    companyId,
  );

  await settleLifecycleEffects(target, entityType, entityId, { status: into.status });
}

/** Ό,τι έκανε μια επαναφορά: η κατάσταση στην οποία γύρισε, και ό,τι άλλο τη συνόδευσε. */
interface Reinstatement {
  readonly restoredStatus: string;
  readonly outcomes: readonly LifecycleOutcome[];
}

/** Πού επιστρέφει η εγγραφή και τι τη συνοδεύει — η απόφαση, πριν από οποιαδήποτε γραφή. */
interface ReinstatementPlan {
  readonly restoredStatus: string;
  readonly patch: ReinstatePatch | null;
}

/**
 * Αποφασίζει την επιστροφή: η τελευταία ζωντανή κατάσταση, εκτός αν η οντότητα **δηλώσει**
 * άλλη (`ReinstatePatch.restoredStatus`) επειδή δένει το `status` της με πεδίο που αλλάζει
 * στην ίδια γραφή.
 *
 * @throws Error αν η δήλωση επιστρέφει αποσυρμένη κατάσταση — η επαναφορά θα άφηνε την
 *   εγγραφή εκεί από όπου έφυγε, με σβησμένες σφραγίδες
 */
function planReinstatement(
  target: LifecycleTarget,
  from: Retirement,
  entityType: SoftDeletableEntityType,
): ReinstatementPlan {
  const lastLiveStatus =
    (target.data?.previousStatus as string) || target.config.defaultRestoreStatus;

  const patch =
    LIFECYCLE_EFFECTS[entityType]?.reinstatePatch?.(from, target.data ?? {}, lastLiveStatus) ?? null;
  const restoredStatus = patch?.restoredStatus ?? lastLiveStatus;

  if (RETIREMENTS.some((retirement) => retirement.status === restoredStatus)) {
    throw new Error(`Lifecycle effect of ${entityType} declared a retired restore status`);
  }

  return { restoredStatus, patch };
}

/**
 * Η **μία** γραφή της επαναφοράς: κατάσταση, σφραγίδες, και ό,τι δήλωσε η οντότητα — ατομικά.
 *
 * Το `status` γράφεται **μετά** τα πεδία της δήλωσης, επίτηδες: τον κύκλο ζωής τον γράφει
 * μόνο η μηχανή. Όποια οντότητα θέλει άλλη κατάσταση επιστροφής τη **δηλώνει**
 * (`planReinstatement`), δεν τη στριμώχνει στα `fields`.
 */
async function writeReinstatement(
  target: LifecycleTarget,
  from: Retirement,
  restoredStatus: string,
  patchFields: Record<string, unknown>,
  actor: LifecycleActor,
): Promise<void> {
  await target.docRef.update({
    ...patchFields,
    status: restoredStatus,
    previousStatus: FieldValue.delete(),
    [from.atField]: FieldValue.delete(),
    [from.byField]: FieldValue.delete(),
    restoredAt: FieldValue.serverTimestamp(),
    restoredBy: actor.uid,
    ...performerStamps(actor.uid, await resolveActorName(actor)),
  });
}

/**
 * Επαναφορά: φέρνει την εγγραφή πίσω στην τελευταία ζωντανή της κατάσταση.
 *
 * @throws ApiError(409) αν η εγγραφή δεν είναι εκεί από όπου ζητείται να επιστρέψει
 */
async function reinstate(
  target: LifecycleTarget,
  from: Retirement,
  entityType: SoftDeletableEntityType,
  entityId: string,
  actor: LifecycleActor,
  companyId: string,
): Promise<Reinstatement> {
  if (target.data?.status !== from.status) {
    throw new ApiError(409, `${target.config.labelEn} is not in ${from.place}`);
  }

  // Ό,τι άλλο δηλώνει η οντότητα ότι αλλάζει στην επιστροφή — στην ΙΔΙΑ εγγραφή, ατομικά.
  const { restoredStatus, patch } = planReinstatement(target, from, entityType);
  const patchFields = patch?.fields ?? {};

  logger.info(`Restoring ${entityType} from ${from.place}`, { entityId, restoredStatus });

  await writeReinstatement(target, from, restoredStatus, patchFields, actor);

  recordStatusTransition(
    entityType,
    entityId,
    target,
    { action: from.restoreAction, from: from.status, to: restoredStatus },
    actor,
    companyId,
    patch?.changes,
  );

  await settleLifecycleEffects(target, entityType, entityId, {
    ...patchFields,
    status: restoredStatus,
  });

  return { restoredStatus, outcomes: patch?.outcome ? [patch.outcome] : [] };
}

/** Η υπογραφή κάθε επαναφοράς — ίδια για κάδο και αρχείο, γιατί είναι η ίδια πράξη. */
type RestoreOperation = (
  db: FirebaseFirestore.Firestore,
  entityType: SoftDeletableEntityType,
  entityId: string,
  restoredBy: string,
  companyId: string,
  performedByName?: string,
) => Promise<{ success: true; entityId: string } & Reinstatement>;

/** Η επαναφορά από μία απόσυρση. Οι δύο εξαγόμενες επαναφορές είναι αυτή, με άλλο όρισμα. */
function restoreFrom(from: Retirement): RestoreOperation {
  return async (db, entityType, entityId, restoredBy, companyId, performedByName) => {
    const target = await loadLifecycleTarget(db, entityType, entityId, companyId);
    const actor = { uid: restoredBy, name: performedByName };
    const reinstatement = await reinstate(target, from, entityType, entityId, actor, companyId);

    return { success: true, entityId, ...reinstatement };
  };
}

// ============================================================================
// ΚΑΔΟΣ
// ============================================================================

/**
 * Soft-delete: moves entity to trash (status='deleted').
 * Does NOT delete data — only changes status.
 *
 * ⚠️ Δεν ελέγχει εξαρτήσεις: αυτό είναι απόφαση της **διαδρομής** της κάθε οντότητας
 * (π.χ. `DELETE /api/properties/[id]`, ADR-329 §3.9). Η οριστική διαγραφή τις ελέγχει πάντα.
 *
 * @throws ApiError(404) if document not found
 * @throws ApiError(404) if it belongs to another company — **σκόπιμα ίδιο με το
 *   «δεν βρέθηκε»**: ξένο ≡ ανύπαρκτο στο σύρμα (ADR-742 §3.3 · §7decies.4)
 */
export async function softDelete(
  db: FirebaseFirestore.Firestore,
  entityType: SoftDeletableEntityType,
  entityId: string,
  deletedBy: string,
  companyId: string,
  performedByName?: string,
  isSuperAdmin: boolean = false,
): Promise<{ success: true; entityId: string }> {
  // Tenant isolation — bypassed for super admin (route-level guard already validated access)
  const target = await loadLifecycleTarget(db, entityType, entityId, companyId, isSuperAdmin);

  await retire(target, TRASH, entityType, entityId, { uid: deletedBy, name: performedByName }, companyId);

  return { success: true, entityId };
}

/**
 * Restore: brings entity back from trash to previous status.
 *
 * @throws ApiError(404) if not found
 * @throws ApiError(404) if it belongs to another company (ADR-742 §7decies.4)
 * @throws ApiError(409) if NOT in trash
 */
export const restoreFromTrash: RestoreOperation = restoreFrom(TRASH);

/**
 * Permanent delete: ONLY from trash (status='deleted').
 * Runs full ADR-226 dependency check + cascade + hard delete.
 *
 * @throws ApiError(409) if not in trash or has blocking dependencies
 */
export async function permanentDelete(
  db: FirebaseFirestore.Firestore,
  entityType: SoftDeletableEntityType,
  entityId: string,
  deletedBy: string,
  companyId: string,
): Promise<{ success: true; entityId: string }> {
  const { config, data } = await loadLifecycleTarget(db, entityType, entityId, companyId);

  // MUST be in trash
  if (data?.status !== TRASHED_STATUS) {
    throw new ApiError(
      409,
      `${config.labelEn} must be in trash before permanent deletion`,
    );
  }

  logger.info(`Permanently deleting ${entityType}`, { entityId });

  // Delegate to ADR-226 engine (dependency check + cascade + hard delete + audit)
  await executeDeletion(db, entityType, entityId, deletedBy, companyId);

  logger.info(`${entityType} permanently deleted`, { entityId });
  return { success: true, entityId };
}

// ============================================================================
// ΑΡΧΕΙΟ
// ============================================================================

/** Επιλογές αρχειοθέτησης που δεν έχει ο άνθρωπος στην οθόνη. */
export interface ArchiveOptions {
  /**
   * Επιτρέπει τη μετάβαση κάδος → αρχείο. Μόνο η εκκαθάριση τη ζητά: εγγραφή του κάδου που
   * **απέκτησε αναφορές** δεν σβήνεται ποτέ, άρα αλλιώς θα έμενε εκεί για πάντα.
   */
  readonly fromTrash?: boolean;
  /** Η ανθρώπινη πράξη πίσω από αρχειοθέτηση που εκτελεί η μηχανή. */
  readonly cause?: AuditCause;
}

/** Οι λόγοι για τους οποίους μια εγγραφή **δεν** μπαίνει στο αρχείο. */
function assertArchivable(
  target: LifecycleTarget,
  entityType: SoftDeletableEntityType,
  options: ArchiveOptions,
): void {
  const { config, data } = target;

  if (!config.archive) {
    throw new ApiError(400, `${config.labelEn} cannot be archived`, "ARCHIVE_UNSUPPORTED");
  }
  if (data?.status === TRASHED_STATUS && !options.fromTrash) {
    throw new ApiError(409, `${config.labelEn} is in trash`, "ARCHIVE_FROM_TRASH");
  }

  // Ό,τι δεσμεύεται από συναλλαγή (π.χ. αγοραστής) δεν αποσύρεται ούτε στο αρχείο.
  const blocked = conditionalBlockMessage(entityType, data);
  if (blocked !== null) {
    throw new ApiError(409, blocked, "ARCHIVE_BLOCKED");
  }
}

/**
 * Archive: αποσύρει την εγγραφή από την καθημερινή δουλειά **χωρίς** προθεσμία διαγραφής
 * (status='archived'). Ό,τι την αναφέρει συνεχίζει να τη βρίσκει.
 *
 * @throws ApiError(400) αν η οντότητα δεν έχει αρχείο (`SOFT_DELETE_CONFIG[…].archive`)
 * @throws ApiError(404) αν δεν βρέθηκε ή ανήκει σε άλλη εταιρεία
 * @throws ApiError(409) αν είναι στον κάδο, ή δεσμεύεται από συναλλαγή
 */
export async function archive(
  db: FirebaseFirestore.Firestore,
  entityType: SoftDeletableEntityType,
  entityId: string,
  archivedBy: string,
  companyId: string,
  performedByName?: string,
  options: ArchiveOptions = {},
): Promise<{ success: true; entityId: string }> {
  const target = await loadLifecycleTarget(db, entityType, entityId, companyId);
  assertArchivable(target, entityType, options);

  const actor = { uid: archivedBy, name: performedByName, cause: options.cause };
  await retire(target, ARCHIVE, entityType, entityId, actor, companyId);

  return { success: true, entityId };
}

/**
 * Restore from archive: φέρνει την εγγραφή πίσω στην τελευταία ζωντανή της κατάσταση.
 *
 * @throws ApiError(404) αν δεν βρέθηκε ή ανήκει σε άλλη εταιρεία
 * @throws ApiError(409) αν ΔΕΝ είναι στο αρχείο
 */
export const restoreFromArchive: RestoreOperation = restoreFrom(ARCHIVE);

// ============================================================================
// LIST — η ανάγνωση κάδου και αρχείου ζει στο `lifecycle-list` (όριο μεγέθους αρχείου)·
// ξαναεξάγεται εδώ ώστε η μηχανή να μένει η ΜΙΑ πόρτα του κύκλου ζωής.
// ============================================================================
export { listArchived, listTrashed, type TrashedEntityRow } from "./lifecycle-list";
