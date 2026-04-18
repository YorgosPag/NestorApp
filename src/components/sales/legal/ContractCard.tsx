'use client';

/**
 * ContractCard — Expandable card per contract with FSM action buttons
 *
 * @enterprise ADR-230 (SPEC-230D Task E)
 */

import React, { useState, useCallback } from 'react';
import {
  FileSignature,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  User,
  Euro,
  CalendarDays,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useNotifications } from '@/providers/NotificationProvider';
import type { LegalContract, ContractStatus } from '@/types/legal-contracts';
import { CONTRACT_STATUS_TRANSITIONS } from '@/types/legal-contracts';
import '@/lib/design-system';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import {
  formatCurrency as formatEUR,
  formatDate as formatLocaleDate,
} from '@/lib/intl-utils';

// ============================================================================
// TYPES
// ============================================================================

interface ContractCardProps {
  contract: LegalContract;
  onTransition: (contractId: string, targetStatus: ContractStatus) => Promise<{ success: boolean; error?: string }>;
}

// ============================================================================
// HELPERS
// ============================================================================

const PHASE_KEYS: Record<string, string> = {
  preliminary: 'sales.legal.preliminary',
  final: 'sales.legal.final',
  payoff: 'sales.legal.payoff',
};

const STATUS_KEYS: Record<ContractStatus, string> = {
  draft: 'sales.legal.draft',
  pending_signature: 'sales.legal.pendingSig',
  signed: 'sales.legal.signed',
  completed: 'sales.legal.completed',
};

const STATUS_COLORS: Record<ContractStatus, string> = {
  draft: 'bg-gray-100 text-gray-700',
  pending_signature: 'bg-yellow-100 text-yellow-800',
  signed: 'bg-green-100 text-green-800',
  completed: 'bg-blue-100 text-blue-800',
};

const NEXT_STATUS_KEYS: Record<ContractStatus, string> = {
  draft: 'sales.legal.sendForSignature',
  pending_signature: 'sales.legal.markAsSigned',
  signed: 'sales.legal.complete',
  completed: '',
};

function formatDateOrDash(iso: string | null): string {
  if (!iso) return '—';
  return formatLocaleDate(iso);
}

function formatPriceOrDash(amount: number | null): string {
  if (amount === null || amount === undefined) return '—';
  return formatEUR(amount, 'EUR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ============================================================================
// COMPONENT
// ============================================================================

export function ContractCard({ contract, onTransition }: ContractCardProps) {
  const colors = useSemanticColors();
  const { t } = useTranslation(['common', 'common-account', 'common-actions', 'common-empty-states', 'common-navigation', 'common-photos', 'common-sales', 'common-shared', 'common-status', 'common-validation']);
  const { success, error: notifyError } = useNotifications();
  const [expanded, setExpanded] = useState(false);
  const [transitioning, setTransitioning] = useState(false);

  const nextStatuses = CONTRACT_STATUS_TRANSITIONS[contract.status];

  const handleTransition = useCallback(async (target: ContractStatus) => {
    setTransitioning(true);
    const result = await onTransition(contract.id, target);
    setTransitioning(false);

    if (result.success) {
      success(t('sales.legal.transitionSuccess', { status: t(STATUS_KEYS[target]) }));
    } else {
      notifyError(result.error ?? t('sales.legal.transitionError'));
    }
  }, [contract.id, onTransition, success, notifyError]);

  return (
    <article className="rounded-lg border bg-card">
      {/* Header — always visible */}
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="flex w-full items-center justify-between gap-3 p-3 text-left hover:bg-muted/50 transition-colors"
      >
        <span className="flex items-center gap-2 min-w-0">
          <FileSignature className={cn("h-4 w-4 shrink-0", colors.text.muted)} />
          <span className="font-medium text-sm truncate">
            {t(PHASE_KEYS[contract.phase])}
          </span>
        </span>

        <span className="flex items-center gap-2 shrink-0">
          <Badge variant="secondary" className={cn('text-[10px]', STATUS_COLORS[contract.status])}>
            {t(STATUS_KEYS[contract.status])}
          </Badge>
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>

      {/* Body — expandable */}
      {expanded && (
        <section className="border-t px-3 pb-3 pt-2 space-y-3">
          {/* Financial info */}
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            <dt className={cn("flex items-center gap-1", colors.text.muted)}>
              <Euro className="h-3 w-3" />
              {t('sales.legal.amount')}
            </dt>
            <dd className="font-medium">{formatPriceOrDash(contract.contractAmount)}</dd>

            {contract.depositAmount !== null && (
              <>
                <dt className={colors.text.muted}>
                  {t('sales.legal.deposit')}
                </dt>
                <dd className="font-medium">{formatPriceOrDash(contract.depositAmount)}</dd>
              </>
            )}

            <dt className={cn("flex items-center gap-1", colors.text.muted)}>
              <CalendarDays className="h-3 w-3" />
              {t('sales.legal.createdAt')}
            </dt>
            <dd>{formatDateOrDash(contract.createdAt)}</dd>

            {contract.signedAt && (
              <>
                <dt className={colors.text.muted}>
                  {t('sales.legal.signedAt')}
                </dt>
                <dd>{formatDateOrDash(contract.signedAt)}</dd>
              </>
            )}
          </dl>

          {/* Professionals */}
          <section className="space-y-1">
            <h4 className={cn("text-xs font-medium", colors.text.muted)}>
              {t('sales.legal.professionals')}
            </h4>
            <ul className="space-y-0.5 text-xs">
              {[
                { label: t('sales.legal.sellerLawyer'), snap: contract.sellerLawyer },
                { label: t('sales.legal.buyerLawyer'), snap: contract.buyerLawyer },
                { label: t('sales.legal.notary'), snap: contract.notary },
              ].map(({ label, snap }) => (
                <li key={label} className="flex items-center gap-1">
                  <User className={cn("h-3 w-3", colors.text.muted)} />
                  <span className={colors.text.muted}>{label}:</span>
                  <span className="font-medium">
                    {snap?.displayName ?? t('sales.legal.unassigned')}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {/* Notes */}
          {contract.notes && (
            <p className={cn("text-xs italic border-l-2 pl-2", colors.text.muted)}>
              {contract.notes}
            </p>
          )}

          {/* FSM Action Buttons */}
          {nextStatuses.length > 0 && (
            <footer className="flex gap-2 pt-1">
              {nextStatuses.map((target) => (
                <Button
                  key={target}
                  size="sm"
                  variant="outline"
                  disabled={transitioning}
                  onClick={() => handleTransition(target)}
                  className="text-xs gap-1"
                >
                  <ArrowRight className="h-3 w-3" />
                  {t(NEXT_STATUS_KEYS[contract.status])}
                </Button>
              ))}
            </footer>
          )}
        </section>
      )}
    </article>
  );
}
