/**
 * @fileoverview useMatchingConfig Hook (Phase 2d)
 * @description Read/write matching configuration from Firestore
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-03-30
 * @see DECISIONS-PHASE-2.md Q2 (Configurable thresholds)
 * @compliance CLAUDE.md Enterprise Standards — zero `any`
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useCompanyId } from '@/hooks/useCompanyId';
import { createStaleCache } from '@/lib/stale-cache';
import type { MatchingConfig } from '@/subapps/accounting/types';
import { DEFAULT_MATCHING_CONFIG } from '@/subapps/accounting/types';
import { COLLECTIONS } from '@/config/firestore-collections';
import { accountingDocId } from '@/subapps/accounting/services/repository/accounting-doc-ids';

// ADR-300: Module-level cache — survives React unmount/remount (navigation)
const matchingConfigCache = createStaleCache<MatchingConfig>('accounting-matching-config');

/**
 * Read/write matching config from Firestore.
 * Falls back to DEFAULT_MATCHING_CONFIG if no doc exists.
 */
export function useMatchingConfig() {
  // ADR-439 Phase 2c: per-tenant config. companyId via the centralized resolver
  // (ADR-201) — client-safe, NOT the server `@/config/tenant` getter.
  const companyId = useCompanyId()?.companyId;
  // ADR-300: Seed from module-level cache → zero flash on re-navigation
  const [config, setConfig] = useState<MatchingConfig>(matchingConfigCache.get() ?? DEFAULT_MATCHING_CONFIG);
  const [loading, setLoading] = useState(!matchingConfigCache.hasLoaded());
  const [saving, setSaving] = useState(false);

  const loadConfig = useCallback(async () => {
    if (!companyId) return;
    try {
      // ADR-300: Only show spinner on first load — not on re-navigation
      if (!matchingConfigCache.hasLoaded()) setLoading(true);
      const { getFirestore, doc, getDoc } = await import('firebase/firestore');
      const { getApp } = await import('firebase/app');
      const db = getFirestore(getApp());
      const docRef = doc(db, COLLECTIONS.ACCOUNTING_SETTINGS, accountingDocId(companyId, 'matching_config'));
      const snap = await getDoc(docRef);
      const loaded = snap.exists() ? (snap.data() as MatchingConfig) : DEFAULT_MATCHING_CONFIG;
      // ADR-300: Write to module-level cache so next remount skips spinner
      matchingConfigCache.set(loaded);
      setConfig(loaded);
    } catch {
      // Keep default config on error
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    if (!companyId) return;
    void loadConfig();
  }, [companyId, loadConfig]);

  const saveConfig = useCallback(async (newConfig: MatchingConfig): Promise<boolean> => {
    if (!companyId) return false;
    try {
      setSaving(true);
      const { getFirestore, doc, setDoc } = await import('firebase/firestore');
      const { getApp } = await import('firebase/app');
      const db = getFirestore(getApp());
      const docRef = doc(db, COLLECTIONS.ACCOUNTING_SETTINGS, accountingDocId(companyId, 'matching_config'));
      // Stamp companyId so the Firestore rules (gate-by-body-companyId) accept the write.
      await setDoc(docRef, { ...newConfig, companyId }, { merge: true });
      // ADR-300: Keep cache in sync after successful save
      matchingConfigCache.set(newConfig);
      setConfig(newConfig);
      return true;
    } catch {
      return false;
    } finally {
      setSaving(false);
    }
  }, [companyId]);

  return { config, loading, saving, saveConfig, refetch: loadConfig };
}
