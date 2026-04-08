/**
 * =============================================================================
 * BrokerageAgreementCard — Single agreement display with actions
 * =============================================================================
 *
 * @module components/projects/tabs/brokerage/BrokerageAgreementCard
 * @enterprise ADR-230 / SPEC-230B
 */

import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EntityFilesManager } from '@/components/shared/files';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTypography } from '@/hooks/useTypography';
import { cn } from '@/lib/utils';
import { Pencil, XCircle, RefreshCw, X, Paperclip } from 'lucide-react';
import type { BrokerageAgreement } from '@/types/brokerage';
import { ENTITY_TYPES } from '@/config/domain-constants';
import { getStatusBadge, formatCommission } from './brokerage-helpers';
import '@/lib/design-system';

// =============================================================================
// PROPS
// =============================================================================

interface BrokerageAgreementCardProps {
  agreement: BrokerageAgreement;
  t: (key: string) => string;
  propertyName: string | null;
  onEdit: () => void;
  onTerminate: () => void;
  onRenew: () => void;
  isTerminating: boolean;
  isRenewing: boolean;
  renewDate: string;
  onRenewDateChange: (date: string) => void;
  onConfirmTerminate: () => void;
  onConfirmRenew: () => void;
  onCancelAction: () => void;
  isFormActive: boolean;
  companyId: string;
  currentUserId: string;
  projectId: string;
  projectName: string;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function BrokerageAgreementCard({
  agreement,
  t,
  propertyName,
  onEdit,
  onTerminate,
  onRenew,
  isTerminating,
  isRenewing,
  renewDate,
  onRenewDateChange,
  onConfirmTerminate,
  onConfirmRenew,
  onCancelAction,
  isFormActive,
  companyId,
  currentUserId,
  projectId,
  projectName,
  isExpanded,
  onToggleExpand,
}: BrokerageAgreementCardProps) {
  const iconSizes = useIconSizes();
  const typography = useTypography();
  const status = getStatusBadge(agreement, t);
  const isActive = agreement.status === 'active' &&
    (!agreement.endDate || new Date(agreement.endDate) >= new Date());

  return (
    <li className="rounded-lg border p-2 space-y-2">
      <header className="flex items-center justify-between">
        <nav className="flex items-center gap-2">
          <span className={typography.label.sm}>{agreement.agentName}</span>
          <Badge variant={status.variant}>{status.label}</Badge>
          {agreement.exclusivity === 'exclusive' && (
            <Badge variant="outline" className="text-orange-600 border-orange-300">
              {t('sales.legal.exclusive')}
            </Badge>
          )}
        </nav>
        <nav className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleExpand}
            title={t('sales.legal.attachFiles')}
          >
            <Paperclip className={`${iconSizes.xs} ${isExpanded ? 'text-primary' : ''}`} />
          </Button>
          {isActive && !isFormActive && (
            <>
              <Button variant="ghost" size="sm" onClick={onEdit} title={t('sales.legal.editAgreement')}>
                <Pencil className={iconSizes.xs} />
              </Button>
              <Button variant="ghost" size="sm" onClick={onRenew} title={t('sales.legal.renewAgreement')}>
                <RefreshCw className={iconSizes.xs} />
              </Button>
              <Button variant="ghost" size="sm" onClick={onTerminate} title={t('sales.legal.terminateAgreement')}>
                <XCircle className={`${iconSizes.xs} text-destructive`} />
              </Button>
            </>
          )}
        </nav>
      </header>

      <nav className={cn("flex flex-wrap gap-x-4 gap-y-1", typography.special.tertiary)}>
        <span>{t('sales.legal.commission')}: {formatCommission(agreement)}</span>
        <span>{t('sales.legal.startDate')}: {agreement.startDate.split('T')[0]}</span>
        <span>
          {t('sales.legal.endDate')}:{' '}
          {agreement.endDate ? agreement.endDate.split('T')[0] : t('sales.legal.indefinite')}
        </span>
        {propertyName && <span>{propertyName}</span>}
      </nav>

      {agreement.notes && (
        <p className={cn(typography.special.tertiary, "italic")}>{agreement.notes}</p>
      )}

      {/* Inline terminate confirmation */}
      {isTerminating && (
        <footer className="flex items-center gap-2 rounded bg-destructive/10 p-2">
          <p className={cn(typography.body.sm, "flex-1")}>
            {/* eslint-disable-next-line custom/no-hardcoded-strings */}
            {t('sales.legal.terminateConfirm').replace('{{name}}', agreement.agentName)}
          </p>
          <Button size="sm" variant="destructive" onClick={onConfirmTerminate}>
            {t('sales.legal.terminateAgreement')}
          </Button>
          <Button size="sm" variant="outline" onClick={onCancelAction}>
            {t('buttons.cancel')}
          </Button>
        </footer>
      )}

      {/* Inline renew */}
      {isRenewing && (
        <footer className="flex items-center gap-2 rounded bg-blue-50 p-2 dark:bg-blue-950/20">
          <label className={typography.body.sm}>{t('sales.legal.renewEndDate')}:</label>
          <input
            type="date"
            value={renewDate}
            onChange={(e) => onRenewDateChange(e.target.value)}
            className={cn("h-8 rounded border px-2", typography.body.sm)}
          />
          <Button size="sm" onClick={onConfirmRenew} disabled={!renewDate}>
            {t('sales.legal.renewAgreement')}
          </Button>
          <Button size="sm" variant="outline" onClick={onCancelAction}>
            {t('buttons.cancel')}
          </Button>
        </footer>
      )}

      {/* Expandable file upload */}
      {isExpanded && companyId && (
        <section className="relative rounded border bg-muted/20 p-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleExpand}
            className="absolute top-1 right-1 h-7 w-7 p-0 z-10"
            aria-label="Close"
          >
            <X className={iconSizes.sm} />
          </Button>
          <EntityFilesManager
            companyId={companyId}
            currentUserId={currentUserId}
            entityType={ENTITY_TYPES.PROJECT}
            entityId={projectId}
            entityLabel={`${projectName} — ${agreement.agentName}`}
            domain="brokerage"
            category="contracts"
            purpose={agreement.id}
            allowedEntryPointIds={['brokerage-agreement', 'voice-note', 'generic-project-doc']}
          />
        </section>
      )}
    </li>
  );
}
