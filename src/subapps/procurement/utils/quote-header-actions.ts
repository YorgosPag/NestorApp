/**
 * quote-header-actions — ADR-328 §5.I factory
 *
 * Pure function: no hooks, no side effects. Returns action descriptors for
 * QuoteDetailsHeader primary/secondary/overflow slots based on quote FSM status
 * and RFQ award lock state.
 */

import { Download, MessageSquare, History } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Quote, QuoteStatus } from '../types/quote';
import type { RFQ } from '../types/rfq';

// ============================================================================
// ACTION DESCRIPTOR TYPES
// ============================================================================

export interface QuoteHeaderPrimaryAction {
  id: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  disabledTooltip?: string;
  variant?: 'default' | 'outline' | 'destructive';
}

export interface QuoteHeaderSecondaryAction {
  id: string;
  icon: LucideIcon;
  tooltip: string;
  onClick: () => void;
  disabled?: boolean;
  badge?: number;
}

export interface QuoteHeaderOverflowAction {
  id: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  disabledTooltip?: string;
  destructive?: boolean;
}

export interface QuoteHeaderActionsResult {
  primaryActions: QuoteHeaderPrimaryAction[];
  secondaryActions: QuoteHeaderSecondaryAction[];
  overflowActions: QuoteHeaderOverflowAction[];
}

// ============================================================================
// BUILD PARAMS
// ============================================================================

export interface BuildQuoteHeaderActionsParams {
  quote: Quote;
  rfq: RFQ | null;
  onConfirm: () => void;
  onApprove: () => void;
  onReject: () => void;
  onCreatePo: () => void;
  onViewPo: () => void;
  onRestore: () => void;
  onDownload: () => void;
  onOpenComments: () => void;
  onOpenHistory: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  t: (key: string) => string;
}

// ============================================================================
// INTERNALS
// ============================================================================

const AWARD_LOCKABLE: readonly QuoteStatus[] = ['submitted', 'under_review', 'rejected'];

function isLockedByAward(quote: Quote, rfq: RFQ | null): boolean {
  if (!rfq?.winnerQuoteId) return false;
  if (rfq.winnerQuoteId === quote.id) return false;
  return AWARD_LOCKABLE.includes(quote.status);
}

function hasPdfSource(quote: Quote): boolean {
  return quote.source === 'scan' || quote.source === 'email_inbox';
}

// ============================================================================
// FACTORY
// ============================================================================

export function buildQuoteHeaderActions(p: BuildQuoteHeaderActionsParams): QuoteHeaderActionsResult {
  const locked = isLockedByAward(p.quote, p.rfq);
  const awardTooltip = locked ? p.t('rfqs.quoteHeader.tooltip.disabledByAward') : undefined;
  const comingSoon = p.t('rfqs.quoteHeader.tooltip.comingSoon');

  const primaryActions = buildPrimary(p, locked, awardTooltip);
  const secondaryActions: QuoteHeaderSecondaryAction[] = [
    {
      id: 'download',
      icon: Download,
      tooltip: p.t('rfqs.quoteHeader.tooltip.download'),
      onClick: p.onDownload,
      disabled: !hasPdfSource(p.quote),
    },
    {
      id: 'comments',
      icon: MessageSquare,
      tooltip: p.t('rfqs.quoteHeader.tooltip.comments'),
      onClick: p.onOpenComments,
      disabled: true,
    },
    {
      id: 'history',
      icon: History,
      tooltip: p.t('rfqs.quoteHeader.tooltip.history'),
      onClick: p.onOpenHistory,
      disabled: true,
    },
  ];
  const overflowActions: QuoteHeaderOverflowAction[] = [
    { id: 'edit', label: p.t('rfqs.quoteHeader.action.edit'), onClick: p.onEdit, disabled: true, disabledTooltip: comingSoon },
    { id: 'duplicate', label: p.t('rfqs.quoteHeader.action.duplicate'), onClick: p.onDuplicate },
    { id: 'delete', label: p.t('rfqs.quoteHeader.action.delete'), onClick: p.onDelete, destructive: true },
  ];

  return { primaryActions, secondaryActions, overflowActions };
}

function buildPrimary(
  p: BuildQuoteHeaderActionsParams,
  locked: boolean,
  awardTooltip: string | undefined,
): QuoteHeaderPrimaryAction[] {
  switch (p.quote.status) {
    case 'submitted':
      return [
        { id: 'confirm', label: p.t('rfqs.quoteHeader.action.confirm'), onClick: p.onConfirm, disabled: locked, disabledTooltip: awardTooltip },
        { id: 'reject', label: p.t('rfqs.quoteHeader.action.reject'), onClick: p.onReject, variant: 'outline' },
      ];
    case 'under_review':
      return [
        { id: 'approve', label: p.t('rfqs.quoteHeader.action.approve'), onClick: p.onApprove, disabled: locked, disabledTooltip: awardTooltip },
        { id: 'reject', label: p.t('rfqs.quoteHeader.action.reject'), onClick: p.onReject, variant: 'outline' },
      ];
    case 'accepted':
      return p.quote.linkedPoId
        ? [{ id: 'viewPo', label: p.t('rfqs.quoteHeader.action.viewPo'), onClick: p.onViewPo }]
        : [{ id: 'createPo', label: p.t('rfqs.quoteHeader.action.createPo'), onClick: p.onCreatePo }];
    case 'rejected':
      return [{ id: 'restore', label: p.t('rfqs.quoteHeader.action.restore'), onClick: p.onRestore, disabled: locked, disabledTooltip: awardTooltip }];
    case 'draft':
      return [{ id: 'edit', label: p.t('rfqs.quoteHeader.action.edit'), onClick: p.onEdit }];
    default:
      return [];
  }
}
