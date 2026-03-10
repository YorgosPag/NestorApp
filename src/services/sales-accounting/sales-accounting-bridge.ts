/**
 * @fileoverview Sales-to-Accounting Bridge Service (ADR-198)
 * @description Server-side service που δημιουργεί λογιστικά παραστατικά
 *              από sales events (κράτηση, πώληση, ακύρωση)
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-03-11
 * @version 1.0.0
 * @see ADR-198 Sales-to-Accounting Bridge
 * @compliance CLAUDE.md Enterprise Standards — zero `any`
 */

import { safeFirestoreOperation } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { createAccountingServices } from '@/subapps/accounting/services/create-accounting-services';
import { getCategoryByCode } from '@/subapps/accounting/config/account-categories';
import { generateTransactionId } from '@/services/enterprise-id.service';
import type { CreateInvoiceInput } from '@/subapps/accounting/types/invoice';
import type { InvoiceIssuer, InvoiceCustomer } from '@/subapps/accounting/types/invoice';
import type { MyDataIncomeType } from '@/subapps/accounting/types/common';
import type { CompanyProfile } from '@/subapps/accounting/types/company';
import type {
  SalesAccountingEvent,
  SalesAccountingResult,
  DepositInvoiceEvent,
  FinalSaleInvoiceEvent,
  CreditInvoiceEvent,
} from './types';

// ============================================================================
// CONSTANTS
// ============================================================================

/** ΦΠΑ 24% για νεόδμητα ακίνητα */
const VAT_RATE = 24;
const VAT_DIVISOR = 1 + VAT_RATE / 100; // 1.24

/** Κατηγορία εσόδων για πωλήσεις ακινήτων */
const INCOME_CATEGORY = 'construction_res_income' as const;

/** Default σειρά τιμολογίων */
const DEFAULT_SERIES = 'A';

// ============================================================================
// BRIDGE SERVICE
// ============================================================================

/**
 * Sales-to-Accounting Bridge
 *
 * Δημιουργεί αυτόματα λογιστικά παραστατικά (invoice + journal entry)
 * από sales events (deposit, final sale, credit/cancellation).
 *
 * @pattern SAP RE-FX Transaction Chain — κοινό transactionChainId
 * @see ADR-198
 */
export class SalesAccountingBridge {
  private readonly services = createAccountingServices();

  /**
   * Κεντρικό entry point — επεξεργάζεται ένα sales event
   */
  async processEvent(event: SalesAccountingEvent): Promise<SalesAccountingResult> {
    // 1. Check αν η λογιστική είναι configured
    const companyProfile = await this.services.repository.getCompanySetup();
    if (!companyProfile) {
      return this.errorResult(
        event.unitId,
        'Η λογιστική δεν είναι ρυθμισμένη. Δημιουργήστε πρώτα το προφίλ εταιρείας στη Λογιστική.'
      );
    }

    switch (event.eventType) {
      case 'deposit_invoice':
        return this.createDepositInvoice(event, companyProfile);
      case 'final_sale_invoice':
        return this.createFinalSaleInvoice(event, companyProfile);
      case 'credit_invoice':
        return this.createCreditInvoice(event, companyProfile);
    }
  }

  // ── Deposit Invoice ──────────────────────────────────────────────────────

  private async createDepositInvoice(
    event: DepositInvoiceEvent,
    profile: CompanyProfile
  ): Promise<SalesAccountingResult> {
    const grossAmount = event.depositAmount;
    if (grossAmount <= 0) {
      return this.errorResult(event.unitId, 'Το ποσό προκαταβολής πρέπει να είναι θετικό.');
    }

    const netAmount = roundTwo(grossAmount / VAT_DIVISOR);
    const vatAmount = roundTwo(grossAmount - netAmount);

    const customer = await this.resolveCustomer(event.buyerContactId);
    const issuer = this.buildIssuer(profile);
    const transactionChainId = await this.resolveTransactionChainId(event.unitId);

    const invoiceInput = this.buildInvoiceInput({
      type: 'sales_invoice',
      series: DEFAULT_SERIES,
      issuer,
      customer,
      description: `Προκαταβολή κράτησης — ${event.unitName}`,
      netAmount,
      vatAmount,
      grossAmount,
      paymentMethod: event.paymentMethod,
      projectId: event.projectId,
      unitId: event.unitId,
      relatedInvoiceId: null,
      notes: event.notes,
    });

    return this.executeInvoiceCreation(invoiceInput, transactionChainId, event.unitId);
  }

  // ── Final Sale Invoice ───────────────────────────────────────────────────

