'use client';

import { useState, useCallback, useEffect } from 'react';
import type { Opportunity } from '@/types/crm';
import { 
    addOpportunity as apiAddOpportunity, 
    getOpportunities as apiGetOpportunities, 
    deleteOpportunity as apiDeleteOpportunity 
} from '@/services/opportunities.service';
import { useToast } from '@/hooks/useToast';

export function useOpportunities() {
    const { toast } = useToast();
    const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchOpportunities = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const fetchedOpportunities = await apiGetOpportunities();
            setOpportunities(fetchedOpportunities);
        } catch (err) {
            const errorMessage = "Δεν ήταν δυνατή η φόρτωση των ευκαιριών.";
            setError(errorMessage);
            toast({
                title: "Σφάλμα",
                description: errorMessage,
                variant: "destructive"
            });
        } finally {
            setLoading(false);
        }
    }, [toast]);
    
    const addOpportunity = async (data: Partial<Omit<Opportunity, 'id' | 'createdAt' | 'updatedAt'>>) => {
        try {
          await apiAddOpportunity({
              ...data,
              contactId: '', 
              assignedTo: 'current-user-id',
              status: 'active',
              lastActivity: new Date(),
          } as any);
    
          toast({
              title: "Επιτυχία",
              description: "Το lead προστέθηκε επιτυχώς!",
              variant: "success",
          });
          
          fetchOpportunities();
        } catch (error) {
          console.error(error);
          toast({
              title: "Σφάλμα",
              description: "Δεν ήταν δυνατή η προσθήκη του lead.",
              variant: "destructive",
          });
          throw error;
        }
      };

    const deleteOpportunity = async (id: string, name: string) => {
        try {
            await apiDeleteOpportunity(id);
            toast({
                title: "Επιτυχής Διαγραφή",
                description: `Η ευκαιρία "${name}" διαγράφηκε.`,
                variant: "success",
            });
            fetchOpportunities();
        } catch (error) {
            toast({
                title: "Σφάλμα Διαγραφής",
                description: "Δεν ήταν δυνατή η διαγραφή της ευκαιρίας.",
                variant: "destructive",
            });
            console.error("Error deleting opportunity:", error);
            throw error;
        }
    };
    
    // Initial fetch
    useEffect(() => {
        fetchOpportunities();
    }, [fetchOpportunities]);

    return { opportunities, loading, error, fetchOpportunities, addOpportunity, deleteOpportunity };
}
