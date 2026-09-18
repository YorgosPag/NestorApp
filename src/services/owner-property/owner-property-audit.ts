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
import { recordTrackedEntityWrite } from '@/services/entity-audit-tracked-write';
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
 * **Καταγράφει** μια επιτυχημένη γραφή αγγελίας — μέσω του **κοινού** ίχνους οντότητας
 * (`entity-audit-tracked-write.ts`, ADR-866 §2.8 Γ3): μόνο μετά από επιτυχή γραφή · ιδεμπότητο ·
 * δεν πετά ποτέ. Εδώ μένει **μόνο** ό,τι είναι της αγγελίας: μητρώο πεδίων, όνομα, θεματοφυλακή.
 */
export async function recordOwnerPropertyWrite(
  after: OwnerProperty,
  { actor, before, extraChanges = [] }: OwnerPropertyAuditContext,
): Promise<void> {
  await recordTrackedEntityWrite({
    entityType: 'owner_property',
    entityId: after.id,
    entityName: after.title.trim() || null,
    trackedFields: OWNER_PROPERTY_TRACKED_FIELDS,
    before,
    after,
    extraChanges,
    performedBy: actor.uid,
    ledger: auditLedgerScopeOf(custodyWorkspace(custodyOf(after))),
  });
}

/** Οι ενέργειες ιστορικού που αφορούν **ένα** παγωμένο αποδεικτικό — μία διατύπωση για όλες (ADR-864 §19-§20). */
export type OwnerPropertyEvidenceAction = Extract<AuditAction, 'document_accessed' | 'evidence_retention_scheduled' | 'evidence_disposed'>;

/**
 * **Καταγράφει γεγονός παγωμένου αποδεικτικού**: άνοιγμα (Α34 — το «Viewed» του DocuSign) · κλείδωμα διατήρησης ·
 * διάθεση (§20 — η απόδειξη διάθεσης του Purview).
 *
 * 🔑 Στο **ίδιο** βιβλίο με τις γραφές της αγγελίας (προσωπικό ή εταιρικό, `auditLedgerScopeOf`): ο
 * ιδιοκτήτης βλέπει στο «Ιστορικό» **ποιος** άνοιξε το έντυπο που βεβαιώθηκε στο όνομά του, **πότε**, και
 * **ως πότε** κρατιέται.
 * ⚠️ Δεν πετά ποτέ — αποτυχία ίχνους δεν ακυρώνει πράξη που ήδη κρίθηκε.
 */
export async function recordOwnerPropertyEvidenceEvent(
  property: OwnerProperty,
  action: OwnerPropertyEvidenceAction,
  performedBy: string,
  evidence: { readonly id: string; readonly fileName: string },
  detail: string | null = null,
): Promise<void> {
  await EntityAuditService.recordChange({
    entityType: 'owner_property',
    entityId: property.id,
    entityName: property.title.trim() || null,
    action,
    changes: [{ field: 'evidence', oldValue: null, newValue: detail === null ? evidence.id : `${evidence.id} · ${detail}`, label: evidence.fileName }],
    performedBy,
    performedByName: null,
    ...auditLedgerScopeOf(custodyWorkspace(custodyOf(property))),
  });
}

/** Άνοιγμα αποδεικτικού από δρώντα (Α34). */
export async function recordOwnerPropertyEvidenceAccess(
  property: OwnerProperty,
  actor: ListingActor,
  evidence: { readonly id: string; readonly fileName: string },
): Promise<void> {
  await recordOwnerPropertyEvidenceEvent(property, 'document_accessed', actor.uid, evidence);
}
