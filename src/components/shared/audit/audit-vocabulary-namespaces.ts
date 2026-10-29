/**
 * 🌐 Ποια namespaces χρειάζεται η γραμμή Ιστορικού μιας οντότητας — ADR-195 (ζ)
 *
 * 🔑 ΤΟ ΕΡΩΤΗΜΑ: *«για να γράψω τις τιμές του ιστορικού ΑΥΤΗΣ της οντότητας, ποια λεξιλόγια πρέπει να είναι φορτωμένα;»*
 *
 * 🔴 **ΓΙΑΤΙ ΥΠΑΡΧΕΙ — ΜΕΤΡΗΜΕΝΟ 2026-10-29.** Ο `audit-value-resolver` διάβαζε καταλόγους από `contacts-form`,
 * `properties-enums`, `projects`, `quotes`, `document-registry` — **κανένα** στο `AUDIT_TIMELINE_NAMESPACES`, και
 * **κανείς** στο audit δεν τα φόρτωνε. Δούλευαν μόνο όταν άλλο component της ίδιας σελίδας έτυχε να τα έχει φορτώσει.
 *
 * ✅ **ΠΑΡΑΓΩΓΗ, ΟΧΙ ΛΙΣΤΑ.** Τα namespaces βγαίνουν από τις **ίδιες** δηλώσεις που χρησιμοποιεί ο resolver
 * (`enumCatalog` · `itemCatalogs` · `nestedKeyCatalog` · κατάλογος ανά όνομα πεδίου · λέξη μονάδας εμβαδού). Μια νέα
 * δήλωση φορτώνει το namespace της **χωρίς** δεύτερη γραμμή κάπου αλλού — δεν υπάρχει χειρόγραφη λίστα να ξεχαστεί.
 * Κάθε οντότητα πληρώνει **μόνο** τα δικά της λεξιλόγια (namespace ανά λειτουργία, πρακτική i18next/Locize).
 *
 * @module components/shared/audit/audit-vocabulary-namespaces
 */

import { getTrackedFieldsForEntityAuditType } from '@/config/audit-tracked-fields';
import { getAuditValueCatalog, type AuditCatalogRef } from '@/config/audit-value-catalogs';
import { AUDIT_AREA_FIELDS, AUDIT_VALUE_WORDS } from '@/config/audit-value-vocabularies';
import type { TrackedFieldDef } from '@/lib/audit/tracked-field-def';

const cache = new Map<string, readonly string[]>();

/** Όλοι οι κατάλογοι που δηλώνει ένα tracked πεδίο — ό,τι θα ρωτήσει ο resolver για τις τιμές του. */
function catalogsOfField(field: string, def: TrackedFieldDef): AuditCatalogRef[] {
  const refs: (AuditCatalogRef | undefined)[] = [
    // ΑΚΡΙΒΩΣ ο κανόνας του `resolveAuditValue`: ο κατάλογος του περιγραφέα, αλλιώς ο κατάλογος του ονόματος.
    def.enumCatalog ?? getAuditValueCatalog(field),
    def.nestedKeyCatalog,
    ...Object.values(def.itemCatalogs ?? {}),
  ];
  return refs.filter((ref): ref is AuditCatalogRef => ref !== undefined);
}

/**
 * Τα namespaces λεξιλογίου για τον τύπο οντότητας, ταξινομημένα (σταθερό κλειδί για τον hook φόρτωσης).
 * Άγνωστος τύπος ⇒ κενή λίστα: ο resolver πέφτει στην ωμή τιμή, **ορατά**.
 */
export function auditVocabularyNamespaces(entityType: string | null): readonly string[] {
  const cacheKey = entityType ?? '';
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const result = vocabularyNamespacesOf(getTrackedFieldsForEntityAuditType(entityType) ?? {});
  cache.set(cacheKey, result);
  return result;
}

/** Η καθαρή παραγωγή, από ένα μητρώο πεδίων — εκτεθειμένη ώστε η άγκυρα να ελέγχει κάθε κανόνα χωριστά (Λ3). */
export function vocabularyNamespacesOf(defs: Readonly<Record<string, TrackedFieldDef>>): readonly string[] {
  const namespaces = new Set<string>();
  for (const [field, def] of Object.entries(defs)) {
    for (const ref of catalogsOfField(field, def)) namespaces.add(ref.ns);
    if (AUDIT_AREA_FIELDS.has(field)) namespaces.add(AUDIT_VALUE_WORDS.sqm.ns);
  }
  return [...namespaces].sort();
}
