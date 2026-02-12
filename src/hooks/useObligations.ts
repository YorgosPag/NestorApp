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
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('useObligations');

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
        logger.info('Loaded obligations from Firebase', { count: data.length });
      // 🌐 i18n: Error messages converted to i18n keys - 2026-01-18
      } catch (err) {
        logger.error('Error loading obligations', { error: err });
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
        logger.info('Deleted obligation', { id });
      }
      return success;
    } catch (err) {
      logger.error('Error deleting obligation', { error: err });
      return false;
    }
  };

  const duplicateObligation = async (id: string): Promise<ObligationDocument | null> => {
    try {
      const duplicate = await repository.duplicate(id);
      if (duplicate) {
        setObligations(prev => [...prev, duplicate]);
        logger.info('Duplicated obligation', { sourceId: id, newId: duplicate.id });
      }
      return duplicate;
    } catch (err) {
      logger.error('Error duplicating obligation', { error: err });
      return null;
    }
  };

  const refreshObligations = async () => {
    try {
      setLoading(true);
      const data = await repository.getAll();
      setObligations(data);
    } catch (err) {
      logger.error('Error refreshing obligations', { error: err });
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
        logger.error('Error loading obligation', { error: err });
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
        logger.info('Loaded obligation templates from Firebase', { count: data.length });
      } catch (err) {
        logger.error('Error loading templates', { error: err });
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
    inReview: 0,
    returned: 0,
    approved: 0,
    issued: 0,
    superseded: 0,
    archived: 0,
    completed: 0,
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
        logger.info('Loaded obligation statistics from Firebase', { data });
      } catch (err) {
        logger.error('Error loading stats', { error: err });
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




