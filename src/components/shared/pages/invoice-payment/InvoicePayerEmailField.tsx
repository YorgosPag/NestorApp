/**
 * Το email του πληρωτή για πληρωμή με **κάρτα** — μόνο όταν ο φάκελος δεν το έχει (ADR-ACC-030 §5.11).
 *
 * 🏆 Stripe Checkout: `customer_email` γνωστό ⇒ προσυμπληρώνεται· άγνωστο ⇒ ο πελάτης **πρέπει** να το δώσει. Η σελίδα
 * του παρόχου (EveryPay) δεν το ζητά, και χωρίς αυτό **κρύβει** Google Pay / Apple Pay ⇒ το ζητάμε εμείς, πριν από τη
 * μετάβαση. 🔒 Πέρα από το Stripe: το γνωστό email **δεν** φτάνει ποτέ σε αυτή τη σελίδα — η όψη λέει μόνο **αν** χρειάζεται.
 *
 * Επικύρωση με τον **ίδιο** κριτή με τον διακομιστή (`isValidEmail`), ποτέ με την εγγενή του browser (θα μιλούσε στη
 * γλώσσα του browser). Σφάλμα στο blur μόνο για ό,τι γράφτηκε (όχι για κενό — Baymard)· στο πάτημα και για κενό.
 *
 * @module components/shared/pages/invoice-payment/InvoicePayerEmailField
 */

'use client';

import React from 'react';

import { HintedField } from '@/components/ui/hinted-field';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { EMAIL_MAX_LENGTH, isValidEmail } from '@/lib/validation/email-validation';

import { INVOICE_PUBLIC_PAYMENT_NS } from './invoice-payment-primitives';

/** Το id του πεδίου — η εστίαση μετά από άκυρη υποβολή το βρίσκει από εδώ. */
const PAYER_EMAIL_FIELD_ID = 'invoice-payer-email';

type PayerEmailDefect = 'required' | 'invalid';

function defectOf(value: string): PayerEmailDefect | null {
  const trimmed = value.trim();
  if (trimmed === '') return 'required';
  return isValidEmail(trimmed) ? null : 'invalid';
}

export interface PayerEmailEntry {
  readonly value: string;
  readonly defect: PayerEmailDefect | null;
  readonly change: (value: string) => void;
  readonly blur: () => void;
  /** Κρίνει την τιμή για υποβολή: το email (χωρίς κενά) ή `null` — τότε δείχνει το σφάλμα και εστιάζει στο πεδίο. */
  readonly confirm: () => string | null;
}

/** Η κατάσταση του πεδίου. Σύγχρονο `confirm`, ώστε η καρτέλα πληρωμής να ανοίγει **μέσα** στο πάτημα. */
export function usePayerEmailEntry(): PayerEmailEntry {
  const [value, setValue] = React.useState('');
  const [defect, setDefect] = React.useState<PayerEmailDefect | null>(null);
  const change = React.useCallback((next: string) => {
    setValue(next);
    // Μόλις διορθωθεί, το σφάλμα φεύγει αμέσως· νέο σφάλμα μόνο στο blur / στην υποβολή.
    setDefect((current) => (current !== null && defectOf(next) === null ? null : current));
  }, []);
  const blur = React.useCallback(() => {
    setDefect(value.trim() === '' ? null : defectOf(value));
  }, [value]);
  const confirm = React.useCallback((): string | null => {
    const found = defectOf(value);
    setDefect(found);
    if (found === null) return value.trim();
    document.getElementById(PAYER_EMAIL_FIELD_ID)?.focus();
    return null;
  }, [value]);
  return { value, defect, change, blur, confirm };
}

export function InvoicePayerEmailField({ entry, disabled }: {
  readonly entry: PayerEmailEntry;
  readonly disabled: boolean;
}): React.ReactElement {
  const { t } = useTranslation(INVOICE_PUBLIC_PAYMENT_NS);
  const error = entry.defect === 'required'
    ? t('payNow.payerEmail.required')
    : entry.defect === 'invalid' ? t('payNow.payerEmail.invalid') : undefined;
  return (
    <HintedField
      id={PAYER_EMAIL_FIELD_ID}
      label={t('payNow.payerEmail.label')}
      hint={t('payNow.payerEmail.hint')}
      type="email"
      inputMode="email"
      autoComplete="email"
      maxLength={EMAIL_MAX_LENGTH}
      value={entry.value}
      disabled={disabled}
      onChange={entry.change}
      onBlur={entry.blur}
      error={error}
    />
  );
}
