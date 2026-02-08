/**
 * 📄 ENTERPRISE OBLIGATIONS HOOKS - PRODUCTION READY
 *
 * Αντικατέστησε τα mock hooks με επαγγελματικά Firebase/Database calls.
 * Όλα τα δεδομένα προέρχονται από production βάση δεδομένων.
 */

"use client";

import { useState, useEffect } from 'react';
import { FirestoreObligationsRepository } from '@/services/obligations/InMemoryObligationsRepository';
import type { ObligationDocument, ObligationTemplate } from '@/types/obligations';

// 🔥 ENTERPRISE: Firebase-based obligations hook
export function useObligations() {
  const [obligations, setObligations] = useState<ObligationDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [repository] = useState(() => new FirestoreObligationsRepository());

  useEffect(() => {
    const loadObligations = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await repository.getAll();
        setObligations(data);
        console.log(`✅ Loaded ${data.length} obligations from Firebase`);
      // 🌐 i18n: Error messages converted to i18n keys - 2026-01-18
      } catch (err) {
        console.error('❌ Error loading obligations:', err);
        setError('obligations.errors.loadFailed');
        setObligations([]);
      } finally {
        setLoading(false);
      }
    };

    loadObligations();
  }, [repository]);

  const deleteObligation = async (id: string): Promise<boolean> => {
    try {
      const success = await repository.delete(id);
      if (success) {
        setObligations(prev => prev.filter(o => o.id !== id));
        console.log(`✅ Deleted obligation: ${id}`);
      }
      return success;
    } catch (err) {
      console.error('❌ Error deleting obligation:', err);
      return false;
    }
  };

  const duplicateObligation = async (id: string): Promise<ObligationDocument | null> => {
    try {
      const duplicate = await repository.duplicate(id);
      if (duplicate) {
        setObligations(prev => [...prev, duplicate]);
        console.log(`✅ Duplicated obligation: ${id} -> ${duplicate.id}`);
      }
      return duplicate;
    } catch (err) {
      console.error('❌ Error duplicating obligation:', err);
      return null;
    }
  };

  const refreshObligations = async () => {
    try {
      setLoading(true);
      const data = await repository.getAll();
      setObligations(data);
    } catch (err) {
      console.error('❌ Error refreshing obligations:', err);
      setError('obligations.errors.refreshFailed');
    } finally {
      setLoading(false);
    }
  };

  return {
    obligations,
    loading,
    error,
    deleteObligation,
    duplicateObligation,
    refreshObligations,
  };
}

/**
 * 🔍 Hook for fetching a single obligation by ID
 */
export function useObligation(id: string) {
  const [obligation, setObligation] = useState<ObligationDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [repository] = useState(() => new FirestoreObligationsRepository());

  useEffect(() => {
    const loadObligation = async () => {
      if (!id) {
        setObligation(null);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const data = await repository.getById(id);
        setObligation(data);
      } catch (err) {
        console.error('❌ Error loading obligation:', err);
        setError('obligations.errors.loadSingleFailed');
        setObligation(null);
      } finally {
        setLoading(false);
      }
    };

    loadObligation();
  }, [id, repository]);

  return {
    obligation,
    loading,
    error
  };
}

// 🏢 ENTERPRISE: Obligation Template type

/**
 * 📋 Hook for fetching obligation templates
 */
export function useObligationTemplates() {
  // 🏢 ENTERPRISE: Proper type instead of any[]
  const [templates, setTemplates] = useState<ObligationTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [repository] = useState(() => new FirestoreObligationsRepository());

  useEffect(() => {
    const loadTemplates = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await repository.getTemplates();
        setTemplates(data);
        console.log(`✅ Loaded ${data.length} obligation templates from Firebase`);
      } catch (err) {
        console.error('❌ Error loading templates:', err);
        setError('obligations.errors.loadTemplatesFailed');
        setTemplates([]);
      } finally {
        setLoading(false);
      }
    };

    loadTemplates();
  }, [repository]);

  return {
    templates,
    loading,
    error
  };
}

/**
 * 📊 Hook for fetching obligation statistics
 */
export function useObligationStats() {
  const [stats, setStats] = useState({
    total: 0,
    draft: 0,
    completed: 0,
    approved: 0,
    thisMonth: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [repository] = useState(() => new FirestoreObligationsRepository());

  useEffect(() => {
    const loadStats = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await repository.getStatistics();
        setStats(data);
        console.log(`✅ Loaded obligation statistics from Firebase:`, data);
      } catch (err) {
        console.error('❌ Error loading stats:', err);
        setError('obligations.errors.loadStatsFailed');
      } finally {
        setLoading(false);
      }
    };

    loadStats();
  }, [repository]);

  return {
    ...stats,
    loading,
    error
  };
}



