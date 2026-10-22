'use client';

/**
 * @fileoverview **Τα πέντε βήματα μιας παράδοσης** — πρόσκληση · αποδοχή · ολοκλήρωση · αρχεία · Πρωτόκολλο (ADR-916 §5.15).
 * @related handover-office-presentation.ts (εικονίδιο + τόνος ανά κατάσταση) · lib/property-handover/handover-office-status.ts
 * @module components/property-handover-office/HandoverStepTrack
 *
 * ♿ Η κατάσταση λέγεται **με λέξη** (για αναγνώστες οθόνης) **και** με εικονίδιο — ποτέ μόνο με χρώμα (WCAG 1.4.1).
 */

import React from 'react';

import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/hooks/useSemanticColors';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { HANDOVER_OFFICE_STEPS, type HandoverOfficeStatus } from '@/types/property-handover';

import { HANDOVER_STEP_PRESENTATION } from './handover-office-presentation';

const K = 'properties-detail:handover';

export function HandoverStepTrack({ steps }: { readonly steps: HandoverOfficeStatus['steps'] }): React.ReactElement {
  const { t } = useTranslation(['properties-detail']);
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  return (
    <ol aria-label={t(`${K}.stepsLabel`)} className="m-0 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 text-sm">
      {HANDOVER_OFFICE_STEPS.map((step) => {
        const state = steps[step];
        const { Icon, tone } = HANDOVER_STEP_PRESENTATION[state];
        return (
          <li key={step} data-step={step} data-state={state} className="inline-flex items-center gap-1.5">
            <Icon className={cn(iconSizes.sm, colors.text[tone])} aria-hidden="true" />
            <span className={state === 'pending' ? 'text-muted-foreground' : 'text-foreground'}>{t(`${K}.step.${step}`)}</span>
            <span className="sr-only">{t(`${K}.stepState.${state}`)}</span>
          </li>
        );
      })}
    </ol>
  );
}
