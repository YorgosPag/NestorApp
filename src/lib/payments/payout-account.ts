/**
 * @fileoverview ADR-943 §5.9 — **«Λήψη πληρωμών»**: ό,τι βλέπει και στέλνει ο μηχανικός για να δέχεται προκαταβολές.
 *   Κοινό client + server (καμία βάση, κανένας πάροχος).
 * @module lib/payments/payout-account
 *
 * 🔑 **Ελάχιστα δεδομένα** (ADR-943 §6.4): IBAN, ΑΦΜ και ταυτοποίηση περνούν **διαμέσου** του διακομιστή προς τον PSP και
 *    **δεν** αποθηκεύονται από εμάς. Η ταυτοποίηση (KYC) γίνεται στη **hosted** σελίδα του παρόχου.
 * 🔑 **Πρώτα τρόπος απόδοσης, μετά χρήματα** (Airbnb · Upwork): χωρίς `ready` ο ιδιοκτήτης δεν μπορεί να πληρώσει
 *    προκαταβολή σε αυτόν τον μηχανικό.
 */

import { z } from 'zod';

import { isValidGreekVat } from '@/lib/validation/greek-vat-number';
import { validateIBAN } from '@/types/contacts/banking';

/**
 * Πού βρίσκεται ο λογαριασμός λήψης πληρωμών:
 * - `unavailable` — η πλατφόρμα δεν έχει ενεργό marketplace (καμία εγγραφή δυνατή)·
 * - `none` — δεν ξεκίνησε·
 * - `registering` — η εγγραφή στον πάροχο είναι σε εξέλιξη (λίγα δευτερόλεπτα)·
 * - `verifying` — εγγράφηκε· ο πάροχος περιμένει την ταυτοποίηση (KYC) ή την ελέγχει·
 * - `rejected` — ο πάροχος απέρριψε την ταυτοποίηση·
 * - `ready` — δέχεται πληρωμές·
 * - `blocked` — ο πάροχος ανέστειλε ή έκλεισε τον λογαριασμό.
 */
export const PAYOUT_ACCOUNT_STATES = ['unavailable', 'none', 'registering', 'verifying', 'rejected', 'ready', 'blocked'] as const;
export type PayoutAccountState = (typeof PAYOUT_ACCOUNT_STATES)[number];

export interface PayoutAccountView {
  readonly state: PayoutAccountState;
  /** Η hosted σελίδα ταυτοποίησης του παρόχου, όταν τη δίνει (`verifying` · `rejected`). */
  readonly kycProcessUrl: string | null;
}

const text = (max: number) => z.string().trim().min(1).max(max);

/**
 * Τα στοιχεία εγγραφής — ίδιο σχήμα στη φόρμα και στον διακομιστή. Το email **δεν** είναι πεδίο: είναι του λογαριασμού
 * (από το token), ώστε κανείς να μη γράψει δικαιούχο σε ξένο email.
 */
export const payoutRegistrationSchema = z.object({
  legalName: text(200),
  tradeName: text(200),
  taxNumber: z.string().trim().refine(isValidGreekVat),
  address: text(300),
  iban: z.string().trim().max(42).refine((value) => validateIBAN(value).valid),
  ibanBeneficiary: text(200),
  phone: z.string().trim().regex(/^\+?[0-9 ]{8,20}$/),
  description: text(200),
  consumerToConsumer: z.boolean(),
}).strict();

export type PayoutRegistration = z.infer<typeof payoutRegistrationSchema>;

/** Η διαδρομή του API — μία, client + server. */
export const PAYOUT_ACCOUNT_API = '/api/account/payouts';
