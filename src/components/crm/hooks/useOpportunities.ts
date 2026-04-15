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
import { useTranslation } from '@/i18n/hooks/useTranslation';
// 🏢 ADR-300: Stale-while-revalidate — prevents navigation flash on remount
import { createStaleCache } from '@/lib/stale-cache';

const logger = createModuleLogger('useOpportunities');

// ADR-300: Module-level cache survives React unmount/remount (navigation)
const oppsCache = createStaleCache<Opportunity[]>('crm-pipeline');

export function useOpportunities() {
    const notifications = useNotifications();
    const { t } = useTranslation(['crm', 'crm-inbox']);
    // ADR-300: Seed from cache → zero flash on re-navigation
    const [opportunities, setOpportunities] = useState<Opportunity[]>(oppsCache.get() ?? []);
    const [loading, setLoading] = useState(!oppsCache.hasLoaded());
    const [error, setError] = useState<string | null>(null);

    // 🌐 i18n: All messages converted to i18n keys - 2026-01-18
    const fetchOpportunities = useCallback(async () => {
        // ADR-300: Only show spinner on first load — not on re-navigation
        if (!oppsCache.hasLoaded()) setLoading(true);
        setError(null);
        try {
            const fetchedOpportunities = await apiGetOpportunities();
            // ADR-300: Write to module-level cache so next remount skips spinner
            oppsCache.set(fetchedOpportunities);
            setOpportunities(fetchedOpportunities);
        } catch (err) {
            const loadErrorMessage = t("opportunities.errors.loadFailed");
            setError(loadErrorMessage);
            notifications.error(loadErrorMessage);
        } finally {
            setLoading(false);
        }
    }, [notifications, t]);
    
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
    
          notifications.success(t("opportunities.messages.addSuccess"));

          fetchOpportunities();
        } catch (error) {
          logger.error('Error adding opportunity', { error });
          notifications.error(t("opportunities.errors.addFailed"));
          throw error;
        }
      };

    const deleteOpportunity = async (id: string, name: string) => {
        try {
            await apiDeleteOpportunity(id);
            notifications.success(t("opportunities.messages.deleteSuccess"));
            fetchOpportunities();
        } catch (error) {
            notifications.error(t("opportunities.errors.deleteFailed"));
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
