/**
 * @fileoverview **ΟΙ ΙΚΑΝΟΤΗΤΕΣ ΤΟΥ ΟΡΓΑΝΙΣΜΟΥ** — το μόνο πράγμα που ζητά ο φρουρός.
 * @related ADR-824 §5 · lib/auth/brokerage-authority.ts
 * @module services/company/company-capabilities.reader
 *
 * 🔑 **Στενός αναγνώστης, ίδιο σκεπτικό με το `company-public-name.reader.ts`.** Το
 * έγγραφο `companies/{id}` κουβαλά `createdBy` (uid) · `_lastModifiedByName`
 * (**ονοματεπώνυμο ανθρώπου**) · `settings` · `plan`. Επιστρέφοντας **ολόκληρο** το
 * έγγραφο, ο επόμενος που θα γράψει `{...company}` σε απάντηση θα το διέρρεε — και
 * κανείς δεν θα το πρόσεχε. Ό,τι δεν γυρίζει, **δεν μπορεί** να διαρρεύσει.
 *
 * ⚠️ **`undefined` σε κάθε αστοχία, ποτέ εξαίρεση.** Ο καταναλωτής είναι φρουρός: το
 * `undefined` περνά στο `capabilityStatusOf` και γίνεται **`unrequested`**, δηλαδή
 * **άρνηση**. Fail-closed χωρίς να χρειάζεται ο καλών να θυμηθεί `try`.
 *
 * 🔴 **Και γι' αυτό η αστοχία ανάγνωσης ΔΕΝ γίνεται «επιτρέπεται»**: μια εναλλακτική
 * που επέστρεφε «άγνωστο ⇒ άσε το να περάσει» θα άνοιγε τη ρυθμιζόμενη πράξη ακριβώς
 * τη στιγμή που η βάση δεν απαντά.
 *
 * **Layering**: reader — Admin SDK, **μία** ανάγνωση εγγράφου κατά ταυτότητα.
 */

import 'server-only';

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';
import type { OrganizationCapabilities } from '@/types/organization-capability';

const logger = createModuleLogger('company-capabilities.reader');

/** **Οι ικανότητες, ή `undefined`** — και το `undefined` σημαίνει *άρνηση*. */
export async function readCompanyCapabilities(
  adminDb: AdminFirestore,
  companyId: string | null,
): Promise<OrganizationCapabilities | undefined> {
  if (companyId === null || companyId.trim() === '') return undefined;

  try {
    const snapshot = await adminDb.collection(COLLECTIONS.COMPANIES).doc(companyId).get();
    const capabilities = (snapshot.data() as { capabilities?: unknown } | undefined)?.capabilities;

    return typeof capabilities === 'object' && capabilities !== null
      ? (capabilities as OrganizationCapabilities)
      : undefined;
  } catch (error) {
    logger.error('Οι ικανότητες του οργανισμού δεν διαβάστηκαν — η πράξη ΑΡΝΕΙΤΑΙ', {
      data: { companyId },
      error: error instanceof Error ? error.message : String(error),
    });
    return undefined;
  }
}
