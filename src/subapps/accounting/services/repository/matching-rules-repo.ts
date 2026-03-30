/**
 * @fileoverview Matching Rules Repository — Firestore CRUD for Learned Rules
 * @description Standalone functions for managing matching rules (Phase 2b)
 * @author Claude Code (Anthropic AI) + Giorgos Pagonis
 * @created 2026-03-30
 * @version 1.0.0
 * @see DECISIONS-PHASE-2.md Q5 — Advanced Learning
 * @compliance CLAUDE.md Enterprise Standards — zero `any`
 */

import { safeFirestoreOperation } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { generateMatchingRuleId } from '@/services/enterprise-id.service';
import type {
  LearnedRule,
  CreateLearnedRuleInput,
} from '../../types/matching-rules';
import type { MatchableEntityType } from '../../types/bank';
import { sanitizeForFirestore, isoNow } from './firestore-helpers';

// ============================================================================
// CREATE
// ============================================================================

export async function createMatchingRule(
  data: CreateLearnedRuleInput
): Promise<{ id: string }> {
  const id = generateMatchingRuleId();
  const now = isoNow();
  const doc = sanitizeForFirestore({
    ...data,
    ruleId: id,
    confirmations: 0,
    rejections: 0,
    lastConfirmedAt: null,
    lastUsedAt: null,
    createdAt: now,
    updatedAt: now,
  } as unknown as Record<string, unknown>);

  await safeFirestoreOperation(async (db) => {
    await db.collection(COLLECTIONS.ACCOUNTING_MATCHING_RULES).doc(id).set(doc);
  }, undefined);

  return { id };
}

// ============================================================================
// READ
// ============================================================================

export async function getMatchingRule(
  ruleId: string
): Promise<LearnedRule | null> {
  return safeFirestoreOperation(async (db) => {
    const snap = await db
      .collection(COLLECTIONS.ACCOUNTING_MATCHING_RULES)
      .doc(ruleId)
      .get();
    if (!snap.exists) return null;
    return snap.data() as LearnedRule;
  }, null);
}

/**
 * Find an existing rule by merchant name and entity type
 *
 * Searches active rules where pattern.merchantName matches.
 * Returns the highest-confidence match.
 */
export async function findRuleByPattern(
  merchantName: string,
  entityType: MatchableEntityType
): Promise<LearnedRule | null> {
  return safeFirestoreOperation(async (db) => {
    const snap = await db
      .collection(COLLECTIONS.ACCOUNTING_MATCHING_RULES)
      .where('status', '==', 'active')
      .where('pattern.merchantName', '==', merchantName)
      .where('target.entityType', '==', entityType)
      .orderBy('confidence', 'desc')
      .limit(1)
      .get();

    if (snap.empty) return null;
    return snap.docs[0]?.data() as LearnedRule ?? null;
  }, null);
}

/**
 * Find active rule matching a merchant name (any entity type)
 *
 * Used by getRuleBonus to check if there's a known pattern.
 */
export async function findRuleByMerchant(
  merchantName: string
): Promise<LearnedRule | null> {
  return safeFirestoreOperation(async (db) => {
    const snap = await db
      .collection(COLLECTIONS.ACCOUNTING_MATCHING_RULES)
      .where('status', '==', 'active')
      .where('pattern.merchantName', '==', merchantName)
      .orderBy('confidence', 'desc')
      .limit(1)
      .get();

    if (snap.empty) return null;
    return snap.docs[0]?.data() as LearnedRule ?? null;
  }, null);
}

/** List all active rules */
export async function listActiveRules(): Promise<LearnedRule[]> {
  return safeFirestoreOperation(async (db) => {
    const snap = await db
      .collection(COLLECTIONS.ACCOUNTING_MATCHING_RULES)
      .where('status', '==', 'active')
      .orderBy('confidence', 'desc')
      .limit(200)
      .get();

    return snap.docs.map((d) => d.data() as LearnedRule);
  }, []);
}

// ============================================================================
// UPDATE
// ============================================================================

export async function updateMatchingRule(
  ruleId: string,
  updates: Partial<LearnedRule>
): Promise<void> {
  await safeFirestoreOperation(async (db) => {
    await db
      .collection(COLLECTIONS.ACCOUNTING_MATCHING_RULES)
      .doc(ruleId)
      .update(
        sanitizeForFirestore({
          ...updates,
          updatedAt: isoNow(),
        } as unknown as Record<string, unknown>)
      );
  }, undefined);
}

// ============================================================================
// BULK OPERATIONS
// ============================================================================

/**
 * Disable stale rules — 90-day calibration window
 *
 * Disables rules that:
 * 1. Have confidence below 50%, OR
 * 2. Haven't been confirmed since cutoffDate (90 days ago)
 *
 * Returns the number of rules disabled.
 */
export async function disableStaleRules(
  cutoffDate: string
): Promise<number> {
  return safeFirestoreOperation(async (db) => {
    const activeSnap = await db
      .collection(COLLECTIONS.ACCOUNTING_MATCHING_RULES)
      .where('status', '==', 'active')
      .get();

    let disabled = 0;
    const now = isoNow();
    const batch = db.batch();

    for (const doc of activeSnap.docs) {
      const rule = doc.data() as LearnedRule;
      const shouldDisable =
        rule.confidence < 50 ||
        (!rule.lastConfirmedAt || rule.lastConfirmedAt < cutoffDate);

      if (shouldDisable) {
        batch.update(doc.ref, sanitizeForFirestore({
          status: 'disabled',
          updatedAt: now,
        } as unknown as Record<string, unknown>));
        disabled++;
      }
    }

    if (disabled > 0) {
      await batch.commit();
    }

    return disabled;
  }, 0);
}
