import 'server-only';

/**
 * @fileoverview **ΤΟ ΙΧΝΟΣ ΜΙΑΣ ΓΡΑΦΗΣ ΟΝΤΟΤΗΤΑΣ** — διαφορά από το μητρώο πεδίων → ενέργεια → εγγραφή, στο
 * βιβλίο που ορίζει η **θεματοφυλακή**.
 * @related ADR-195 §«Προσωπικό βιβλίο» · ADR-864 Φ1β · ADR-866 §2.8 (Γ3 — εξαγωγή, N.18)
 * @module services/entity-audit-tracked-write
 *
 * 🔑 **Εξήχθη όταν απέκτησε ΔΕΥΤΕΡΟ καταναλωτή.** Το σχήμα ζούσε μέσα στο `owner-property-audit.ts`
 * (ADR-864 Φ1β)· ο φάκελος του ακινήτου (ADR-866 Φ1.1) θα το έγραφε ξανά, γραμμή προς γραμμή — δίδυμο
 * που θα απέκλινε την πρώτη φορά που το ένα μάθαινε κάτι (π.χ. νέα ενέργεια) και το άλλο όχι.
 *
 * | Ερώτηση | Πηγή | Πεδίο |
 * |---|---|---|
 * | **ποιος το έκανε;** | ο δρων | `performedBy` |
 * | **σε ποιου το βιβλίο;** | η **θεματοφυλακή** του εγγράφου — ποτέ ο δρων | `companyId` **ή** `userId` |
 *
 * ⚠️ **Καλείται ΜΟΝΟ μετά από επιτυχή γραφή** — ίχνος για πράξη που δεν έγινε είναι ψέμα στο βιβλίο.
 * ⚠️ **Δεν πετά ποτέ** (`recordChange` καταπίνει και καταγράφει) — ίχνος που αποτυγχάνει δεν ακυρώνει
 * ποτέ την πράξη του ανθρώπου (ADR-195).
 */

import { EntityAuditService } from '@/services/entity-audit.service';
import type { AuditLedgerScope } from '@/lib/audit/audit-ledger';
import type { TrackedFieldDef } from '@/lib/audit/audit-diff';
import type { AuditAction, AuditEntityType, AuditFieldChange } from '@/types/audit-trail';

/**
 * **Οι αλλαγές** ανάμεσα σε δύο καταστάσεις, από το **ένα** μητρώο πεδίων της οντότητας.
 *
 * Στη γέννηση η σύγκριση γίνεται με **κενό** έγγραφο ⇒ το ιστορικό ξεκινά με τις αρχικές τιμές (ίδιο
 * πρότυπο με το `entity-creation.service.ts`).
 */
export function trackedWriteChanges<T extends object>(
  before: T | null,
  after: T,
  trackedFields: Record<string, TrackedFieldDef>,
): AuditFieldChange[] {
  return EntityAuditService.diffFields(before === null ? {} : { ...before }, { ...after }, trackedFields);
}

/**
 * **Η ενέργεια** — `created` στη γέννηση · `status_changed` όταν άλλαξε **μόνο** ο κύκλος ζωής
 * (`lifecycle` — το φίλτρο «κατάσταση» του `ActivityTab` τις ξεχωρίζει) · αλλιώς `updated`.
 */
export function trackedWriteAction(
  before: object | null,
  changes: readonly AuditFieldChange[],
): AuditAction {
  if (before === null) return 'created';
  return changes.length > 0 && changes.every((change) => change.field === 'lifecycle')
    ? 'status_changed'
    : 'updated';
}

/** Μια επιτυχημένη γραφή — ό,τι χρειάζεται το ίχνος της. */
export interface TrackedEntityWrite<T extends object> {
  readonly entityType: AuditEntityType;
  readonly entityId: string;
  /** Όνομα προς εμφάνιση στο ιστορικό — `null` όταν ο άνθρωπος δεν έδωσε. */
  readonly entityName: string | null;
  readonly trackedFields: Record<string, TrackedFieldDef>;
  /** Η κατάσταση **πριν** — `null` στη γέννηση. */
  readonly before: T | null;
  readonly after: T;
  /** Αλλαγές που **δεν** είναι παρακολουθούμενο πεδίο — μπαίνουν στην **ίδια** εγγραφή (μία πράξη, μία γραμμή). */
  readonly extraChanges?: readonly AuditFieldChange[];
  /** Ο δρων. */
  readonly performedBy: string;
  /** Το βιβλίο — **παράγεται από τη θεματοφυλακή** του εγγράφου, ποτέ από τον δρώντα. */
  readonly ledger: AuditLedgerScope;
}

/**
 * **Καταγράφει** μια επιτυχημένη γραφή.
 *
 * 🔑 **Ιδεμπότητα**: ενημέρωση **χωρίς** αλλαγή παρακολουθούμενου πεδίου (π.χ. «αρχειοθέτησε» σε ήδη
 * αρχειοθετημένο) ⇒ **καμία** εγγραφή. Το ιστορικό μετρά πράξεις με αποτέλεσμα, όχι κλικ.
 */
export async function recordTrackedEntityWrite<T extends object>(write: TrackedEntityWrite<T>): Promise<void> {
  const changes = [
    ...trackedWriteChanges(write.before, write.after, write.trackedFields),
    ...(write.extraChanges ?? []),
  ];
  if (write.before !== null && changes.length === 0) return;

  await EntityAuditService.recordChange({
    entityType: write.entityType,
    entityId: write.entityId,
    entityName: write.entityName,
    action: trackedWriteAction(write.before, changes),
    changes,
    performedBy: write.performedBy,
    performedByName: null,
    ...write.ledger,
  });
}
