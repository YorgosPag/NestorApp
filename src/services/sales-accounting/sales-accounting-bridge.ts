/**
 * @fileoverview Sales-to-Accounting Bridge Service (ADR-198)
 * @description Server-side service that creates accounting documents
 *              from sales events (deposit, sale, cancellation).
 *   Helpers extracted to sales-accounting-helpers.ts per CLAUDE.md N.7.1
 * @author Claude Code (Anthropic AI) + Giorgos Pagonis
 * @created 2026-03-11
 * @modified 2026-03-31 — Split helpers to sales-accounting-helpers.ts
 * @version 1.1.0
 * @see ADR-198 Sales-to-Accounting Bridge
 * @compliance CLAUDE.md Enterprise Standards — zero `any`
 */

import { getErrorMessage } from '@/lib/error-utils';
import { createAccountingServices } from '@/subapps/accounting/services/create-accounting-services';
import { notifyAccountingOffice, notifyBuyerReservation, notifyBuyerCancellation, notifyBuyerSale } from './accounting-notification';
import { EntityAuditService } from '@/services/entity-audit.service';
import { safeFireAndForget } from '@/lib/safe-fire-and-forget';
import type { CreateInvoiceInput } from '@/subapps/accounting/types/invoice';
import type { CompanyProfile } from '@/subapps/accounting/types/company';
import type {
  SalesAccountingEvent,
  SalesAccountingResult,
  DepositInvoiceEvent,
  FinalSaleInvoiceEvent,
  CreditInvoiceEvent,
  ReservationNotifyEvent,
} from './types';

import {
  VAT_DIVISOR,
  DEFAULT_SERIES,
  roundTwo,
  errorResult,
  resolveCustomer,
  buildIssuer,
  buildInvoiceInput,
  resolvePropertyCompanyId,
  resolveTransactionChainId,
  updatePropertyTransactionChain,
  findDepositInvoiceId,
  resolveHierarchy,
} from './sales-accounting-helpers';

// ============================================================================
// BRIDGE SERVICE
// ============================================================================

/**
 * Sales-to-Accounting Bridge
 *
 * Creates accounting documents (invoice + journal entry) automatically
 * from sales events (deposit, final sale, credit/cancellation).
 *
 * @pattern SAP RE-FX Transaction Chain — shared transactionChainId
 * @see ADR-198
 */
export class SalesAccountingBridge {
  private readonly services;

  constructor(tenant: { companyId: string; userId: string }) {
    this.services = createAccountingServices(tenant);
  }

  /**
   * Diagnostic — check if accounting is configured
   */
  async checkSetup(): Promise<CompanyProfile | null> {
    return this.services.repository.getCompanySetup();
  }

  /**
   * Main entry point — processes a sales event
   */
  async processEvent(event: SalesAccountingEvent): Promise<SalesAccountingResult> {
    // 1. Check if accounting is configured
    const companyProfile = await this.services.repository.getCompanySetup();
    if (!companyProfile) {
      return errorResult(
        event.propertyId,
        'Η λογιστική δεν είναι ρυθμισμένη. Δημιουργήστε πρώτα το προφίλ εταιρείας στη Λογιστική.'
      );
    }

    // 1b. Resolve buyer name server-side
    if (!event.buyerName && event.buyerContactId) {
      const customer = await resolveCustomer(event.buyerContactId);
      event.buyerName = customer.name !== 'Αγοραστής' ? customer.name : null;
    }

    // 1c. Resolve hierarchy server-side (building -> project -> company)
    await resolveHierarchy(event);

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

    // 2. Email notification to accounting office (fire-and-forget)
    notifyAccountingOffice(event, result).catch(() => { /* silent */ });

    // 3. Email notification to buyer on sale (fire-and-forget)
    if (event.eventType === 'final_sale_invoice' && event.buyerContactId) {
      const buyerCustomer = await resolveCustomer(event.buyerContactId);
      if (buyerCustomer.email) {
        notifyBuyerSale(event, result, buyerCustomer.email, buyerCustomer.name)
          .catch(() => { /* silent */ });
      }
    }

    // 4. Email notification to buyer on cancellation (fire-and-forget)
    if (event.eventType === 'credit_invoice' && event.buyerContactId) {
      const buyerCustomer = await resolveCustomer(event.buyerContactId);
      if (buyerCustomer.email) {
        notifyBuyerCancellation(event, result, buyerCustomer.email, buyerCustomer.name)
          .catch(() => { /* silent */ });
      }
    }

    return result;
  }

  // ── Reservation Notify (email-only, no invoice) ─────────────────────────

  private async handleReservationNotify(
    event: ReservationNotifyEvent
  ): Promise<SalesAccountingResult> {
    if (event.buyerContactId) {
      const buyer = await resolveCustomer(event.buyerContactId);
      if (buyer.email) {
        notifyBuyerReservation(event, null, buyer.email, buyer.name)
          .catch(() => { /* silent */ });
      }
    }

    notifyAccountingOffice(event, null).catch(() => { /* silent */ });

    return {
      success: true,
      invoiceId: null,
      invoiceNumber: null,
      journalEntryId: null,
      transactionChainId: `notify_${event.propertyId}`,
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
      return errorResult(event.propertyId, 'Το ποσό προκαταβολής πρέπει να είναι θετικό.');
    }

    const netAmount = roundTwo(grossAmount / VAT_DIVISOR);
    const vatAmount = roundTwo(grossAmount - netAmount);

    const customer = await resolveCustomer(event.buyerContactId);
    const issuer = buildIssuer(profile);
    const transactionChainId = await resolveTransactionChainId(event.propertyId);

    const invoiceInput = buildInvoiceInput({
      type: 'sales_invoice',
      series: DEFAULT_SERIES,
      issuer,
      customer,
      description: `Προκαταβολή κράτησης — ${event.propertyName}`,
      netAmount,
      vatAmount,
      grossAmount,
      paymentMethod: event.paymentMethod,
      projectId: event.projectId,
      propertyId: event.propertyId,
      relatedInvoiceId: null,
      notes: event.notes,
      saleLineItems: event.lineItems,
    });

    return this.executeInvoiceCreation(invoiceInput, transactionChainId, event.propertyId);
  }

