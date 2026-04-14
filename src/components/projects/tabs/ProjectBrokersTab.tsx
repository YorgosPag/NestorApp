'use client';

/**
 * =============================================================================
 * ProjectBrokersTab — Brokerage agreement management at project level
 * =============================================================================
 *
 * Inline form (ΟΧΙ modal) for creating/editing brokerage agreements.
 * Uses ContactSearchManager + TabbedAddNewContactDialog (dialog switching).
 *
 * @module components/projects/tabs/ProjectBrokersTab
 * @enterprise ADR-230 / SPEC-230B
 */

import React, { useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { TabbedAddNewContactDialog } from '@/components/contacts/dialogs/TabbedAddNewContactDialog';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useCompanyId } from '@/hooks/useCompanyId';
import { useAuth } from '@/auth/hooks/useAuth';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTypography } from '@/hooks/useTypography';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';
import { Briefcase, Plus } from 'lucide-react';
import { BrokerageInlineForm } from './brokerage/BrokerageInlineForm';
import { BrokerageAgreementCard } from './brokerage/BrokerageAgreementCard';
import { useBrokerageAgreements } from './brokerage/useBrokerageAgreements';
import { useGuardedBrokerTerminate } from '@/hooks/useGuardedBrokerTerminate';
import '@/lib/design-system';

// =============================================================================
// PROPS
// =============================================================================

interface ProjectBrokersTabProps {
  project?: { id: string; name?: string; [key: string]: unknown };
  data?: { id: string; name?: string; [key: string]: unknown };
}

// =============================================================================
// COMPONENT
// =============================================================================

