
'use client';

import React, { useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, User, Mail, Phone, Tag, Calendar, Edit3, Send, PhoneCall, Plus, Clock, CheckCircle } from 'lucide-react';
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <p className="text-gray-600">Φόρτωση lead...</p>
        </div>
      </div>
    );
  }

  if (leadError || !lead) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-6 py-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-8 text-center">
            <h2 className="text-xl font-semibold text-red-800 mb-2">Σφάλμα</h2>
            <p className="text-red-600 mb-4">{leadError || 'Το lead δεν βρέθηκε'}</p>
            <button
              onClick={() => router.push('/crm/leads')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
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
      <div className="min-h-screen bg-gray-50 dark:bg-background">
        <div className="bg-white dark:bg-card shadow-sm border-b">
          <div className="px-6 py-4">
            <div className="flex items-center gap-4">
              <button
                onClick={handleGoBack}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="Επιστροφή"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-3">
                <User className="w-6 h-6 text-blue-600" />
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-foreground">{lead.fullName}</h1>
                  <p className="text-gray-600 dark:text-muted-foreground">Lead Profile</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="container mx-auto px-6 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1 space-y-6">
              <ContactCard lead={lead} />
              {lead.notes && (
                <div className="bg-white dark:bg-card rounded-lg shadow p-6">
                  <h4 className="font-medium mb-2">Σημειώσεις</h4>
                  <p className="text-sm text-gray-700 bg-gray-50 dark:bg-muted/50 rounded p-3">{lead.notes}</p>
                </div>
              )}
              <QuickActions lead={lead} onEdit={() => setShowEditModal(true)} onNewTask={() => setShowTaskModal(true)} onSendEmail={() => setShowEmailModal(true)} />
              <TasksSummary tasks={tasks} loading={loadingTasks} />
            </div>

            <div className="lg:col-span-2 space-y-6">
              <UpcomingTasks tasks={tasks} router={router} />
              <div className="bg-white dark:bg-card rounded-lg shadow p-6">
                <CommunicationsHistory contactId={lead.id} />
              </div>
            </div>
          </div>
        </div>
      </div>

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
