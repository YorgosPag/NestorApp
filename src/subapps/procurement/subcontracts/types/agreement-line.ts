/**
 * @fileoverview **Γραμμή συμφωνητικού (schedule of values)** — κοινή στο πρότυπο ειδικότητας και στο
 *   συμφωνητικό (ADR-928 §5.3 · §5.4).
 * @module subapps/procurement/subcontracts/types/agreement-line
 *
 * 🔑 Τα ποσά σε **λεπτά** (`MinorAmount`), τα ποσοστά σε **μονάδες βάσης**. Το «ολογράφως» **δεν** αποθηκεύεται:
 * παράγεται από το `amountInWords` (`lib/money/amount-in-words`) τη στιγμή της απόδοσης — αποθηκευμένο κείμενο
 * ποσού είναι δεύτερη αλήθεια που μπορεί να διαφωνήσει με τον αριθμό.
 */

import type { MinorAmount } from '@/lib/money/money';
import type { BasisPoints } from '@/lib/pricing/discount-rule';
import type { UomCode } from '@/lib/uom/uom-registry';
import type { SupplierSkuRef } from '@/subapps/catalog/types/supply-relationship';
import type { ClauseBlock } from './clause';
import type { LocalizedText } from './clause-parameter';
import type { PaymentPlanLineOverride } from './payment-plan';

/** Είδος γραμμής (Δ9): μόνο εργασία · μόνο υλικό · προμήθεια και τοποθέτηση. */
export const AGREEMENT_LINE_KINDS = ['labor', 'supply', 'supply_and_install'] as const;
export type AgreementLineKind = (typeof AGREEMENT_LINE_KINDS)[number];

/** Τρόπος τιμολόγησης γραμμής. */
export const AGREEMENT_LINE_PRICINGS = ['unit_rate', 'lump_sum', 'day_rate'] as const;
export type AgreementLinePricing = (typeof AGREEMENT_LINE_PRICINGS)[number];

/**
 * Στάδιο γραμμής με το μερίδιό του στην τιμή (2008: αστάρωμα 10% · οδηγοί 20% · γέμισμα 45% · ψιλό 25%).
 * Τα μερίδια μιας γραμμής αθροίζουν **ακριβώς** 10.000 — επικυρώνεται από τον γραφέα.
 */
export interface AgreementLineStage {
  readonly key: string;
  readonly label: LocalizedText;
  readonly share: BasisPoints;
}

/**
 * Κανόνας επιμέτρησης («αφαιρείται το 50% των ανοιγμάτων»). Κείμενο της εταιρείας σε μπλοκ, όχι υπολογισμός:
 * ο υπολογισμός επιμέτρησης ανήκει στις πιστοποιήσεις (επόμενη φάση).
 */
export interface MeasurementRule {
  readonly blocks: readonly ClauseBlock[];
}

/**
 * Όριο ημερών ασφάλισης ανά μονάδα παραγόμενου έργου (2008: «1 ένσημο ανά 30 τ.μ.»· 2009: «≤ 1,2 ένσημα/τόνο»).
 * `unitsPerInsuredDay` σε χιλιοστά της μονάδας ⇒ ακέραιος (30 τ.μ. = 30_000).
 */
export interface InsuredDaysCap {
  readonly unit: UomCode;
  readonly milliUnitsPerInsuredDay: number;
}

export interface AgreementLine {
  /** Σταθερό μέσα στο έγγραφο· οι αναθεωρήσεις και οι πιστοποιήσεις δένουν σε αυτό. */
  readonly id: string;
  readonly kind: AgreementLineKind;
  readonly pricing: AgreementLinePricing;
  readonly description: LocalizedText;
  /** Κατάλογος (ADR-923): αντικαθιστά τα `{t428}` του 2009. */
  readonly atoeCode: string | null;
  readonly skuRef: SupplierSkuRef | null;
  readonly unit: UomCode;
  /** Εκτίμηση· προαιρετική στο `unit_rate`. Σε χιλιοστά της μονάδας ⇒ ακέραιος. */
  readonly estimatedMilliQuantity: number | null;
  readonly unitPrice: MinorAmount;
  /**
   * Τιμή «για πελάτη» (Δ7, 2007: ρόμβος 1 € / 2 €). Δεν τυπώνεται στο συμφωνητικό υπεργολάβου όταν
   * `printClientPrice === false`· τροφοδοτεί τις αλλαγές αγοραστή (επόμενη φάση).
   */
  readonly clientUnitPrice: MinorAmount | null;
  readonly printClientPrice: boolean;
  readonly comment: LocalizedText | null;
  readonly measurementRule: MeasurementRule | null;
  readonly stages: readonly AgreementLineStage[];
  readonly insuredDaysCap: InsuredDaysCap | null;
  readonly paymentOverride: PaymentPlanLineOverride | null;
}
