'use client';

import { useState, useCallback, useEffect } from 'react';
import type { Opportunity } from '@/types/crm';
import { 
    addOpportunity as apiAddOpportunity, 
    getOpportunities as apiGetOpportunities, 
    deleteOpportunity as apiDeleteOpportunity 
} from '@/services/opportunities.service';
import { useNotifications } from '@/providers/NotificationProvider';

export function useOpportunities() {
    const notifications = useNotifications();
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
            notifications.error(errorMessage);
        } finally {
            setLoading(false);
        }
    }, [notifications]);
    
    const addOpportunity = async (data: Partial<Omit<Opportunity, 'id' | 'createdAt' | 'updatedAt'>>) => {
        try {
          // 🏢 ENTERPRISE: Construct proper Opportunity object with all required fields
          const opportunityData: Omit<Opportunity, 'id' | 'createdAt' | 'updatedAt'> = {
              title: data.title || '',
              contactId: data.contactId || '',
              assignedTo: data.assignedTo || process.env.NEXT_PUBLIC_DEFAULT_USER_ID || 'current-user-id',
              status: data.status || 'active',
              stage: data.stage || 'initial_contact',
              lastActivity: data.lastActivity || new Date(),
              ...data,
          };
          await apiAddOpportunity(opportunityData);
    
          notifications.success("Το lead προστέθηκε επιτυχώς!");
          
          fetchOpportunities();
        } catch (error) {
          console.error(error);
          notifications.error("Δεν ήταν δυνατή η προσθήκη του lead.");
          throw error;
        }
      };

    const deleteOpportunity = async (id: string, name: string) => {
        try {
            await apiDeleteOpportunity(id);
            notifications.success(`Η ευκαιρία "${name}" διαγράφηκε.`);
            fetchOpportunities();
        } catch (error) {
            notifications.error("Δεν ήταν δυνατή η διαγραφή της ευκαιρίας.");
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
