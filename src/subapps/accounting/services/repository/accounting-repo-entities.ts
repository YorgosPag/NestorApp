/**
 * @fileoverview Accounting Repository — Entity EFKA Domain (per-entity EFKA payments + config)
 * @description Standalone functions extracted from FirestoreAccountingRepository.
 *   ADR-440: the partners/members/shareholders ARRAYS are no longer stored here —
 *   they live in the company profile (SSoT) and are read via
 *   `profile-entity-accessors.ts`. This module keeps only the EFKA payment queries
 *   (separate `accounting_efka_payments` collection) and the EFKA user config.
 * @author Claude Code (Anthropic AI) + Giorgos Pagonis
 * @created 2026-03-25
 * @see ADR-440 Accounting Entity-Data SSoT
 * @see ADR-ACC-012 OE, ADR-ACC-014 EPE, ADR-ACC-015 AE
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, max 500 lines
 */

import { safeFirestoreOperation } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';

import type { EFKAPayment, EFKAUserConfig } from '../../types/efka';
import type { TenantContext } from '../../types/common';

import { sanitizeForFirestore } from './firestore-helpers';

// ============================================================================
// PARTNERS EFKA (ADR-ACC-012 OE)
// ============================================================================
//
// NOTE (ADR-440): partners / members / shareholders ARRAYS are read from the
// company profile (`accounting_settings/{companyId}`) via
// `profile-entity-accessors.ts` — the profile is the SSoT. The former
// per-tenant singleton readers/writers were removed. Only the EFKA payment
// queries (a separate collection) remain here.

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
// MEMBERS EFKA (ADR-ACC-014 EPE)
// ============================================================================

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
// SHAREHOLDERS EFKA (ADR-ACC-015 AE)
// ============================================================================

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
