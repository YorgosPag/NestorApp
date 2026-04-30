'use client';

/**
 * QuoteDetailsHeader — ADR-267 SSoT + ADR-328 §5.I extension
 *
 * Phase 11 adds: primary (status-driven) + secondary (icon) + overflow + PDF toggle.
 * Legacy props (onEdit, onArchive) kept for backward compat but superseded by rich slots.
 */

import { FileText, Eye, EyeOff, MoreHorizontal } from 'lucide-react';
import { EntityDetailsHeader, createEntityAction } from '@/core/entity-headers';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { QuoteStatusBadge } from '@/subapps/procurement/components/QuoteStatusBadge';
import type { Quote } from '@/subapps/procurement/types/quote';
import { isExpired, daysUntilExpiry, formatValidUntilDate } from '@/subapps/procurement/utils/quote-expiration';
import type {
  QuoteHeaderPrimaryAction,
  QuoteHeaderSecondaryAction,
  QuoteHeaderOverflowAction,
} from '@/subapps/procurement/utils/quote-header-actions';

// ============================================================================
// PROPS
// ============================================================================

interface QuoteDetailsHeaderProps {
  quote: Quote;
  // Legacy simple actions — backward compat
  onCreateNew?: () => void;
  onEdit?: () => void;
  onArchive?: () => void;
  onRequestRenewal?: () => void;
  // Rich action slots — Phase 11 §5.I
  primaryActions?: QuoteHeaderPrimaryAction[];
  secondaryActions?: QuoteHeaderSecondaryAction[];
  overflowActions?: QuoteHeaderOverflowAction[];
  // PDF toggle — Phase 11 §5.O
  pdfOpen?: boolean;
  onTogglePdf?: () => void;
  hasPdf?: boolean;
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

function PrimaryButton({ action }: { action: QuoteHeaderPrimaryAction }) {
  const btn = (
    <Button size="sm" variant={action.variant ?? 'default'} onClick={action.onClick} disabled={action.disabled}>
      {action.label}
    </Button>
  );
  if (action.disabled && action.disabledTooltip) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span tabIndex={0}>{btn}</span>
        </TooltipTrigger>
        <TooltipContent>{action.disabledTooltip}</TooltipContent>
      </Tooltip>
    );
  }
  return btn;
}

function SecondaryIcon({ action }: { action: QuoteHeaderSecondaryAction }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="sm" onClick={action.onClick} disabled={action.disabled} className="relative h-8 w-8 p-0">
          <action.icon className="h-4 w-4" />
          {action.badge != null && action.badge > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
              {action.badge}
            </span>
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{action.tooltip}</TooltipContent>
    </Tooltip>
  );
}

function PdfToggleButton({ pdfOpen, onTogglePdf, hasPdf, tooltipShow, tooltipHide }: {
  pdfOpen: boolean; onTogglePdf: () => void; hasPdf: boolean;
  tooltipShow: string; tooltipHide: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="sm" onClick={onTogglePdf} disabled={!hasPdf} className="h-8 w-8 p-0">
          {pdfOpen ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{pdfOpen ? tooltipHide : tooltipShow}</TooltipContent>
    </Tooltip>
  );
}

function OverflowMenu({ actions }: { actions: QuoteHeaderOverflowAction[] }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {actions.map((a) => (
          <Tooltip key={a.id}>
            <TooltipTrigger asChild>
              <span>
                <DropdownMenuItem
                  onClick={a.disabled ? undefined : a.onClick}
                  disabled={a.disabled}
                  className={a.destructive ? 'text-destructive focus:text-destructive' : undefined}
                >
                  {a.label}
                </DropdownMenuItem>
              </span>
            </TooltipTrigger>
            {a.disabled && a.disabledTooltip && (
              <TooltipContent side="left">{a.disabledTooltip}</TooltipContent>
            )}
          </Tooltip>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ExpiryBanner({ validUntilDate, daysAgo, onRequestRenewal, t }: {
  validUntilDate: string; daysAgo: number; onRequestRenewal?: () => void;
  t: (key: string, vars?: Record<string, unknown>) => string;
}) {
  return (
    <div className="mx-2 mb-2 px-3 py-2 rounded-md bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 flex items-center justify-between gap-3 text-sm">
      <span className="text-amber-800 dark:text-amber-200 font-medium">
        {daysAgo === 1
          ? t('rfqs.expiry.banner.title', { date: validUntilDate, daysAgo })
          : t('rfqs.expiry.banner.titlePlural', { date: validUntilDate, daysAgo })}
      </span>
      {onRequestRenewal && (
        <Button size="sm" variant="outline" onClick={onRequestRenewal} className="shrink-0 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/30">
          {t('rfqs.expiry.banner.requestRenewalCta')} →
        </Button>
      )}
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function QuoteDetailsHeader({
  quote,
  onCreateNew,
  onEdit,
  onArchive,
  onRequestRenewal,
  primaryActions = [],
  secondaryActions = [],
  overflowActions = [],
  pdfOpen = false,
  onTogglePdf,
  hasPdf = false,
}: QuoteDetailsHeaderProps) {
  const { t } = useTranslation('quotes');
  const isTerminal = quote.status === 'archived';
  const expired = isExpired(quote);
  const days = daysUntilExpiry(quote);
  const daysAgo = days !== null && days < 0 ? Math.abs(days) : 1;
  const validUntilDate = formatValidUntilDate(quote);
  const hasRichActions = primaryActions.length > 0 || secondaryActions.length > 0 || overflowActions.length > 0 || !!onTogglePdf;

  const legacyActions = [
    ...(onCreateNew ? [createEntityAction('new', t('list.createQuote'), onCreateNew)] : []),
    ...(onEdit && !isTerminal ? [createEntityAction('edit', t('detail.editQuote'), onEdit)] : []),
    ...(onArchive && !isTerminal ? [createEntityAction('delete', t('detail.archiveQuote'), onArchive)] : []),
  ];

  return (
    <div>
      <EntityDetailsHeader
        icon={FileText}
        title={quote.displayNumber}
        variant="detailed"
        titleAdornment={<QuoteStatusBadge status={quote.status} className="text-sm" />}
        actions={legacyActions}
      />
      {hasRichActions && (
        <div className="mx-2 mb-1 flex items-center gap-1 flex-wrap">
          {primaryActions.map((a) => <PrimaryButton key={a.id} action={a} />)}
          <div className="flex-1" />
          {secondaryActions.map((a) => <SecondaryIcon key={a.id} action={a} />)}
          {onTogglePdf && (
            <PdfToggleButton
              pdfOpen={pdfOpen}
              onTogglePdf={onTogglePdf}
              hasPdf={hasPdf}
              tooltipShow={t('rfqs.quoteHeader.tooltip.viewPdf')}
              tooltipHide={t('rfqs.quoteHeader.tooltip.hidePdf')}
            />
          )}
          {overflowActions.length > 0 && <OverflowMenu actions={overflowActions} />}
        </div>
      )}
      {expired && (
        <ExpiryBanner
          validUntilDate={validUntilDate}
          daysAgo={daysAgo}
          onRequestRenewal={onRequestRenewal}
          t={t}
        />
      )}
    </div>
  );
}
