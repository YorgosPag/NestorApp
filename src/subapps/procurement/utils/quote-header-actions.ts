/**
 * quote-header-actions — ADR-328 §5.I factory
 *
 * Pure function: no hooks, no side effects. Returns action descriptors for
 * QuoteDetailsHeader primary/secondary/overflow slots based on quote FSM status
 * and RFQ award lock state.
 */

import { Download, MessageSquare } from 'lucide-react';
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
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  t: (key: string) => string;
  isConnected?: boolean;
}

// ============================================================================
// INTERNALS
// ============================================================================

// `draft` (§8.5.4): με «Επιβεβαίωση» μπαίνει στη Σύγκριση — μετά την ανάθεση θα ήταν καθυστερημένη προσφορά.
const AWARD_LOCKABLE: readonly QuoteStatus[] = ['draft', 'submitted', 'under_review', 'rejected'];

const EDIT_LOCKED_STATUSES: readonly QuoteStatus[] = ['accepted', 'archived', 'superseded'];

function isLockedByAward(quote: Quote, rfq: RFQ | null): boolean {
  if (!rfq?.winnerQuoteId) return false;
  if (rfq.winnerQuoteId === quote.id) return false;
  return AWARD_LOCKABLE.includes(quote.status);
}

function isEditLocked(quote: Quote): boolean {
  return EDIT_LOCKED_STATUSES.includes(quote.status);
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
  const offlineTooltip = p.isConnected === false ? p.t('rfqs.offline.requiresConnection') : undefined;
  const offline = offlineTooltip !== undefined;

  const primaryActions = buildPrimary(p, locked, awardTooltip, offlineTooltip);
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
    },
  ];
  const editLocked = isEditLocked(p.quote);
  const editTooltip = editLocked
    ? p.t('rfqs.editDialog.lockedTooltip')
    : offlineTooltip;
  const overflowActions: QuoteHeaderOverflowAction[] = [
    { id: 'edit', label: p.t('rfqs.quoteHeader.action.edit'), onClick: p.onEdit, disabled: editLocked || offline, disabledTooltip: editTooltip },
    { id: 'duplicate', label: p.t('rfqs.quoteHeader.action.duplicate'), onClick: p.onDuplicate },
    { id: 'delete', label: p.t('rfqs.quoteHeader.action.delete'), onClick: p.onDelete, destructive: true },
  ];

  return { primaryActions, secondaryActions, overflowActions };
}

/**
 * ADR-327 §8.5.4 — χειροκίνητη προσφορά (ο PM καταχωρεί ό,τι έστειλε ο προμηθευτής): ήταν ΜΟΝΟ «Επεξεργασία»
 * ⇒ καμία διαδρομή προς τη Σύγκριση (μετρά `submitted/under_review/accepted`). Ίδια «Επιβεβαίωση» με τη σάρωση,
 * επιτρεπτή μετάβαση `draft → under_review` (Ariba «submit on behalf of supplier»).
 */
function buildDraftPrimary(
  p: BuildQuoteHeaderActionsParams,
  locked: boolean,
  awardTooltip: string | undefined,
  offlineTooltip: string | undefined,
): QuoteHeaderPrimaryAction[] {
  return [
    confirmAction(p, locked, awardTooltip, offlineTooltip),
    {
      id: 'edit', label: p.t('rfqs.quoteHeader.action.edit'), onClick: p.onEdit,
      variant: 'outline', disabled: offlineTooltip !== undefined, disabledTooltip: offlineTooltip,
    },
  ];
}

/** «Επιβεβαίωση» → `under_review` — ΕΝΑ κουμπί για `submitted` (πύλη/σάρωση) και `draft` (χειροκίνητη). */
function confirmAction(
  p: BuildQuoteHeaderActionsParams,
  locked: boolean,
  awardTooltip: string | undefined,
  offlineTooltip: string | undefined,
): QuoteHeaderPrimaryAction {
  return {
    id: 'confirm', label: p.t('rfqs.quoteHeader.action.confirm'), onClick: p.onConfirm,
    disabled: locked || offlineTooltip !== undefined,
    disabledTooltip: offlineTooltip ?? awardTooltip,
  };
}

function buildPrimary(
  p: BuildQuoteHeaderActionsParams,
  locked: boolean,
  awardTooltip: string | undefined,
  offlineTooltip: string | undefined,
): QuoteHeaderPrimaryAction[] {
  const offline = offlineTooltip !== undefined;
  switch (p.quote.status) {
    case 'submitted':
      return [
        confirmAction(p, locked, awardTooltip, offlineTooltip),
        {
          id: 'reject', label: p.t('rfqs.quoteHeader.action.reject'), onClick: p.onReject,
          variant: 'outline', disabled: offline, disabledTooltip: offlineTooltip,
        },
      ];
    case 'under_review':
      return [
        {
          id: 'approve', label: p.t('rfqs.quoteHeader.action.approve'), onClick: p.onApprove,
          disabled: locked || offline,
          disabledTooltip: offlineTooltip ?? awardTooltip,
        },
        {
          id: 'reject', label: p.t('rfqs.quoteHeader.action.reject'), onClick: p.onReject,
          variant: 'outline', disabled: offline, disabledTooltip: offlineTooltip,
        },
      ];
    case 'accepted':
      return p.quote.linkedPoId
        ? [{ id: 'viewPo', label: p.t('rfqs.quoteHeader.action.viewPo'), onClick: p.onViewPo }]
        : [{
            id: 'createPo', label: p.t('rfqs.quoteHeader.action.createPo'), onClick: p.onCreatePo,
            disabled: offline, disabledTooltip: offlineTooltip,
          }];
    case 'rejected':
      return [{
        id: 'restore', label: p.t('rfqs.quoteHeader.action.restore'), onClick: p.onRestore,
        disabled: locked || offline,
        disabledTooltip: offlineTooltip ?? awardTooltip,
      }];
    case 'draft':
      return buildDraftPrimary(p, locked, awardTooltip, offlineTooltip);
    default:
      return [];
  }
}
