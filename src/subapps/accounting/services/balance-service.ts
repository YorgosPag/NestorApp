/**
 * @fileoverview Customer Balance Service — Hybrid Stored + Reconciliation
 * @description Event-driven balance updates + full recalculation + credit limit checks
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-03-29
 * @see DECISIONS-PHASE-1b.md Q1-Q4
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, max 500 lines
 */

import type { IAccountingRepository } from '../types/interfaces';
import type { Invoice } from '../types/invoice';
import type {
  CustomerBalance,
  AgingBuckets,
  CreditCheckResult,
} from '../types/customer-balance';
import { isoNow } from './repository/firestore-helpers';

// ============================================================================
// AGING BUCKET CALCULATION (Q2 — SAP S/4HANA 6-bucket)
// ============================================================================

/**
 * Υπολογίζει aging buckets από λίστα ανοιχτών τιμολογίων
 *
 * Κάθε τιμολόγιο κατατάσσεται σε bucket βάσει ημερών καθυστέρησης
 * από τo dueDate (ή issueDate αν dueDate = null).
 */
export function calculateAgingBuckets(
  invoices: Invoice[],
  referenceDate: Date = new Date()
): AgingBuckets {
  const buckets: AgingBuckets = {
    current: 0,
    days1_30: 0,
    days31_60: 0,
    days61_90: 0,
    days91_120: 0,
    days120plus: 0,
  };

  for (const inv of invoices) {
    if (inv.paymentStatus === 'paid') continue;

    const dueDate = new Date(inv.dueDate ?? inv.issueDate);
    const daysOverdue = Math.floor(
      (referenceDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    const balance = inv.balanceDue;

    if (daysOverdue <= 0) {
      buckets.current += balance;
    } else if (daysOverdue <= 30) {
      buckets.days1_30 += balance;
    } else if (daysOverdue <= 60) {
      buckets.days31_60 += balance;
    } else if (daysOverdue <= 90) {
      buckets.days61_90 += balance;
    } else if (daysOverdue <= 120) {
      buckets.days91_120 += balance;
    } else {
      buckets.days120plus += balance;
    }
  }

  return buckets;
}

// ============================================================================
// FULL RECALCULATION FROM SOURCE DOCUMENTS
// ============================================================================

/**
 * Πλήρης επανυπολογισμός balance ενός πελάτη από invoices
 *
 * Χρησιμοποιείται για reconciliation — ξαναϋπολογίζει τα πάντα
 * από τα source documents (invoices collection).
 */
export async function recalculateCustomerBalance(
  repository: IAccountingRepository,
  customerId: string,
  fiscalYear: number
): Promise<CustomerBalance> {
  const { items: invoices } = await repository.listInvoices(
    { customerId, fiscalYear },
    1000
  );

  const now = new Date();
  let totalInvoiced = 0;
  let totalPaid = 0;
  let totalCreditNotes = 0;
  let disputedBalance = 0;
  let overdueBalance = 0;
  let invoiceCount = 0;
  let lastInvoiceDate: string | null = null;
  let lastPaymentDate: string | null = null;

  const openInvoices: Invoice[] = [];

  for (const inv of invoices) {
    if (inv.type === 'credit_invoice') {
      totalCreditNotes += inv.totalGrossAmount;
      continue;
    }

    totalInvoiced += inv.totalGrossAmount;
    totalPaid += inv.totalPaid;

    if (inv.isDisputed) {
      disputedBalance += inv.balanceDue;
    }

    if (inv.paymentStatus !== 'paid') {
      invoiceCount++;
      openInvoices.push(inv);

      const dueDate = new Date(inv.dueDate ?? inv.issueDate);
      if (dueDate < now) {
        overdueBalance += inv.balanceDue;
      }
    }

    if (!lastInvoiceDate || inv.issueDate > lastInvoiceDate) {
      lastInvoiceDate = inv.issueDate;
    }

    for (const payment of inv.payments) {
      if (!lastPaymentDate || payment.date > lastPaymentDate) {
        lastPaymentDate = payment.date;
      }
    }
  }

  const aging = calculateAgingBuckets(openInvoices, now);
  const netBalance = totalInvoiced - totalPaid - totalCreditNotes;

  // Fetch existing balance for credit management fields (preserve settings)
  const existing = await repository.getCustomerBalance(customerId);

  const balance: CustomerBalance = {
    customerId,
    customerName: existing?.customerName ?? invoices[0]?.customer?.name ?? '',
    totalInvoiced,
    totalPaid,
    totalCreditNotes,
    netBalance,
    overdueBalance,
    aging,
    disputedBalance,
    creditLimit: existing?.creditLimit ?? null,
    creditHoldRule: existing?.creditHoldRule ?? 'off',
    creditHoldActive: existing?.creditHoldActive ?? false,
    riskClass: existing?.riskClass ?? 'low',
    nextReviewDate: existing?.nextReviewDate ?? null,
    lastInvoiceDate,
    lastPaymentDate,
    invoiceCount,
    fiscalYear,
    updatedAt: isoNow(),
  };

  await repository.upsertCustomerBalance(customerId, balance);
  return balance;
}

// ============================================================================
// EVENT-DRIVEN UPDATE (called after invoice/payment/credit note changes)
// ============================================================================

/**
 * Ενημέρωση balance μετά από αλλαγή invoice/payment
 *
 * Shortcut: recalculates from scratch (safe, ~1 query).
 * Για μεγάλους πελάτες με 1000+ invoices, μπορεί να βελτιστοποιηθεί
 * με incremental updates στο μέλλον.
 */
export async function updateCustomerBalance(
  repository: IAccountingRepository,
  customerId: string,
  fiscalYear: number
): Promise<CustomerBalance> {
  return recalculateCustomerBalance(repository, customerId, fiscalYear);
}

// ============================================================================
// BATCH RECONCILIATION
// ============================================================================

/**
 * Batch reconciliation — επανυπολογίζει ΟΛΟΥΣ τους πελάτες
 *
 * @returns Αριθμός πελατών που reconciled + τυχόν auto-corrections
 */
export async function reconcileAllBalances(
  repository: IAccountingRepository,
  fiscalYear: number
): Promise<{ reconciled: number; corrected: number }> {
  const existingBalances = await repository.listCustomerBalances(fiscalYear);

  // Collect unique customerIds from existing balances
  const customerIds = new Set(existingBalances.map((b) => b.customerId));

  // Also scan invoices for customers without a balance record
  const { items: invoices } = await repository.listInvoices({ fiscalYear }, 1000);
  for (const inv of invoices) {
    if (inv.customer.contactId) {
      customerIds.add(inv.customer.contactId);
    }
  }

  let reconciled = 0;
  let corrected = 0;

  for (const customerId of customerIds) {
    const before = existingBalances.find((b) => b.customerId === customerId);
    const after = await recalculateCustomerBalance(repository, customerId, fiscalYear);

    reconciled++;

    if (before && Math.abs(before.netBalance - after.netBalance) > 0.01) {
      corrected++;
    }
  }

  return { reconciled, corrected };
}

// ============================================================================
// CREDIT LIMIT CHECK (Q3 — SAP/NetSuite pattern)
// ============================================================================

/**
 * Έλεγχος πιστωτικού ορίου πριν έκδοση νέου τιμολογίου
 *
 * Exposure formula: exposure = currentBalance (open AR)
 * Check: exposure + newInvoiceAmount > creditLimit
 *
 * Behavior:
 * - auto → Block τιμολογίου + API 422 + UI warning
 * - manual → Warning μόνο
 * - off → Κανένας έλεγχος
 */
export function checkCreditLimit(
  balance: CustomerBalance,
  newInvoiceAmount: number
): CreditCheckResult {
  // No credit limit → always allowed
  if (balance.creditLimit === null || balance.creditHoldRule === 'off') {
    return {
      allowed: true,
      warning: null,
      exposure: balance.netBalance,
      availableCredit: null,
    };
  }

  const exposure = balance.netBalance;
  const projectedExposure = exposure + newInvoiceAmount;
  const availableCredit = balance.creditLimit - exposure;
  const exceedsLimit = projectedExposure > balance.creditLimit;

  if (!exceedsLimit) {
    return {
      allowed: true,
      warning: null,
      exposure,
      availableCredit,
    };
  }

  // Exceeds limit
  if (balance.creditHoldRule === 'auto') {
    return {
      allowed: false,
      warning: `Υπέρβαση πιστωτικού ορίου: €${projectedExposure.toFixed(2)} > €${balance.creditLimit.toFixed(2)}`,
      exposure,
      availableCredit,
    };
  }

  // manual → warning only
  return {
    allowed: true,
    warning: `Προσοχή: υπέρβαση πιστωτικού ορίου (€${projectedExposure.toFixed(2)} > €${balance.creditLimit.toFixed(2)})`,
    exposure,
    availableCredit,
  };
}
