/**
 * ✍️ Πεδία Ιστορικού που ένας γραφέας γράφει **ΑΠΕΥΘΕΙΑΣ**, εκτός του μητρώου tracked πεδίων — ADR-195 (ζ) · ADR-915 §45.21
 *
 * 🔑 ΤΟ ΕΡΩΤΗΜΑ: *«ποια πεδία εμφανίζονται στο Ιστορικό αυτής της οντότητας χωρίς να περνούν από το `diffTrackedFields`;»*
 *
 * 🔴 **ΓΙΑΤΙ ΥΠΑΡΧΕΙ — ΜΕΤΡΗΜΕΝΟ 2026-11-16.** Το `auditVocabularyNamespaces` παρήγαγε τα namespaces μόνο από τα tracked +
 * τα αποσυρμένα πεδία. Οι αναθέσεις έκδοσης (ADR-915 §27/§45) γράφουν τα δικά τους πεδία με `EntityAuditService.recordChange`
 * ⇒ ο κατάλογός τους (`document-registry`) δεν φορτωνόταν ποτέ για το ακίνητο ⇒ σε el «— → declined», «quoted → accepted».
 *
 * ✅ **ΔΗΛΩΣΗ ΤΟΥ ΓΡΑΦΕΑ, ΟΧΙ ΛΙΣΤΑ ΟΝΟΜΑΤΩΝ.** Κάθε γραμμή εδώ δείχνει στην **ίδια** δήλωση που διαβάζει ο γραφέας — ένα νέο
 * πεδίο εκεί φορτώνει το λεξιλόγιό του χωρίς δεύτερη αλλαγή. Ο κατάλογος κάθε πεδίου λύνεται από το όνομά του
 * (`audit-value-catalogs.ts`), όπως και στον resolver.
 *
 * ⚠️ **ΜΟΝΟ ΑΝΑΓΝΩΣΗ — ΧΩΡΙΣΤΟ ΜΗΤΡΩΟ ΕΠΙΤΗΔΕΣ** (ίδιος λόγος με το `audit-retired-fields.ts`): αν τα πεδία έμπαιναν στο
 * ενεργό μητρώο, το `diffTrackedFields` θα τα αναζητούσε στο έγγραφο του ακινήτου, όπου **δεν** ζουν.
 *
 * @module config/audit-direct-written-fields
 */

import { ISSUANCE_AUDIT_FIELD_NAMES } from '@/lib/document-validity/issuance-audit-fields';

/** ADR-915 §27/§45 — `recordIssuanceAudit` γράφει σε `property` **ή** `owner_property`, ανάλογα με τον χώρο. */
const DIRECT_WRITTEN_FIELDS: Readonly<Record<string, readonly string[]>> = {
  property: ISSUANCE_AUDIT_FIELD_NAMES,
  owner_property: ISSUANCE_AUDIT_FIELD_NAMES,
};

/** Τα απευθείας γραμμένα πεδία ενός τύπου οντότητας (κενό αν δεν έχει) — μόνο own-property, ποτέ `constructor`. */
export function getDirectWrittenAuditFields(entityType: string | null): readonly string[] {
  if (entityType === null || !Object.prototype.hasOwnProperty.call(DIRECT_WRITTEN_FIELDS, entityType)) return [];
  return DIRECT_WRITTEN_FIELDS[entityType];
}
