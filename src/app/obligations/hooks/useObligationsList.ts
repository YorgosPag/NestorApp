
"use client";

import { useState, useMemo, useCallback } from "react";
import { useObligations } from "@/hooks/useObligations";
import { ObligationDocument } from "@/types/obligations";
import { useToast } from "@/hooks/useToast";

export type ObligationStatus = 'draft' | 'completed' | 'approved';
export type StatusFilter = 'all' | ObligationStatus;

interface Filters {
  searchTerm: string;
  status: StatusFilter;
}

export function useObligationsList() {
  const { obligations, loading, error, deleteObligation: apiDelete, duplicateObligation: apiDuplicate } = useObligations();
  const [filters, setFilters] = useState<Filters>({ searchTerm: '', status: 'all' });
  const { toast } = useToast();

  const handleFilterChange = useCallback((key: keyof Filters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleSearch = (term: string) => {
    handleFilterChange('searchTerm', term);
  };

  const filteredObligations = useMemo(() => {
    const safeLower = (str: string | undefined | null) => (str || '').toLowerCase();
    
    return obligations.filter(obligation => {
      const searchTermLower = filters.searchTerm.toLowerCase();
      
      const matchesSearch = searchTermLower === '' ||
        safeLower(obligation.title).includes(searchTermLower) ||
        safeLower(obligation.projectName).includes(searchTermLower);
        
      const matchesStatus = filters.status === 'all' || obligation.status === filters.status;
      
      return matchesSearch && matchesStatus;
    });
  }, [obligations, filters]);

  const stats = useMemo(() => {
    if (loading) return null;
    return {
      total: obligations.length,
      drafts: obligations.filter(o => o.status === 'draft').length,
      completed: obligations.filter(o => o.status === 'completed').length,
      approved: obligations.filter(o => o.status === 'approved').length,
    };
  }, [obligations, loading]);

  const deleteObligation = useCallback(async (id: string, title: string) => {
    if (window.confirm(`Είστε σίγουροι ότι θέλετε να διαγράψετε τη συγγραφή "${title}"?`)) {
      const success = await apiDelete(id);
      if (success) {
        toast({ title: "Επιτυχής Διαγραφή", description: `Η συγγραφή "${title}" διαγράφηκε.` });
      } else {
        toast({ title: "Σφάλμα", description: "Η διαγραφή απέτυχε.", variant: "error" });
      }
    }
  }, [apiDelete, toast]);

  const duplicateObligation = useCallback(async (id: string) => {
    const duplicated = await apiDuplicate(id);
    if (duplicated) {
      toast({ title: "Επιτυχής Αντιγραφή", description: `Δημιουργήθηκε το αντίγραφο "${duplicated.title}".` });
    } else {
      toast({ title: "Σφάλμα", description: "Η αντιγραφή απέτυχε.", variant: "error" });
    }
  }, [apiDuplicate, toast]);

  return {
    loading,
    error,
    stats,
    filteredObligations,
    filters,
    handleFilterChange,
    handleSearch,
    deleteObligation,
    duplicateObligation
  };
}

    