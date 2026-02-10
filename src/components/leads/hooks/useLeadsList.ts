
"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getOpportunities, deleteOpportunity } from "@/services/opportunities.service";
import toast from "react-hot-toast";
import type { Opportunity } from "@/types/crm";
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('useLeadsList');

export function useLeadsList(refreshTrigger?: number | string | boolean | null) {
  const router = useRouter();
  const [leads, setLeads] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string|null>(null);
  const [editingLead, setEditingLead] = useState<Opportunity | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [emailingLead, setEmailingLead] = useState<Opportunity | null>(null);
  const [showEmailModal, setShowEmailModal] = useState(false);

  // 🌐 i18n: All messages converted to i18n keys - 2026-01-18
  const fetchLeads = useCallback(async () => {
    try {
      setLoading(true);
      const leadsData = await getOpportunities();
      setLeads(leadsData);
      setError(null);
    } catch (err) {
      setError("leads.errors.loadFailed");
      logger.error('Error fetching leads', { error: err });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchLeads(); }, [fetchLeads, refreshTrigger]);

  const handleEdit = (lead: Opportunity) => { setEditingLead(lead); setShowEditModal(true); };

  const handleEmail = (lead: Opportunity) => {
    if (!lead?.email) { toast.error("leads.errors.noEmail"); return; }
    setEmailingLead(lead); setShowEmailModal(true);
  };

  const handleViewProfile = (leadId: string) => { router.push(`/crm/leads/${leadId}`); };

  const handleDelete = async (leadId: string, leadName: string) => {
    // 🌐 i18n: Note - confirm dialog requires runtime translation in component
    const confirmDelete = window.confirm(
      `leads.confirm.deleteMessage`
    );
    if (!confirmDelete) return;
    try {
      await deleteOpportunity(leadId);
      toast.success("leads.status.deleteSuccess");
      setLeads(prev => prev.filter(l => l.id !== leadId));
    } catch (error) {
      toast.error("leads.errors.deleteFailed");
      logger.error('Error deleting lead', { error });
    }
  };

  const closeEditModal = () => { setShowEditModal(false); setEditingLead(null); };
  const closeEmailModal = () => { setShowEmailModal(false); setEmailingLead(null); };

  return {
    leads, loading, error, fetchLeads,
    editingLead, showEditModal, emailingLead, showEmailModal,
    handleEdit, handleEmail, handleViewProfile, handleDelete,
    closeEditModal, closeEmailModal,
  };
}
