'use client';

/**
 * LoanStatusTimeline — Vertical stepper showing 15-stage loan progress
 * Shows: completed (checkmark), current (spinner), future (circle)
 *
 * @enterprise ADR-234 Phase 2 — SPEC-234C
 */

import React from 'react';
import { CheckCircle2, Circle, Loader2 } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { LoanTrackingStatus } from '@/types/loan-tracking';
import { LOAN_STATUS_ORDER } from '@/types/loan-tracking';

// ============================================================================
// COMPONENT
// ============================================================================

interface LoanStatusTimelineProps {
  status: LoanTrackingStatus;
  /** Compact mode: show only current ± 1 step */
  compact?: boolean;
}

export function LoanStatusTimeline({ status, compact = false }: LoanStatusTimelineProps) {
  const { t } = useTranslation('payments');

  // Terminal states: show badge only
  if (status === 'rejected' || status === 'cancelled') {
    return (
      <aside className="text-xs text-destructive font-medium py-1">
        {t(`loanTracking.status.${status}`, { defaultValue: status })}
      </aside>
    );
  }

  const currentIndex = LOAN_STATUS_ORDER.indexOf(status);

  // Filter steps for compact mode
  const steps = compact
    ? LOAN_STATUS_ORDER.filter((_, i) => {
        // Show: first completed, current-1, current, current+1
        if (i === 0 && currentIndex > 0) return true; // first step always
        return Math.abs(i - currentIndex) <= 1;
      })
    : LOAN_STATUS_ORDER.filter(s => s !== 'not_applicable');

  return (
    <nav aria-label="Loan progress" className="space-y-0">
      {steps.map((step) => {
        const stepIndex = LOAN_STATUS_ORDER.indexOf(step);
        const isCompleted = stepIndex < currentIndex;
        const isCurrent = stepIndex === currentIndex;

        return (
          <figure key={step} className="flex items-center gap-2 py-0.5">
            {isCompleted && (
              <CheckCircle2 className="h-3 w-3 text-green-600 shrink-0" />
            )}
            {isCurrent && (
              <Loader2 className="h-3 w-3 text-blue-600 animate-spin shrink-0" />
            )}
            {!isCompleted && !isCurrent && (
              <Circle className="h-3 w-3 text-muted-foreground/40 shrink-0" />
            )}
            <figcaption className={`text-[10px] leading-tight ${
              isCurrent ? 'font-semibold text-foreground'
                : isCompleted ? 'text-muted-foreground'
                  : 'text-muted-foreground/50'
            }`}>
              {t(`loanTracking.status.${step}`, { defaultValue: step })}
            </figcaption>
          </figure>
        );
      })}
    </nav>
  );
}
