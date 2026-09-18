import 'server-only';

/**
 * @fileoverview **ΤΟ ΙΧΝΟΣ ΤΟΥ ΦΑΚΕΛΟΥ** — ποιος άλλαξε τι, πότε, στο **προσωπικό** βιβλίο του κατόχου.
 * @related ADR-866 Φ1.1 · ADR-195 §«Προσωπικό βιβλίο» · services/entity-audit-tracked-write.ts
 * @module services/property-dossier/property-dossier-audit
 *
 * 🔑 Εδώ ζει **μόνο** ό,τι είναι του φακέλου: το μητρώο πεδίων, το όνομα, και **σε ποιου το βιβλίο**.
 * Το σχήμα (διαφορά → ενέργεια → εγγραφή · ιδεμποτία · «ποτέ πριν τη γραφή») είναι το **κοινό** του
 * `recordTrackedEntityWrite` — ίδιο με την αγγελία, όχι αντίγραφό του.
 *
 * ⚠️ **Το βιβλίο παράγεται από τον ΚΑΤΟΧΟ του φακέλου, όχι από τον δρώντα.** Σήμερα ταυτίζονται (ο
 * κάτοχος γεννά τον φάκελό του)· από τη Φ3 γράφουν και καλεσμένοι, και το ίχνος τους πρέπει να το δει
 * ο **κάτοχος** — όχι το γραφείο του καλεσμένου.
 */

import { PROPERTY_DOSSIER_TRACKED_FIELDS } from '@/config/audit-tracked-fields';
import { recordTrackedEntityWrite } from '@/services/entity-audit-tracked-write';
import type { PropertyDossier } from '@/types/property-dossier';

/** Ό,τι χρειάζεται το ίχνος μιας γραφής φακέλου — **υποχρεωτικό** σε κάθε διαδρομή γραφής. */
export interface PropertyDossierAuditContext {
  /** Ποιος ενεργεί (uid). */
  readonly performedBy: string;
  /** Η κατάσταση **πριν** — `null` στη γέννηση. */
  readonly before: PropertyDossier | null;
}

/**
 * **Καταγράφει** μια επιτυχημένη γραφή φακέλου.
 *
 * ⚠️ Για γέννηση **μέσα σε εξωτερική δέσμη** (Φ1.3, δημιουργία αγγελίας) ο καλών το καλεί **μετά** το
 * `commit()` — ποτέ μέσα στο σώμα συναλλαγής, που ξανατρέχει σε σύγκρουση.
 */
export async function recordPropertyDossierWrite(
  after: PropertyDossier,
  { performedBy, before }: PropertyDossierAuditContext,
): Promise<void> {
  await recordTrackedEntityWrite({
    entityType: 'property_dossier',
    entityId: after.id,
    entityName: after.label,
    trackedFields: PROPERTY_DOSSIER_TRACKED_FIELDS,
    before,
    after,
    performedBy,
    ledger: { userId: after.userId },
  });
}
