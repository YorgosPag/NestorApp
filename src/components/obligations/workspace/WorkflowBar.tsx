"use client";

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getSpacingClass } from '@/lib/design-system';
import type { ObligationStatus } from '@/types/obligations';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  OBLIGATION_WORKFLOW_LABEL_KEYS,
  OBLIGATION_WORKFLOW_SEQUENCE,
  getAvailableTransitions,
  getStatusToneClass,
} from './workflow';

interface WorkflowBarProps {
  status: ObligationStatus;
  onTransition: (status: ObligationStatus) => void;
  disabled?: boolean;
}

export function WorkflowBar({ status, onTransition, disabled = false }: WorkflowBarProps) {
  const { t } = useTranslation('obligations');

  return (
    <section className={`rounded-lg border ${getSpacingClass('p', 'md')} space-y-4`} aria-label={t('workspace.workflow.title')}>
      <header className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold">{t('workspace.workflow.title')}</h2>
        <Badge className={getStatusToneClass(status)} variant="outline">
          {t(OBLIGATION_WORKFLOW_LABEL_KEYS[status])}
        </Badge>
      </header>

      <ol className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {OBLIGATION_WORKFLOW_SEQUENCE.map((workflowStatus) => {
          const isActive = workflowStatus === status;
          return (
            <li key={workflowStatus}>
              <Badge
                variant="outline"
                className={`w-full justify-center py-1 ${isActive ? getStatusToneClass(workflowStatus) : 'text-muted-foreground'}`}
              >
                {t(OBLIGATION_WORKFLOW_LABEL_KEYS[workflowStatus])}
              </Badge>
            </li>
          );
        })}
      </ol>

      <div className="flex flex-wrap gap-2">
        {getAvailableTransitions(status).map((nextStatus) => (
          <Button
            key={nextStatus}
            type="button"
            size="sm"
            variant="outline"
            disabled={disabled}
            onClick={() => onTransition(nextStatus)}
          >
            {t(OBLIGATION_WORKFLOW_LABEL_KEYS[nextStatus])}
          </Button>
        ))}
      </div>
    </section>
  );
}
