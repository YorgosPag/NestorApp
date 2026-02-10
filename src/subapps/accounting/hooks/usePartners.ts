/**
 * @fileoverview Accounting Subapp — usePartners Hook
 * @description Client-side hook για διαχείριση εταίρων ΟΕ
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-02-10
 * @version 1.0.0
 * @see ADR-ACC-012 OE Partnership Support
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, no inline styles
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import type { Partner } from '@/subapps/accounting/types/entity';

// ============================================================================
// TYPES
// ============================================================================

interface UsePartnersReturn {
  /** Λίστα εταίρων */
  partners: Partner[];
  /** Κατάσταση φόρτωσης */
  loading: boolean;
  /** Κατάσταση αποθήκευσης */
  saving: boolean;
  /** Μήνυμα σφάλματος */
  error: string | null;
  /** Ανανέωση δεδομένων */
  fetchPartners: () => Promise<void>;
  /** Αποθήκευση εταίρων */
  savePartners: (partners: Partner[]) => Promise<boolean>;
}

// ============================================================================
// HOOK
// ============================================================================

export function usePartners(): UsePartnersReturn {
  const { user } = useAuth();

  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getAuthHeaders = useCallback(async (): Promise<HeadersInit> => {
    if (!user) return {};
    const token = await user.getIdToken();
    return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  }, [user]);

  const fetchPartners = useCallback(async (): Promise<void> => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);

      const headers = await getAuthHeaders();
      const response = await fetch('/api/accounting/partners', { headers });

      if (!response.ok) {
        const errorData: { error?: string } = await response.json();
        throw new Error(errorData.error ?? `HTTP ${response.status}`);
      }

      const data: { success: boolean; data: Partner[] } = await response.json();
      setPartners(data.data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load partners';
      setError(message);
      setPartners([]);
    } finally {
      setLoading(false);
    }
  }, [user, getAuthHeaders]);

  const savePartners = useCallback(async (newPartners: Partner[]): Promise<boolean> => {
    if (!user) return false;

    try {
      setSaving(true);
      setError(null);

      const headers = await getAuthHeaders();
      const response = await fetch('/api/accounting/partners', {
        method: 'PUT',
        headers,
        body: JSON.stringify({ partners: newPartners }),
      });

      if (!response.ok) {
        const errorData: { error?: string } = await response.json();
        throw new Error(errorData.error ?? `HTTP ${response.status}`);
      }

      setPartners(newPartners);
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save partners';
      setError(message);
      return false;
    } finally {
      setSaving(false);
    }
  }, [user, getAuthHeaders]);

  useEffect(() => {
    if (user) {
      fetchPartners();
    }
  }, [user, fetchPartners]);

  return {
    partners,
    loading,
    saving,
    error,
    fetchPartners,
    savePartners,
  };
}
