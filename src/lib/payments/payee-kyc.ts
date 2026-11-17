/**
 * @fileoverview ADR-943 §5.14 — το **λεξιλόγιο ταυτοποίησης (KYC)** του δικαιούχου marketplace. Κοινό client + server:
 *   ο server το διαβάζει από τον πάροχο, η κάρτα «Λήψη πληρωμών» το δείχνει (κάθε τιμή = κλειδί i18n).
 * @module lib/payments/payee-kyc
 *
 * 🔑 Μοντέλο Stripe Connect: η κατάσταση λογαριασμού στον πάροχο κρίνει τις **πληρωμές** (charges)· το KYC `verified`
 *    κρίνει τις **αποδόσεις** (payouts). Ο ΕΝΑΣ κριτής: `server/payments/payment-payee-capabilities.ts`.
 */

/** Η πορεία KYC (EveryPay `SELLER_KYC.STATUS`). `unknown` ⇒ δεν ήρθε ακόμη σήμα ή τιμή που δεν ξέρουμε. */
export const PAYEE_KYC_STATUSES = ['initial', 'existing', 'in-progress', 'pending', 'verified', 'rejected', 'unknown'] as const;
export type PayeeKycStatus = (typeof PAYEE_KYC_STATUSES)[number];

/**
 * Τα δικαιολογητικά της ταυτοποίησης (EveryPay `category_status`, docs «Seller KYC») — ό,τι το Stripe λέει
 * `requirements`. Κλειστό λεξιλόγιο: άγνωστη κατηγορία του παρόχου **αγνοείται** (ποτέ δεν μαντεύουμε τι σημαίνει).
 */
export const PAYEE_KYC_REQUIREMENTS = [
  'company_info', 'gov_kyc', 'gov_kyb', 'proof_of_id', 'proof_of_residence', 'proof_of_financials',
  'proof_of_business_establishment', 'proof_of_funds', 'proof_of_funds_individual', 'other_documents',
] as const;
export type PayeeKycRequirement = (typeof PAYEE_KYC_REQUIREMENTS)[number];

/** Η κατάσταση ενός δικαιολογητικού. Άγνωστη τιμή ⇒ `unknown` — **ποτέ** `approved` από μαντεψιά. */
export const PAYEE_REQUIREMENT_STATES = ['pending', 'in-progress', 'approved', 'rejected', 'bypass', 'unknown'] as const;
export type PayeeRequirementState = (typeof PAYEE_REQUIREMENT_STATES)[number];

/** Δικαιολογητικό ⇒ κατάσταση· λείπει ⇒ δεν εφαρμόζεται (`null` του παρόχου). Μόνο καταστάσεις — κανένα προσωπικό δεδομένο. */
export type PayeeKycRequirements = Readonly<Partial<Record<PayeeKycRequirement, PayeeRequirementState>>>;

/** Τι περιμένει **τον άνθρωπο** (Stripe `currently_due`): εκκρεμές, απορριφθέν ή άγνωστο. Ό,τι ελέγχεται δεν είναι δικό του. */
const DUE_STATES: ReadonlySet<PayeeRequirementState> = new Set(['pending', 'rejected', 'unknown']);

/** Τα δικαιολογητικά που περιμένουν ενέργεια του δικαιούχου, με τη σειρά του λεξιλογίου. */
export function dueRequirementsOf(requirements: PayeeKycRequirements): readonly PayeeKycRequirement[] {
  return PAYEE_KYC_REQUIREMENTS.filter((requirement) => {
    const state = requirements[requirement];
    return state !== undefined && DUE_STATES.has(state);
  });
}
