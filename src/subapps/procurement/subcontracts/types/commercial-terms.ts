/**
 * @fileoverview **Δομημένοι εμπορικοί όροι** συμφωνητικού και επιλογές ρητρών (ADR-928 §5.4 · §5.2.1).
 * @module subapps/procurement/subcontracts/types/commercial-terms
 *
 * Οι όροι που **τροφοδοτούν υπολογισμούς** (ΦΠΑ, παρακράτηση, ποινή, συνεργείο, επιμερισμός) ζουν εδώ ως
 * δεδομένα. Οι όροι που είναι **μόνο κείμενο** ζουν ως ρήτρες της βιβλιοθήκης (`ClauseSelection`). Ένας όρος
 * δεν γράφεται ποτέ και στα δύο.
 */

import type { MinorAmount } from '@/lib/money/money';
import type { BasisPoints } from '@/lib/pricing/discount-rule';
import type { GreekVatRatePercent } from '@/subapps/accounting/services/config/vat-rates';
import type { TradeCode } from '@/subapps/procurement/types/trade';
import type { ClauseKey } from './clause';
import type { ClauseParameterValue, ClauseParty, LocalizedText } from './clause-parameter';
import type { PaymentPlan } from './payment-plan';

/** ΦΠΑ: οι τιμές είναι εντός ή εκτός, με συντελεστή από τον ΕΝΑ πίνακα (`vat-rates.ts`). */
export interface VatTerms {
  readonly treatment: 'excluded' | 'included';
  readonly rate: GreekVatRatePercent;
}

/** Παρακράτηση φόρου (2009: «ΦΜΥ 3%»). Ποσοστό = παράμετρος της εταιρείας, ποτέ σταθερά νόμου. */
export interface WithholdingTerms {
  readonly applies: boolean;
  readonly rate: BasisPoints;
}

/** Ποινική ρήτρα: ποσό ανά ημέρα καθυστέρησης, με ανώτατο ποσοστό του προϋπολογισμού. */
export interface PenaltyTerms {
  readonly perDay: MinorAmount;
  readonly capOfContractValue: BasisPoints;
}

/** Ελάχιστη ημερήσια απόδοση (2008: 110 τ.μ./ημέρα) σε χιλιοστά της μονάδας της γραμμής. */
export interface MinimumOutput {
  readonly lineId: string;
  readonly milliUnitsPerDay: number;
}

/** Μέλος συνεργείου: ειδικότητα, μερίδιο αναλογίας, συμφωνημένο ημερομίσθιο ως προκαταβολή. */
export interface CrewMember {
  readonly role: LocalizedText;
  readonly trade: TradeCode | null;
  readonly ratioParts: number;
  readonly dailyWage: MinorAmount | null;
}

export interface CrewTerms {
  readonly minimumHeadcount: number;
  readonly members: readonly CrewMember[];
}

/** Επιμερισμός κόστους (2009: γερανός 50/50). Τα μερίδια αθροίζουν 10.000. */
export interface CostSharingItem {
  readonly description: LocalizedText;
  readonly shares: readonly { readonly party: ClauseParty; readonly share: BasisPoints }[];
}

/** Απαιτούμενα έγγραφα πριν την έναρξη ή πριν από κάθε πληρωμή (αλληλέγγυα ευθύνη, ν.4554/2018). */
export const REQUIRED_DOCUMENT_KINDS = [
  'tax_clearance',
  'insurance_clearance',
  'liability_insurance',
  'personnel_list',
  'efka_registration',
  'safety_plan',
] as const;
export type RequiredDocumentKind = (typeof REQUIRED_DOCUMENT_KINDS)[number];

export interface RequiredDocument {
  readonly kind: RequiredDocumentKind;
  readonly when: { readonly kind: 'days_before_start'; readonly days: number } | { readonly kind: 'before_each_payment' };
}

export interface CommercialTerms {
  readonly vat: VatTerms;
  readonly withholding: WithholdingTerms;
  readonly paymentPlan: PaymentPlan;
  readonly penalty: PenaltyTerms | null;
  readonly minimumOutputs: readonly MinimumOutput[];
  readonly crew: CrewTerms | null;
  readonly costSharing: readonly CostSharingItem[];
  readonly requiredDocuments: readonly RequiredDocument[];
  /** Όριο μετρητών ανά πληρωμή (σήμερα 500 € — παράμετρος). Πάνω από αυτό: ρητή προειδοποίηση + ιστορικό. */
  readonly cashLimitPerPayment: MinorAmount;
}

/**
 * Απόκλιση από τη ζώνη ανοχής (§5.2.1, τρόπος 3): η βιβλιοθήκη μένει ίδια, αλλάζει μόνο αυτό το έγγραφο. Η
 * έκδοση **μπλοκάρεται** όσο υπάρχει απόκλιση χωρίς απόφαση.
 */
export interface ClauseDeviation {
  readonly reason: string;
  readonly requestedBy: string;
  readonly decision: 'pending' | 'approved' | 'rejected';
  readonly decidedBy: string | null;
}

/** Ρήτρα της βιβλιοθήκης μέσα σε συμφωνητικό: **καρφωμένη έκδοση** + τιμές παραμέτρων. */
export interface ClauseSelection {
  readonly clauseId: string;
  readonly clauseKey: ClauseKey;
  /** Η έκδοση που επιλέχθηκε· η αλλαγή της βιβλιοθήκης ΔΕΝ αγγίζει εκδοθέν έγγραφο (§5.6). */
  readonly version: number;
  readonly parameterValues: Readonly<Record<string, ClauseParameterValue>>;
  /** Ανά κλειδί παραμέτρου, μόνο όπου η τιμή βγήκε από τη ζώνη `acceptable`. */
  readonly deviations: Readonly<Record<string, ClauseDeviation>>;
}
