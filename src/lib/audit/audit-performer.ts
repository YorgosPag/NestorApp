/**
 * 👤 Ο **φορέας** μιας εγγραφής — ποιος έκανε την πράξη που θα γραφτεί στο Ιστορικό (ADR-195).
 *
 * 🔑 Δύο μορφές, **καμία τρίτη**: ή **άνθρωπος** (Firebase uid), ή **διεργασία της μηχανής**
 * (`system:<διεργασία>`) που μπορεί να ενεργεί **εκ μέρους** ανθρώπου (πρακτική Procore/SAP:
 * κάθε γραμμή ελέγχου έχει actor). Δεν υπάρχει «χωρίς φορέα» — ο τύπος δεν το εκφράζει — και
 * δεν υπάρχει «ένα string που άλλοτε είναι uid κι άλλοτε όνομα» (εκεί γεννήθηκε το `uid` στη
 * θέση του ονόματος στο Ιστορικό).
 *
 * Το όνομα **δεν** ζει εδώ: το λύνει ο server τη στιγμή της εγγραφής
 * (`server/lib/performer-stamp.ts`), γιατί ο άνθρωπος μετονομάζεται και η μηχανή μεταφράζεται.
 *
 * @module lib/audit/audit-performer
 * @enterprise ADR-195 — Entity Audit Trail
 */

import { SYSTEM_IDENTITY, isSystemActorId, type SystemActorId } from '@/config/domain-constants';

export interface UserPerformer {
  readonly kind: 'user';
  readonly uid: string;
  /** Αν το `/users/{uid}` δεν δώσει όνομα — συνήθως το email της συνεδρίας. */
  readonly fallbackName: string | null;
}

export interface ProcessPerformer {
  readonly kind: 'process';
  readonly processId: SystemActorId;
  /** Ο άνθρωπος για λογαριασμό του οποίου ενήργησε η διεργασία — όνομα, ποτέ ταυτότητα καναλιού. */
  readonly onBehalfOf: string | null;
}

export type AuditPerformer = UserPerformer | ProcessPerformer;

/** Άνθρωπος — το uid είναι υποχρεωτικό· κενό ή ταυτότητα μηχανής είναι σφάλμα του καλούντα. */
export function userPerformer(uid: string, fallbackName?: string | null): AuditPerformer {
  const trimmed = uid.trim();
  if (trimmed === '' || isSystemActorId(trimmed)) {
    throw new Error(`userPerformer: "${uid}" is not a human identity`);
  }
  return { kind: 'user', uid: trimmed, fallbackName: fallbackName?.trim() || null };
}

/** Διεργασία της μηχανής, προαιρετικά εκ μέρους ανθρώπου. */
export function processPerformer(
  processId: SystemActorId = SYSTEM_IDENTITY.ID,
  onBehalfOf?: string | null,
): ProcessPerformer {
  return { kind: 'process', processId, onBehalfOf: onBehalfOf?.trim() || null };
}

/** Από ταυτότητα που μπορεί να είναι **είτε** άνθρωπος **είτε** μηχανή — η απόφαση από την ταυτότητα, ποτέ από το όνομα. */
export function performerFromActorId(actorId: string, fallbackName?: string | null): AuditPerformer {
  return isSystemActorId(actorId) ? processPerformer(actorId) : userPerformer(actorId, fallbackName);
}

/** Η ταυτότητα που γράφεται στο `performedBy` / `_lastModifiedBy`. */
export function performerId(performer: AuditPerformer): string {
  return performer.kind === 'user' ? performer.uid : performer.processId;
}