  private async createFinalSaleInvoice(
    event: FinalSaleInvoiceEvent,
    profile: CompanyProfile
  ): Promise<SalesAccountingResult> {
    const remainingGross = event.finalPrice - event.depositAlreadyInvoiced;
    if (remainingGross <= 0) {
      return this.errorResult(
        event.unitId,
        'Η τελική τιμή πρέπει να είναι μεγαλύτερη από την ήδη τιμολογημένη προκαταβολή.'
      );
    }

    const netAmount = roundTwo(remainingGross / VAT_DIVISOR);
    const vatAmount = roundTwo(remainingGross - netAmount);

    const customer = await this.resolveCustomer(event.buyerContactId);
    const issuer = this.buildIssuer(profile);
    const transactionChainId = await this.resolveTransactionChainId(event.unitId);

    // Βρες το deposit invoice για relatedInvoiceId
    const depositInvoiceId = await this.findDepositInvoiceId(event.unitId);

    const invoiceInput = this.buildInvoiceInput({
      type: 'sales_invoice',
      series: DEFAULT_SERIES,
      issuer,
      customer,
      description: `Πώληση ακινήτου — ${event.unitName} (υπόλοιπο)`,
      netAmount,
      vatAmount,
      grossAmount: remainingGross,
      paymentMethod: event.paymentMethod,
      projectId: event.projectId,
      unitId: event.unitId,
      relatedInvoiceId: depositInvoiceId,
      notes: event.notes,
    });

    return this.executeInvoiceCreation(invoiceInput, transactionChainId, event.unitId);
  }

  // ── Credit Invoice (Cancellation) ────────────────────────────────────────

  private async createCreditInvoice(
    event: CreditInvoiceEvent,
    profile: CompanyProfile
  ): Promise<SalesAccountingResult> {
    const grossAmount = event.creditAmount;
    if (grossAmount <= 0) {
      return this.errorResult(event.unitId, 'Το ποσό επιστροφής πρέπει να είναι θετικό.');
    }

    const netAmount = roundTwo(grossAmount / VAT_DIVISOR);
    const vatAmount = roundTwo(grossAmount - netAmount);

    const customer = await this.resolveCustomer(event.buyerContactId);
    const issuer = this.buildIssuer(profile);
    const transactionChainId = await this.resolveTransactionChainId(event.unitId);

    // Βρες το deposit invoice για relatedInvoiceId
    const depositInvoiceId = await this.findDepositInvoiceId(event.unitId);

    const invoiceInput = this.buildInvoiceInput({
      type: 'credit_invoice',
      series: DEFAULT_SERIES,
      issuer,
      customer,
      description: `Πιστωτικό — Ακύρωση κράτησης ${event.unitName}: ${event.reason}`,
      netAmount,
      vatAmount,
      grossAmount,
      paymentMethod: event.paymentMethod,
      projectId: event.projectId,
      unitId: event.unitId,
      relatedInvoiceId: depositInvoiceId,
      notes: event.notes,
    });

    return this.executeInvoiceCreation(invoiceInput, transactionChainId, event.unitId);
  }

  // ── Shared Helpers ───────────────────────────────────────────────────────

