/**
 * @fileoverview Sales-to-Accounting Bridge — Helper Functions
 * @description Extracted from sales-accounting-bridge.ts per CLAUDE.md N.7.1 (max 500 lines)
 *   Contains: constants, utility functions, Firestore resolvers, invoice builders
 * @author Claude Code (Anthropic AI) + Giorgos Pagonis
 * @created 2026-03-31
 * @see ADR-198 Sales-to-Accounting Bridge, ADR-199 Multi-line Invoices
 * @compliance CLAUDE.md Enterprise Standards — zero `any`
 */

import { safeFirestoreOperation } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FIELDS } from '@/config/firestore-field-constants';
import { getCategoryByCode } from '@/subapps/accounting/config/account-categories';
import { generateTransactionId } from '@/services/enterprise-id.service';
import { EntityAuditService } from '@/services/entity-audit.service';
import { ENTITY_TYPES } from '@/config/domain-constants';
import type { CreateInvoiceInput } from '@/subapps/accounting/types/invoice';
import type { InvoiceIssuer, InvoiceCustomer } from '@/subapps/accounting/types/invoice';
import type { MyDataIncomeType } from '@/subapps/accounting/types/common';
import type { CompanyProfile } from '@/subapps/accounting/types/company';
import type {
  SalesAccountingEvent,
  SalesAccountingResult,
  SaleLineItem,
} from './types';
import { nowISO } from '@/lib/date-local';

// ============================================================================
// CONSTANTS
// ============================================================================

/** VAT 24% for new-build real estate */
export const VAT_RATE = 24;
export const VAT_DIVISOR = 1 + VAT_RATE / 100; // 1.24

/** Income category for real estate sales */
export const INCOME_CATEGORY = 'construction_res_income' as const;

/** Default invoice series */
export const DEFAULT_SERIES = 'A';

// ============================================================================
// UTILITY
// ============================================================================

/** Round to 2 decimal places */
export function roundTwo(n: number): number {
  return Math.round(n * 100) / 100;
}

// ============================================================================
// ERROR HELPER
// ============================================================================

export function errorResult(propertyId: string, error: string): SalesAccountingResult {
  return {
    success: false,
    invoiceId: null,
    invoiceNumber: null,
    journalEntryId: null,
    transactionChainId: `txn_error_${propertyId}`,
    error,
  };
}

// ============================================================================
// CUSTOMER / ISSUER BUILDERS
// ============================================================================

export function defaultCustomer(): InvoiceCustomer {
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
 * Resolve customer data from a contact ID.
 * Used by Sales Accounting Bridge to build invoice customer.
 * The contactId comes from owners[] via getPrimaryBuyerContactId().
 */
export async function resolveCustomer(contactId: string | null): Promise<InvoiceCustomer> {
  if (!contactId) {
    return defaultCustomer();
  }

  return safeFirestoreOperation(async (db) => {
    const snap = await db.collection(COLLECTIONS.CONTACTS).doc(contactId).get();
    if (!snap.exists) return defaultCustomer();

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
      contactId,
      name,
      vatNumber: (contact.vatNumber as string) ?? (contact.afm as string) ?? null,
      taxOffice: (contact.taxOffice as string) ?? (contact.doy as string) ?? null,
      address: (contact.address as string) ?? null,
      city: (contact.city as string) ?? null,
      postalCode: (contact.postalCode as string) ?? null,
      country: 'GR',
      email: resolvedEmail,
    };
  }, defaultCustomer());
}

export function buildIssuer(profile: CompanyProfile): InvoiceIssuer {
  return {
    name: profile.businessName,
    vatNumber: profile.vatNumber,
    taxOffice: profile.taxOffice,
    address: profile.address,
    city: profile.city,
    postalCode: profile.postalCode,
    phone: profile.phone,
    mobile: profile.mobile ?? null,
    email: profile.email,
    website: profile.website ?? null,
    profession: profile.profession,
    bankAccounts: [],
  };
}

// ============================================================================
// FIRESTORE RESOLVERS
// ============================================================================

export async function resolvePropertyCompanyId(propertyId: string): Promise<string | null> {
  return safeFirestoreOperation(async (db) => {
    const snap = await db.collection(COLLECTIONS.PROPERTIES).doc(propertyId).get();
    return snap.exists ? (snap.data()?.companyId as string) ?? null : null;
  }, null);
}

export async function resolveTransactionChainId(propertyId: string): Promise<string> {
  const existing = await safeFirestoreOperation(async (db) => {
    const snap = await db.collection(COLLECTIONS.PROPERTIES).doc(propertyId).get();
    if (!snap.exists) return null;
    const data = snap.data() as Record<string, unknown> | undefined;
    const commercial = data?.commercial as Record<string, unknown> | undefined;
    return (commercial?.transactionChainId as string) ?? null;
  }, null);

  return existing ?? generateTransactionId();
}

