/**
 * @fileoverview Accounting Repository — Entity Domain (Partners, Members, Shareholders, EFKA)
 * @description Standalone functions extracted from FirestoreAccountingRepository
 * @author Claude Code (Anthropic AI) + Giorgos Pagonis
 * @created 2026-03-25
 * @see ADR-ACC-012 OE, ADR-ACC-014 EPE, ADR-ACC-015 AE
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, max 500 lines
 */

import { safeFirestoreOperation } from '@/lib/firebaseAdmin';
import { COLLECTIONS, SYSTEM_DOCS } from '@/config/firestore-collections';

import type { Partner, Member, Shareholder } from '../../types/entity';
import type { EFKAPayment, EFKAUserConfig } from '../../types/efka';

import { sanitizeForFirestore, isoNow } from './firestore-helpers';

// ============================================================================
// PARTNERS (ADR-ACC-012 OE)
// ============================================================================

export async function getPartners(): Promise<Partner[]> {
  return safeFirestoreOperation(async (db) => {
    const snap = await db.collection(COLLECTIONS.ACCOUNTING_SETTINGS).doc(SYSTEM_DOCS.ACCT_PARTNERS).get();
    if (!snap.exists) return [];
    const data = snap.data() as { partners: Partner[] };
    return data.partners ?? [];
  }, []);
}

export async function savePartners(partners: Partner[]): Promise<void> {
  const now = isoNow();
  await safeFirestoreOperation(async (db) => {
    const docRef = db.collection(COLLECTIONS.ACCOUNTING_SETTINGS).doc(SYSTEM_DOCS.ACCT_PARTNERS);
    const doc = sanitizeForFirestore({
      partners,
      updatedAt: now,
    } as unknown as Record<string, unknown>);
    await docRef.set(doc);
  }, undefined);
}

export async function getPartnerEFKAPayments(
  partnerId: string,
  year: number
): Promise<EFKAPayment[]> {
  return safeFirestoreOperation(async (db) => {
    const snap = await db
      .collection(COLLECTIONS.ACCOUNTING_EFKA_PAYMENTS)
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

export async function getMembers(): Promise<Member[]> {
  return safeFirestoreOperation(async (db) => {
    const snap = await db.collection(COLLECTIONS.ACCOUNTING_SETTINGS).doc(SYSTEM_DOCS.ACCT_MEMBERS).get();
    if (!snap.exists) return [];
    const data = snap.data() as { members: Member[] };
    return data.members ?? [];
  }, []);
}

export async function saveMembers(members: Member[]): Promise<void> {
  const now = isoNow();
  await safeFirestoreOperation(async (db) => {
    const docRef = db.collection(COLLECTIONS.ACCOUNTING_SETTINGS).doc(SYSTEM_DOCS.ACCT_MEMBERS);
    const doc = sanitizeForFirestore({
      members,
      updatedAt: now,
    } as unknown as Record<string, unknown>);
    await docRef.set(doc);
  }, undefined);
}

export async function getMemberEFKAPayments(
  memberId: string,
  year: number
): Promise<EFKAPayment[]> {
  return safeFirestoreOperation(async (db) => {
    const snap = await db
      .collection(COLLECTIONS.ACCOUNTING_EFKA_PAYMENTS)
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

export async function getShareholders(): Promise<Shareholder[]> {
  return safeFirestoreOperation(async (db) => {
    const snap = await db.collection(COLLECTIONS.ACCOUNTING_SETTINGS).doc(SYSTEM_DOCS.ACCT_SHAREHOLDERS).get();
    if (!snap.exists) return [];
    const data = snap.data() as { shareholders: Shareholder[] };
    return data.shareholders ?? [];
  }, []);
}

export async function saveShareholders(shareholders: Shareholder[]): Promise<void> {
  const now = isoNow();
  await safeFirestoreOperation(async (db) => {
    const docRef = db.collection(COLLECTIONS.ACCOUNTING_SETTINGS).doc(SYSTEM_DOCS.ACCT_SHAREHOLDERS);
    const doc = sanitizeForFirestore({
      shareholders,
      updatedAt: now,
    } as unknown as Record<string, unknown>);
    await docRef.set(doc);
  }, undefined);
}

export async function getShareholderEFKAPayments(
  shareholderId: string,
  year: number
): Promise<EFKAPayment[]> {
  return safeFirestoreOperation(async (db) => {
    const snap = await db
      .collection(COLLECTIONS.ACCOUNTING_EFKA_PAYMENTS)
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

export async function getEFKAPayments(year: number): Promise<EFKAPayment[]> {
  return safeFirestoreOperation(async (db) => {
    const snap = await db
      .collection(COLLECTIONS.ACCOUNTING_EFKA_PAYMENTS)
      .where('year', '==', year)
      .orderBy('month', 'asc')
      .get();
    return snap.docs.map((d) => d.data() as EFKAPayment);
  }, []);
}

export async function updateEFKAPayment(
  paymentId: string,
  updates: Partial<EFKAPayment>
): Promise<void> {
  await safeFirestoreOperation(async (db) => {
    await db.collection(COLLECTIONS.ACCOUNTING_EFKA_PAYMENTS).doc(paymentId).update(
      sanitizeForFirestore(updates as Record<string, unknown>)
    );
  }, undefined);
}

export async function getEFKAUserConfig(): Promise<EFKAUserConfig | null> {
  return safeFirestoreOperation(async (db) => {
    const snap = await db.collection(COLLECTIONS.ACCOUNTING_EFKA_CONFIG).doc(SYSTEM_DOCS.ACCT_EFKA_USER_CONFIG).get();
    if (!snap.exists) return null;
    return snap.data() as EFKAUserConfig;
  }, null);
}

export async function saveEFKAUserConfig(config: EFKAUserConfig): Promise<void> {
  await safeFirestoreOperation(async (db) => {
    await db.collection(COLLECTIONS.ACCOUNTING_EFKA_CONFIG).doc(SYSTEM_DOCS.ACCT_EFKA_USER_CONFIG).set(
      sanitizeForFirestore(config as unknown as Record<string, unknown>)
    );
  }, undefined);
}
