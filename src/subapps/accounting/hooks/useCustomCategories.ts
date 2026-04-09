/**
 * @fileoverview Accounting Subapp — useCustomCategories Hook
 * @description Client-side hook για CRUD custom κατηγοριών εσόδων/εξόδων.
 *   Ίδιο pattern με useAPYCertificates.ts (ADR-ACC-020).
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-03-18
 * @see ADR-ACC-021 Custom Categories
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, no inline styles
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { API_ROUTES } from '@/config/domain-constants';
import type {
  CustomCategoryDocument,
  CreateCustomCategoryInput,
  UpdateCustomCategoryInput,
} from '@/subapps/accounting/types';

// ============================================================================
// TYPES
// ============================================================================

interface UseCustomCategoriesOptions {
  /** Συμπερίληψη απενεργοποιημένων (soft-deleted) categories (default: false) */
  includeInactive?: boolean;
  /** Αυτόματο fetch κατά το mount (default: true) */
  autoFetch?: boolean;
}

interface DeleteResult {
  action: 'soft_deleted' | 'hard_deleted';
  message: string;
}

interface UseCustomCategoriesReturn {
  /** Λίστα custom categories */
  categories: CustomCategoryDocument[];
  /** Κατάσταση φόρτωσης */
  loading: boolean;
  /** Μήνυμα σφάλματος */
  error: string | null;
  /** Ανανέωση δεδομένων */
  refetch: () => Promise<void>;
  /** Δημιουργία νέας custom category */
  createCategory: (input: CreateCustomCategoryInput) => Promise<{ id: string; code: string }>;
  /** Ενημέρωση custom category */
  updateCategory: (id: string, updates: UpdateCustomCategoryInput) => Promise<void>;
  /** Διαγραφή custom category (soft ή hard, βάσει χρήσης) */
  deleteCategory: (id: string) => Promise<DeleteResult>;
}

// ============================================================================
// HOOK
// ============================================================================

/**
 * Hook για CRUD custom κατηγοριών.
 *
 * Παρέχει:
 * - `categories`: array από Firestore (active by default)
 * - `createCategory`: POST /api/accounting/categories
 * - `updateCategory`: PATCH /api/accounting/categories/[id]
 * - `deleteCategory`: DELETE /api/accounting/categories/[id] (smart soft/hard)
 *
 * @example
 * ```tsx
 * const { categories, createCategory } = useCustomCategories();
 * await createCategory({ type: 'expense', label: 'Υπεργολαβίες Σιδηρού', ... });
 * ```
 */
export function useCustomCategories(
  options: UseCustomCategoriesOptions = {}
): UseCustomCategoriesReturn {
  const { includeInactive = false, autoFetch = true } = options;

  const { user } = useAuth();
  const { t } = useTranslation('accounting-setup');
  const [categories, setCategories] = useState<CustomCategoryDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCategories = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (includeInactive) params.set('includeInactive', 'true');

      const res = await fetch(`${API_ROUTES.ACCOUNTING.CATEGORIES.LIST}?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = (await res.json()) as { categories: CustomCategoryDocument[] };
      setCategories(data.categories);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('setup.customCategories.errors.fetchFailed'));
    } finally {
      setLoading(false);
    }
  }, [user, includeInactive]);

  useEffect(() => {
    if (autoFetch) {
      void fetchCategories();
    }
  }, [autoFetch, fetchCategories]);

  const createCategory = useCallback(
    async (input: CreateCustomCategoryInput): Promise<{ id: string; code: string }> => {
      const res = await fetch(API_ROUTES.ACCOUNTING.CATEGORIES.LIST, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });

      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? t('setup.customCategories.errors.createFailed'));
      }

      const result = (await res.json()) as { id: string; code: string };
      await fetchCategories();
      return result;
    },
    [fetchCategories]
  );

  const updateCategory = useCallback(
    async (id: string, updates: UpdateCustomCategoryInput): Promise<void> => {
      const res = await fetch(API_ROUTES.ACCOUNTING.CATEGORIES.BY_ID(id), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? t('setup.customCategories.errors.updateFailed'));
      }

      await fetchCategories();
    },
    [fetchCategories]
  );

  const deleteCategory = useCallback(
    async (id: string): Promise<DeleteResult> => {
      const res = await fetch(API_ROUTES.ACCOUNTING.CATEGORIES.BY_ID(id), {
        method: 'DELETE',
      });

      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? t('setup.customCategories.errors.deleteFailed'));
      }

      const result = (await res.json()) as DeleteResult;
      await fetchCategories();
      return result;
    },
    [fetchCategories]
  );

  return {
    categories,
    loading,
    error,
    refetch: fetchCategories,
    createCategory,
    updateCategory,
    deleteCategory,
  };
}
