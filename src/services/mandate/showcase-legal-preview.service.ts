/**
 * @fileoverview **«ΤΙ ΘΑ ΔΕΙ Ο ΚΟΣΜΟΣ» — η προεπισκόπηση της νομικής ταυτότητας, από τις ΙΔΙΕΣ εισόδους** με τη
 * δημοσίευση (ADR-841 §7 Α23.14).
 * @related lib/agency/showcase-legal-identity.ts (ο κριτής) · services/mandate/showcase-legal-identity-custody.ts
 * @module services/mandate/showcase-legal-preview.service
 *
 * 🔑 **Καμία δεύτερη ανάγνωση, καμία δεύτερη κρίση**: οι είσοδοι έρχονται από το `readLegalIdentityInputs` (προφίλ ·
 * αντίγραφο ΓΕΜΗ · έδρα της **κάρτας** της δημοσιευμένης βιτρίνας), η κρίση από το `previewShowcaseLegalIdentity`,
 * που καλεί τον **ίδιο** `resolveShowcaseLegalIdentity` της δημοσίευσης. Ό,τι λέει η οθόνη, το λέει και ο γραφέας.
 *
 * ⚠️ **Συναλλαγή μόνο-ανάγνωσης**: τα τρία έγγραφα διαβάζονται ως **ένα** στιγμιότυπο — μια αποθήκευση κάρτας
 * ανάμεσα δεν μπορεί να δώσει έδρα κάρτας από «πριν» και προφίλ από «μετά».
 */

import 'server-only';

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { readShowcase } from '@/lib/agency/showcase-read';
import { previewShowcaseLegalIdentity, type LegalIdentityPreview } from '@/lib/agency/showcase-legal-identity';
import { readLegalIdentityInputs } from '@/services/mandate/showcase-legal-identity-custody';

/**
 * **Η προεπισκόπηση του οργανισμού** — `companyId` πάντα από την απόδειξη του καλούντα, ποτέ από σώμα.
 *
 * ⚠️ Αποτυχία ανάγνωσης **πετά** (ο καλών απαντά 5xx «ξαναδοκίμασε»): ένα «λείπει η επωνυμία» σε βλάβη θα έστελνε
 * τον άνθρωπο να ξαναγράψει κάτι που το σύστημα ήδη κρατά (N.12 — άγνωστο ≠ κενό).
 */
export async function readShowcaseLegalPreview(
  adminDb: AdminFirestore,
  companyId: string,
): Promise<LegalIdentityPreview> {
  const ref = adminDb.collection(COLLECTIONS.AGENCY_PROFILES).doc(companyId);
  return adminDb.runTransaction(
    async (transaction) => {
      const snapshot = await transaction.get(ref);
      const read = snapshot.exists ? readShowcase(snapshot.data(), companyId) : null;
      // 🔑 Ίδια πηγή έδρας κάρτας με τη δημοσίευση (`keptLocations`): η κάρτα **μεταφέρεται**, άρα αυτή θα κριθεί.
      const locations = read?.outcome === 'showcase' ? read.showcase.locations : [];
      return previewShowcaseLegalIdentity(await readLegalIdentityInputs(adminDb, transaction, companyId, locations));
    },
    { readOnly: true },
  );
}
