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
  | 'credit_invoice'
  | 'reservation_notify';

// ============================================================================
// SALE LINE ITEM (ADR-199 — Multi-line invoices for appurtenances)
// ============================================================================

/** Γραμμή πώλησης — unit ή παρακολούθημα (parking/storage) */
export interface SaleLineItem {
  /** Firestore document ID of the asset */
  assetId: string;
  /** Type of asset being sold */
  assetType: 'unit' | 'parking' | 'storage';
  /** Human-readable name (e.g. "Α-101", "P-05", "S-12") */
  assetName: string;
  /** Gross amount including VAT */
  grossAmount: number;
}

// ============================================================================
// BASE EVENT (Shared fields)
// ============================================================================

/** Κοινά πεδία για όλα τα sales-accounting events */
export interface SalesAccountingEventBase {
  /** Firestore property ID */
  propertyId: string;
  /** Ανθρώπινο όνομα ακινήτου (π.χ. "Α-101") */
  propertyName: string;
  /** Firestore project ID (αν υπάρχει) */
  projectId: string | null;
  /** Firestore contact ID αγοραστή (αν υπάρχει) */
  buyerContactId: string | null;
  /** Όνομα αγοραστή (για email ειδοποίησης) */
  buyerName: string | null;
  /** Όνομα έργου (για email ειδοποίησης) */
  projectName: string | null;
  /** Τίτλος αδείας (για email ειδοποίησης) */
  permitTitle: string | null;
  /** Όνομα εταιρείας (για email ειδοποίησης) */
  companyName: string | null;
  /** Όνομα κτιρίου (για email ειδοποίησης) */
  buildingName: string | null;
  /** Όροφος μονάδας (για email ειδοποίησης) */
  unitFloor: number | null;
  /** Διεύθυνση έργου (για email ειδοποίησης) */
  projectAddress: string | null;
  /** Τρόπος πληρωμής */
  paymentMethod: PaymentMethod;
  /** Σημειώσεις */
  notes: string | null;
  /** ADR-199: Multi-line invoice items (unit + appurtenances) */
  lineItems?: SaleLineItem[];
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

/** Ειδοποίηση κράτησης χωρίς τιμολόγιο (email-only) */
export interface ReservationNotifyEvent extends SalesAccountingEventBase {
  eventType: 'reservation_notify';
  /** Ποσό προκαταβολής — μπορεί να είναι 0 */
  depositAmount: number;
}

/** Discriminated union — 4 τύποι events */
export type SalesAccountingEvent =
  | DepositInvoiceEvent
  | FinalSaleInvoiceEvent
  | CreditInvoiceEvent
  | ReservationNotifyEvent;

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
