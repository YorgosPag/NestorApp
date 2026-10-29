"use client";

/**
 * 🌐 Φορτώνει τα λεξιλόγια τιμών της οντότητας για τη γραμμή Ιστορικού — ADR-195 (ζ)
 *
 * Το `t` που επιστρέφει αλλάζει αναφορά όταν ολοκληρωθεί η φόρτωση (`useTranslation`, ADR-744 §25), οπότε μια γραμμή
 * που ζωγραφίστηκε πριν φτάσει το λεξιλόγιο **ξαναζωγραφίζεται** με τις λέξεις — δεν μένει ωμή.
 *
 * ⚠️ Χωριστό αρχείο, **χωρίς** στατικά κλειδιά: η λίστα namespaces είναι παραγόμενη (`auditVocabularyNamespaces`), και
 * ο αναλυτής του CHECK 3.8 διαβάζει μόνο bundles γραμμένα ως literal. Κάθε κλειδί που λύνεται με αυτό το `t` φέρει
 * **ρητό** `ns` από τη δήλωσή του.
 *
 * @module components/shared/audit/useAuditVocabulary
 */

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { auditVocabularyNamespaces } from './audit-vocabulary-namespaces';

export function useAuditVocabulary(entityType: string | null) {
  return useTranslation(auditVocabularyNamespaces(entityType)).t;
}
