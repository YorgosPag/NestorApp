/**
 * @fileoverview Τα **ονόματα** των εγγράφων του υπολογιστή (ADR-949) ως **ωμά** κλειδιά locale — ένας πίνακας για το σήμα
 *   προέλευσης και τον διάλογο ανάγνωσης. Ωμά κλειδιά, όχι `${…}`: ο γεννήτορας του i18n slice δεν λύνει δυναμικό `t()`.
 * @module components/objective-value/objective-value-document-labels
 */

import type { ObjectiveValueEvidenceDocument } from '@/config/objective-value/objective-value-evidence';

export const EVIDENCE_DOCUMENT_LABEL_KEYS: Readonly<Record<ObjectiveValueEvidenceDocument, string>> = {
  'owner-e9': 'objective-value:evidence.documents.owner-e9',
  'owner-enfia-assessment': 'objective-value:evidence.documents.owner-enfia-assessment',
  'unit-permit': 'objective-value:evidence.documents.unit-permit',
  'title-deed': 'objective-value:evidence.documents.title-deed',
};
