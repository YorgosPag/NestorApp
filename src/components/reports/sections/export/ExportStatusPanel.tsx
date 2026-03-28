'use client';

/**
 * @module reports/sections/export/ExportStatusPanel
 * @enterprise ADR-265 Phase 13 — Export job status tracker
 */

import '@/lib/design-system';
import { useTranslation } from 'react-i18next';
import { useSemanticColors } from '@/hooks/useSemanticColors';
import { CheckCircle, Loader2, AlertCircle, Clock } from 'lucide-react';
import { ReportSection, ReportEmptyState } from '@/components/reports/core';
import { cn } from '@/lib/utils';
import type { ExportJob } from './types';

interface ExportStatusPanelProps {
  jobs: ExportJob[];
}

const STATUS_ICONS = {
  pending: Clock,
  exporting: Loader2,
  done: CheckCircle,
  error: AlertCircle,
} as const;

export function ExportStatusPanel({ jobs }: ExportStatusPanelProps) {
  const { t } = useTranslation('reports');
  const colors = useSemanticColors();

  if (jobs.length === 0) {
    return (
      <ReportSection title={t('exportCenter.status.title')} id="export-status">
        <ReportEmptyState type="no-data" />
      </ReportSection>
    );
  }

  return (
    <ReportSection
      title={t('exportCenter.status.title')}
      description={t('exportCenter.status.description')}
      id="export-status"
    >
      <ul className="space-y-2">
        {jobs.map((job, i) => {
          const Icon = STATUS_ICONS[job.status];
          const isSpinning = job.status === 'exporting';

          return (
            <li
              key={`${job.domain}-${job.format}-${i}`}
              className={cn(
                'flex items-center gap-3 rounded-md border px-3 py-2',
                colors.bg.card,
                colors.border.default,
              )}
            >
              <Icon
                className={cn(
                  'h-4 w-4 shrink-0',
                  job.status === 'done' && colors.text.success,
                  job.status === 'error' && colors.text.error,
                  job.status === 'exporting' && colors.text.info,
                  job.status === 'pending' && colors.text.muted,
                  isSpinning && 'animate-spin',
                )}
              />
              <span className={cn('text-sm font-medium', colors.text.default)}>
                {t(`nav.${job.domain === 'executive' ? 'overview' : job.domain}`)}
              </span>
              <span className={cn('text-xs uppercase', colors.text.muted)}>
                {job.format}
              </span>
              <span className={cn('ml-auto text-xs', colors.text.muted)}>
                {t(`exportCenter.status.${job.status}`)}
              </span>
              {job.error && (
                <span className={cn('text-xs', colors.text.error)}>
                  {job.error}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </ReportSection>
  );
}
