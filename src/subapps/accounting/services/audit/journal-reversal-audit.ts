/**
 * @fileoverview Accounting — Ίχνος αντιλογισμού εγγραφής Ε-Ε (SSoT, καθαρό) — ADR-ACC-010 §2.1.1 Φάση 8
 * @description Δύο γεγονότα, γραμμένα στην ΙΔΙΑ συναλλαγή με τον αντιλογισμό (ποτέ storno χωρίς ίχνος, ποτέ ίχνος
 *   για storno που δεν έγινε): `JOURNAL_REVERSED` στην αρχική και `JOURNAL_CREATED` στην αντιλογιστική — όπως κάθε
 *   εγγραφή του βιβλίου έχει ίχνος γέννησης (SAP: change document στο αρχικό + νέο παραστατικό).
 *
 * @see ADR-ACC-010 §2.1.1 Φάση 8 · services/audit/depreciation-audit.ts (ίδιο σχήμα)
 * @compliance CLAUDE.md Enterprise Standards — zero `any`
 */

import type { AccountingAuditEntry } from '../../types/accounting-audit';
import type { JournalEntry } from '../../types/journal';
import { accountingAuditEntryOf } from '../accounting-audit-service';

export interface JournalReversalAuditInput {
  readonly original: JournalEntry;
  readonly reversal: JournalEntry;
  readonly userId: string;
}

/** Το ίχνος ενός αντιλογισμού: γεγονός στην αρχική + γέννηση της αντιλογιστικής. */
export function journalReversalAuditEntries({ original, reversal, userId }: JournalReversalAuditInput): AccountingAuditEntry[] {
  const metadata = {
    originalEntryId: original.entryId,
    reversalEntryId: reversal.entryId,
    reversalDate: reversal.date,
    trigger: reversal.reversalTrigger ?? null,
    reasonCode: reversal.cancellationReasonCode ?? null,
    crossPeriod: reversal.crossPeriodReversal === true,
    type: original.type,
    category: original.category,
    netAmount: original.netAmount,
  };
  return [
    accountingAuditEntryOf({
      eventType: 'JOURNAL_REVERSED', entityType: 'journal', entityId: original.entryId, userId,
      details: `Αντιλογισμός εγγραφής ${original.date}: ${original.description} — €${original.netAmount.toFixed(2)}`,
      metadata,
    }),
    accountingAuditEntryOf({
      eventType: 'JOURNAL_CREATED', entityType: 'journal', entityId: reversal.entryId, userId,
      details: `Αντιλογιστική εγγραφή ${reversal.date}: ${reversal.description} — €${reversal.netAmount.toFixed(2)}`,
      metadata,
    }),
  ];
}
