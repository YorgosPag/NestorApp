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
import { notifyAccountingOffice, notifyBuyerReservation } from './accounting-notification';
import type { CreateInvoiceInput } from '@/subapps/accounting/types/invoice';
import type { InvoiceIssuer, InvoiceCustomer } from '@/subapps/accounting/types/invoice';
import type { MyDataIncomeType } from '@/subapps/accounting/types/common';
import type { CompanyProfile } from '@/subapps/accounting/types/company';
import type {
  SalesAccountingEvent,
  SalesAccountingResult,
  SaleLineItem,
  DepositInvoiceEvent,
  FinalSaleInvoiceEvent,
  CreditInvoiceEvent,
  ReservationNotifyEvent,
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
   * Diagnostic — check if accounting is configured
   */
  async checkSetup(): Promise<CompanyProfile | null> {
    return this.services.repository.getCompanySetup();
  }

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

    // 1b. Resolve buyer name server-side (ο client μπορεί να μην το γνωρίζει)
    if (!event.buyerName && event.buyerContactId) {
      const customer = await this.resolveCustomer(event.buyerContactId);
      event.buyerName = customer.name !== 'Αγοραστής' ? customer.name : null;
    }

    // 1c. Resolve hierarchy server-side (building → project → company)
    await this.resolveHierarchy(event);

    // Handle reservation_notify — email-only, no invoice
    if (event.eventType === 'reservation_notify') {
      return this.handleReservationNotify(event);
    }

    let result: SalesAccountingResult;

    switch (event.eventType) {
      case 'deposit_invoice':
        result = await this.createDepositInvoice(event, companyProfile);
        break;
      case 'final_sale_invoice':
        result = await this.createFinalSaleInvoice(event, companyProfile);
        break;
      case 'credit_invoice':
        result = await this.createCreditInvoice(event, companyProfile);
        break;
    }

    // 2. Email ειδοποίηση στο λογιστήριο (fire-and-forget)
    notifyAccountingOffice(event, result).catch(() => { /* silent */ });

    return result;
  }

  // ── Reservation Notify (email-only, no invoice) ─────────────────────────

  private async handleReservationNotify(
    event: ReservationNotifyEvent
  ): Promise<SalesAccountingResult> {
    if (event.buyerContactId) {
      const buyer = await this.resolveCustomer(event.buyerContactId);
      if (buyer.email) {
        notifyBuyerReservation(event, null, buyer.email, buyer.name)
          .catch(() => { /* silent */ });
      }
    }

    return {
      success: true,
      invoiceId: null,
      invoiceNumber: null,
      journalEntryId: null,
      transactionChainId: `notify_${event.unitId}`,
      error: null,
    };
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
      saleLineItems: event.lineItems,
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
      saleLineItems: event.lineItems,
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
      saleLineItems: event.lineItems,
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
   * Resolve ιεραρχίας: building → project → company
   * Εμπλουτίζει το event με πληροφορίες ιεραρχίας για τα emails
   */
  private async resolveHierarchy(event: SalesAccountingEvent): Promise<void> {
    // Skip αν ήδη έχει ιεραρχία
    if (event.companyName && event.buildingName && event.projectAddress) return;

    await safeFirestoreOperation(async (db) => {
      // 1. Fetch unit → buildingId, floor
      const unitSnap = await db.collection(COLLECTIONS.UNITS).doc(event.unitId).get();
      if (!unitSnap.exists) return;
      const unitData = unitSnap.data() as Record<string, unknown>;
      event.unitFloor = (unitData.floor as number) ?? null;

      const buildingId = unitData.buildingId as string | undefined;
      if (!buildingId) return;

      // 2. Fetch building
      const buildingSnap = await db.collection(COLLECTIONS.BUILDINGS).doc(buildingId).get();
      if (!buildingSnap.exists) return;
      const buildingData = buildingSnap.data() as Record<string, unknown>;
      event.buildingName = (buildingData.name as string) ?? null;

      const projectId = buildingData.projectId as string | undefined;
      if (!projectId) return;

      // 3. Fetch project
      const projectSnap = await db.collection(COLLECTIONS.PROJECTS).doc(projectId).get();
      if (!projectSnap.exists) return;
      const projectData = projectSnap.data() as Record<string, unknown>;
      if (!event.projectName) event.projectName = (projectData.name as string) ?? null;
      event.permitTitle = (projectData.title as string) ?? null;
      const addr = (projectData.address as string) ?? '';
      const city = (projectData.city as string) ?? '';
      event.projectAddress = [addr, city].filter(Boolean).join(', ') || null;

      // 4. Fetch company
      const companyId = projectData.companyId as string | undefined;
      if (!companyId) {
        event.companyName = (projectData.company as string) ?? null;
        return;
      }
      const companySnap = await db.collection(COLLECTIONS.CONTACTS).doc(companyId).get();
      if (companySnap.exists) {
        const companyData = companySnap.data() as Record<string, unknown>;
        event.companyName = (companyData.companyName as string)
          ?? (companyData.displayName as string)
          ?? (projectData.company as string)
          ?? null;
      } else {
        event.companyName = (projectData.company as string) ?? null;
      }
    }, undefined);
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
      const companyName = (contact.companyName as string) ?? '';
      const name = `${firstName} ${lastName}`.trim() || companyName || 'Αγοραστής';

      // Resolve email: standard emails[] array first, then legacy field
      const emails = contact.emails as Array<{ email?: string; isPrimary?: boolean }> | undefined;
      const primaryEmail = emails?.find(e => e.isPrimary)?.email ?? emails?.[0]?.email ?? null;
      const resolvedEmail = primaryEmail ?? (contact.email as string) ?? null;

      return {
        contactId: buyerContactId,
        name,
        vatNumber: (contact.vatNumber as string) ?? (contact.afm as string) ?? null,
        taxOffice: (contact.taxOffice as string) ?? (contact.doy as string) ?? null,
        address: (contact.address as string) ?? null,
        city: (contact.city as string) ?? null,
        postalCode: (contact.postalCode as string) ?? null,
        country: 'GR',
        email: resolvedEmail,
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
   *
   * ADR-199: Αν υπάρχουν lineItems (παρακολουθήματα), δημιουργεί N γραμμές
   * αντί για 1. Backward compatible — χωρίς lineItems ίδια συμπεριφορά.
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
    /** ADR-199: Multi-line items (unit + appurtenances) */
    saleLineItems?: SaleLineItem[];
  }): CreateInvoiceInput {
    const category = getCategoryByCode(INCOME_CATEGORY);
    const mydataCode = (category?.mydataCode ?? 'category1_1') as MyDataIncomeType;
    const now = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const fiscalYear = new Date().getFullYear();

    // ADR-199: Multi-line invoices for appurtenances
    const hasMultipleLines = params.saleLineItems && params.saleLineItems.length > 0;

    const invoiceLineItems = hasMultipleLines
      ? (params.saleLineItems ?? []).map((item, idx) => {
          const lineNet = roundTwo(item.grossAmount / VAT_DIVISOR);
          return {
            lineNumber: idx + 1,
            description: this.buildLineDescription(params.type, item),
            quantity: 1,
            unit: 'τεμ',
            unitPrice: lineNet,
            vatRate: VAT_RATE,
            netAmount: lineNet,
            mydataCode,
          };
        })
      : [
          {
            lineNumber: 1,
            description: params.description,
            quantity: 1,
            unit: 'τεμ',
            unitPrice: params.netAmount,
            vatRate: VAT_RATE,
            netAmount: params.netAmount,
            mydataCode,
          },
        ];

    // Recalculate totals from line items for consistency
    const totalNet = hasMultipleLines
      ? roundTwo(invoiceLineItems.reduce((sum, li) => sum + li.netAmount, 0))
      : params.netAmount;
    const totalGross = hasMultipleLines
      ? roundTwo(params.saleLineItems!.reduce((sum, li) => sum + li.grossAmount, 0))
      : params.grossAmount;
    const totalVat = roundTwo(totalGross - totalNet);

    return {
      series: params.series,
      type: params.type,
      issueDate: now,
      dueDate: null,
      issuer: params.issuer,
      customer: params.customer,
      lineItems: invoiceLineItems,
      currency: 'EUR',
      totalNetAmount: totalNet,
      totalVatAmount: totalVat,
      totalGrossAmount: totalGross,
      vatBreakdown: [
        {
          vatRate: VAT_RATE,
          netAmount: totalNet,
          vatAmount: totalVat,
        },
      ],
      paymentMethod: params.paymentMethod as CreateInvoiceInput['paymentMethod'],
      paymentStatus: 'paid',
      payments: [],
      totalPaid: totalGross,
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
   * ADR-199: Builds description for an invoice line item
   */
  private buildLineDescription(
    invoiceType: 'sales_invoice' | 'credit_invoice',
    item: SaleLineItem
  ): string {
    const assetLabels: Record<SaleLineItem['assetType'], string> = {
      unit: 'Μονάδα',
      parking: 'Θέση στάθμευσης',
      storage: 'Αποθήκη',
    };
    const prefix = invoiceType === 'credit_invoice' ? 'Πιστωτικό —' : 'Πώληση —';
    return `${prefix} ${assetLabels[item.assetType]} ${item.assetName}`;
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
