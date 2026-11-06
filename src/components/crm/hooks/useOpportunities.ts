'use client';

import { useState, useCallback, useEffect } from 'react';
import type { Opportunity } from '@/types/crm';
import { getOpportunities as apiGetOpportunities } from '@/services/opportunities.service';
import { createOpportunityWithPolicy, deleteOpportunityWithPolicy } from '@/services/crm/crm-mutation-gateway';
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
    const { t } = useTranslation('crm');
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
          // ADR-930 §3.10: η ΜΙΑ πόρτα δημιουργίας — ο server παράγει κατάσταση (από το στάδιο), στιγμές, δημιουργό,
          // κάτοχο (κενό ⇒ ο δημιουργός) και τη γραμμή ιστορικού.
          await createOpportunityWithPolicy({ data });

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
            await deleteOpportunityWithPolicy({ opportunityId: id });
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
