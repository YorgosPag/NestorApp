/**
 * @fileoverview Matching Adapters — Entity-to-Scoring Input Converters
 * @description Converts domain entities (Invoice, JournalEntry, etc.) to scoring inputs
 * @author Claude Code (Anthropic AI) + Giorgos Pagonis
 * @created 2026-03-30
 * @version 1.0.0
 * @see matching-engine.ts — uses these adapters for candidate gathering
 * @compliance CLAUDE.md Enterprise Standards — zero `any`
 */

import type {
  BankTransaction,
  MatchableEntityType,
  MatchResult,
} from '../../types/bank';
import type { Invoice } from '../../types/invoice';
import type { JournalEntry } from '../../types/journal';
import type { EFKAPayment } from '../../types/efka';
import type { TaxInstallment } from '../../types/tax';
import type {
  ScoringCandidateInput,
  ScoringTransactionInput,
} from './matching-scoring';

// ============================================================================
// RAW CANDIDATE TYPE
// ============================================================================

export interface RawCandidate {
  entityId: string;
  entityType: MatchableEntityType;
  displayLabel: string;
  scoring: ScoringCandidateInput;
}

// ============================================================================
// TRANSACTION ADAPTER
// ============================================================================

export function transactionToScoringInput(txn: BankTransaction): ScoringTransactionInput {
  return {
    amount: txn.amount,
    currency: txn.currency,
    bankDescription: txn.bankDescription,
    counterparty: txn.counterparty,
    paymentReference: txn.paymentReference,
    transactionDate: txn.transactionDate,
  };
}

// ============================================================================
// ENTITY ADAPTERS
// ============================================================================

export function invoiceToRawCandidate(inv: Invoice): RawCandidate {
  return {
    entityId: inv.invoiceId,
    entityType: 'invoice',
    displayLabel: `Τιμολόγιο ${inv.series}-${inv.number} — ${inv.customer.name}`,
    scoring: {
      amount: inv.balanceDue > 0 ? inv.balanceDue : inv.totalGrossAmount,
      currency: inv.currency,
      description: `${inv.series}-${inv.number} ${inv.customer.name}`,
      date: inv.issueDate,
      counterpartyName: inv.customer.name,
      reference: `${inv.series}-${inv.number}`,
    },
  };
}

export function journalToRawCandidate(je: JournalEntry): RawCandidate {
  return {
    entityId: je.entryId,
    entityType: 'journal_entry',
    displayLabel: `Εγγραφή ${je.entryId.substring(0, 8)} — ${je.description}`,
    scoring: {
      amount: je.grossAmount,
      currency: 'EUR',
      description: je.description,
      date: je.date,
      counterpartyName: je.contactName,
      reference: je.invoiceId,
    },
  };
}

export function efkaToRawCandidate(efka: EFKAPayment): RawCandidate {
  return {
    entityId: efka.paymentId,
    entityType: 'efka_payment',
    displayLabel: `ΕΦΚΑ ${efka.month}/${efka.year}`,
    scoring: {
      amount: efka.amount,
      currency: 'EUR',
      description: `ΕΦΚΑ ασφαλιστικές εισφορές ${efka.month}/${efka.year}`,
      date: efka.dueDate,
      counterpartyName: 'ΕΦΚΑ',
      reference: null,
    },
  };
}

export function taxToRawCandidate(tax: TaxInstallment): RawCandidate {
  return {
    entityId: `tax_${tax.installmentNumber}`,
    entityType: 'tax_payment',
    displayLabel: `Φόρος δόση ${tax.installmentNumber}`,
    scoring: {
      amount: tax.amount,
      currency: 'EUR',
      description: `Φόρος εισοδήματος δόση ${tax.installmentNumber}`,
      date: tax.dueDate,
      counterpartyName: 'ΑΑΔΕ',
      reference: null,
    },
  };
}

// ============================================================================
// UTILITY
// ============================================================================

export function emptyMatchResult(transactionId: string): MatchResult {
  return {
    transactionId,
    status: 'unmatched',
    matchedEntityId: null,
    matchedEntityType: null,
    confidence: null,
  };
}
