/**
 * @fileoverview Cash Flow Data Fetcher — ADR-268 Phase 8
 * @description Server-only Firestore queries for all 6 cash flow data sources.
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, <500 lines
 */

import 'server-only';

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS, SUBCOLLECTIONS } from '@/config/firestore-collections';
import type {
  CashFlowConfig,
  CashFlowFilter,
  RawInstallment,
  RawCheque,
  RawPurchaseOrder,
  RawInvoice,
  RawBankTransaction,
  RawEFKA,
  RawCashFlowData,
} from './cash-flow.types';
import { DEFAULT_CASH_FLOW_CONFIG } from './cash-flow.types';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('CashFlowDataFetcher');

// =============================================================================
// CONFIG
// =============================================================================

/** Read cashFlowConfig from settings/{companyId} */
export async function fetchCashFlowConfig(
  companyId: string,
): Promise<CashFlowConfig> {
  const db = getAdminFirestore();
  const doc = await db
    .collection(COLLECTIONS.SETTINGS)
    .doc(companyId)
    .get();

  if (!doc.exists) return { ...DEFAULT_CASH_FLOW_CONFIG };

  const data = doc.data();
  const config = data?.cashFlowConfig as CashFlowConfig | undefined;

  return config ?? { ...DEFAULT_CASH_FLOW_CONFIG };
}

/** Update cashFlowConfig in settings/{companyId} */
export async function saveCashFlowConfig(
  companyId: string,
  config: CashFlowConfig,
): Promise<void> {
  const db = getAdminFirestore();
  await db
    .collection(COLLECTIONS.SETTINGS)
    .doc(companyId)
    .set({ cashFlowConfig: config }, { merge: true });
}

// =============================================================================
// INSTALLMENTS (collectionGroup query)
// =============================================================================

export async function fetchInstallments(
  filter: CashFlowFilter,
): Promise<RawInstallment[]> {
  const db = getAdminFirestore();
  const snap = await db
    .collectionGroup(SUBCOLLECTIONS.PROPERTY_PAYMENT_PLANS)
    .where('companyId', '==', filter.companyId)
    .where('status', 'in', ['active', 'draft'])
    .get();

  const installments: RawInstallment[] = [];

  for (const doc of snap.docs) {
    const data = doc.data();
    const projectId = (data.projectId as string) ?? '';
    const buildingId = (data.buildingId as string) ?? '';
    const unitId = (data.unitId as string) ?? '';

    if (filter.projectId && projectId !== filter.projectId) continue;
    if (filter.buildingId && buildingId !== filter.buildingId) continue;

    const items = (data.installments as Array<Record<string, unknown>>) ?? [];
    for (const inst of items) {
      const status = inst.status as string;
      if (status === 'paid' || status === 'waived') continue;

      installments.push({
        paymentPlanId: doc.id,
        unitId,
        projectId,
        buildingId,
        amount: (inst.amount as number) ?? 0,
        dueDate: (inst.dueDate as string) ?? '',
        status,
        paidAmount: (inst.paidAmount as number) ?? 0,
        paidDate: (inst.paidDate as string) ?? null,
      });
    }
  }

  return installments;
}

// =============================================================================
// CHEQUES
// =============================================================================

export async function fetchCheques(
  filter: CashFlowFilter,
): Promise<RawCheque[]> {
  const db = getAdminFirestore();
  let query = db
    .collection(COLLECTIONS.CHEQUES)
    .where('companyId', '==', filter.companyId);

  const snap = await query.get();

  return snap.docs
    .map((doc) => {
      const d = doc.data();
      return {
        chequeId: doc.id,
        amount: (d.amount as number) ?? 0,
        maturityDate: (d.maturityDate as string) ?? '',
        status: (d.status as string) ?? '',
        drawerName: (d.drawerName as string) ?? '',
        chequeNumber: (d.chequeNumber as string) ?? '',
        direction: (d.direction as string) ?? 'incoming',
        projectId: d.context?.entityId as string | undefined,
      };
    })
    .filter((c) => {
      if (filter.projectId && c.projectId !== filter.projectId) return false;
      return true;
    });
}

// =============================================================================
// PURCHASE ORDERS
// =============================================================================

