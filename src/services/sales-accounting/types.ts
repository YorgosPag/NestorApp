/**
 * @fileoverview Sales-to-Accounting Bridge Types (ADR-198)
 * @description Discriminated union types για τη γέφυρα Πωλήσεων → Λογιστικής
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-03-11
 * @version 1.0.0
 * @see ADR-198 Sales-to-Accounting Bridge
 * @compliance CLAUDE.md Enterprise Standards — zero `any`
 */

import type { PaymentMethod } from '@/subapps/accounting/types/common';

// ============================================================================
// EVENT TYPES (Discriminated Union)
// ============================================================================

/** Τύποι events που ενεργοποιούν τη γέφυρα Sales → Accounting */
export type SalesAccountingEventType =
  | 'deposit_invoice'
  | 'final_sale_invoice'
  | 'credit_invoice';

// ============================================================================
// BASE EVENT (Shared fields)
// ============================================================================

/** Κοινά πεδία για όλα τα sales-accounting events */
export interface SalesAccountingEventBase {
  /** Firestore unit ID */
  unitId: string;
  /** Ανθρώπινο όνομα μονάδας (π.χ. "Α-101") */
  unitName: string;
  /** Firestore project ID (αν υπάρχει) */
  projectId: string | null;
  /** Firestore contact ID αγοραστή (αν υπάρχει) */
  buyerContactId: string | null;
  /** Τρόπος πληρωμής */
  paymentMethod: PaymentMethod;
  /** Σημειώσεις */
  notes: string | null;
}

// ============================================================================
// CONCRETE EVENTS (Discriminated by eventType)
// ============================================================================

/** Κράτηση με προκαταβολή → Τιμολόγιο Πώλησης (ΤΠ 1.1) */
export interface DepositInvoiceEvent extends SalesAccountingEventBase {
  eventType: 'deposit_invoice';
  /** Ποσό προκαταβολής — gross (περιλαμβάνει ΦΠΑ 24%) */
  depositAmount: number;
}

/** Τελική πώληση → Τιμολόγιο Πώλησης (ΤΠ 1.1) για υπόλοιπο */
export interface FinalSaleInvoiceEvent extends SalesAccountingEventBase {
  eventType: 'final_sale_invoice';
  /** Τελική τιμή πώλησης — gross (περιλαμβάνει ΦΠΑ) */
  finalPrice: number;
  /** Ποσό ήδη τιμολογημένο από deposit — gross */
  depositAlreadyInvoiced: number;
}

/** Ακύρωση κράτησης → Πιστωτικό Τιμολόγιο (5.1) */
export interface CreditInvoiceEvent extends SalesAccountingEventBase {
  eventType: 'credit_invoice';
  /** Ποσό επιστροφής — gross */
  creditAmount: number;
  /** Αιτιολογία ακύρωσης */
  reason: string;
}

/** Discriminated union — 3 τύποι events */
export type SalesAccountingEvent =
  | DepositInvoiceEvent
  | FinalSaleInvoiceEvent
  | CreditInvoiceEvent;

// ============================================================================
// RESULT TYPE
// ============================================================================

/** Αποτέλεσμα εκτέλεσης bridge event */
export interface SalesAccountingResult {
  /** Επιτυχία ή αποτυχία */
  success: boolean;
  /** ID τιμολογίου (αν δημιουργήθηκε) */
  invoiceId: string | null;
  /** Αριθμός τιμολογίου (αν δημιουργήθηκε) */
  invoiceNumber: number | null;
  /** ID εγγραφής Ε-Ε (αν δημιουργήθηκε) */
  journalEntryId: string | null;
  /** Transaction chain ID (κοινό για deposit/final/credit) */
  transactionChainId: string;
  /** Μήνυμα σφάλματος (αν αποτύχει) */
  error: string | null;
}
