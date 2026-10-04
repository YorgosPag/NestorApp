'use client';

/**
 * ADR-901 Φ1 — μία γραμμή του καταλόγου δικαιολογητικών: κατάσταση (σχήμα + κείμενο),
 * πάροχος, αρχεία-τεκμήρια, ισχύς, λόγος επιστροφής/μη εφαρμογής, και ενέργειες ελέγχου.
 * Φ4.4: ποιος έστειλε κάθε τεκμήριο (ρόλος) · «Αποστολή εγγράφου» / «Απόσυρση» για τον επαγγελματία.
 * Φ4.5: «Στείλε τη νέα έκδοση» (επαγγελματίας) · «Εκκρεμεί από» + «Ζήτησε από: X» (οικοδεσπότης **και** επαγγελματίας).
 * Π2: «εκ μέρους του εντολέα» · σφραγισμένη παράδοση (χωρίς έλεγχο — δεν υπάρχει αρχείο να ελεγχθεί, Α35).
 *
 * @module components/sales/conveyance/ConveyanceChecklistRow
 */

import React from 'react';
import { Download, Eye, FileText, MoreHorizontal } from 'lucide-react';
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
import type { CaseFileMode } from '@/lib/conveyance/case-activity';
import type { ChecklistRow, EvidenceFile } from '@/types/conveyance-case';
import { STATUS_PRESENTATION } from './conveyance-presentation';
import { RowRequestAction, type RowRequest } from './ConveyanceRowRequest';
import { fulfilmentOf } from '@/config/engagement-policy';
import { sentOnBehalf } from '@/lib/conveyance/contribution-audience';
import {
  isWithdrawing,
  ReissueFileButton,
  ReviseFileButton,
  SealedDeliveryNote,
  TransmitRowAction,
  TransmittalSource,
  WithdrawFileButton,
  type RowTransmittal,
} from './ConveyanceRowTransmittal';

export type RowDialogMode = 'accept' | 'reject' | 'not_applicable';

/** ADR-901 Φ4 · Φ4.4 — άνοιγμα/λήψη τεκμηρίου (επαγγελματίας **και** οικοδεσπότης). Απόν ⇒ η γραμμή δείχνει μόνο ονόματα. */
export type OpenEvidenceFile = (file: EvidenceFile, mode: CaseFileMode) => void;

/**
 * Ό,τι **κάνει** κανείς σε μια γραμμή — κοινό για τη γραμμή **και** την ενότητα που τη ζωγραφίζει (μία δήλωση, όχι
 * δύο δίδυμες που αποκλίνουν στην επόμενη ενέργεια).
 */
export interface ChecklistRowHandlers {
  readonly canEdit: boolean;
  readonly onOpenDialog: (row: ChecklistRow, mode: RowDialogMode) => void;
  readonly onClear: (row: ChecklistRow) => void;
  readonly onOpenFile?: OpenEvidenceFile;
  /** ADR-901 Φ4.4 — αποστολή/απόσυρση (μόνο ο επαγγελματίας). */
  readonly transmittal?: RowTransmittal;
  /** ADR-901 Φ4.5 — «Ζήτησε έγγραφο» (όποιος μπορεί να ζητήσει). */
  readonly request?: RowRequest;
}

interface ConveyanceChecklistRowProps extends ChecklistRowHandlers {
  readonly row: ChecklistRow;
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
    if (sentOnBehalf(row.item)) return <OnBehalfHint row={row} level={level} />;
    // Φ4.4 — ό,τι στέλνει επαγγελματίας ΔΕΝ «ανεβαίνει στην καρτέλα Έγγραφα»: το στέλνει εκείνος από την υπόθεση.
    if (level === 'contribution') {
      return <p className={cn('text-xs', colors.text.muted)}>{t('row.transmittalHint', { provider: t(`providers.${row.provider}`) })}</p>;
    }
    return level ? <p className={cn('text-xs', colors.text.muted)}>{t('row.uploadHint', { level: t(`levels.${level}`) })}</p> : null;
  }
  return null;
}