export async function updatePropertyTransactionChain(
  propertyId: string,
  transactionChainId: string
): Promise<void> {
  await safeFirestoreOperation(async (db) => {
    const propRef = db.collection(COLLECTIONS.PROPERTIES).doc(propertyId);
    const snap = await propRef.get();
    const oldChainId =
      ((snap.data()?.commercial as Record<string, unknown> | undefined)
        ?.transactionChainId as string | undefined) ?? null;
    const companyId = (snap.data()?.companyId as string | undefined) ?? null;

    await propRef.update({
      'commercial.transactionChainId': transactionChainId,
    });

    // ADR-195 — Entity audit trail (sales-accounting bridge system write)
    if (oldChainId !== transactionChainId && companyId) {
      await EntityAuditService.recordChange({
        entityType: ENTITY_TYPES.PROPERTY,
        entityId: propertyId,
        entityName: null,
        action: 'updated',
        changes: [
          {
            field: 'commercial.transactionChainId',
            oldValue: oldChainId,
            newValue: transactionChainId,
            label: 'Αλυσίδα Συναλλαγής',
          },
        ],
        performedBy: 'system',
        performedByName: 'Σύστημα',
        companyId,
      });
    }
  }, undefined);
}

export async function findDepositInvoiceId(propertyId: string): Promise<string | null> {
  return safeFirestoreOperation(async (db) => {
    const snap = await db
      .collection(COLLECTIONS.ACCOUNTING_INVOICES)
      .where(FIELDS.PROPERTY_ID, '==', propertyId)
      .where(FIELDS.TYPE, '==', 'sales_invoice')
      .orderBy(FIELDS.CREATED_AT, 'asc')
      .limit(1)
      .get();

    if (snap.empty) return null;
    return (snap.docs[0].data() as { invoiceId: string }).invoiceId;
  }, null);
}

export async function resolveHierarchy(event: SalesAccountingEvent): Promise<void> {
  // Skip if hierarchy already resolved
  if (event.companyName && event.buildingName && event.projectAddress) return;

  await safeFirestoreOperation(async (db) => {
    // 1. Fetch property -> buildingId, floor
    const propertySnap = await db.collection(COLLECTIONS.PROPERTIES).doc(event.propertyId).get();
    if (!propertySnap.exists) return;
    const propertyData = propertySnap.data() as Record<string, unknown>;
    event.unitFloor = (propertyData.floor as number) ?? null;

    const buildingId = propertyData.buildingId as string | undefined;
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

// ============================================================================
// INVOICE INPUT BUILDER
// ============================================================================

export interface BuildInvoiceInputParams {
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
  propertyId: string;
  relatedInvoiceId: string | null;
  notes: string | null;
  /** ADR-199: Multi-line items (unit + appurtenances) */
  saleLineItems?: SaleLineItem[];
}

/**
 * ADR-199: Builds description for an invoice line item
 */
export function buildLineDescription(
  invoiceType: 'sales_invoice' | 'credit_invoice',
  item: SaleLineItem
): string {
  const assetLabels: Record<SaleLineItem['assetType'], string> = {
    property: 'Ακίνητο',
    parking: 'Θέση στάθμευσης',
    storage: 'Αποθήκη',
  };
  const prefix = invoiceType === 'credit_invoice' ? 'Πιστωτικό —' : 'Πώληση —';
  return `${prefix} ${assetLabels[item.assetType]} ${item.assetName}`;
}

/**
 * Builds a complete CreateInvoiceInput from params.
 *
 * ADR-199: If lineItems (appurtenances) exist, creates N lines
 * instead of 1. Backward compatible -- without lineItems same behavior.
 */
export function buildInvoiceInput(params: BuildInvoiceInputParams): CreateInvoiceInput {
  const category = getCategoryByCode(INCOME_CATEGORY);
  const mydataCode = (category?.mydataCode ?? 'category1_1') as MyDataIncomeType;
  const now = nowISO().slice(0, 10); // YYYY-MM-DD
  const fiscalYear = new Date().getFullYear();

  // ADR-199: Multi-line invoices for appurtenances
  const hasMultipleLines = params.saleLineItems && params.saleLineItems.length > 0;

  const invoiceLineItems = hasMultipleLines
    ? (params.saleLineItems ?? []).map((item, idx) => {
        const lineNet = roundTwo(item.grossAmount / VAT_DIVISOR);
        return {
          lineNumber: idx + 1,
          description: buildLineDescription(params.type, item),
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
    propertyId: params.propertyId,
    relatedInvoiceId: params.relatedInvoiceId,
    journalEntryId: null,
    notes: params.notes,
    fiscalYear,
  };
}
