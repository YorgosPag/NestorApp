import 'server-only';

/**
 * @fileoverview **ΤΟ ΙΧΝΟΣ ΤΗΣ ΑΓΓΕΛΙΑΣ** — ποιος άλλαξε τι, πότε, και **σε ποιου το βιβλίο** γράφεται.
 * @related ADR-864 Φ1β (Ε-9 Α) · ADR-195 §«Προσωπικό βιβλίο» · ADR-777 §8.39 (θεματοφυλακή)
 * @module services/owner-property/owner-property-audit
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΚΕΝΟ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Καμία πράξη στο `owner_properties` δεν άφηνε ίχνος — ούτε η **απόσυρση**, ούτε το
 * **στένεμα κοινού** που το Ε-3 αποφάσισε «ελεύθερο, **με ίχνος**». Και δεν μπορούσε: το
 * ίχνος απαιτούσε `companyId`, και ο ιδιώτης (Ε-1) δεν έχει.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΔΥΟ ΕΡΩΤΗΣΕΙΣ, ΔΥΟ ΑΠΑΝΤΗΣΕΙΣ — ΠΟΤΕ ΜΙΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * | Ερώτηση | Πηγή | Πεδίο |
 * |---|---|---|
 * | **ποιος το έκανε;** | ο δρων (`ListingActor.uid`) | `performedBy` |
 * | **σε ποιου το βιβλίο;** | η **θεματοφυλακή** (`custodyOf`) | `companyId` **ή** `userId` |
 *
 * ⚠️ **Η εμβέλεια ΔΕΝ παράγεται από τον δρώντα.** Ένας μεσίτης που αποσύρει το **δικό του**
 * διαμέρισμα ως ιδιώτης έχει `companyId` στην ταυτότητά του — αν η εμβέλεια ερχόταν από
 * εκεί, η εγγραφή θα πήγαινε στο βιβλίο **του γραφείου** και θα τη διάβαζε ο προϊστάμενός
 * του. Η θεματοφυλακή είναι **παράγωγο πεδίων που κανείς δεν στέλνει από το δίκτυο**, άρα
 * το βιβλίο **δεν επιλέγεται** — προκύπτει.
 *
 * 🏆 **Πρότυπο**: Salesforce Field History (πεδίο · παλιά · νέα · ποιος · πότε) · ιστορικό
 * τιμής Zillow/Idealista (αλλαγή τιμής **ανά διάθεση**) · GitHub/Figma (το προσωπικό ίχνος
 * δεν το βλέπει ο διαχειριστής οργανισμού). **Πάμε παραπέρα** σε ένα σημείο που μετράει: το
 * ίχνος είναι **ιδιότητα της διαδρομής γραφής** (`persist` το απαιτεί στον **τύπο**), όχι
 * κλήση που κάθε νέα πράξη πρέπει να θυμηθεί.
 */

import { EntityAuditService } from '@/services/entity-audit.service';
import { OWNER_PROPERTY_TRACKED_FIELDS } from '@/config/audit-tracked-fields';
import { auditLedgerScopeOf } from '@/lib/audit/audit-ledger';
import {
  custodyOf,
  custodyWorkspace,
  type ListingActor,
} from '@/lib/owner-property/listing-custody';
import type { AuditAction, AuditFieldChange } from '@/types/audit-trail';
import type { OwnerProperty } from '@/types/owner-property';

/** Ό,τι χρειάζεται το ίχνος μιας γραφής — **υποχρεωτικό** στο `persist`. */
export interface OwnerPropertyAuditContext {
  /** Ποιος ενεργεί. */
  readonly actor: ListingActor;
  /** Η κατάσταση **πριν** — `null` στη γέννηση. */
  readonly before: OwnerProperty | null;
  /**
   * ADR-864 Φ3 (Α18) — αλλαγές που **δεν** είναι παρακολουθούμενο πεδίο (γεγονός συναίνεσης πάνω στην
   * εντολή). Μπαίνουν στην **ίδια** εγγραφή με τις διαφορές πεδίων: μία πράξη, μία γραμμή ιστορικού.
   */
  readonly extraChanges?: readonly AuditFieldChange[];
}

/**
 * **Οι αλλαγές** ανάμεσα σε δύο καταστάσεις, από το **ένα** μητρώο πεδίων.
 *
 * Στη γέννηση η σύγκριση γίνεται με **κενό** έγγραφο ⇒ το ιστορικό ξεκινά με τις αρχικές
 * τιμές (ίδιο πρότυπο με το `entity-creation.service.ts`).
 */
export function ownerPropertyAuditChanges(
  before: OwnerProperty | null,
  after: OwnerProperty,
): AuditFieldChange[] {
  return EntityAuditService.diffFields(
    before === null ? {} : { ...before },
    { ...after },
    OWNER_PROPERTY_TRACKED_FIELDS,
  );
}

/**
 * **Η ενέργεια** — `created` στη γέννηση · `status_changed` όταν άλλαξε **μόνο** ο κύκλος
 * ζωής (απόσυρση/επαναφορά — το φίλτρο «κατάσταση» του `ActivityTab` τις ξεχωρίζει) ·
 * αλλιώς `updated`.
 */
export function ownerPropertyAuditAction(
  before: OwnerProperty | null,
  changes: readonly AuditFieldChange[],
): AuditAction {
  if (before === null) return 'created';
  return changes.length > 0 && changes.every((change) => change.field === 'lifecycle')
    ? 'status_changed'
    : 'updated';
}

/**
 * **Καταγράφει** μια επιτυχημένη γραφή αγγελίας.
 *
 * ⚠️ **Καλείται ΜΟΝΟ μετά από επιτυχή γραφή** — ένα ίχνος για πράξη που δεν έγινε είναι
 * ψέμα στο βιβλίο που υπάρχει για να λέει την αλήθεια.
 *
 * 🔑 **Ιδεμπότητα**: ενημέρωση **χωρίς** αλλαγή παρακολουθούμενου πεδίου (π.χ. «απόσυρε»
 * σε ήδη αποσυρμένη) ⇒ **καμία** εγγραφή. Το ιστορικό μετρά πράξεις με αποτέλεσμα, όχι κλικ.
 *
 * ⚠️ **Δεν πετά ποτέ** (το `recordChange` καταπίνει και καταγράφει) — ίχνος που αποτυγχάνει
 * δεν ακυρώνει ποτέ την πράξη του ανθρώπου.
 */
export async function recordOwnerPropertyWrite(
  after: OwnerProperty,
  { actor, before, extraChanges = [] }: OwnerPropertyAuditContext,
): Promise<void> {
  const changes = [...ownerPropertyAuditChanges(before, after), ...extraChanges];
  if (before !== null && changes.length === 0) return;

  await EntityAuditService.recordChange({
    entityType: 'owner_property',
    entityId: after.id,
    entityName: after.title.trim() || null,
    action: ownerPropertyAuditAction(before, changes),
    changes,
    performedBy: actor.uid,
    performedByName: null,
    ...auditLedgerScopeOf(custodyWorkspace(custodyOf(after))),
  });
}
