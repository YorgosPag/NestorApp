/**
 * @fileoverview **Ο ΕΝΑΣ γραφέας των αδειών της βιτρίνας** (ADR-915 §21).
 * @related app/api/agency-profile/licences/route.ts · lib/agency/showcase-licence.ts (σχηματισμός) ·
 *   services/mandate/agency-profile.service.ts (`publishShowcase` — τις **διατηρεί**)
 * @module services/mandate/showcase-licence-custody
 *
 * 🔑 **Δική τους πράξη, όπως η κάρτα και το σήμα**: η υποσελίδα «Άδειες» έχει δικό της «Αποθήκευση» (LinkedIn «Licenses &
 *    certifications» · Houzz «Verified License»). Η σφράγιση του route slice της βιτρίνας ορίζει γραπτά ότι η επόμενη
 *    αύξηση λύνεται με δεύτερη διαδρομή — και η δημοσίευση της βιτρίνας **μεταφέρει** το πεδίο (`keptLicences`).
 * 🔑 **Συναλλαγή + `update` μόνο του πεδίου**: το έγγραφο ανήκει στον γραφέα της βιτρίνας· εδώ αλλάζει **μόνο** το
 *    `licences`, και μια δημοσίευση που τρέχει ταυτόχρονα δεν χάνει τίποτα (η συναλλαγή ξαναεκτελείται).
 * 🔒 Το κλειδί είναι το `companyId` **της απόδειξης** (από τον καλούντα), ποτέ από σώμα.
 */

import 'server-only';

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { readShowcase } from '@/lib/agency/showcase-read';
import { createModuleLogger } from '@/lib/telemetry';
import type { ShowcaseLicenceRejection } from '@/lib/agency/showcase-licence';
import type { ShowcaseLicence } from '@/types/agency-profile';

const logger = createModuleLogger('showcase-licence-custody');

export type ShowcaseLicencesWriteResult =
  | { readonly kind: 'saved'; readonly licences: readonly ShowcaseLicence[] }
  | { readonly kind: 'rejected'; readonly reason: ShowcaseLicenceRejection }
  | { readonly kind: 'failed' };

/**
 * **«Αυτές είναι οι άδειές μου.»** — ολόκληρη η λίστα, ήδη σχηματισμένη από το σύνορο (`formShowcaseLicences`).
 * Ιδεμποτής: η ίδια λίστα δύο φορές = ίδιο έγγραφο.
 */
export async function saveShowcaseLicences(
  adminDb: AdminFirestore,
  companyId: string,
  licences: readonly ShowcaseLicence[],
): Promise<ShowcaseLicencesWriteResult> {
  const ref = adminDb.collection(COLLECTIONS.AGENCY_PROFILES).doc(companyId);
  try {
    return await adminDb.runTransaction(async (transaction): Promise<ShowcaseLicencesWriteResult> => {
      const snapshot = await transaction.get(ref);
      const existing = snapshot.exists ? readShowcase(snapshot.data(), companyId) : null;
      // Άδεια χωρίς βιτρίνα δεν έχει πού να φανεί — ονομασμένη άρνηση, όχι σιωπηλή γραφή σε ανύπαρκτο έγγραφο.
      if (existing?.outcome !== 'showcase') return { kind: 'rejected', reason: 'licences-without-showcase' };
      transaction.update(ref, { licences });
      return { kind: 'saved', licences };
    });
  } catch (error) {
    logger.error('[LICENCES] Η αποθήκευση των αδειών απέτυχε', {
      companyId,
      error: error instanceof Error ? error.message : String(error),
    });
    return { kind: 'failed' };
  }
}
