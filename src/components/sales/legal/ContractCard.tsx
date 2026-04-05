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

const PHASE_LABELS: Record<string, string> = {
  preliminary: 'Προσύμφωνο',
  final: 'Οριστικό Συμβόλαιο',
  payoff: 'Εξοφλητήριο',
};

const STATUS_LABELS: Record<ContractStatus, { key: string; default: string }> = {
  draft: { key: 'sales.legal.draft', default: 'Πρόχειρο' },
  pending_signature: { key: 'sales.legal.pendingSig', default: 'Αναμονή Υπογραφής' },
  signed: { key: 'sales.legal.signed', default: 'Υπογεγραμμένο' },
  completed: { key: 'sales.legal.completed', default: 'Ολοκληρωμένο' },
};

const STATUS_COLORS: Record<ContractStatus, string> = {
  draft: 'bg-gray-100 text-gray-700',
  pending_signature: 'bg-yellow-100 text-yellow-800',
  signed: 'bg-green-100 text-green-800',
  completed: 'bg-blue-100 text-blue-800',
};

const NEXT_STATUS_LABELS: Record<ContractStatus, string> = {
  draft: 'Αποστολή για Υπογραφή',
  pending_signature: 'Σημείωση ως Υπογεγραμμένο',
  signed: 'Ολοκλήρωση',
  completed: '',
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('el-GR');
}

function formatCurrency(amount: number | null): string {
  if (amount === null || amount === undefined) return '—';
  return new Intl.NumberFormat('el-GR', { style: 'currency', currency: 'EUR' }).format(amount);
}

// ============================================================================
// COMPONENT
// ============================================================================

export function ContractCard({ contract, onTransition }: ContractCardProps) {
  const colors = useSemanticColors();
  const { t } = useTranslation('common');
  const { success, error: notifyError } = useNotifications();
  const [expanded, setExpanded] = useState(false);
  const [transitioning, setTransitioning] = useState(false);

  const nextStatuses = CONTRACT_STATUS_TRANSITIONS[contract.status];

  const handleTransition = useCallback(async (target: ContractStatus) => {
    setTransitioning(true);
    const result = await onTransition(contract.id, target);
    setTransitioning(false);

    if (result.success) {
      success(`Μετάβαση σε ${STATUS_LABELS[target].default}`);
    } else {
      notifyError(result.error ?? 'Αποτυχία μετάβασης');
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
            {t(`sales.legal.${contract.phase}`, { defaultValue: PHASE_LABELS[contract.phase] })}
          </span>
        </span>

        <span className="flex items-center gap-2 shrink-0">
          <Badge variant="secondary" className={cn('text-[10px]', STATUS_COLORS[contract.status])}>
            {t(STATUS_LABELS[contract.status].key, { defaultValue: STATUS_LABELS[contract.status].default })}
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
              {t('sales.legal.amount', { defaultValue: 'Ποσό' })}
            </dt>
            <dd className="font-medium">{formatCurrency(contract.contractAmount)}</dd>

            {contract.depositAmount !== null && (
              <>
                <dt className={colors.text.muted}>
                  {t('sales.legal.deposit', { defaultValue: 'Αρραβώνας' })}
                </dt>
                <dd className="font-medium">{formatCurrency(contract.depositAmount)}</dd>
              </>
            )}

            <dt className={cn("flex items-center gap-1", colors.text.muted)}>
              <CalendarDays className="h-3 w-3" />
              {t('sales.legal.createdAt', { defaultValue: 'Δημιουργία' })}
            </dt>
            <dd>{formatDate(contract.createdAt)}</dd>

            {contract.signedAt && (
              <>
                <dt className={colors.text.muted}>
                  {t('sales.legal.signedAt', { defaultValue: 'Υπογραφή' })}
                </dt>
                <dd>{formatDate(contract.signedAt)}</dd>
              </>
            )}
          </dl>

          {/* Professionals */}
          <section className="space-y-1">
            <h4 className={cn("text-xs font-medium", colors.text.muted)}>
              {t('sales.legal.professionals', { defaultValue: 'Επαγγελματίες' })}
            </h4>
            <ul className="space-y-0.5 text-xs">
              {[
                { label: t('sales.legal.sellerLawyer', { defaultValue: 'Δικ. Πωλητή' }), snap: contract.sellerLawyer },
                { label: t('sales.legal.buyerLawyer', { defaultValue: 'Δικ. Αγοραστή' }), snap: contract.buyerLawyer },
                { label: t('sales.legal.notary', { defaultValue: 'Συμβολαιογράφος' }), snap: contract.notary },
              ].map(({ label, snap }) => (
                <li key={label} className="flex items-center gap-1">
                  <User className={cn("h-3 w-3", colors.text.muted)} />
                  <span className={colors.text.muted}>{label}:</span>
                  <span className="font-medium">
                    {snap?.displayName ?? t('sales.legal.unassigned', { defaultValue: 'Μη ανατεθ.' })}
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
                  {NEXT_STATUS_LABELS[contract.status]}
                </Button>
              ))}
            </footer>
          )}
        </section>
      )}
    </article>
  );
}
