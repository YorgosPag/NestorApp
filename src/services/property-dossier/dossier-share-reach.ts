/**
 * @fileoverview **«ΦΤΑΝΕΙ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ ΣΕ ΑΥΤΗ ΤΗ ΣΥΜΜΕΤΟΧΗ;»** — η ΜΙΑ κρίση εύρους του φακέλου ιδιώτη (ADR-916 Φ-Ε1).
 * @related ADR-866 §2.11 (ο κριτής καρτέλας) · `services/property-dossier/dossier-engagement-host-adapter.ts` (η όψη) ·
 *          `services/property-dossier/dossier-file-access.service.ts` (η πόρτα ανοίγματος)
 * @module services/property-dossier/dossier-share-reach
 *
 * 🔑 **Μία κρίση, δύο καταναλωτές**: η λίστα που βλέπει ο επαγγελματίας **και** η πόρτα που υπογράφει σύνδεσμο ρωτούν
 *    **αυτή** τη συνάρτηση. Αρχείο που φαίνεται στη λίστα ανοίγει· αρχείο που δεν φαίνεται, απαντά 404 — ποτέ διαφωνία.
 * 🔑 **Η καρτέλα κρίνεται από τον ΙΔΙΟ κριτή με τη σελίδα του κατόχου** (`propertyDossierFileTabOf`, ρωτώντας **όλες**
 *    τις καρτέλες με τη σειρά της σελίδας): ό,τι ο κάτοχος βλέπει στα «Έγγραφα» είναι ό,τι φτάνει ως «Έγγραφα». Ένας
 *    δεύτερος κανόνας «κατηγορία ⇒ καρτέλα» θα έχανε το καταφύγιο (ADR-916 Φ-Γ3) και θα έδινε άλλα από όσα ο κάτοχος βλέπει.
 * 🔑 **Παράγεται σε κάθε ανάγνωση**: εξαίρεση, μετακίνηση ή κάδος ισχύουν στο **επόμενο** άνοιγμα — καμία αποθηκευμένη λίστα.
 *
 * Καθαρό: καμία βάση, ασκείται από άγκυρες χωρίς mock.
 */

import { propertyDossierFileTabOf } from '@/components/property-dossier/property-dossier-media';
import { ENTITY_TYPES, FILE_STATUS } from '@/config/domain-constants';
import {
  PROPERTY_DOSSIER_FILE_TABS,
  type PropertyDossierFileTab,
} from '@/config/upload-entry-points/entries-property-dossier';
import type { DossierShareReach } from '@/types/engagement';
import type { FileRecord } from '@/types/file-record';
import type { PropertyDossier } from '@/types/property-dossier';

/** Ό,τι χρειάζεται η κρίση από το `FileRecord` — διαβασμένο από τον δίσκο, ποτέ από το σύρμα. */
export type DossierReachFile = Pick<
  FileRecord,
  'id' | 'userId' | 'entityType' | 'entityId' | 'status' | 'isDeleted' | 'domain' | 'category' | 'purpose'
>;

/** Ο φάκελος όσο τον χρειάζεται η κρίση. */
export type DossierReachOwner = Pick<PropertyDossier, 'id' | 'label' | 'userId' | 'type'>;

/** Ζει το αρχείο **τώρα** στον φάκελο, στο βιβλίο του **σημερινού** κατόχου; (ξένο ≡ ανύπαρκτο) */
function livesInDossier(dossier: DossierReachOwner, file: DossierReachFile): boolean {
  return file.userId === dossier.userId
    && file.entityType === ENTITY_TYPES.PROPERTY_DOSSIER
    && file.entityId === dossier.id
    && file.status === FILE_STATUS.READY
    && file.isDeleted !== true;
}

/**
 * Η καρτέλα όπου **φτάνει** το αρχείο σε αυτή τη συμμετοχή — ή `null` (δεν φτάνει ⇒ για τον επαγγελματία δεν υπάρχει).
 *
 * Σειρά: ζει στον φάκελο του κατόχου → δεν είναι εξαιρεμένο → η καρτέλα του (κατά τη σελίδα) ανήκει στο εύρος.
 */
export function dossierFileReach(
  dossier: DossierReachOwner,
  file: DossierReachFile,
  reach: DossierShareReach,
): PropertyDossierFileTab | null {
  if (!livesInDossier(dossier, file)) return null;
  if (reach.excludedFileIds.includes(file.id)) return null;
  const tab = propertyDossierFileTabOf(dossier, file, PROPERTY_DOSSIER_FILE_TABS);
  return tab !== null && reach.tabs.includes(tab) ? tab : null;
}