  // ── Final Sale Invoice ───────────────────────────────────────────────────

  private async createFinalSaleInvoice(
    event: FinalSaleInvoiceEvent,
    profile: CompanyProfile
  ): Promise<SalesAccountingResult> {
    const remainingGross = event.finalPrice - event.depositAlreadyInvoiced;
    if (remainingGross <= 0) {
      return errorResult(
        event.propertyId,
        'Η τελική τιμή πρέπει να είναι μεγαλύτερη από την ήδη τιμολογημένη προκαταβολή.'
      );
    }

    const netAmount = roundTwo(remainingGross / VAT_DIVISOR);
    const vatAmount = roundTwo(remainingGross - netAmount);

    const customer = await resolveCustomer(event.buyerContactId);
    const issuer = buildIssuer(profile);
    const transactionChainId = await resolveTransactionChainId(event.propertyId);

    const depositInvoiceId = await findDepositInvoiceId(event.propertyId);

    const invoiceInput = buildInvoiceInput({
      type: 'sales_invoice',
      series: DEFAULT_SERIES,
      issuer,
      customer,
      description: `Πώληση ακινήτου — ${event.propertyName} (υπόλοιπο)`,
      netAmount,
      vatAmount,
      grossAmount: remainingGross,
      paymentMethod: event.paymentMethod,
      projectId: event.projectId,
      propertyId: event.propertyId,
      relatedInvoiceId: depositInvoiceId,
      notes: event.notes,
      saleLineItems: event.lineItems,
    });

    return this.executeInvoiceCreation(invoiceInput, transactionChainId, event.propertyId);
  }

  // ── Credit Invoice (Cancellation) ────────────────────────────────────────

  private async createCreditInvoice(
    event: CreditInvoiceEvent,
    profile: CompanyProfile
  ): Promise<SalesAccountingResult> {
    const grossAmount = event.creditAmount;
    if (grossAmount <= 0) {
      return errorResult(event.propertyId, 'Το ποσό επιστροφής πρέπει να είναι θετικό.');
    }

    const netAmount = roundTwo(grossAmount / VAT_DIVISOR);
    const vatAmount = roundTwo(grossAmount - netAmount);

    const customer = await resolveCustomer(event.buyerContactId);
    const issuer = buildIssuer(profile);
    const transactionChainId = await resolveTransactionChainId(event.propertyId);

    const depositInvoiceId = await findDepositInvoiceId(event.propertyId);

    const invoiceInput = buildInvoiceInput({
      type: 'credit_invoice',
      series: DEFAULT_SERIES,
      issuer,
      customer,
      description: `Πιστωτικό — Ακύρωση κράτησης ${event.propertyName}: ${event.reason}`,
      netAmount,
      vatAmount,
      grossAmount,
      paymentMethod: event.paymentMethod,
      projectId: event.projectId,
      propertyId: event.propertyId,
      relatedInvoiceId: depositInvoiceId,
      notes: event.notes,
      saleLineItems: event.lineItems,
    });

    return this.executeInvoiceCreation(invoiceInput, transactionChainId, event.propertyId);
  }

  // ── Invoice Execution ───────────────────────────────────────────────────

  /**
   * Executes invoice + journal entry creation + unit update
   */
  private async executeInvoiceCreation(
    invoiceInput: CreateInvoiceInput,
    transactionChainId: string,
    propertyId: string
  ): Promise<SalesAccountingResult> {
    try {
      // 1. Create invoice (atomic numbering)
      const { id: invoiceId, number: invoiceNumber } =
        await this.services.repository.createInvoice(invoiceInput);

      // 2. Create journal entry
      const journalEntry =
        await this.services.service.createJournalEntryFromInvoice(invoiceId);

      // 3. Update unit.commercial.transactionChainId
      await updatePropertyTransactionChain(propertyId, transactionChainId);

      // 4. Audit trail: invoice created
      const invoiceTypeLabel = invoiceInput.type === 'credit_invoice' ? 'Πιστωτικό' : 'Τιμολόγιο';
      const companyId = await resolvePropertyCompanyId(propertyId);
      safeFireAndForget(EntityAuditService.recordChange({
        entityType: 'property',
        entityId: propertyId,
        entityName: null,
        action: 'invoice_created',
        changes: [{
          field: 'invoice',
          oldValue: null,
          newValue: `${invoiceTypeLabel} ${invoiceNumber}`,
          label: 'Παραστατικό',
        }],
        performedBy: 'system',
        performedByName: 'Σύστημα',
        companyId: companyId ?? 'unknown',
      }), 'SalesAccountingBridge.auditTrail');

      return {
        success: true,
        invoiceId,
        invoiceNumber,
        journalEntryId: journalEntry?.entryId ?? null,
        transactionChainId,
        error: null,
      };
    } catch (err) {
      const message = getErrorMessage(err, 'Unknown error creating invoice');
      console.error(`[SalesAccountingBridge] Error for property ${propertyId}:`, message);
      return errorResult(propertyId, message);
    }
  }
}