/** Π2 — έγγραφο εντολέα: το στέλνει ο εκπρόσωπός του· όπου υπάρχει και επαφή, ανεβαίνει εναλλακτικά εκεί (Σ-1). */
function OnBehalfHint({ row, level }: { readonly row: ChecklistRow; readonly level: string | undefined }) {
  const { t } = useTranslation(['conveyance']);
  const colors = useSemanticColors();
  const [representative] = fulfilmentOf(row.provider).contributors;
  const role = representative ? t(`engagement.roles.${representative}`) : t(`providers.${row.provider}`);
  const text = level && level !== 'contribution'
    ? t('row.onBehalfOrUploadHint', { role, level: t(`levels.${level}`) })
    : t('row.onBehalfHint', { role });
  return <p className={cn('text-xs', colors.text.muted)}>{text}</p>;
}

function FileButtons({ file, onOpenFile }: { readonly file: EvidenceFile; readonly onOpenFile: OpenEvidenceFile }) {
  const { t } = useTranslation(['conveyance']);
  const iconSizes = useIconSizes();
  return (
    <>
      <Button variant="ghost" size="icon" className="h-6 w-6" aria-label={t('files.view', { name: file.displayName })} onClick={() => onOpenFile(file, 'view')}>
        <Eye className={iconSizes.xs} aria-hidden="true" />
      </Button>
      <Button variant="ghost" size="icon" className="h-6 w-6" aria-label={t('files.download', { name: file.displayName })} onClick={() => onOpenFile(file, 'download')}>
        <Download className={iconSizes.xs} aria-hidden="true" />
      </Button>
    </>
  );
}

function RowFiles({ row, onOpenFile, transmittal }: Pick<ConveyanceChecklistRowProps, 'row' | 'onOpenFile' | 'transmittal'>) {
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const files = row.files.filter((file) => !isWithdrawing(file, transmittal));
  if (files.length === 0) return null;
  return (
    <ul className="space-y-0.5">
      {files.map((file) => (
        <li key={`${file.fileId}-${file.level}`} className={cn('flex flex-wrap items-center gap-1 text-xs', colors.text.secondary)}>
          <FileText className={cn(iconSizes.xs, 'shrink-0')} aria-hidden="true" />
          <span className="truncate">{file.displayName}</span>
          <TransmittalSource file={file} />
          {onOpenFile && <FileButtons file={file} onOpenFile={onOpenFile} />}
          <ReviseFileButton file={file} row={row} transmittal={transmittal} />
          <WithdrawFileButton file={file} transmittal={transmittal} />
          <ReissueFileButton file={file} transmittal={transmittal} />
        </li>
      ))}
    </ul>
  );
}

function RowActions({ row, onOpenDialog, onClear }: Pick<ConveyanceChecklistRowProps, 'row' | 'onOpenDialog' | 'onClear'>) {
  const { t } = useTranslation(['conveyance']);
  const iconSizes = useIconSizes();
  const label = t(row.item.labelKey);
  const reviewable = row.status !== 'not_applicable' && row.status !== 'needs_answer' && row.status !== 'delivered_sealed';
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

export function ConveyanceChecklistRow({ row, canEdit, onOpenDialog, onClear, onOpenFile, transmittal, request }: ConveyanceChecklistRowProps) {
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
        <RowFiles row={row} onOpenFile={onOpenFile} transmittal={transmittal} />
        <SealedDeliveryNote row={row} />
        <RowValidity row={row} />
        <RowNote row={row} />
        <TransmitRowAction row={row} transmittal={transmittal} />
        <RowRequestAction row={row} request={request} />
      </section>
      {canEdit && <RowActions row={row} onOpenDialog={onOpenDialog} onClear={onClear} />}
    </article>
  );
}
