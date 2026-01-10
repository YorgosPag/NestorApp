
'use client';

import React, { useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, User, Mail, Phone, Tag, Calendar, Edit3, Send, PhoneCall, Plus, Clock, CheckCircle } from 'lucide-react';
import { TRANSITION_PRESETS, INTERACTIVE_PATTERNS } from '@/components/ui/effects';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
// 🏢 ENTERPRISE: Import from canonical location
import { Spinner as AnimatedSpinner } from '@/components/ui/spinner';
import { Toaster } from 'react-hot-toast';

import CommunicationsHistory from '@/components/CommunicationsHistory';
import SendEmailModal from '@/components/email/SendEmailModal';
import CreateTaskModal from '@/components/crm/dashboard/dialogs/CreateTaskModal';
import { EditOpportunityModal } from '@/components/crm/dashboard/EditOpportunityModal';

import { ContactCard } from './components/ContactCard';
import { QuickActions } from './components/QuickActions';
import { TasksSummary } from './components/TasksSummary';
import { UpcomingTasks } from './components/UpcomingTasks';
import { useLead } from './hooks/useLead';
import { useLeadTasks } from './hooks/useLeadTasks';

export default function LeadProfilePage() {
  const iconSizes = useIconSizes();
  const { getStatusBorder } = useBorderTokens();
  const colors = useSemanticColors();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const { lead, loading: loadingLead, error: leadError, refetch: refetchLead } = useLead(id);
  const { tasks, loading: loadingTasks, refetch: refetchTasks } = useLeadTasks(id);

  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);

  const handleLeadUpdated = useCallback(() => {
    refetchLead();
  }, [refetchLead]);

  const handleTaskCreated = useCallback(() => {
    refetchTasks();
  }, [refetchTasks]);

  const handleGoBack = () => {
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push('/crm/leads');
    }
  };

  if (loadingLead) {
    return (
      <div className={`min-h-screen ${colors.bg.secondary} flex items-center justify-center`}>
        <div className="text-center">
          <AnimatedSpinner size="large" variant="info" className="mx-auto mb-2" />
          <p className={`${colors.text.muted}`}>Φόρτωση lead...</p>
        </div>
      </div>
    );
  }

  if (leadError || !lead) {
    return (
      <div className={`min-h-screen ${colors.bg.secondary}`}>
        <div className="container mx-auto px-6 py-8">
          <div className={`${colors.bg.errorLight} ${getStatusBorder('error')} rounded-lg p-8 text-center`}>
            <h2 className={`text-xl font-semibold ${colors.text.error} mb-2`}>Σφάλμα</h2>
            <p className={`${colors.text.error} mb-4`}>{leadError || 'Το lead δεν βρέθηκε'}</p>
            <button
              onClick={() => router.push('/crm/leads')}
              className={`px-4 py-2 ${colors.bg.info} ${colors.text.onInfo} rounded-lg ${INTERACTIVE_PATTERNS.PRIMARY_HOVER}`}
            >
              Επιστροφή στα Leads
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <Toaster position="top-right" />
      <main className={`min-h-screen ${colors.bg.secondary}`}>
        <header className={`${colors.bg.primary} shadow-sm border-b`}>
          <div className="px-6 py-4">
            <nav className="flex items-center gap-4" aria-label="Πλοήγηση lead profile">
              <button
                onClick={handleGoBack}
                className={`p-2 rounded-lg ${INTERACTIVE_PATTERNS.SUBTLE_HOVER} ${TRANSITION_PRESETS.FAST_COLORS}`}
                aria-label="Επιστροφή"
              >
                <ArrowLeft className={iconSizes.md} />
              </button>
              <div className="flex items-center gap-3">
                <User className={`${iconSizes.lg} ${colors.text.info}`} />
                <div>
                  <h1 className={`text-2xl font-bold ${colors.text.primary}`}>{lead.fullName}</h1>
                  <p className={`${colors.text.muted}`}>Lead Profile</p>
                </div>
              </div>
            </nav>
          </div>
        </header>

        <section className="container mx-auto px-6 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <aside className="lg:col-span-1 space-y-6" aria-label="Στοιχεία επαφής και γρήγορες ενέργειες">
              <ContactCard lead={lead} />
              {lead.notes && (
                <article className={`${colors.bg.primary} rounded-lg shadow p-6`}>
                  <h4 className="font-medium mb-2">Σημειώσεις</h4>
                  <p className={`text-sm ${colors.text.secondary} ${colors.bg.secondary} rounded p-3`}>{lead.notes}</p>
                </article>
              )}
              <QuickActions lead={lead} onEdit={() => setShowEditModal(true)} onNewTask={() => setShowTaskModal(true)} onSendEmail={() => setShowEmailModal(true)} />
              <TasksSummary tasks={tasks} loading={loadingTasks} />
            </aside>

            <section className="lg:col-span-2 space-y-6" aria-label="Εργασίες και ιστορικό επικοινωνίας">
              <UpcomingTasks tasks={tasks} router={router} />
              <article className={`${colors.bg.primary} rounded-lg shadow p-6`}>
                <CommunicationsHistory contactId={lead.id} />
              </article>
            </section>
          </div>
        </section>
      </main>

      <SendEmailModal
        lead={lead}
        isOpen={showEmailModal}
        onClose={() => setShowEmailModal(false)}
        onEmailSent={() => console.log('Email sent')}
      />
      {lead && (
        <EditOpportunityModal
          opportunity={lead}
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          onLeadUpdated={handleLeadUpdated}
        />
      )}
      <CreateTaskModal
        isOpen={showTaskModal}
        onClose={() => setShowTaskModal(false)}
        onTaskCreated={handleTaskCreated}
        preselectedLead={lead}
      />
    </>
  );
}
