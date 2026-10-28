/**
 * @jest-environment node
 *
 * Μονάδα στο σύνορο του API (ADR-327 §8.5.4, 2026-10-28) — ο ΕΝΑΣ κανόνας εισόδου `toStoredUom` και στα PM routes.
 * Ζωντανά: η «Νέα Προσφορά» έδειχνε `pcs` σε ελεύθερο πεδίο και η γραμμή RFQ δοκιμής είχε αποθηκευτεί ως «m³» δίπλα
 * στο «m3» της BOQ (δύο γραφές για την ίδια μονάδα). Σάρωση και πύλη κανονικοποιούσαν ήδη· PM routes όχι.
 *
 * Μ1 γραμμή προσφοράς: «m³»/«τεμ» → κανονικός κωδικός · άγνωστη γραφή αυτούσια (ορατή, ποτέ ψεύτικη αντιστοίχιση) ·
 * Μ2 γραμμή RFQ: ίδιο · κενό ⇒ `null` (καμία μονάδα, ΟΧΙ προεπιλογή) · απούσα ⇒ απούσα (μερική ενημέρωση).
 */

jest.mock('server-only', () => ({}));

import { QuoteLineCreateSchema, QuoteLineSchema } from '@/app/api/quotes/_shared/quote-line-schema';
import { RfqLineItemSchema } from '../rfq-line-schema';

const QUOTE_LINE = {
  id: 'ql1', description: 'σκυρόδεμα', categoryCode: null, quantity: 2, unitPrice: 10, vatRate: 24, lineTotal: 20, notes: null,
};
const RFQ_LINE = { source: 'ad_hoc' as const, description: 'σκυρόδεμα', trade: 'concrete' as const };

describe('Μ1 γραμμή προσφοράς', () => {
  it.each([['m³', 'm3'], ['τεμ', 'pcs'], ['m3', 'm3']])('%s → %s', (raw, stored) => {
    expect(QuoteLineSchema.parse({ ...QUOTE_LINE, unit: raw }).unit).toBe(stored);
    expect(QuoteLineCreateSchema.parse({ ...QUOTE_LINE, unit: raw }).unit).toBe(stored);
  });

  it('άγνωστη γραφή μένει αυτούσια', () => {
    expect(QuoteLineSchema.parse({ ...QUOTE_LINE, unit: 'καρότσι' }).unit).toBe('καρότσι');
  });
});

describe('Μ2 γραμμή RFQ', () => {
  it('«m³» → m3 · κενό ⇒ null · απούσα ⇒ απούσα', () => {
    expect(RfqLineItemSchema.parse({ ...RFQ_LINE, unit: 'm³' }).unit).toBe('m3');
    expect(RfqLineItemSchema.parse({ ...RFQ_LINE, unit: '  ' }).unit).toBeNull();
    expect(RfqLineItemSchema.parse({ ...RFQ_LINE, unit: null }).unit).toBeNull();
    expect(RfqLineItemSchema.parse(RFQ_LINE)).not.toHaveProperty('unit', expect.anything());
  });
});
