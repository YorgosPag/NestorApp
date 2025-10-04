"use client";

import { useState, useEffect } from 'react';
import type { ObligationDocument } from '@/types/obligations';

// Mock implementation - replace with real service call
export function useObligations() {
  const [obligations, setObligations] = useState<ObligationDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Mock loading
    const timer = setTimeout(() => {
      setObligations([]);
      setLoading(false);
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  const deleteObligation = async (id: string) => {
    // Mock implementation
    setObligations(prev => prev.filter(o => o.id !== id));
    return true;
  };

  const duplicateObligation = async (id: string) => {
    // Mock implementation
    const original = obligations.find(o => o.id === id);
    if (original) {
      const duplicate = { ...original, id: `${id}_copy` };
      setObligations(prev => [...prev, duplicate]);
      return duplicate;
    }
    return null;
  };

  return {
    obligations,
    loading,
    error,
    deleteObligation,
    duplicateObligation,
  };
}

// Additional exports that might be used
export function useObligation(id: string) {
  const { obligations, loading, error } = useObligations();
  return {
    obligation: obligations.find(o => o.id === id),
    loading,
    error
  };
}

export function useObligationTemplates() {
  // Mock implementation
  return {
    templates: [],
    loading: false,
    error: null
  };
}

export function useObligationStats() {
  const { obligations } = useObligations();
  return {
    total: obligations.length,
    draft: obligations.filter(o => o.status === 'draft').length,
    completed: obligations.filter(o => o.status === 'completed').length,
    approved: obligations.filter(o => o.status === 'approved').length,
  };
}