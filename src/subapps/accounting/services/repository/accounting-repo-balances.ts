/**
 * @fileoverview Accounting Repository — Balances & Fiscal Periods Domain
 * @description Standalone functions for customer balances and fiscal period CRUD
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-03-29
 * @see DECISIONS-PHASE-1b.md Q1-Q8
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, max 500 lines
 */

import { safeFirestoreOperation } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';

import type { CustomerBalance } from '../../types/customer-balance';
import type { FiscalPeriod } from '../../types/fiscal-period';
import type { TenantContext } from '../../types/common';

import { sanitizeForFirestore, isoNow } from './firestore-helpers';

// ============================================================================
// CUSTOMER BALANCES
// ============================================================================

export async function getCustomerBalance(
  tenant: TenantContext,
  customerId: string
): Promise<CustomerBalance | null> {
  return safeFirestoreOperation(async (db) => {
    const snap = await db
      .collection(COLLECTIONS.ACCOUNTING_CUSTOMER_BALANCES)
      .doc(customerId)
      .get();
    if (!snap.exists) return null;
    return snap.data() as CustomerBalance;
  }, null);
}

export async function upsertCustomerBalance(
  tenant: TenantContext,
  customerId: string,
  balance: CustomerBalance
): Promise<void> {
  await safeFirestoreOperation(async (db) => {
    const doc = sanitizeForFirestore({
      ...balance,
      companyId: tenant.companyId,
      updatedAt: isoNow(),
    } as unknown as Record<string, unknown>);
    await db
      .collection(COLLECTIONS.ACCOUNTING_CUSTOMER_BALANCES)
      .doc(customerId)
      .set(doc);
  }, undefined);
}

export async function listCustomerBalances(
  tenant: TenantContext,
  fiscalYear: number
): Promise<CustomerBalance[]> {
  return safeFirestoreOperation(async (db) => {
    const snap = await db
      .collection(COLLECTIONS.ACCOUNTING_CUSTOMER_BALANCES)
      .where('companyId', '==', tenant.companyId)
      .where('fiscalYear', '==', fiscalYear)
      .orderBy('netBalance', 'desc')
      .get();
    return snap.docs.map((d) => d.data() as CustomerBalance);
  }, []);
}

// ============================================================================
// FISCAL PERIODS
// ============================================================================

export async function getFiscalPeriod(
  tenant: TenantContext,
  periodId: string
): Promise<FiscalPeriod | null> {
  return safeFirestoreOperation(async (db) => {
    const snap = await db
      .collection(COLLECTIONS.ACCOUNTING_FISCAL_PERIODS)
      .doc(periodId)
      .get();
    if (!snap.exists) return null;
    return snap.data() as FiscalPeriod;
  }, null);
}

export async function listFiscalPeriods(
  tenant: TenantContext,
  fiscalYear: number
): Promise<FiscalPeriod[]> {
  return safeFirestoreOperation(async (db) => {
    const snap = await db
      .collection(COLLECTIONS.ACCOUNTING_FISCAL_PERIODS)
      .where('companyId', '==', tenant.companyId)
      .where('fiscalYear', '==', fiscalYear)
      .orderBy('periodNumber', 'asc')
      .get();
    return snap.docs.map((d) => d.data() as FiscalPeriod);
  }, []);
}

export async function updateFiscalPeriod(
  tenant: TenantContext,
  periodId: string,
  updates: Partial<FiscalPeriod>
): Promise<void> {
  await safeFirestoreOperation(async (db) => {
    await db
      .collection(COLLECTIONS.ACCOUNTING_FISCAL_PERIODS)
      .doc(periodId)
      .update(
        sanitizeForFirestore({ ...updates, updatedAt: isoNow() } as Record<string, unknown>)
      );
  }, undefined);
}

export async function createFiscalPeriods(
  tenant: TenantContext,
  periods: FiscalPeriod[]
): Promise<void> {
  await safeFirestoreOperation(async (db) => {
    const batch = db.batch();
    for (const period of periods) {
      const ref = db
        .collection(COLLECTIONS.ACCOUNTING_FISCAL_PERIODS)
        .doc(period.periodId);
      batch.set(
        ref,
        sanitizeForFirestore(period as unknown as Record<string, unknown>)
      );
    }
    await batch.commit();
  }, undefined);
}
