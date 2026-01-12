
"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getOpportunities, deleteOpportunity } from "@/services/opportunities.service";
import toast from "react-hot-toast";
import type { Opportunity } from "@/types/crm";

export function useLeadsList(refreshTrigger?: number | string | boolean | null) {
  const router = useRouter();
  const [leads, setLeads] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string|null>(null);
  const [editingLead, setEditingLead] = useState<Opportunity | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [emailingLead, setEmailingLead] = useState<Opportunity | null>(null);
  const [showEmailModal, setShowEmailModal] = useState(false);

  const fetchLeads = useCallback(async () => {
    try {
      setLoading(true);
      const leadsData = await getOpportunities();
      setLeads(leadsData);
      setError(null);
    } catch (err) {
      setError("Σφάλμα κατά τη φόρτωση των leads");
      console.error("Error fetching leads:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchLeads(); }, [fetchLeads, refreshTrigger]);

  const handleEdit = (lead: Opportunity) => { setEditingLead(lead); setShowEditModal(true); };

  const handleEmail = (lead: Opportunity) => {
    if (!lead?.email) { toast.error("Αυτό το lead δεν έχει email address"); return; }
    setEmailingLead(lead); setShowEmailModal(true);
  };

  const handleViewProfile = (leadId: string) => { router.push(`/crm/leads/${leadId}`); };

  const handleDelete = async (leadId: string, leadName: string) => {
    const confirmDelete = window.confirm(
      `Είστε σίγουροι ότι θέλετε να διαγράψετε το lead "${leadName}"?\n\nΑυτή η ενέργεια δεν μπορεί να αναιρεθεί.`
    );
    if (!confirmDelete) return;
    try {
      await deleteOpportunity(leadId);
      toast.success(`✅ Το lead "${leadName}" διαγράφηκε επιτυχώς!`);
      setLeads(prev => prev.filter(l => l.id !== leadId));
    } catch (error) {
      toast.error("❌ Σφάλμα κατά τη διαγραφή lead");
      console.error("Error deleting lead:", error);
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
