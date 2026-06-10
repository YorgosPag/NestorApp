/**
 * @fileoverview Accounting Repository — Config Domain (Matching Engine Config)
 * @description Per-tenant read/write of the matching engine configuration
 *              (scoring weights + thresholds) via the Admin SDK.
 *
 * Historically the matching config lived in a single GLOBAL document
 * (`accounting_settings/matching_config`) read with the *client* firebase SDK from
 * inside `matching-engine.ts`. Because the engine runs SERVER-side (bank/match API
 * routes), that client read always failed → the engine silently used the hardcoded
 * defaults. ADR-439 Phase 2c moves the config to a per-tenant composite document
 * (`accounting_settings/{companyId}__matching_config`) read here with the Admin SDK,
 * fixing that latent bug while making the config tenant-scoped.
 *
 * @author Claude Code (Anthropic AI) + Giorgos Pagonis
 * @created 2026-06-10
 * @see ADR-439 Tenant Identity SSoT & Provisioning — Phase 2c
 * @see N.6 — deterministic doc id + setDoc (never addDoc)
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, max 500 lines
 */

import { safeFirestoreOperation } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';

import type { MatchingConfig } from '../../types/matching-config';
import type { TenantContext } from '../../types/common';

import { sanitizeForFirestore, isoNow } from './firestore-helpers';
import { accountingDocId } from './accounting-doc-ids';

/**
 * Load the per-tenant matching config. Returns `null` when no stored config exists
 * (the engine then falls back to `DEFAULT_MATCHING_CONFIG`).
 */
export async function getMatchingConfig(tenant: TenantContext): Promise<MatchingConfig | null> {
  return safeFirestoreOperation(async (db) => {
    const snap = await db
      .collection(COLLECTIONS.ACCOUNTING_SETTINGS)
      .doc(accountingDocId(tenant.companyId, 'matching_config'))
      .get();
    if (!snap.exists) return null;
    return snap.data() as MatchingConfig;
  }, null);
}

/**
 * Persist the per-tenant matching config. Stamps `companyId` so the Firestore rules
 * (gate-by-body-companyId) pass for both Admin and client reads of the same document.
 */
export async function saveMatchingConfig(tenant: TenantContext, config: MatchingConfig): Promise<void> {
  const now = isoNow();
  await safeFirestoreOperation(async (db) => {
    const docRef = db
      .collection(COLLECTIONS.ACCOUNTING_SETTINGS)
      .doc(accountingDocId(tenant.companyId, 'matching_config'));
    const doc = sanitizeForFirestore({
      ...config,
      companyId: tenant.companyId,
      updatedAt: now,
    } as unknown as Record<string, unknown>);
    await docRef.set(doc);
  }, undefined);
}
