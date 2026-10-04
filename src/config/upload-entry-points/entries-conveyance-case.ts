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

/**
 * Π2 — το id του entry point **εκ μέρους** του πελάτη, παραγόμενο από το id της γραμμής (ίδια σύμβαση με το
 * `purpose`): ο κατάλογος (`items-parties.ts`) και αυτό το αρχείο **δεν** κρατούν δεύτερο λεξικό αντιστοίχισης.
 */
export function onBehalfEntryPointId(itemId: string): string {
  return `case-${itemId.replace(/_/g, '-')}`;
}

interface OnBehalfDocument {
  readonly itemId: string;
  readonly label: UploadEntryPoint['label'];
  readonly icon: string;
}

/**
 * Π2 — τα έγγραφα του **αγοραστή/τράπεζας** που ο δικηγόρος αγοραστή στέλνει **εκ μέρους** του πελάτη του
 * (`PROVIDER_FULFILMENT`, `capacity: 'on_behalf'`). Ανεβαίνουν στον δικό του προσωπικό χώρο όπως κάθε transmittal·
 * το ακροατήριο το ορίζει η κλάση ιδιωτικότητας του εγγράφου (αγοραστής · δικηγόρος του · συμβολαιογράφος).
 */
const ON_BEHALF_OF_BUYER: readonly OnBehalfDocument[] = [
  { itemId: 'buyer_identity', label: { el: 'Ταυτότητα και ΑΦΜ αγοραστή', en: 'Buyer ID and tax number' }, icon: 'UserSquare' },
  { itemId: 'buyer_income_statement', label: { el: 'Εκκαθαριστικό Ε1 αγοραστή', en: 'Buyer E1 income statement' }, icon: 'Receipt' },
  { itemId: 'buyer_mortgage_approval', label: { el: 'Έγκριση στεγαστικού δανείου', en: 'Mortgage approval' }, icon: 'Landmark' },
  { itemId: 'buyer_employment_certificate', label: { el: 'Βεβαίωση εργοδότη / εισοδήματος', en: 'Employer / income certificate' }, icon: 'Briefcase' },
  { itemId: 'buyer_payslips', label: { el: 'Μισθοδοτικές καταστάσεις', en: 'Payslips' }, icon: 'Receipt' },
  { itemId: 'bank_property_valuation', label: { el: 'Εκτίμηση ακινήτου από την τράπεζα', en: 'Bank property valuation' }, icon: 'Landmark' },
  { itemId: 'buyer_first_home_exemption', label: { el: 'Δικαιολογητικά απαλλαγής α\' κατοικίας', en: 'First-home exemption documents' }, icon: 'Home' },
  { itemId: 'buyer_payment_proofs', label: { el: 'Αποδεικτικά καταβολής τιμήματος', en: 'Proof of payment of the price' }, icon: 'Banknote' },
];

const ON_BEHALF_FIRST_ORDER = 6;

function onBehalfOfBuyer(document: OnBehalfDocument, index: number): UploadEntryPoint {
  return {
    id: onBehalfEntryPointId(document.itemId),
    purpose: document.itemId,
    domain: 'legal',
    category: 'documents',
    label: document.label,
    description: { el: 'Εκ μέρους του αγοραστή', en: 'On behalf of the buyer' },
    icon: document.icon,
    order: ON_BEHALF_FIRST_ORDER + index,
  };
}

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
  ...ON_BEHALF_OF_BUYER.map(onBehalfOfBuyer),
];
