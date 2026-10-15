/**
 * @fileoverview Accounting — Depreciation Audit (SSoT, pure) — ADR-ACC-010 §2.1.1 Φάσεις 4–5
 * @description Το ίχνος ΜΙΑΣ σύγκλισης απόσβεσης: το γεγονός του παγίου (καταχώριση / διόρθωση / αναίρεση) ΚΑΙ η
 *   δημιουργία της εγγραφής Ε-Ε της διαφοράς. Γράφονται στην ΙΔΙΑ συναλλαγή με την εγγραφή (ποτέ έξοδο χωρίς ίχνος).
 *
 *   🔑 Γιατί τρία γεγονότα και όχι ένα: «πρώτη καταχώριση», «διόρθωση διαφοράς» (SAP repeat run) και «αναίρεση»
 *   (Xero rollback) αλλάζουν τον φόρο με διαφορετικό τρόπο — ο ελεγκτής πρέπει να τα ξεχωρίζει χωρίς να συγκρίνει ποσά.
 *
 * @see ADR-ACC-010 §2.1.1 (Φάση 5) · ADR-ACC-007
 * @compliance CLAUDE.md Enterprise Standards — zero `any`
 */

import type { AccountingAuditEntry, AccountingAuditEventType } from '../../types/accounting-audit';
import type { DepreciationPostedChange } from '../../types/assets';
import { accountingAuditEntryOf } from '../accounting-audit-service';

/** Ποιο γεγονός παγίου είναι η σύγκλιση. */
export function depreciationEventOf(change: DepreciationPostedChange): AccountingAuditEventType {
  if (change.record.annualDepreciation === 0) return 'DEPRECIATION_REVERSED';
  return change.wasPosted ? 'DEPRECIATION_ADJUSTED' : 'DEPRECIATION_POSTED';
}

/** Το ίχνος μιας σύγκλισης: γεγονός παγίου + δημιουργία εγγραφής Ε-Ε. */
export function depreciationAuditEntries(change: DepreciationPostedChange, userId: string): AccountingAuditEntry[] {
  const { record, delta, journalEntryId } = change;
  const metadata = {
    recordId: record.recordId,
    fiscalYear: record.fiscalYear,
    annualDepreciation: record.annualDepreciation,
    delta,
    journalEntryId,
    revision: record.revision ?? null,
  };
  return [
    accountingAuditEntryOf({
      eventType: depreciationEventOf(change), entityType: 'fixed_asset', entityId: record.assetId, userId,
      details: `Απόσβεση χρήσης ${record.fiscalYear}: €${record.annualDepreciation.toFixed(2)} (Δ €${delta.toFixed(2)})`,
      metadata,
    }),
    accountingAuditEntryOf({
      eventType: 'JOURNAL_CREATED', entityType: 'journal', entityId: journalEntryId, userId,
      details: `Εγγραφή ημερολογίου: απόσβεση ${record.fiscalYear} — €${delta.toFixed(2)}`,
      metadata: { type: 'expense', netAmount: delta, source: 'depreciation', recordId: record.recordId },
    }),
  ];
}
