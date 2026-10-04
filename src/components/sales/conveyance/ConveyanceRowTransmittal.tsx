'use client';

/**
 * ADR-901 Φ4.4 — τα κομμάτια της γραμμής καταλόγου που αφορούν το **transmittal**: ποιος έστειλε ένα τεκμήριο
 * (ρόλος — ποτέ όνομα/email, Α18), η «Απόσυρση» του δικού μου, και η «Αποστολή εγγράφου» στις γραμμές του ρόλου μου.
 * Φ4.5: «Στείλε τη νέα έκδοση» στο δικό μου σταλμένο, **μόνο** όταν ο server λέει ότι η στοίβα μου έχει νεότερη (Α28).
 * Φ4.5 (§14.6): «Νέα έκδοση» — ο δρόμος που **γεννά** τη v2: ανέβασμα στη στοίβα του σταλμένου + αποστολή στους ίδιους.
 * Π2 (§14.7): έγγραφο **εκ μέρους** του εντολέα — «από: Δικηγόρος αγοραστή, εκ μέρους του εντολέα» · «Αποστολή εκ μέρους
 * του εντολέα» · και για όποιον **δεν** ανήκει στο ακροατήριο, η σφραγισμένη παράδοση (ότι ήρθε, ποτέ τι).
 *
 * Τα δικαιώματα **δεν** αποφασίζονται εδώ: ο server κρίνει (`judgeContribution`)· ο client απλώς δείχνει το κουμπί
 * όπου ο ίδιος κριτής (καθαρός, κοινός) λέει «ναι» — ώστε ο άνθρωπος να μη βλέπει ενέργεια που θα αρνηθεί ο server.
 *
 * @module components/sales/conveyance/ConveyanceRowTransmittal
 */

import React from 'react';
import { FilePlus2, Loader2, RefreshCw, Send, Undo2 } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Button } from '@/components/ui/button';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/intl-utils';
import { sentOnBehalf } from '@/lib/conveyance/contribution-audience';
import type { ChecklistRow, EvidenceFile } from '@/types/conveyance-case';

/** Φ4.5 — τι αναθεωρείται: το δικό μου σταλμένο **και** η γραμμή του (για την πόρτα ανεβάσματος). */
export interface RevisionTarget {
  readonly file: EvidenceFile;
  readonly row: ChecklistRow;
}

/** Οι ενέργειες transmittal μιας όψης — απούσες ⇒ η γραμμή δεν προσφέρει αποστολή/απόσυρση (οικοδεσπότης). */
export interface RowTransmittal {
  readonly canTransmit: (row: ChecklistRow) => boolean;
  readonly sendingItemId: string | null;
  readonly withdrawingIds: ReadonlySet<string>;
  readonly onTransmit: (row: ChecklistRow) => void;
  readonly onWithdraw: (file: EvidenceFile) => void;
  /** Φ4.5 — αποστολές που ξαναστέλνονται αυτή τη στιγμή (νέα έκδοση στους ίδιους). */
  readonly reissuingIds: ReadonlySet<string>;
  readonly onReissue: (file: EvidenceFile) => void;
  /** Φ4.5 — ανέβασε νέα έκδοση του σταλμένου μου και στείλε τη στους ίδιους (διάλογος). */
  readonly onRevise: (file: EvidenceFile, row: ChecklistRow) => void;
}

/** Αποσύρεται αυτή τη στιγμή (αισιόδοξα κρυμμένο); */
export function isWithdrawing(file: EvidenceFile, transmittal: RowTransmittal | undefined): boolean {
  return file.source.kind === 'transmittal' && transmittal !== undefined && transmittal.withdrawingIds.has(file.source.contributionId);
}

/** «από: Συμβολαιογράφος» — μόνο για σταλμένα τεκμήρια. */
export function TransmittalSource({ file }: { readonly file: EvidenceFile }) {
  const { t } = useTranslation(['conveyance']);
  const colors = useSemanticColors();
  if (file.source.kind !== 'transmittal') return null;
  const role = t(`engagement.roles.${file.source.authorRole}`);
  return <span className={cn('shrink-0', colors.text.muted)}>{file.source.onBehalf ? t('files.fromOnBehalf', { role }) : t('files.from', { role })}</span>;
}

/** 🔒 Π2 — «Παραδόθηκε 3/10 · από: Δικηγόρος αγοραστή, εκ μέρους του εντολέα» — χωρίς αρχείο, όνομα ή ενέργεια. */
export function SealedDeliveryNote({ row }: { readonly row: ChecklistRow }) {
  const { t } = useTranslation(['conveyance']);
  const colors = useSemanticColors();
  if (row.status !== 'delivered_sealed' || row.sealed === null) return null;
  const role = t(`engagement.roles.${row.sealed.authorRole}`);
  return <p className={cn('text-xs', colors.text.muted)}>{t('row.sealed', { role, date: formatDate(row.sealed.deliveredAt) })}</p>;
}

