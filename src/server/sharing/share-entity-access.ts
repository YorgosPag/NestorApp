import 'server-only';

/**
 * =============================================================================
 * SHARE ENTITY ACCESS — η ανάγνωση της κοινοποιημένης οντότητας, στον διακομιστή (ADR-884 Φ0.12)
 * =============================================================================
 *
 * Διαδέχεται το `services/sharing/resolver-core/share-entity-access.ts` (ADR-699), που
 * διάβαζε **από τον browser** με client SDK.
 *
 * 🔴 **Γιατί μετακόμισε**: ο παραλήπτης ενός συνδέσμου είναι, εξ ορισμού, **ανώνυμος** —
 * και οι κανόνες των `contacts` / `files` κλείνουν σωστά τον ανώνυμο. Άρα η ανάγνωση του
 * browser **αποτύγχανε πάντα** για παραλήπτη χωρίς λογαριασμό: οι σύνδεσμοι επαφής και
 * αρχείου άνοιγαν μόνο σε όποιον **ήδη** είχε πρόσβαση — δηλαδή σε κανέναν που χρειαζόταν
 * σύνδεσμο. Ο διακομιστής διαβάζει **αφού** κρίνει διακριτικό/λήξη/όριο/κωδικό, και
 * σερβίρει μόνο την **προβολή** του resolver (π.χ. μόνο τα `includedFields` μιας επαφής).
 *
 * 🔑 **Το «ανήκει στον μισθωτή;» είναι ΜΙΑ ερώτηση** (ADR-742): `isPayloadOwnedByCompany`
 * από το `lib/auth/tenant-ownership`, που απορρίπτει το κενό **και στις δύο** πλευρές.
 *
 * @module server/sharing/share-entity-access
 */

import type { Firestore } from 'firebase-admin/firestore';

import { isPayloadOwnedByCompany } from '@/lib/auth/tenant-ownership';
import { createModuleLogger } from '@/lib/telemetry';
import type { ShareEntityDefinition } from '@/types/sharing';

const logger = createModuleLogger('ShareEntityAccess');

/**
 * Διαβάζει την οντότητα μιας κοινοποίησης· `null` όταν δεν υπάρχει πια.
 *
 * Δεν πετά: κοινοποίηση που επέζησε της οντότητάς της πρέπει να αποδίδει άδεια κατάσταση,
 * όχι σφάλμα — η προειδοποίηση στο log είναι το σήμα.
 */
export async function readSharedEntity(
  adminDb: Firestore,
  definition: ShareEntityDefinition<unknown>,
  shareId: string,
  entityId: string,
): Promise<Record<string, unknown> | null> {
  const snap = await adminDb.collection(definition.entityCollection).doc(entityId).get();
  if (!snap.exists) {
    logger.warn('Share points to a missing entity', {
      shareId,
      collection: definition.entityCollection,
      entityId,
    });
    return null;
  }
  return (snap.data() ?? {}) as Record<string, unknown>;
}

/**
 * Μπορεί ο μισθωτής `companyId` να κοινοποιήσει την οντότητα `entityId`;
 *
 * Ανύπαρκτη οντότητα ⇒ `false` — και όχι «δεν βρέθηκε», ώστε η διαδρομή να μην
 * επιβεβαιώνει ποια ids υπάρχουν σε **άλλον** μισθωτή.
 */
export async function mayShareEntity(
  adminDb: Firestore,
  definition: ShareEntityDefinition<unknown>,
  companyId: string,
  entityId: string,
): Promise<boolean> {
  if (!companyId || !entityId) return false;
  const snap = await adminDb.collection(definition.entityCollection).doc(entityId).get();
  if (!snap.exists) return false;
  return isPayloadOwnedByCompany((snap.data() ?? {}) as { companyId?: string }, companyId);
}
