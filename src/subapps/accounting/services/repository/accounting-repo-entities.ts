/**
 * @fileoverview Accounting Repository — Entity Domain (Partners, Members, Shareholders, EFKA)
 * @description Standalone functions extracted from FirestoreAccountingRepository
 * @author Claude Code (Anthropic AI) + Giorgos Pagonis
 * @created 2026-03-25
 * @see ADR-ACC-012 OE, ADR-ACC-014 EPE, ADR-ACC-015 AE
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, max 500 lines
 */

import { safeFirestoreOperation } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';

import type { Partner, Member, Shareholder } from '../../types/entity';
import type { EFKAPayment, EFKAUserConfig } from '../../types/efka';
import type { TenantContext } from '../../types/common';

import { sanitizeForFirestore, isoNow } from './firestore-helpers';
import { accountingDocId } from './accounting-doc-ids';

// ============================================================================
// PARTNERS (ADR-ACC-012 OE)
// ============================================================================

export async function getPartners(tenant: TenantContext): Promise<Partner[]> {
  return safeFirestoreOperation(async (db) => {
    const snap = await db.collection(COLLECTIONS.ACCOUNTING_SETTINGS).doc(accountingDocId(tenant.companyId, 'partners')).get();
    if (!snap.exists) return [];
    const data = snap.data() as { partners: Partner[] };
    return data.partners ?? [];
  }, []);
}

export async function savePartners(tenant: TenantContext, partners: Partner[]): Promise<void> {
  const now = isoNow();
  await safeFirestoreOperation(async (db) => {
    const docRef = db.collection(COLLECTIONS.ACCOUNTING_SETTINGS).doc(accountingDocId(tenant.companyId, 'partners'));
    const doc = sanitizeForFirestore({
      partners,
      companyId: tenant.companyId,
      updatedAt: now,
    } as unknown as Record<string, unknown>);
    await docRef.set(doc);
  }, undefined);
}

export async function getPartnerEFKAPayments(
  tenant: TenantContext,
  partnerId: string,
  year: number
): Promise<EFKAPayment[]> {
  return safeFirestoreOperation(async (db) => {
    const snap = await db
      .collection(COLLECTIONS.ACCOUNTING_EFKA_PAYMENTS)
      .where('companyId', '==', tenant.companyId)
      .where('partnerId', '==', partnerId)
      .where('year', '==', year)
      .orderBy('month', 'asc')
      .get();
    return snap.docs.map((d) => d.data() as EFKAPayment);
  }, []);
}

// ============================================================================
// MEMBERS (ADR-ACC-014 EPE)
// ============================================================================

export async function getMembers(tenant: TenantContext): Promise<Member[]> {
  return safeFirestoreOperation(async (db) => {
    const snap = await db.collection(COLLECTIONS.ACCOUNTING_SETTINGS).doc(accountingDocId(tenant.companyId, 'members')).get();
    if (!snap.exists) return [];
    const data = snap.data() as { members: Member[] };
    return data.members ?? [];
  }, []);
}

export async function saveMembers(tenant: TenantContext, members: Member[]): Promise<void> {
  const now = isoNow();
  await safeFirestoreOperation(async (db) => {
    const docRef = db.collection(COLLECTIONS.ACCOUNTING_SETTINGS).doc(accountingDocId(tenant.companyId, 'members'));
    const doc = sanitizeForFirestore({
      members,
      companyId: tenant.companyId,
      updatedAt: now,
    } as unknown as Record<string, unknown>);
    await docRef.set(doc);
  }, undefined);
}

export async function getMemberEFKAPayments(
  tenant: TenantContext,
  memberId: string,
  year: number
): Promise<EFKAPayment[]> {
  return safeFirestoreOperation(async (db) => {
    const snap = await db
      .collection(COLLECTIONS.ACCOUNTING_EFKA_PAYMENTS)
      .where('companyId', '==', tenant.companyId)
      .where('partnerId', '==', memberId)
      .where('year', '==', year)
      .orderBy('month', 'asc')
      .get();
    return snap.docs.map((d) => d.data() as EFKAPayment);
  }, []);
}