  /**
   * Εκτελεί τη δημιουργία invoice + journal entry + unit update
   */
  private async executeInvoiceCreation(
    invoiceInput: CreateInvoiceInput,
    transactionChainId: string,
    unitId: string
  ): Promise<SalesAccountingResult> {
    try {
      // 1. Δημιουργία τιμολογίου (atomic numbering)
      const { id: invoiceId, number: invoiceNumber } =
        await this.services.repository.createInvoice(invoiceInput);

      // 2. Δημιουργία journal entry
      const journalEntry =
        await this.services.service.createJournalEntryFromInvoice(invoiceId);

      // 3. Ενημέρωση unit.commercial.transactionChainId
      await this.updateUnitTransactionChain(unitId, transactionChainId);

      return {
        success: true,
        invoiceId,
        invoiceNumber,
        journalEntryId: journalEntry?.entryId ?? null,
        transactionChainId,
        error: null,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error creating invoice';
      console.error(`[SalesAccountingBridge] Error for unit ${unitId}:`, message);
      return this.errorResult(unitId, message);
    }
  }

  /**
   * Resolve ή δημιουργία transactionChainId για τη μονάδα
   */
  private async resolveTransactionChainId(unitId: string): Promise<string> {
    const existing = await safeFirestoreOperation(async (db) => {
      const snap = await db.collection(COLLECTIONS.UNITS).doc(unitId).get();
      if (!snap.exists) return null;
      const data = snap.data() as Record<string, unknown> | undefined;
      const commercial = data?.commercial as Record<string, unknown> | undefined;
      return (commercial?.transactionChainId as string) ?? null;
    }, null);

    return existing ?? generateTransactionId();
  }

  /**
   * Ενημέρωση unit.commercial.transactionChainId στο Firestore
   */
  private async updateUnitTransactionChain(
    unitId: string,
    transactionChainId: string
  ): Promise<void> {
    await safeFirestoreOperation(async (db) => {
      await db.collection(COLLECTIONS.UNITS).doc(unitId).update({
        'commercial.transactionChainId': transactionChainId,
      });
    }, undefined);
  }

  /**
   * Βρίσκει το πρώτο deposit invoice για τη μονάδα (για relatedInvoiceId)
   */
  private async findDepositInvoiceId(unitId: string): Promise<string | null> {
    return safeFirestoreOperation(async (db) => {
      const snap = await db
        .collection(COLLECTIONS.ACCOUNTING_INVOICES)
        .where('unitId', '==', unitId)
        .where('type', '==', 'sales_invoice')
        .orderBy('createdAt', 'asc')
        .limit(1)
        .get();

      if (snap.empty) return null;
      return (snap.docs[0].data() as { invoiceId: string }).invoiceId;
    }, null);
  }

  /**
   * Resolve buyer info από contacts collection
   */
  private async resolveCustomer(buyerContactId: string | null): Promise<InvoiceCustomer> {
    if (!buyerContactId) {
      return this.defaultCustomer();
    }

    return safeFirestoreOperation(async (db) => {
      const snap = await db.collection(COLLECTIONS.CONTACTS).doc(buyerContactId).get();
      if (!snap.exists) return this.defaultCustomer();

      const contact = snap.data() as Record<string, unknown>;
      const firstName = (contact.firstName as string) ?? '';
      const lastName = (contact.lastName as string) ?? '';
      const name = `${firstName} ${lastName}`.trim() || 'Αγοραστής';

      return {
        contactId: buyerContactId,
        name,
        vatNumber: (contact.afm as string) ?? null,
        taxOffice: (contact.doy as string) ?? null,
        address: (contact.address as string) ?? null,
        city: (contact.city as string) ?? null,
        postalCode: (contact.postalCode as string) ?? null,
        country: 'GR',
        email: (contact.email as string) ?? null,
      };
    }, this.defaultCustomer());
  }

  private defaultCustomer(): InvoiceCustomer {
    return {
      contactId: null,
      name: 'Αγοραστής',
      vatNumber: null,
      taxOffice: null,
      address: null,
      city: null,
      postalCode: null,
      country: 'GR',
      email: null,
    };
  }

  /**
   * Μετατρέπει το CompanyProfile σε InvoiceIssuer
   */
  private buildIssuer(profile: CompanyProfile): InvoiceIssuer {
    return {
      name: profile.businessName,
      vatNumber: profile.vatNumber,
      taxOffice: profile.taxOffice,
      address: profile.address,
      city: profile.city,
      postalCode: profile.postalCode,
      phone: profile.phone,
      email: profile.email,
      profession: profile.profession,
    };
  }

  /**
   * Χτίζει πλήρες CreateInvoiceInput
   */
  private buildInvoiceInput(params: {
    type: 'sales_invoice' | 'credit_invoice';
    series: string;
    issuer: InvoiceIssuer;
    customer: InvoiceCustomer;
    description: string;
    netAmount: number;
    vatAmount: number;
    grossAmount: number;
    paymentMethod: string;
    projectId: string | null;
    unitId: string;
    relatedInvoiceId: string | null;
    notes: string | null;
  }): CreateInvoiceInput {
    const category = getCategoryByCode(INCOME_CATEGORY);
    const now = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const fiscalYear = new Date().getFullYear();

    return {
      series: params.series,
      type: params.type,
      issueDate: now,
      dueDate: null,
      issuer: params.issuer,
      customer: params.customer,
      lineItems: [
        {
          lineNumber: 1,
          description: params.description,
          quantity: 1,
          unit: 'τεμ',
          unitPrice: params.netAmount,
          vatRate: VAT_RATE,
          netAmount: params.netAmount,
          mydataCode: (category?.mydataCode ?? 'category1_1') as MyDataIncomeType,
        },
      ],
      currency: 'EUR',
      totalNetAmount: params.netAmount,
      totalVatAmount: params.vatAmount,
      totalGrossAmount: params.grossAmount,
      vatBreakdown: [
        {
          vatRate: VAT_RATE,
          netAmount: params.netAmount,
          vatAmount: params.vatAmount,
        },
      ],
      paymentMethod: params.paymentMethod as CreateInvoiceInput['paymentMethod'],
      paymentStatus: 'paid',
      payments: [],
      totalPaid: params.grossAmount,
      balanceDue: 0,
      mydata: {
        status: 'draft',
        mark: null,
        uid: null,
        authCode: null,
        submittedAt: null,
        respondedAt: null,
        errorMessage: null,
      },
      projectId: params.projectId,
      unitId: params.unitId,
      relatedInvoiceId: params.relatedInvoiceId,
      journalEntryId: null,
      notes: params.notes,
      fiscalYear,
    };
  }

  /**
   * Error result helper
   */
  private errorResult(unitId: string, error: string): SalesAccountingResult {
    return {
      success: false,
      invoiceId: null,
      invoiceNumber: null,
      journalEntryId: null,
      transactionChainId: `txn_error_${unitId}`,
      error,
    };
  }
}

// ============================================================================
// UTILITY
// ============================================================================

/** Στρογγυλοποίηση σε 2 δεκαδικά */
function roundTwo(n: number): number {
  return Math.round(n * 100) / 100;
}
