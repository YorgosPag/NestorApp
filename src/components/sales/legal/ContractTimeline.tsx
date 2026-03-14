'use client';

/**
 * ContractTimeline — Horizontal 3-step stepper
 * Shows: Προσύμφωνο → Οριστικό → Εξοφλητήριο
 *
 * @enterprise ADR-230 (SPEC-230D Task D)
 */

import React from 'react';
import { Check, Circle, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { LegalContract, ContractPhase } from '@/types/legal-contracts';

// ============================================================================
// TYPES
// ============================================================================

interface ContractTimelineProps {
  contracts: LegalContract[];
}

interface StepConfig {
  phase: ContractPhase;
  labelKey: string;
  defaultLabel: string;
}

const STEPS: StepConfig[] = [
  { phase: 'preliminary', labelKey: 'sales.legal.preliminary', defaultLabel: 'Προσύμφωνο' },
  { phase: 'final', labelKey: 'sales.legal.final', defaultLabel: 'Οριστικό' },
  { phase: 'payoff', labelKey: 'sales.legal.payoff', defaultLabel: 'Εξοφλητήριο' },
];

// ============================================================================
// HELPERS
// ============================================================================

function getStepState(
  phase: ContractPhase,
  contracts: LegalContract[]
): 'completed' | 'active' | 'pending' {
  const contract = contracts.find((c) => c.phase === phase);
  if (!contract) return 'pending';
  if (contract.status === 'signed' || contract.status === 'completed') return 'completed';
  return 'active';
}

// ============================================================================
// COMPONENT
// ============================================================================

export function ContractTimeline({ contracts }: ContractTimelineProps) {
  const { t } = useTranslation('common');

  return (
    <nav aria-label="Contract phases" className="flex items-center gap-2 py-3">
      {STEPS.map((step, index) => {
        const state = getStepState(step.phase, contracts);

        return (
          <React.Fragment key={step.phase}>
            {/* Step */}
            <figure className="flex flex-col items-center gap-1 min-w-0">
              <span
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full border-2 transition-colors',
                  state === 'completed' && 'border-green-600 bg-green-600 text-white',
                  state === 'active' && 'border-blue-600 bg-blue-50 text-blue-600',
                  state === 'pending' && 'border-muted-foreground/30 bg-muted text-muted-foreground/50'
                )}
              >
                {state === 'completed' && <Check className="h-4 w-4" />}
                {state === 'active' && <Circle className="h-3 w-3 fill-current" />}
                {state === 'pending' && <Minus className="h-4 w-4" />}
              </span>
              <span
                className={cn(
                  'text-[10px] font-medium text-center leading-tight max-w-[5rem] truncate',
                  state === 'completed' && 'text-green-700',
                  state === 'active' && 'text-blue-700',
                  state === 'pending' && 'text-muted-foreground/50'
                )}
              >
                {t(step.labelKey, { defaultValue: step.defaultLabel })}
              </span>
            </figure>

            {/* Connector line */}
            {index < STEPS.length - 1 && (
              <span
                className={cn(
                  'flex-1 h-0.5 rounded-full',
                  getStepState(STEPS[index + 1].phase, contracts) !== 'pending'
                    ? 'bg-green-400'
                    : 'bg-muted-foreground/20'
                )}
              />
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}
