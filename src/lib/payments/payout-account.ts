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

import type { PayeeKycRequirement } from '@/lib/payments/payee-kyc';
import { isValidGreekVat } from '@/lib/validation/greek-vat-number';
import { validateIBAN } from '@/types/contacts/banking';

/**
 * Πού βρίσκεται ο λογαριασμός λήψης πληρωμών (ADR-943 §5.14 — μοντέλο Stripe Connect: **πληρωμές ≠ αποδόσεις**):
 * - `unavailable` — η πλατφόρμα δεν έχει ενεργό marketplace (καμία εγγραφή δυνατή)·
 * - `none` — δεν ξεκίνησε·
 * - `registering` — η εγγραφή στον πάροχο είναι σε εξέλιξη (λίγα δευτερόλεπτα)·
 * - `action-required` — δέχεται πληρωμές (κρατούνται), αλλά οι **αποδόσεις** περιμένουν ενέργεια του ανθρώπου (ταυτοποίηση)·
 * - `verifying` — ο πάροχος ελέγχει· καμία ενέργεια του ανθρώπου·
 * - `rejected` — ο πάροχος απέρριψε την ταυτοποίηση·
 * - `ready` — πληρωμές **και** αποδόσεις·
 * - `blocked` — ο πάροχος ανέστειλε ή έκλεισε τον λογαριασμό.
 */
export const PAYOUT_ACCOUNT_STATES = [
  'unavailable', 'none', 'registering', 'action-required', 'verifying', 'rejected', 'ready', 'blocked',
] as const;
export type PayoutAccountState = (typeof PAYOUT_ACCOUNT_STATES)[number];

/** Τα δηλωμένα στοιχεία στον πάροχο, για ανάγνωση. Το IBAN **μόνο** ως τελευταία 4 ψηφία. */
export interface PayoutAccountDetails {
  readonly legalName: string | null;
  readonly tradeName: string | null;
  readonly address: string | null;
  readonly taxNumber: string | null;
  readonly ibanLast4: string | null;
  readonly ibanBeneficiary: string | null;
  readonly bankName: string | null;
}

export interface PayoutAccountView {
  readonly state: PayoutAccountState;
  /** Δέχεται πληρωμή ο ιδιοκτήτης (τα χρήματα κρατούνται στον πάροχο). */
  readonly charges: boolean;
  /** Αποδίδονται χρήματα στον δικαιούχο (απαιτεί ολοκληρωμένη ταυτοποίηση). */
  readonly payouts: boolean;
  /** Τα δικαιολογητικά που περιμένουν τον άνθρωπο (Stripe `currently_due`). */
  readonly dueRequirements: readonly PayeeKycRequirement[];
  /** Η hosted σελίδα ταυτοποίησης του παρόχου — όσο η ταυτοποίηση δεν ολοκληρώθηκε. */
  readonly kycProcessUrl: string | null;
  /** Τα δηλωμένα στοιχεία (από τον πάροχο, κάθε φορά)· `null` όταν δεν υπάρχει δικαιούχος ή ο πάροχος δεν απάντησε. */
  readonly details: PayoutAccountDetails | null;
}

/** Ο κωδικός άρνησης όταν η αλλαγή στοιχείων θέλει **πρόσφατη** επιβεβαίωση ταυτότητας (πρότυπο «sudo mode»). */
export const PAYOUT_REAUTHENTICATION_REQUIRED = 'reauthentication-required';

/** Πόσο πρόσφατη πρέπει να είναι η σύνδεση για αλλαγή στοιχείων πίστωσης (GitHub sudo mode · Stripe: λεπτά). */
export const PAYOUT_REAUTHENTICATION_WINDOW_SEC = 5 * 60;

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

/**
 * Αλλαγή στοιχείων — ό,τι δέχεται ο πάροχος σε ενημέρωση (EveryPay `PUT /sellers/{id}`). **Όχι** ΑΦΜ (νέο ΑΦΜ = νέος
 * δικαιούχος), **όχι** τηλέφωνο. Ο λογαριασμός πίστωσης αλλάζει **μόνο** μαζί με τον δικαιούχο του. Τουλάχιστον ένα πεδίο.
 */
export const payoutUpdateSchema = z.object({
  legalName: text(200).optional(),
  tradeName: text(200).optional(),
  address: text(300).optional(),
  description: text(200).optional(),
  bankAccount: z.object({
    iban: z.string().trim().max(42).refine((value) => validateIBAN(value).valid),
    beneficiary: text(200),
  }).strict().optional(),
}).strict().refine((update) => Object.values(update).some((value) => value !== undefined));

export type PayoutUpdate = z.infer<typeof payoutUpdateSchema>;

/** Η διαδρομή του API — μία, client + server. */
export const PAYOUT_ACCOUNT_API = '/api/account/payouts';