/** «Απόσυρση» — μόνο στο **δικό μου** σταλμένο τεκμήριο. */
export function WithdrawFileButton({ file, transmittal }: { readonly file: EvidenceFile; readonly transmittal?: RowTransmittal }) {
  const { t } = useTranslation(['conveyance']);
  const iconSizes = useIconSizes();
  if (!transmittal || file.source.kind !== 'transmittal' || !file.source.own) return null;
  return (
    <Button variant="ghost" size="icon" className="h-6 w-6" aria-label={t('transmittal.withdraw', { name: file.displayName })} onClick={() => transmittal.onWithdraw(file)}>
      <Undo2 className={iconSizes.xs} aria-hidden="true" />
    </Button>
  );
}

/**
 * Φ4.5 — «Στείλε τη νέα έκδοση: X» — ένα πάτημα, ίδιοι παραλήπτες (Aconex «auto update transmittal»). Υπάρχει **μόνο**
 * όταν το τεκμήριο είναι δικό μου **και** ο server βρήκε νεότερη, αποστελλόμενη κεφαλή στη στοίβα μου.
 */
export function ReissueFileButton({ file, transmittal }: { readonly file: EvidenceFile; readonly transmittal?: RowTransmittal }) {
  const { t } = useTranslation(['conveyance']);
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  if (!transmittal || file.source.kind !== 'transmittal' || !file.source.own || !file.source.newerVersion) return null;
  const { contributionId, newerVersion } = file.source;
  const busy = transmittal.reissuingIds.has(contributionId);
  return (
    <span className="flex basis-full flex-wrap items-center gap-2 pl-4">
      <Button variant="outline" size="sm" className="h-6 gap-1 px-2 text-xs" disabled={busy} aria-busy={busy} onClick={() => transmittal.onReissue(file)}>
        {busy ? <Loader2 className={cn(iconSizes.xs, 'animate-spin')} aria-hidden="true" /> : <RefreshCw className={iconSizes.xs} aria-hidden="true" />}
        {busy ? t('transmittal.dialog.sending') : t('transmittal.reissue', { name: newerVersion.displayName })}
      </Button>
      <span className={cn('text-xs', colors.text.muted)}>{t('transmittal.reissueHint')}</span>
    </span>
  );
}

/**
 * Φ4.5 — «Νέα έκδοση» (Autodesk Docs «Upload new version» · Aconex «Supersede»): στο **δικό μου** σταλμένο, σε γραμμή
 * που ο ρόλος μου συμπληρώνει **τώρα**. Κρύβεται όταν η στοίβα έχει ήδη νεότερη — τότε η ενέργεια είναι η αποστολή της.
 */
export function ReviseFileButton({ file, row, transmittal }: { readonly file: EvidenceFile; readonly row: ChecklistRow; readonly transmittal?: RowTransmittal }) {
  const { t } = useTranslation(['conveyance']);
  const iconSizes = useIconSizes();
  if (!transmittal || file.source.kind !== 'transmittal' || !file.source.own || file.source.newerVersion) return null;
  if (!transmittal.canTransmit(row) || transmittal.reissuingIds.has(file.source.contributionId)) return null;
  return (
    <Button variant="ghost" size="icon" className="h-6 w-6" aria-label={t('transmittal.revise.action', { name: file.displayName })} onClick={() => transmittal.onRevise(file, row)}>
      <FilePlus2 className={iconSizes.xs} aria-hidden="true" />
    </Button>
  );
}

/** «Αποστολή εγγράφου» — στις γραμμές που ο ρόλος μου συμπληρώνει **τώρα**. */
export function TransmitRowAction({ row, transmittal }: { readonly row: ChecklistRow; readonly transmittal?: RowTransmittal }) {
  const { t } = useTranslation(['conveyance']);
  const iconSizes = useIconSizes();
  if (!transmittal || !transmittal.canTransmit(row)) return null;
  const sending = transmittal.sendingItemId === row.itemId;
  return (
    <Button variant="outline" size="sm" className="gap-1" disabled={sending} aria-busy={sending} onClick={() => transmittal.onTransmit(row)}>
      {sending
        ? <Loader2 className={cn(iconSizes.xs, 'animate-spin')} aria-hidden="true" />
        : <Send className={iconSizes.xs} aria-hidden="true" />}
      {sending ? t('transmittal.dialog.sending') : sentOnBehalf(row.item) ? t('transmittal.actionOnBehalf') : t('transmittal.action')}
    </Button>
  );
}
