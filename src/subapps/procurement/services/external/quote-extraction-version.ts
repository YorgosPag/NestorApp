/**
 * 🏷️ Έκδοση κανονικοποίησης της εξαγωγής προσφοράς + αναβάθμιση **ήδη αποθηκευμένων** εξαγωγών (ADR-327 §8.5.4).
 *
 * 🔴 **ΓΙΑΤΙ (2026-10-29)**: η διόρθωση της 28/10 (`structuredText` στο `normalizeExtracted`) καθαρίζει μόνο **νέες**
 * σαρώσεις. Η QT-0004 (MACON ATEE) και κάθε παλιότερη σάρωση κρατούν στο Firestore το ΚΕΙΜΕΝΟ `"null"` σε 8 πεδία, και
 * ο έλεγχος σάρωσης το δείχνει. Τίποτα στο αποθηκευμένο έγγραφο δεν έλεγε **με ποιους κανόνες** βγήκε.
 *
 * 🔑 **Όπως οι μεγάλοι**: το Azure Document Intelligence σφραγίζει κάθε αποτέλεσμα με την έκδοση που το παρήγαγε
 * (`apiVersion`)· το μοτίβο «schema versioning» (MongoDB) κρατά έκδοση **πάνω στο έγγραφο** ώστε μια μετάπτωση να
 * στοχεύει ακριβώς όσα είναι παλιότερα. Εδώ: `normalizationVersion` σε κάθε νέα εξαγωγή, και μία καθαρή συνάρτηση που
 * φέρνει ένα παλιό αποθηκευμένο σχήμα στην τρέχουσα έκδοση — με τον **ΙΔΙΟ** ορισμό απουσίας (`structuredText`) που
 * χρησιμοποιεί η εγγραφή. Η άγκυρα σημείου-σταθερότητας αποδεικνύει ότι εγγραφή και μετάπτωση λένε το ίδιο.
 *
 * ⚠️ Η confidence **δεν** αλλάζει (provenance: είναι η κρίση του μοντέλου τη στιγμή της σάρωσης).
 *
 * @module subapps/procurement/services/external/quote-extraction-version
 */

import type { ExtractedQuoteData, ExtractedQuoteLine, ExtractedSignatory, FieldWithConfidence } from '../../types/quote';
import { structuredText, structuredTextList } from '@/lib/ai-structured-output';

/**
 * Η τρέχουσα έκδοση κανόνων κανονικοποίησης. Ανέβασέ την όταν αλλάζει κανόνας που αφορά **ήδη αποθηκευμένα** δεδομένα,
 * και επέκτεινε το `normalizeStoredExtractedData`.
 * - (λείπει) — πριν τις 2026-10-28: το κείμενο `"null"`/`"N/A"`/`"—"` αποθηκευόταν ως τιμή.
 * - `2` — κάθε κείμενο περνά από `structuredText` (ADR-327 §8.5.4).
 */
export const QUOTE_EXTRACTION_NORMALIZATION_VERSION = 2;

/** Τα πεδία κειμένου πρώτου επιπέδου που μπορεί να λείπουν (`FieldWithConfidence<string | null>`). */
export const STORED_NULLABLE_TEXT_FIELDS = [
  'vendorName', 'vendorVat', 'vendorPhone', 'vendorAddress', 'vendorCity', 'vendorPostalCode', 'vendorCountry',
  'quoteDate', 'validUntil', 'quoteReference', 'paymentTerms', 'deliveryTerms', 'warranty', 'notes', 'tradeHint',
] as const satisfies readonly (keyof ExtractedQuoteData)[];

const SIGNATORY_TEXT_FIELDS = [
  'firstName', 'lastName', 'role', 'profession', 'mobile', 'email', 'vatNumber',
] as const satisfies readonly (keyof ExtractedSignatory)[];

/** Ένα πεδίο που **λείπει** (παλιό σχήμα) μένει όπως είναι — η μετάπτωση καθαρίζει, δεν εφευρίσκει πεδία. */
function cleanField(f: FieldWithConfidence<string | null> | undefined): FieldWithConfidence<string | null> | undefined {
  return f ? { ...f, value: structuredText(f.value) } : f;
}

function cleanSignatory(s: ExtractedSignatory | undefined): ExtractedSignatory | undefined {
  if (!s) return s; // σάρωση πριν το ADR-336: χωρίς υπογράφοντα
  const out = { ...s };
  for (const key of SIGNATORY_TEXT_FIELDS) {
    const cleaned = cleanField(s[key]);
    if (cleaned) out[key] = cleaned;
  }
  return out;
}

function cleanLine(line: ExtractedQuoteLine): ExtractedQuoteLine {
  return {
    ...line,
    description: { ...line.description, value: structuredText(line.description.value) ?? '' },
    unit: { ...line.unit, value: structuredText(line.unit.value) ?? '' },
    parentRowNumber: structuredText(line.parentRowNumber),
  };
}

/** `true` όταν η εξαγωγή γράφτηκε με παλιότερους κανόνες από τους τρέχοντες. */
export function extractionNeedsUpgrade(data: Pick<ExtractedQuoteData, 'normalizationVersion'>): boolean {
  return (data.normalizationVersion ?? 0) < QUOTE_EXTRACTION_NORMALIZATION_VERSION;
}

/**
 * Αποθηκευμένη εξαγωγή → η ίδια, με τους τρέχοντες κανόνες. Καθαρή και ιδεμποτική: δεύτερη εφαρμογή = ίδιο αποτέλεσμα.
 * Γραμμές: η περιγραφή/μονάδα είναι μη-κενού τύπου (`string`) ⇒ απουσία = `''`, όπως στο `normalizeLineItems`.
 */
export function normalizeStoredExtractedData(data: ExtractedQuoteData): ExtractedQuoteData {
  const out: ExtractedQuoteData = { ...data, normalizationVersion: QUOTE_EXTRACTION_NORMALIZATION_VERSION };
  for (const key of STORED_NULLABLE_TEXT_FIELDS) {
    const cleaned = cleanField(data[key]);
    if (cleaned) out[key] = cleaned;
  }
  if (data.vendorEmails) out.vendorEmails = { ...data.vendorEmails, value: structuredTextList(data.vendorEmails.value) };
  if (Array.isArray(data.lineItems)) out.lineItems = data.lineItems.map(cleanLine);
  if (Array.isArray(data.vendorBankAccounts)) {
    out.vendorBankAccounts = data.vendorBankAccounts.map((b) => ({
      ...b,
      bic: structuredText(b.bic),
      currency: structuredText(b.currency),
      accountHolder: structuredText(b.accountHolder),
    }));
  }
  const signatory = cleanSignatory(data.signatory);
  if (signatory) out.signatory = signatory;
  return out;
}
