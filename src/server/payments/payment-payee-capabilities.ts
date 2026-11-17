import 'server-only';

/**
 * @fileoverview **Ο ΕΝΑΣ κριτής** του τι μπορεί ένας δικαιούχος marketplace — πληρωμές ή και αποδόσεις (ADR-943 §5.14)
 * @description Μοντέλο Stripe Connect (`charges_enabled` ≠ `payouts_enabled`), επειδή ο πάροχος δίνει **δύο** αλήθειες
 *   που η Φ3 συγχώνευε σε μία:
 *   - EveryPay `status: Authorized` (API) — «can receive transfers». Ο πωλητής **γεννιέται** Authorized (docs, παράδειγμα
 *     Create· μετρημένο ζωντανά 2026-11-17: «Δέχεστε πληρωμές» αμέσως, χωρίς ταυτοποίηση).
 *   - EveryPay KYC `verified` (μόνο webhook — κανένα endpoint) — «the seller is authorized by EveryPay».
 *
 *   ⇒ **charges** = Authorized: ο ιδιοκτήτης πληρώνει, η μεταφορά γίνεται **κρατημένη** (`on_hold`)· τα χρήματα δεν φεύγουν.
 *   ⇒ **payouts** = Authorized **και** KYC `verified`: μόνο τότε η αποδέσμευση. Airbnb · Upwork · Stripe κάνουν το ίδιο —
 *      «κρατάμε τα χρήματα μέχρι να ξέρουμε σε ποιον πάνε».
 *
 *   Καθαρή συνάρτηση: καμία βάση, κανένας πάροχος. Οι καλούντες (`payment-payee-service.ts`) φέρνουν την αλήθεια.
 */

import { dueRequirementsOf, type PayeeKycRequirement } from '@/lib/payments/payee-kyc';
import type { PayoutAccountState } from '@/lib/payments/payout-account';

import type { PaymentPayeeRecord } from './payment-payee-store';

export interface PayeeCapabilities {
  /** Ο ιδιοκτήτης μπορεί να πληρώσει (τα χρήματα κρατούνται). */
  readonly charges: boolean;
  /** Κρατημένα χρήματα μπορούν να αποδοθούν στον δικαιούχο. */
  readonly payouts: boolean;
  /** Ό,τι περιμένει τον άνθρωπο (κενό όταν δεν περιμένει τίποτα). */
  readonly due: readonly PayeeKycRequirement[];
  /** Η κατάσταση της κάρτας — μία, παραγόμενη από τα παραπάνω. */
  readonly state: Exclude<PayoutAccountState, 'unavailable'>;
}

type PayeeTruth = Pick<PaymentPayeeRecord, 'providerReference' | 'status' | 'kycStatus' | 'kycRequirements'>;

const NONE: PayeeCapabilities = { charges: false, payouts: false, due: [], state: 'none' };

/** Η κατάσταση όσο οι αποδόσεις δεν επιτρέπονται: ποιος περιμένει ποιον; */
function waitingStateOf(payee: PayeeTruth, due: readonly PayeeKycRequirement[]): PayeeCapabilities['state'] {
  if (payee.kycStatus === 'rejected') return 'rejected';
  // `in-progress` · `existing` ⇒ ο πάροχος αποφασίζει· ο άνθρωπος δεν έχει τι να κάνει — εκτός αν ζητήθηκε δικαιολογητικό.
  const providerDeciding = payee.kycStatus === 'in-progress' || payee.kycStatus === 'existing';
  return providerDeciding && due.length === 0 ? 'verifying' : 'action-required';
}

/** **Η** κρίση. Χωρίς δικαιούχο ⇒ τίποτα· σε εγγραφή ⇒ τίποτα· ανεσταλμένος/κλειστός ⇒ τίποτα. */
export function payeeCapabilitiesOf(payee: PayeeTruth | null): PayeeCapabilities {
  if (payee === null) return NONE;
  if (payee.providerReference === null) return { ...NONE, state: 'registering' };
  if (payee.status === 'suspended' || payee.status === 'closed') return { ...NONE, state: 'blocked' };
  const charges = payee.status === 'authorized';
  const payouts = charges && payee.kycStatus === 'verified';
  const due = payouts ? [] : dueRequirementsOf(payee.kycRequirements);
  if (payouts) return { charges, payouts, due, state: 'ready' };
  return { charges, payouts, due, state: waitingStateOf(payee, due) };
}
