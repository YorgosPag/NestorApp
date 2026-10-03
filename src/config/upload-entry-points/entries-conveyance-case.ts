/**
 * =============================================================================
 * Upload Entry Points — Conveyance Case (ADR-901 §5.8.1 · Φ4.4 — Transmittal)
 * =============================================================================
 *
 * Τα έγγραφα που **ο επαγγελματίας** ετοιμάζει για μια υπόθεση μεταβίβασης. Ανεβαίνουν στον **δικό του**
 * προσωπικό χώρο (`files_personal`, `entityType: 'conveyance_case'`, `entityId: <caseId>`) και μένουν
 * **πρόχειρα** — αόρατα σε όλους — μέχρι να γίνει *transmittal* (`conveyance_contributions`, Α24).
 *
 * 🔑 Ένα entry point ανά γραμμή καταλόγου που δέχεται αποστολή. Η αντιστοίχιση γραμμή → entry point ζει
 * **μόνο** στον κατάλογο (`satisfaction.matchers`, επίπεδο `contribution`)· η άγκυρα Α7 απαιτεί κάθε id
 * εδώ να υπάρχει. Το `purpose` = το id της γραμμής, ώστε η αντιστοίχιση να μη χρειάζεται δεύτερο λεξικό.
 *
 * @module config/upload-entry-points/entries-conveyance-case
 */

import type { UploadEntryPoint } from './types';

export const CONVEYANCE_CASE_ENTRY_POINTS: UploadEntryPoint[] = [
  {
    id: 'case-legal-due-diligence',
    purpose: 'legal_due_diligence_report',
    domain: 'legal',
    category: 'documents',
    label: { el: 'Έκθεση νομικού ελέγχου', en: 'Legal due diligence report' },
    description: { el: 'Έλεγχος τίτλων και βαρών — μόνο για τη δική σας πλευρά', en: 'Title and encumbrance review — your side only' },
    icon: 'Scale',
    order: 1,
  },
  {
    id: 'case-contract-draft',
    purpose: 'contract_draft',
    domain: 'legal',
    category: 'contracts',
    label: { el: 'Σχέδιο συμβολαίου', en: 'Draft contract' },
    icon: 'FileSignature',
    order: 2,
  },
  {
    id: 'case-final-contract',
    purpose: 'final_contract',
    domain: 'legal',
    category: 'contracts',
    label: { el: 'Οριστικό συμβόλαιο', en: 'Final contract' },
    icon: 'FileSignature',
    order: 3,
  },
  {
    id: 'case-transfer-tax-proof',
    purpose: 'transfer_tax_proof',
    domain: 'legal',
    category: 'documents',
    label: { el: 'Αποδεικτικό φόρου μεταβίβασης', en: 'Transfer tax receipt' },
    icon: 'Receipt',
    order: 4,
  },
  {
    id: 'case-cadastre-registration',
    purpose: 'cadastre_registration_proof',
    domain: 'legal',
    category: 'documents',
    label: { el: 'Βεβαίωση καταχώρισης στο Κτηματολόγιο', en: 'Land registry registration certificate' },
    icon: 'Landmark',
    order: 5,
  },
];
