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
import { useAuth } from '@/hooks/useAuth';
import { createStaleCache } from '@/lib/stale-cache';
import type { MatchingConfig } from '@/subapps/accounting/types';
import { DEFAULT_MATCHING_CONFIG } from '@/subapps/accounting/types';
import { COLLECTIONS, SYSTEM_DOCS } from '@/config/firestore-collections';

// ADR-300: Module-level cache — survives React unmount/remount (navigation)
const matchingConfigCache = createStaleCache<MatchingConfig>('accounting-matching-config');

/**
 * Read/write matching config from Firestore.
 * Falls back to DEFAULT_MATCHING_CONFIG if no doc exists.
 */
export function useMatchingConfig() {
  const { user } = useAuth();
  // ADR-300: Seed from module-level cache → zero flash on re-navigation
  const [config, setConfig] = useState<MatchingConfig>(matchingConfigCache.get() ?? DEFAULT_MATCHING_CONFIG);
  const [loading, setLoading] = useState(!matchingConfigCache.hasLoaded());
  const [saving, setSaving] = useState(false);

  const loadConfig = useCallback(async () => {
    try {
      // ADR-300: Only show spinner on first load — not on re-navigation
      if (!matchingConfigCache.hasLoaded()) setLoading(true);
      const { getFirestore, doc, getDoc } = await import('firebase/firestore');
      const { getApp } = await import('firebase/app');
      const db = getFirestore(getApp());
      const docRef = doc(db, COLLECTIONS.ACCOUNTING_SETTINGS, SYSTEM_DOCS.ACCT_MATCHING_CONFIG);
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
  }, []);

  useEffect(() => {
    if (!user) return;
    void loadConfig();
  }, [user, loadConfig]);

  const saveConfig = useCallback(async (newConfig: MatchingConfig): Promise<boolean> => {
    try {
      setSaving(true);
      const { getFirestore, doc, setDoc } = await import('firebase/firestore');
      const { getApp } = await import('firebase/app');
      const db = getFirestore(getApp());
      const docRef = doc(db, COLLECTIONS.ACCOUNTING_SETTINGS, SYSTEM_DOCS.ACCT_MATCHING_CONFIG);
      await setDoc(docRef, newConfig, { merge: true });
      // ADR-300: Keep cache in sync after successful save
      matchingConfigCache.set(newConfig);
      setConfig(newConfig);
      return true;
    } catch {
      return false;
    } finally {
      setSaving(false);
    }
  }, []);

  return { config, loading, saving, saveConfig, refetch: loadConfig };
}