export function ProjectBrokersTab({ project, data }: ProjectBrokersTabProps) {
  const projectData = project ?? data;
  const projectId = projectData?.id;
  const projectName = (projectData?.name as string) ?? '';

  const { user } = useAuth();
  const { t } = useTranslation(['common', 'common-account', 'common-actions', 'common-empty-states', 'common-navigation', 'common-photos', 'common-sales', 'common-shared', 'common-status', 'common-validation']);
  const typography = useTypography();
  const colors = useSemanticColors();
  const iconSizes = useIconSizes();
  const companyIdResult = useCompanyId();
  const companyId = companyIdResult?.companyId ?? '';

  const hook = useBrokerageAgreements(projectId, t);
  const { runTerminateOperation, ImpactDialog } = useGuardedBrokerTerminate(projectId ?? '');

  const guardedHandleTerminate = useCallback(
    async (id: string) => {
      await runTerminateOperation(id, () => hook.handleTerminate(id));
    },
    [runTerminateOperation, hook.handleTerminate],
  );

  const propertyNameMap = useMemo(
    () => new Map(hook.units.map((u) => [u.id, u.name])),
    [hook.units]
  );

  const projectLevel = useMemo(
    () => hook.agreements.filter((a) => a.scope === 'project'),
    [hook.agreements]
  );

  const unitLevel = useMemo(
    () => hook.agreements.filter((a) => a.scope === 'property'),
    [hook.agreements]
  );

  if (!projectId) return null;

  return (
    <section className="space-y-2">
      {/* Header */}
      <header className="flex items-center justify-between">
        <h3 className={cn("flex items-center gap-2", typography.heading.md)}>
          <Briefcase className={iconSizes.md} />
          {t('sales.legal.brokerageTitle')}
        </h3>
        {!hook.isFormVisible && (
          <Button size="sm" onClick={hook.handleAdd}>
            <Plus className={`${iconSizes.sm} mr-1`} />
            {t('sales.legal.addAgreement')}
          </Button>
        )}
      </header>

      {/* Inline Form */}
      {hook.isFormVisible && (
        <BrokerageInlineForm
          form={hook.form}
          updateForm={hook.updateForm}
          isEditMode={hook.isEditMode}
          projectName={projectName}
          units={hook.units}
          propertyNameMap={propertyNameMap}
          saving={hook.saving}
          canSave={hook.canSave}
          formError={hook.formError}
          validationResult={hook.validationResult}
          isValidating={hook.isValidating}
          onAgentSelect={hook.handleAgentSelect}
          onCreateNew={hook.isEditMode ? undefined : hook.openNewContactDialog}
          onSave={hook.handleSave}
          onCancel={hook.handleCancel}
          t={t}
        />
      )}

      {/* New Contact Dialog */}
      {hook.showNewContactDialog && (
        <TabbedAddNewContactDialog
          open={hook.showNewContactDialog}
          onOpenChange={hook.handleNewContactCancel}
          onContactAdded={hook.handleNewContactCreated}
          allowedContactTypes={['individual', 'company']}
          defaultPersonas={['real_estate_agent']}
        />
      )}

      {/* Loading */}
      {hook.isLoading && (
        <p className={typography.special.secondary}>...</p>
      )}

      {/* Empty state */}
      {!hook.isLoading && hook.agreements.length === 0 && !hook.isFormVisible && (
        <p className={typography.special.secondary}>{t('sales.legal.noBrokerage')}</p>
      )}

      {/* Project-level agreements */}
      {projectLevel.length > 0 && (
        <article className="space-y-2">
          <h4 className={cn(typography.label.sm, colors.text.muted)}>{t('sales.legal.scopeProject')}</h4>
          <ul className="space-y-2">
            {projectLevel.map((a) => (
              <BrokerageAgreementCard
                key={a.id}
                agreement={a}
                t={t}
                propertyName={null}
                onEdit={() => hook.handleEdit(a)}
                onTerminate={() => hook.setTerminatingId(a.id)}
                onRenew={() => { hook.setRenewingId(a.id); hook.setRenewDate(''); }}
                isTerminating={hook.terminatingId === a.id}
                isRenewing={hook.renewingId === a.id}
                renewDate={hook.renewingId === a.id ? hook.renewDate : ''}
                onRenewDateChange={hook.setRenewDate}
                onConfirmTerminate={() => guardedHandleTerminate(a.id)}
                onConfirmRenew={() => hook.handleRenew(a.id)}
                onCancelAction={hook.cancelAction}
                isFormActive={hook.isFormVisible}
                companyId={companyId}
                currentUserId={user?.uid ?? ''}
                projectId={projectId}
                projectName={projectName}
                isExpanded={hook.expandedAgreementId === a.id}
                onToggleExpand={() => hook.setExpandedAgreementId(
                  hook.expandedAgreementId === a.id ? null : a.id
                )}
              />
            ))}
          </ul>
        </article>
      )}

      {/* Unit-level agreements */}
      {unitLevel.length > 0 && (
        <article className="space-y-2">
          <h4 className={cn(typography.label.sm, colors.text.muted)}>{t('sales.legal.scopeUnit')}</h4>
          <ul className="space-y-2">
            {unitLevel.map((a) => (
              <BrokerageAgreementCard
                key={a.id}
                agreement={a}
                t={t}
                propertyName={a.propertyId ? propertyNameMap.get(a.propertyId) ?? a.propertyId : null}
                onEdit={() => hook.handleEdit(a)}
                onTerminate={() => hook.setTerminatingId(a.id)}
                onRenew={() => { hook.setRenewingId(a.id); hook.setRenewDate(''); }}
                isTerminating={hook.terminatingId === a.id}
                isRenewing={hook.renewingId === a.id}
                renewDate={hook.renewingId === a.id ? hook.renewDate : ''}
                onRenewDateChange={hook.setRenewDate}
                onConfirmTerminate={() => guardedHandleTerminate(a.id)}
                onConfirmRenew={() => hook.handleRenew(a.id)}
                onCancelAction={hook.cancelAction}
                isFormActive={hook.isFormVisible}
                companyId={companyId}
                currentUserId={user?.uid ?? ''}
                projectId={projectId}
                projectName={projectName}
                isExpanded={hook.expandedAgreementId === a.id}
                onToggleExpand={() => hook.setExpandedAgreementId(
                  hook.expandedAgreementId === a.id ? null : a.id
                )}
              />
            ))}
          </ul>
        </article>
      )}
      {ImpactDialog}
    </section>
  );
}
