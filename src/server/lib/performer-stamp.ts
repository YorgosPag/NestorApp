/**
 * 🖋️ SSoT — η **σφραγίδα φορέα** κάθε εγγραφής του server (ADR-195).
 *
 * Ο CDC (`functions/src/audit/contact-audit-trigger.ts`) διαβάζει τον δράστη **από το ίδιο το έγγραφο**:
 * `_lastModifiedBy` (ταυτότητα) + `_lastModifiedByName` (όνομα). Ο πελάτης τα σφραγίζει στο
 * `ContactsService`· οι server γραφείς έγραφαν `lastModifiedBy` (χωρίς `_`) ⇒ ο CDC έβλεπε
 * `cdc_unknown` («καμία γραμμή δεν λέει από ποιον») **και** το ωμό `lastModifiedBy` ως «αλλαγή».
 *
 * 🔑 **ΕΝΑΣ δρόμος**: φορέας ({@link AuditPerformer}) → {@link resolvePerformer} → {@link performerStamp}.
 * Το όνομα λύνεται **εδώ**, μία φορά, για σφραγίδα **και** γραμμή υπηρεσίας — ποτέ uid στη θέση ονόματος.
 *
 * 🔒 Άγκυρα: `server/lib/__tests__/contact-writer-performer-stamp.test.ts` — κάθε γραφέας επαφής του
 * server περνά από εδώ.
 *
 * @module server/lib/performer-stamp
 * @enterprise ADR-195 — Entity Audit Trail
 */

import 'server-only';

import { FieldValue } from 'firebase-admin/firestore';

import { SYSTEM_IDENTITY } from '@/config/domain-constants';
import { performerId, type AuditPerformer, type ProcessPerformer } from '@/lib/audit/audit-performer';
import { resolveUserDisplayName } from '@/services/entity-audit.service';

/** Ο φορέας με λυμένο όνομα — ό,τι χρειάζονται σφραγίδα και γραμμή Ιστορικού. */
export interface ResolvedPerformer {
  readonly id: string;
  readonly name: string | null;
}

/** Οι σφραγίδες που διαβάζει ο CDC — με αυτά τα ονόματα και κανένα άλλο. */
export interface PerformerStamp {
  readonly _lastModifiedBy: string;
  readonly _lastModifiedByName: string | null;
  readonly _lastModifiedAt: FieldValue;
}

/**
 * Το όνομα του φορέα. Άνθρωπος ⇒ `displayName` του `/users/{uid}` (πτώση: `fallbackName`)· διεργασία ⇒ ο
 * άνθρωπος εκ μέρους του οποίου ενήργησε, αλλιώς το στιγμιότυπο της μηχανής (μεταφράζεται στην
 * οθόνη από την ταυτότητα — `audit-actor.ts`).
 */
export async function resolvePerformer(performer: AuditPerformer): Promise<ResolvedPerformer> {
  if (performer.kind === 'process') return resolveProcessPerformer(performer);
  return { id: performerId(performer), name: await resolveUserDisplayName(performer.uid, performer.fallbackName) };
}

/** Η διεργασία λύνεται **χωρίς** ανάγνωση — σύγχρονα, για builders και συναλλαγές. */
export function resolveProcessPerformer(performer: ProcessPerformer): ResolvedPerformer {
  return { id: performer.processId, name: performer.onBehalfOf ?? SYSTEM_IDENTITY.DISPLAY_NAME };
}

/** Τα πεδία δράστη μιας γραμμής υπηρεσίας (`EntityAuditService.recordChange`) — από τον ΙΔΙΟ λυμένο φορέα. */
export function auditActorOf(resolved: ResolvedPerformer): { readonly performedBy: string; readonly performedByName: string | null } {
  return { performedBy: resolved.id, performedByName: resolved.name };
}

/** Οι σφραγίδες `_lastModified*` για ήδη λυμένο φορέα (σύγχρονο — για builders μέσα σε συναλλαγή). */
export function performerStamp(resolved: ResolvedPerformer): PerformerStamp {
  return {
    _lastModifiedBy: resolved.id,
    _lastModifiedByName: resolved.name,
    _lastModifiedAt: FieldValue.serverTimestamp(),
  };
}

/** Λύσε και σφράγισε σε ένα βήμα — η συνήθης χρήση σε `update`. */
export async function stampPerformer(performer: AuditPerformer): Promise<PerformerStamp> {
  return performerStamp(await resolvePerformer(performer));
}
