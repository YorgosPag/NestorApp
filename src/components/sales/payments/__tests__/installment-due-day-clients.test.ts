/**
 * ADR-234 — οι δύο πελάτες της λήξης δόσης γράφουν και διαβάζουν **ημέρα** (`YYYY-MM-DD`).
 *
 * Φυλάνε τα δύο σφάλματα που διορθώθηκαν 2026-10-29: (α) wizard 00:00–03:00 ώρα Ελλάδας ⇒ η φόρμα έδειχνε την
 * ΠΡΟΗΓΟΥΜΕΝΗ ημέρα (τοπική `Date` → `toISOString()` → `split('T')`)· (β) `setMonth` ⇒ 31/1 + 1 μήνας = 3/3.
 */

import type { Installment, PaymentPlanTemplate, TemplateSlot } from '@/types/payment-plan';
import { computeInstallments } from '../payment-plan-wizard-model';
import { buildInstallmentChange, initialInstallmentFields } from '../edit-installment-model';

function slot(overrides: Partial<TemplateSlot> = {}): TemplateSlot {
  return { type: 'custom', labelKey: 'k', defaultLabel: 'Δόση', percentage: 25, amountType: 'percentage', fixedAmount: null, ...overrides };
}

function template(count: number): PaymentPlanTemplate {
  return {
    id: 't', nameKey: 'n', defaultName: 'n', descriptionKey: 'd', defaultDescription: 'd',
    slots: Array.from({ length: count }, () => slot()),
    defaultConfig: {} as PaymentPlanTemplate['defaultConfig'],
  };
}

function installment(dueDate: string): Installment {
  return {
    index: 0, label: 'Κράτηση', type: 'custom', amount: 1000, percentage: 10, dueDate,
    status: 'pending', paidAmount: 0, paidDate: null, paymentIds: [], notes: null,
  } as Installment;
}

describe('wizard — computeInstallments', () => {
  it('01:30 ώρα Ελλάδας 5/11 (23:30Z της 4/11) ⇒ πρώτη λήξη 5/11, ως ημέρα', () => {
    const dues = computeInstallments(template(2), 100_000, new Date('2026-11-04T23:30:00.000Z')).map((i) => i.dueDate);
    expect(dues).toEqual(['2026-11-05', '2026-12-05']);
  });

  it('31/1 ⇒ 28/2 ⇒ 31/3: ψαλίδισμα, όχι 3 Μαρτίου — και κάθε μήνας από την ΑΡΧΙΚΗ ημέρα', () => {
    const dues = computeInstallments(template(4), 100_000, new Date('2027-01-31T10:00:00.000Z')).map((i) => i.dueDate);
    expect(dues).toEqual(['2027-01-31', '2027-02-28', '2027-03-31', '2027-04-30']);
  });

  it('δίσεκτο: 31/1/2028 + 1 ⇒ 29/2/2028', () => {
    const dues = computeInstallments(template(2), 100_000, new Date('2028-01-31T10:00:00.000Z')).map((i) => i.dueDate);
    expect(dues[1]).toBe('2028-02-29');
  });
});

describe('φόρμα δόσης — edit-installment-model', () => {
  it('διαβάζει την ημέρα Αθήνας της παλιάς λήξης-στιγμής (όχι το πρόθεμα UTC)', () => {
    expect(initialInstallmentFields('edit', installment('2026-11-04T23:30:00.000Z')).dueDate).toBe('2026-11-05');
    expect(initialInstallmentFields('edit', installment('2026-11-05')).dueDate).toBe('2026-11-05');
  });

  it('στέλνει την ημέρα αυτούσια — προσθήκη και διόρθωση', () => {
    const fields = { ...initialInstallmentFields('add'), label: 'Θεμελίωση', amount: 5000, dueDate: '2027-02-28' };
    const add = buildInstallmentChange(fields, undefined, false);
    expect(add.kind === 'add' && add.input.dueDate).toBe('2027-02-28');

    const update = buildInstallmentChange(fields, installment('2026-11-05'), false);
    expect(update.kind === 'update' && update.updates.dueDate).toBe('2027-02-28');
  });

  it('κενή ημέρα στη διόρθωση ⇒ η λήξη μένει ως έχει (undefined)', () => {
    const fields = { ...initialInstallmentFields('edit', installment('2026-11-05')), dueDate: '' };
    const update = buildInstallmentChange(fields, installment('2026-11-05'), false);
    expect(update.kind === 'update' && update.updates.dueDate).toBeUndefined();
  });
});
