'use client';

import React, { useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, User } from 'lucide-react';
import { TRANSITION_PRESETS, INTERACTIVE_PATTERNS } from '@/components/ui/effects';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { PageLoadingState, PageErrorState } from '@/core/states';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { cn, getResponsiveClass } from '@/lib/design-system';
import { createModuleLogger } from '@/lib/telemetry';

import CommunicationsHistory from '@/components/CommunicationsHistory';
import SendEmailModal from '@/components/email/SendEmailModal';
import CreateTaskModal from '@/components/crm/dashboard/dialogs/CreateTaskModal';
import { EditOpportunityModal } from '@/components/crm/dashboard/EditOpportunityModal';

import { ContactCard } from './lead-detail/ContactCard';
import { QuickActions } from './lead-detail/QuickActions';
import { TasksSummary } from './lead-detail/TasksSummary';
import { UpcomingTasks } from './lead-detail/UpcomingTasks';
import { useLead } from './lead-detail/hooks/useLead';
import { useLeadTasks } from './lead-detail/hooks/useLeadTasks';

const logger = createModuleLogger('crm/lead-profile');

export function LeadDetailPageContent() {
  const iconSizes = useIconSizes();
  const { getStatusBorder } = useBorderTokens();
  const colors = useSemanticColors();
  const spacing = useSpacingTokens();
  const { t } = useTranslation(['crm', 'crm-inbox']);
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

  // ADR-229 Phase 2: Centralized loading/error states
  if (loadingLead) {
    return <PageLoadingState icon={User} message={t('leadDetails.loading')} layout="fullscreen" />;
  }

  if (leadError || !lead) {
    return (
      <PageErrorState
        title={t('leadDetails.errorTitle')}
        message={leadError || t('leadDetails.notFound')}
        onRetry={() => router.push('/crm/leads')}
        retryLabel={t('leadDetails.backToLeads')}
        layout="fullscreen"
      />
    );
  }

  return (
    <>
      <main className={cn('min-h-screen', colors.bg.secondary)}>
        <header className={cn(colors.bg.primary, 'shadow-sm border-b')}>
          <div className={cn(spacing.padding.x.lg, spacing.padding.y.md)}>
            <nav className={cn('flex items-center', spacing.gap.md)} aria-label={t('leadDetails.navAria')}>
              <button
                onClick={handleGoBack}
                className={cn('p-2 rounded-lg', INTERACTIVE_PATTERNS.SUBTLE_HOVER, TRANSITION_PRESETS.FAST_COLORS)}
                aria-label={t('leadDetails.backAria')}
              >
                <ArrowLeft className={iconSizes.md} />
              </button>
              <div className={cn('flex items-center', spacing.gap.sm)}>
                <User className={cn(iconSizes.lg, colors.text.info)} />
                <div>
                  <h1 className={cn('text-2xl font-bold', colors.text.primary)}>{lead.fullName}</h1>
                  <p className={colors.text.muted}>{t('leadDetails.headerTitle')}</p>
                </div>
              </div>
            </nav>
          </div>
        </header>

        <section className={cn('container mx-auto', spacing.padding.x.lg, spacing.padding.y.lg)}>
          <div className={cn('grid grid-cols-1 lg:grid-cols-3', spacing.gap.lg)}>
            <aside className={cn(getResponsiveClass('lg', 'col-span-1'), spacing.spaceBetween.lg)} aria-label={t('leadDetails.contactSectionAria')}>
              <ContactCard lead={lead} />
              {lead.notes && (
                <article className={cn(colors.bg.primary, 'rounded-lg shadow', spacing.padding.lg)}>
                  <h4 className={cn('font-medium', spacing.margin.bottom.sm)}>{t('leadDetails.notesTitle')}</h4>
                  <p className={cn('text-sm', colors.text.secondary, colors.bg.secondary, 'rounded', spacing.padding.sm)}>
                    {lead.notes}
                  </p>
                </article>
              )}
              <QuickActions
                lead={lead}
                onEdit={() => setShowEditModal(true)}
                onNewTask={() => setShowTaskModal(true)}
                onSendEmail={() => setShowEmailModal(true)}
              />
              <TasksSummary tasks={tasks} loading={loadingTasks} />
            </aside>

            <section className={cn(getResponsiveClass('lg', 'col-span-2'), spacing.spaceBetween.lg)} aria-label={t('leadDetails.tasksSectionAria')}>
              <UpcomingTasks tasks={tasks} router={router} />
              <article className={cn(colors.bg.primary, 'rounded-lg shadow', spacing.padding.lg)}>
                <CommunicationsHistory contactId={lead.id ?? ''} />
              </article>
            </section>
          </div>
        </section>
      </main>

      <SendEmailModal
        lead={lead ? { id: lead.id || '', fullName: lead.fullName || '', email: lead.email || '' } : null}
        isOpen={showEmailModal}
        onClose={() => setShowEmailModal(false)}
        onEmailSent={() => logger.info('Lead email sent', { leadId: lead?.id })}
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
