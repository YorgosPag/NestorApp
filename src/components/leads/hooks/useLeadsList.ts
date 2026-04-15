
"use client";

/**
 * useLeadsList — Leads list management hook
 *
 * Uses centralized useAsyncData hook for data fetching (ADR-223).
 * CRUD operations trigger refetch for server-consistent state.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getOpportunities } from "@/services/opportunities.service";
import { deleteOpportunityWithPolicy } from '@/services/crm/crm-mutation-gateway';
import { useNotifications } from '@/providers/NotificationProvider';
import type { Opportunity } from "@/types/crm";
import { createModuleLogger } from '@/lib/telemetry';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { ENTITY_ROUTES } from '@/lib/routes';
import { useAsyncData } from '@/hooks/useAsyncData';
// 🏢 ADR-300: Stale-while-revalidate — prevents navigation flash on remount
import { createStaleCache } from '@/lib/stale-cache';

const logger = createModuleLogger('useLeadsList');

// ADR-300: Module-level cache survives React unmount/remount (navigation)
const leadsListCache = createStaleCache<Opportunity[]>('crm-leads');

export function useLeadsList(refreshTrigger?: number | string | boolean | null) {
  const router = useRouter();
  const { t } = useTranslation(['crm', 'crm-inbox']);
  const { success, error: notifyError } = useNotifications();
  const { confirm, dialogProps } = useConfirmDialog();

  const { data, loading, error, refetch: fetchLeads } = useAsyncData({
    fetcher: async () => {
      const result = await getOpportunities();
      // ADR-300: Write to module-level cache so next remount skips spinner
      leadsListCache.set(result);
      return result;
    },
    deps: [refreshTrigger],
    initialData: leadsListCache.get(),
    silentInitialFetch: leadsListCache.hasLoaded(),
  });

  const leads = data ?? [];

  const [editingLead, setEditingLead] = useState<Opportunity | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [emailingLead, setEmailingLead] = useState<Opportunity | null>(null);
  const [showEmailModal, setShowEmailModal] = useState(false);

  const handleEdit = (lead: Opportunity) => { setEditingLead(lead); setShowEditModal(true); };

  const handleEmail = (lead: Opportunity) => {
    if (!lead?.email) { notifyError(t("leads.errors.noEmail")); return; }
    setEmailingLead(lead); setShowEmailModal(true);
  };

  const handleViewProfile = (leadId: string) => { router.push(ENTITY_ROUTES.crm.lead(leadId)); };

  const handleDelete = async (leadId: string, leadName: string) => {
    const confirmDelete = await confirm({
      title: t("leads.confirm.deleteTitle"),
      description: t("leads.confirm.deleteMessage", { name: leadName }),
      variant: 'destructive',
      confirmText: t("leads.confirm.deleteConfirm"),
      cancelText: t("leads.confirm.deleteCancel"),
    });
    if (!confirmDelete) return;
    try {
      await deleteOpportunityWithPolicy({ opportunityId: leadId });
      success(t("leads.status.deleteSuccess", { name: leadName }));
      await fetchLeads();
    } catch (err) {
      notifyError(t("leads.errors.deleteFailed"));
      logger.error('Error deleting lead', { error: err });
    }
  };

  const closeEditModal = () => { setShowEditModal(false); setEditingLead(null); };
  const closeEmailModal = () => { setShowEmailModal(false); setEmailingLead(null); };

  return {
    leads, loading, error, fetchLeads,
    editingLead, showEditModal, emailingLead, showEmailModal,
    handleEdit, handleEmail, handleViewProfile, handleDelete,
    closeEditModal, closeEmailModal,
    confirmDialogProps: dialogProps,
  };
}