export async function fetchPurchaseOrders(
  filter: CashFlowFilter,
): Promise<RawPurchaseOrder[]> {
  const db = getAdminFirestore();
  let query = db
    .collection(COLLECTIONS.PURCHASE_ORDERS)
    .where('companyId', '==', filter.companyId)
    .where('isDeleted', '==', false);

  if (filter.projectId) {
    query = query.where('projectId', '==', filter.projectId);
  }

  const snap = await query.get();

  return snap.docs
    .map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        total: (d.total as number) ?? 0,
        paymentDueDate: (d.paymentDueDate as string) ?? '',
        status: (d.status as string) ?? '',
        projectId: (d.projectId as string) ?? '',
        buildingId: (d.buildingId as string) ?? undefined,
      };
    })
    .filter((po) => {
      if (filter.buildingId && po.buildingId !== filter.buildingId) return false;
      return true;
    });
}

// =============================================================================
// ACCOUNTING INVOICES
// =============================================================================

export async function fetchInvoices(
  filter: CashFlowFilter,
): Promise<RawInvoice[]> {
  const db = getAdminFirestore();
  const query = db
    .collection(COLLECTIONS.ACCOUNTING_INVOICES)
    .where('companyId', '==', filter.companyId);

  const snap = await query.get();

  return snap.docs
    .map((doc) => {
      const d = doc.data();
      return {
        invoiceId: doc.id,
        balanceDue: (d.balanceDue as number) ?? 0,
        dueDate: (d.dueDate as string) ?? '',
        paymentStatus: (d.paymentStatus as string) ?? '',
        projectId: (d.projectId as string) ?? undefined,
      };
    })
    .filter((inv) => {
      if (filter.projectId && inv.projectId !== filter.projectId) return false;
      return true;
    });
}

// =============================================================================
// BANK TRANSACTIONS (for Actual vs Forecast)
// =============================================================================

export async function fetchBankTransactions(
  filter: CashFlowFilter,
): Promise<RawBankTransaction[]> {
  const db = getAdminFirestore();
  const query = db
    .collection(COLLECTIONS.ACCOUNTING_BANK_TRANSACTIONS)
    .where('companyId', '==', filter.companyId);

  const snap = await query.get();

  return snap.docs.map((doc) => {
    const d = doc.data();
    return {
      transactionId: doc.id,
      amount: (d.amount as number) ?? 0,
      direction: (d.direction as 'credit' | 'debit') ?? 'debit',
      valueDate: (d.valueDate as string) ?? '',
    };
  });
}

// =============================================================================
// EFKA PAYMENTS
// =============================================================================

export async function fetchEFKA(
  filter: CashFlowFilter,
): Promise<RawEFKA[]> {
  const db = getAdminFirestore();
  const query = db
    .collection(COLLECTIONS.ACCOUNTING_EFKA_PAYMENTS)
    .where('companyId', '==', filter.companyId);

  const snap = await query.get();

  return snap.docs.map((doc) => {
    const d = doc.data();
    return {
      paymentId: doc.id,
      amount: (d.amount as number) ?? 0,
      dueDate: (d.dueDate as string) ?? '',
      status: (d.status as string) ?? '',
    };
  });
}

// =============================================================================
// ORCHESTRATOR — Fetch All
// =============================================================================

/** Fetch all 6 data sources + config in parallel */
export async function fetchAllCashFlowData(
  filter: CashFlowFilter,
): Promise<RawCashFlowData> {
  const [
    config,
    installments,
    cheques,
    purchaseOrders,
    invoices,
    bankTransactions,
    efka,
  ] = await Promise.all([
    fetchCashFlowConfig(filter.companyId),
    fetchInstallments(filter),
    fetchCheques(filter),
    fetchPurchaseOrders(filter),
    fetchInvoices(filter),
    fetchBankTransactions(filter),
    fetchEFKA(filter),
  ]);

  logger.info('Cash flow data fetched', {
    installments: installments.length,
    cheques: cheques.length,
    purchaseOrders: purchaseOrders.length,
    invoices: invoices.length,
    bankTransactions: bankTransactions.length,
    efka: efka.length,
  });

  return {
    config,
    installments,
    cheques,
    purchaseOrders,
    invoices,
    bankTransactions,
    efka,
  };
}
