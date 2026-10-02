'use client';

/**
 * ADR-901 Φ1 — μία γραμμή του καταλόγου δικαιολογητικών: κατάσταση (σχήμα + κείμενο),
 * πάροχος, αρχεία-τεκμήρια, ισχύς, λόγος επιστροφής/μη εφαρμογής, και ενέργειες ελέγχου.
 *
 * @module components/sales/conveyance/ConveyanceChecklistRow
 */

import React from 'react';
import { FileText, MoreHorizontal } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { formatDate } from '@/lib/intl-utils';
import { cn } from '@/lib/utils';
import type { ChecklistRow } from '@/types/conveyance-case';
import { STATUS_PRESENTATION } from './conveyance-presentation';

export type RowDialogMode = 'accept' | 'reject' | 'not_applicable';

interface ConveyanceChecklistRowProps {
  readonly row: ChecklistRow;
  readonly canEdit: boolean;
  readonly onOpenDialog: (row: ChecklistRow, mode: RowDialogMode) => void;
  readonly onClear: (row: ChecklistRow) => void;
}

function RowValidity({ row }: { readonly row: ChecklistRow }) {
  const { t } = useTranslation(['conveyance']);
  const colors = useSemanticColors();
  const validity = row.item.validity;
  if (row.validOnSigning === false) {
    return <p className={cn('text-xs font-medium', colors.text.error)}>{t('row.invalidOnSigning')}</p>;
  }
  if (row.expiresOn) return <p className={cn('text-xs', colors.text.muted)}>{t('row.expiresOn', { date: formatDate(row.expiresOn) })}</p>;
  if (validity.kind === 'act_day') return <p className={cn('text-xs', colors.text.muted)}>{t('row.actDay')}</p>;
  if (validity.kind === 'unverified' && row.status !== 'not_applicable') {
    return <p className={cn('text-xs', colors.text.muted)}>{t('row.validityUnverified')}</p>;
  }
  return null;
}

function RowNote({ row }: { readonly row: ChecklistRow }) {
  const { t } = useTranslation(['conveyance']);
  const colors = useSemanticColors();
  if (row.status === 'rejected' && row.review?.reason) {
    return <p className={cn('text-xs', colors.text.error)}>{t('row.rejectedReason', { reason: row.review.reason })}</p>;
  }
  if (row.notApplicableBy === 'manual' && row.notApplicable) {
    return <p className={cn('text-xs', colors.text.muted)}>{t('row.notApplicableReason', { reason: row.notApplicable.reason })}</p>;
  }
  if (row.status === 'missing' && row.item.satisfaction.kind === 'offline') {
    return <p className={cn('text-xs', colors.text.muted)}>{t('row.offlineHint')}</p>;
  }
  if (row.status === 'missing' && row.item.satisfaction.kind === 'files') {
    const level = row.item.satisfaction.matchers[0]?.level;
    return level ? <p className={cn('text-xs', colors.text.muted)}>{t('row.uploadHint', { level: t(`levels.${level}`) })}</p> : null;
  }
  return null;
}

function RowFiles({ row }: { readonly row: ChecklistRow }) {
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  if (row.files.length === 0) return null;
  return (
    <ul className="space-y-0.5">
      {row.files.map((file) => (
        <li key={`${file.fileId}-${file.level}`} className={cn('flex items-center gap-1 text-xs', colors.text.secondary)}>
          <FileText className={cn(iconSizes.xs, 'shrink-0')} aria-hidden="true" />
          <span className="truncate">{file.displayName}</span>
        </li>
      ))}
    </ul>
  );
}

function RowActions({ row, onOpenDialog, onClear }: Omit<ConveyanceChecklistRowProps, 'canEdit'>) {
  const { t } = useTranslation(['conveyance']);
  const iconSizes = useIconSizes();
  const label = t(row.item.labelKey);
  const reviewable = row.status !== 'not_applicable' && row.status !== 'needs_answer';
  const hasOverride = row.review !== null || row.notApplicable !== null;
  const acceptLabel = row.files.length > 0 ? t('actions.accept') : t('actions.confirmReceived');
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t('actions.menu', { item: label })}>
          <MoreHorizontal className={iconSizes.sm} aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {reviewable && <DropdownMenuItem onSelect={() => onOpenDialog(row, 'accept')}>{acceptLabel}</DropdownMenuItem>}
        {reviewable && <DropdownMenuItem onSelect={() => onOpenDialog(row, 'reject')}>{t('actions.reject')}</DropdownMenuItem>}
        {row.notApplicableBy !== 'fact' && row.notApplicable === null && (
          <DropdownMenuItem onSelect={() => onOpenDialog(row, 'not_applicable')}>{t('actions.markNotApplicable')}</DropdownMenuItem>
        )}
        {hasOverride && <DropdownMenuItem onSelect={() => onClear(row)}>{t('actions.clear')}</DropdownMenuItem>}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ConveyanceChecklistRow({ row, canEdit, onOpenDialog, onClear }: ConveyanceChecklistRowProps) {
  const { t } = useTranslation(['conveyance']);
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const presentation = STATUS_PRESENTATION[row.status];
  const StatusIcon = presentation.icon;
  return (
    <article className="flex items-start gap-3 py-2">
      <section className="min-w-0 flex-1 space-y-1">
        <header className="flex flex-wrap items-center gap-2">
          <h4 className="text-sm font-medium">{t(row.item.labelKey)}</h4>
          <Badge variant={presentation.variant} className="gap-1">
            <StatusIcon className={iconSizes.xs} aria-hidden="true" />
            {t(`status.${row.status}`)}
          </Badge>
        </header>
        <p className={cn('text-xs', colors.text.muted)}>{t('row.provider', { provider: t(`providers.${row.provider}`) })}</p>
        <RowFiles row={row} />
        <RowValidity row={row} />
        <RowNote row={row} />
      </section>
      {canEdit && <RowActions row={row} onOpenDialog={onOpenDialog} onClear={onClear} />}
    </article>
  );
}
