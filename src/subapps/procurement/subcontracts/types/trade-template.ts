/**
 * @fileoverview **Πρότυπο ανά ειδικότητα** (ADR-928 §5.3) — το «Πρότυπο Προσφοράς. Σιδηροί Οπλισμοί» του
 *   2009, πάνω στον πραγματικό κατάλογο.
 * @module subapps/procurement/subcontracts/types/trade-template
 *
 * Συλλογή `subcontract_trade_templates/{sctt}`, id ντετερμινιστικό από (χώρος, `code`). Πολλά πρότυπα ανά
 * ειδικότητα επιτρέπονται (σκυροδετήσεις / ξυλότυποι, μάρμαρα υλικά / τοποθέτηση): ο κωδικός τα χωρίζει.
 */

import type { TradeCode } from '@/subapps/procurement/types/trade';
import type { AgreementLine } from './agreement-line';
import type { ClauseKey } from './clause';
import type { ClauseParameterValue, LocalizedText } from './clause-parameter';
import type { CommercialTerms } from './commercial-terms';

/** Πώς εκδίδεται το έγγραφο (Δ1, §5.5). */
export const AGREEMENT_DOCUMENT_MODES = [
  'offer_becomes_agreement', // Τρόπος Α (2009): ένα χαρτί, γίνεται συμφωνητικό με την εγκατάσταση
  'offer_then_agreement',    // Τρόπος Β (2005–2008): η αποδεκτή προσφορά γεννά ξεχωριστό συμφωνητικό
] as const;
export type AgreementDocumentMode = (typeof AGREEMENT_DOCUMENT_MODES)[number];

/** Ρήτρα του προτύπου: ποια ρήτρα, και με ποιες τιμές αν διαφέρουν από τις προτιμώμενες της βιβλιοθήκης. */
export interface TemplateClauseRef {
  readonly clauseKey: ClauseKey;
  readonly parameterOverrides: Readonly<Record<string, ClauseParameterValue>>;
}

export interface SubcontractTradeTemplate {
  readonly id: string;                          // sctt_*
  readonly companyId: string;
  readonly code: string;                        // αμετάβλητο, π.χ. `reinforcement.placement`
  readonly trade: TradeCode;
  readonly title: LocalizedText;
  readonly defaultDocumentMode: AgreementDocumentMode;
  readonly lines: readonly AgreementLine[];
  readonly clauses: readonly TemplateClauseRef[];
  readonly defaultTerms: CommercialTerms;
  readonly isArchived: boolean;
  /** CAS (ADR-923 §5.9): κάθε αλλαγή +1. */
  readonly revision: number;
  /** ISO 8601 (ADR-663 §4 · ADR-928 Φ1 απόφαση 1). */
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly createdBy: string;
  readonly updatedBy: string;
}

/** Ό,τι ορίζει ο άνθρωπος — το περίβλημα (id, χώρος, αναθεώρηση, σφραγίδες) το γράφει ο γραφέας. */
export type SubcontractTradeTemplateDefinition = Pick<
  SubcontractTradeTemplate,
  'code' | 'trade' | 'title' | 'defaultDocumentMode' | 'lines' | 'clauses' | 'defaultTerms'
>;
