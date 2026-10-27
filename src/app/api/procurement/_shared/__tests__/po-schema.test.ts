/**
 * Σχήμα PO στο σύνορο του API (ADR-923 §5.11 «3γ», Α5).
 * Το `materialId` πεταγόταν σιωπηλά ⇒ ούτε σύμβαση ανά υλικό ούτε `materialPriceSyncOnPODelivery`.
 */

import { CreatePOItemSchema, CreatePOSchema } from '../po-schema';

const ITEM = { description: 'καλώδιο', quantity: 2, unit: 'm', unitPrice: 1.5, total: 3, categoryCode: 'OIK-7' };

describe('CreatePOItemSchema', () => {
  it('Α5: κρατά το materialId', () => {
    expect(CreatePOItemSchema.parse({ ...ITEM, materialId: 'mat_1' })).toHaveProperty('materialId', 'mat_1');
  });

  it('χωρίς materialId ⇒ null (ρητό, όχι απόν)', () => {
    expect(CreatePOItemSchema.parse(ITEM)).toHaveProperty('materialId', null);
  });

  it('αρνείται ποσότητα/τιμή που η PO δεν μπορεί να κουβαλήσει ακριβώς', () => {
    expect(CreatePOItemSchema.safeParse({ ...ITEM, quantity: 1.2345 }).success).toBe(false);
    expect(CreatePOItemSchema.safeParse({ ...ITEM, unitPrice: 0.12345 }).success).toBe(false);
    expect(CreatePOItemSchema.safeParse({ ...ITEM, quantity: 12.5, unitPrice: 0.125 }).success).toBe(true);
  });
});

describe('CreatePOSchema', () => {
  it('δεν δέχεται εκπτώσεις/σύνολα από τον πελάτη — τα υπολογίζει μόνο ο server', () => {
    const parsed = CreatePOSchema.parse({
      projectId: 'p_1', supplierId: 'sup_1', items: [ITEM], taxRate: 24,
      appliedFaId: 'fwa_rich', faDiscountPercent: 50, faDiscountAmount: 500, netTotal: 1,
    });
    expect(parsed).not.toHaveProperty('faDiscountPercent');
    expect(parsed).not.toHaveProperty('netTotal');
    expect(parsed).not.toHaveProperty('appliedFaId');
  });
});