// ============================================================================
// SHAREHOLDERS (ADR-ACC-015 AE)
// ============================================================================

export async function getShareholders(tenant: TenantContext): Promise<Shareholder[]> {
  return safeFirestoreOperation(async (db) => {
    const snap = await db.collection(COLLECTIONS.ACCOUNTING_SETTINGS).doc(accountingDocId(tenant.companyId, 'shareholders')).get();
    if (!snap.exists) return [];
    const data = snap.data() as { shareholders: Shareholder[] };
    return data.shareholders ?? [];
  }, []);
}

export async function saveShareholders(tenant: TenantContext, shareholders: Shareholder[]): Promise<void> {
  const now = isoNow();
  await safeFirestoreOperation(async (db) => {
    const docRef = db.collection(COLLECTIONS.ACCOUNTING_SETTINGS).doc(accountingDocId(tenant.companyId, 'shareholders'));
    const doc = sanitizeForFirestore({
      shareholders,
      companyId: tenant.companyId,
      updatedAt: now,
    } as unknown as Record<string, unknown>);
    await docRef.set(doc);
  }, undefined);
}

export async function getShareholderEFKAPayments(
  tenant: TenantContext,
  shareholderId: string,
  year: number
): Promise<EFKAPayment[]> {
  return safeFirestoreOperation(async (db) => {
    const snap = await db
      .collection(COLLECTIONS.ACCOUNTING_EFKA_PAYMENTS)
      .where('companyId', '==', tenant.companyId)
      .where('partnerId', '==', shareholderId)
      .where('year', '==', year)
      .orderBy('month', 'asc')
      .get();
    return snap.docs.map((d) => d.data() as EFKAPayment);
  }, []);
}

// ============================================================================
// EFKA PAYMENTS & CONFIG
// ============================================================================

export async function getEFKAPayments(tenant: TenantContext, year: number): Promise<EFKAPayment[]> {
  return safeFirestoreOperation(async (db) => {
    const snap = await db
      .collection(COLLECTIONS.ACCOUNTING_EFKA_PAYMENTS)
      .where('companyId', '==', tenant.companyId)
      .where('year', '==', year)
      .orderBy('month', 'asc')
      .get();
    return snap.docs.map((d) => d.data() as EFKAPayment);
  }, []);
}

export async function updateEFKAPayment(
  tenant: TenantContext,
  paymentId: string,
  updates: Partial<EFKAPayment>
): Promise<void> {
  await safeFirestoreOperation(async (db) => {
    await db.collection(COLLECTIONS.ACCOUNTING_EFKA_PAYMENTS).doc(paymentId).update(
      sanitizeForFirestore(updates as Record<string, unknown>)
    );
  }, undefined);
}

export async function getEFKAUserConfig(tenant: TenantContext): Promise<EFKAUserConfig | null> {
  return safeFirestoreOperation(async (db) => {
    // ADR-439 Phase 2c: per-tenant. The EFKA config lives in its own collection with one
    // config per tenant → bare `{companyId}` doc id (mirrors company_profile), not composite.
    const snap = await db.collection(COLLECTIONS.ACCOUNTING_EFKA_CONFIG).doc(tenant.companyId).get();
    if (!snap.exists) return null;
    return snap.data() as EFKAUserConfig;
  }, null);
}

export async function saveEFKAUserConfig(tenant: TenantContext, config: EFKAUserConfig): Promise<void> {
  await safeFirestoreOperation(async (db) => {
    // Stamp companyId so the gate-by-body-companyId rules accept the write/read.
    await db.collection(COLLECTIONS.ACCOUNTING_EFKA_CONFIG).doc(tenant.companyId).set(
      sanitizeForFirestore({ ...config, companyId: tenant.companyId } as unknown as Record<string, unknown>)
    );
  }, undefined);
}
