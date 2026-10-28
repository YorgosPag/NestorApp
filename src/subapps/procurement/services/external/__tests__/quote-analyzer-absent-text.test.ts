/**
 * Το «null» ως ΚΕΙΜΕΝΟ δεν φτάνει ποτέ στην προσφορά (ADR-327 §8.5.4, 2026-10-28).
 *
 * 🔴 Η αφορμή, μετρημένη ζωντανά: σάρωση πραγματικής προσφοράς (MACON ATEE, 4 γραμμές) ⇒ το μοντέλο έδωσε το
 * κείμενο `"null"` σε `vendorVat` · `validUntil` · `quoteReference` · `warranty` · `signatory.role/mobile/email/
 * vatNumber`. Το `raw.x ?? null` το κράτησε, το Firestore το αποθήκευσε, ο έλεγχος σάρωσης έδειξε «null» στα πεδία.
 * Σχήμα εισόδου = ΤΟ ΜΕΤΡΗΜΕΝΟ (όχι επινοημένο).
 */

/* global describe, it, expect */

import { normalizeExtracted } from '../quote-analyzer.normalizers';
import type { RawExtractedQuote, RawSignatory } from '../quote-analyzer.schemas';

const SIGNATORY: RawSignatory = {
  firstName: 'Νίκη', firstNameConfidence: 95,
  lastName: 'Λογιωτάτου', lastNameConfidence: 95,
  role: 'null', roleConfidence: 0,
  profession: 'Πολιτικός Μηχανικός', professionConfidence: 95,
  mobile: 'null', mobileConfidence: 0,
  email: 'null', emailConfidence: 0,
  vatNumber: 'null', vatNumberConfidence: 0,
};

const RAW: RawExtractedQuote = {
  tableStructureNotes: '',
  vendorName: 'MACON ATEE',
  vendorVat: 'null',
  vendorPhone: '+30 2310 428900',
  vendorEmails: ['info@macon.gr', 'null'],
  vendorAddress: 'Απόλλωνος, Λαγκαδά Πυλαίας',
  vendorCity: 'Θεσσαλονίκη',
  vendorPostalCode: '55535',
  vendorCountry: 'GR',
  vendorBankAccounts: [{ bankName: 'Τράπεζα', bic: 'null', iban: 'GR0000000000000000000000000', currency: 'N/A', accountHolder: '' }],
  signatory: SIGNATORY,
  quoteDate: '2023-07-07',
  validUntil: 'null',
  quoteReference: 'null',
  lineItems: [{
    rowNumber: 'null',
    description: 'Θερμομονωτικές Πλάκες',
    descriptionConfidence: 95,
    rowSubtotal: null,
    rowSubtotalConfidence: 0,
    components: [{
      description: 'Fragmat Neo Super F', descriptionConfidence: 95,
      quantity: null, quantityConfidence: 0,
      unit: 'null', unitConfidence: 0,
      unitPrice: 3.37, unitPriceConfidence: 95,
      discountPercent: null, discountPercentConfidence: 0,
      vatRate: 24, vatRateConfidence: 0,
      lineTotal: null, lineTotalConfidence: 0,
    }],
  }],
  subtotal: null, vatAmount: null, totalAmount: null,
  paymentTerms: 'μετρητά',
  deliveryTerms: 'Παράδοση υλικών επί φορτηγού στο έργο',
  warranty: 'null',
  notes: 'Στις ανωτέρω τιμές δε συμπεριλαμβάνεται ΦΠΑ 24%',
  tradeHint: 'Θερμομόνωση Εξωτερικής Χρήσης',
  pricingType: 'mixed',
  vatIncluded: false, vatIncludedConfidence: 95,
  laborIncluded: null, laborIncludedConfidence: 0,
  detectedLanguage: 'el',
  overallConfidence: 90,
  confidence: {},
};

describe('normalizeExtracted — το κείμενο «null» του μοντέλου', () => {
  const out = normalizeExtracted(RAW);

  it('🔴 Ν1 — τα 4 πεδία κεφαλίδας που ήρθαν "null" αποθηκεύονται ως `null`', () => {
    expect(out.vendorVat.value).toBeNull();
    expect(out.validUntil.value).toBeNull();
    expect(out.quoteReference.value).toBeNull();
    expect(out.warranty.value).toBeNull();
  });

  it('🔴 Ν2 — υπογράφων: role · mobile · email · vatNumber ⇒ `null`· οι πραγματικές τιμές μένουν', () => {
    expect(out.signatory.role.value).toBeNull();
    expect(out.signatory.mobile.value).toBeNull();
    expect(out.signatory.email.value).toBeNull();
    expect(out.signatory.vatNumber.value).toBeNull();
    expect(out.signatory.firstName.value).toBe('Νίκη');
    expect(out.signatory.profession.value).toBe('Πολιτικός Μηχανικός');
  });

  it('Ν3 — λίστες, τράπεζα, γραμμή: καμία λέξη-δείκτης δεν επιβιώνει', () => {
    expect(out.vendorEmails.value).toEqual(['info@macon.gr']);
    expect(out.vendorBankAccounts[0]).toMatchObject({ bic: null, currency: null, accountHolder: null });
    expect(out.lineItems[0].unit.value).toBe('');
    expect(out.lineItems[0].parentRowNumber).toBeNull();
  });

  it('Ν4 — οι πραγματικές τιμές κεφαλίδας περνούν αυτούσιες', () => {
    expect(out.vendorName.value).toBe('MACON ATEE');
    expect(out.vendorPostalCode.value).toBe('55535');
    expect(out.paymentTerms.value).toBe('μετρητά');
  });
});
