'use client';

import { useState, useCallback, useEffect } from 'react';
import type { Opportunity } from '@/types/crm';
import { 
    addOpportunity as apiAddOpportunity, 
    getOpportunities as apiGetOpportunities, 
    deleteOpportunity as apiDeleteOpportunity 
} from '@/services/opportunities.service';
import { useNotifications } from '@/providers/NotificationProvider';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('useOpportunities');

export function useOpportunities() {
    const notifications = useNotifications();
    const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // 🌐 i18n: All messages converted to i18n keys - 2026-01-18
    const fetchOpportunities = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const fetchedOpportunities = await apiGetOpportunities();
            setOpportunities(fetchedOpportunities);
        } catch (err) {
            setError("opportunities.errors.loadFailed");
            notifications.error("opportunities.errors.loadFailed");
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
    
          notifications.success("opportunities.status.addSuccess");

          fetchOpportunities();
        } catch (error) {
          logger.error('Error adding opportunity', { error });
          notifications.error("opportunities.errors.addFailed");
          throw error;
        }
      };

    const deleteOpportunity = async (id: string, name: string) => {
        try {
            await apiDeleteOpportunity(id);
            notifications.success("opportunities.status.deleteSuccess");
            fetchOpportunities();
        } catch (error) {
            notifications.error("opportunities.errors.deleteFailed");
            logger.error('Error deleting opportunity', { error });
            throw error;
        }
    };
    
    // Initial fetch
    useEffect(() => {
        fetchOpportunities();
    }, [fetchOpportunities]);

    return { opportunities, loading, error, fetchOpportunities, addOpportunity, deleteOpportunity };
}
