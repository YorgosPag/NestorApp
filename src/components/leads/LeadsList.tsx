
"use client";
import { User } from "lucide-react";
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { AnimatedSpinner } from '@/subapps/dxf-viewer/components/modal/ModalLoadingStates';
import { EditOpportunityModal } from "@/components/crm/dashboard/EditOpportunityModal";
import SendEmailModal from "@/components/email/SendEmailModal";
import { useLeadsList } from "./hooks/useLeadsList";
import { LeadCard } from "./LeadCard";
import { getStatusColor } from "./utils/formatters";
import { formatDateTime as formatDate } from '@/lib/intl-utils';
import type { Opportunity } from "@/types/crm";
import { HOVER_BACKGROUND_EFFECTS, HOVER_TEXT_EFFECTS } from '@/components/ui/effects/hover-effects';

export default function LeadsList({ refreshTrigger }: { refreshTrigger?: any }) {
  const iconSizes = useIconSizes();
  const { getStatusBorder } = useBorderTokens();
  const colors = useSemanticColors();
  const {
    leads, loading, error, fetchLeads,
    editingLead, showEditModal, emailingLead, showEmailModal,
    handleEdit, handleEmail, handleViewProfile, handleDelete,
    closeEditModal, closeEmailModal,
  } = useLeadsList(refreshTrigger);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <AnimatedSpinner size="large" className="mx-auto mb-2" />
          <p className={`${colors.text.muted}`}>Φόρτωση leads...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${colors.bg.error} ${getStatusBorder('error')} rounded-lg p-4`}>
        <p className={`${colors.text.error}`}>{error}</p>
        <button onClick={fetchLeads} className={`mt-2 px-3 py-1 ${colors.bg.error} ${colors.text.inverted} rounded text-sm transition-colors ${HOVER_BACKGROUND_EFFECTS.RED_BUTTON}`}>
          Δοκιμή ξανά
        </button>
      </div>
    );
  }

  if (leads.length === 0) {
    return (
      <div className="text-center py-12">
        <User className={`${iconSizes.xl3} ${colors.text.muted} mx-auto mb-4`} />
        <h3 className={`text-lg font-medium ${colors.text.foreground} mb-2`}>Δεν υπάρχουν leads</h3>
        <p className={`${colors.text.muted}`}>Προσθέστε το πρώτο σας lead για να ξεκινήσετε!</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Leads ({leads.length})</h3>
          <button onClick={fetchLeads} className={`text-sm ${HOVER_TEXT_EFFECTS.BLUE}`}>Ανανέωση</button>
        </div>

        <div className="grid gap-4">
          {leads.map(lead => (
            <LeadCard
              key={lead.id}
              lead={lead}
              onEmail={handleEmail}
              onEdit={handleEdit}
              onView={handleViewProfile}
              onDelete={handleDelete}
              formatDate={formatDate}
              getStatusColor={getStatusColor}
            />
          ))}
        </div>
      </div>

      {editingLead && (
        <EditOpportunityModal
          opportunity={editingLead}
          isOpen={showEditModal}
          onClose={closeEditModal}
          onLeadUpdated={fetchLeads}
        />
      )}

      {emailingLead && (
        <SendEmailModal
            lead={emailingLead}
            isOpen={showEmailModal}
            onClose={closeEmailModal}
            onEmailSent={() => {/* ίδια ροή, optional log */}}
        />
      )}
    </>
  );
}
