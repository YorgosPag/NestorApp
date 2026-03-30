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
import type { MatchingConfig } from '@/subapps/accounting/types';
import { DEFAULT_MATCHING_CONFIG } from '@/subapps/accounting/types';
import { COLLECTIONS, DOCUMENT_IDS } from '@/config/firestore-collections';

/**
 * Read/write matching config from Firestore.
 * Falls back to DEFAULT_MATCHING_CONFIG if no doc exists.
 */
export function useMatchingConfig() {
  const { user } = useAuth();
  const [config, setConfig] = useState<MatchingConfig>(DEFAULT_MATCHING_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    void loadConfig();
  }, [user, loadConfig]);

  const loadConfig = useCallback(async () => {
    try {
      setLoading(true);
      const { getFirestore, doc, getDoc } = await import('firebase/firestore');
      const { getApp } = await import('firebase/app');
      const db = getFirestore(getApp());
      const docRef = doc(db, COLLECTIONS.ACCOUNTING_SETTINGS, DOCUMENT_IDS.ACCT_MATCHING_CONFIG);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        setConfig(snap.data() as MatchingConfig);
      }
    } catch {
      // Keep default config on error
    } finally {
      setLoading(false);
    }
  }, []);

  const saveConfig = useCallback(async (newConfig: MatchingConfig): Promise<boolean> => {
    try {
      setSaving(true);
      const { getFirestore, doc, setDoc } = await import('firebase/firestore');
      const { getApp } = await import('firebase/app');
      const db = getFirestore(getApp());
      const docRef = doc(db, COLLECTIONS.ACCOUNTING_SETTINGS, DOCUMENT_IDS.ACCT_MATCHING_CONFIG);
      await setDoc(docRef, newConfig, { merge: true });
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
