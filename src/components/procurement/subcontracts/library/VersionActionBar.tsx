'use client';

/**
 * **Οι πράξεις πάνω σε μια έκδοση ρήτρας** — έγκριση · απόρριψη · απόσυρση · «ελέγχθηκε νομικά» (ADR-928 §5.13 · Φ3γ-0).
 *
 * 🔑 Ό,τι δεν αφορά την έκδοση **κρύβεται**· ό,τι αφορά αλλά δεν επιτρέπεται στον θεατή φαίνεται **ανενεργό με αιτία**
 *    («την πρότεινες εσύ»). Η κρίση είναι του `versionActionBlock` = οι **ίδιοι** φύλακες με τον γραφέα, στην ίδια σειρά.
 * 🔑 Οι διάλογοι ανοίγουν από **ένα** σημείο (`dialog` / `onDialog`) ώστε το πληκτρολόγιο της ουράς (A/R) να ανοίγει
 *    τον ίδιο διάλογο με το κλικ — ποτέ απόφαση χωρίς επιβεβαίωση.
 * 🔑 Έγκριση: προαιρετικό «σε ισχύ από» (`DatePickerField` ↔ `CalendarDay` με τους υπάρχοντες μετατροπείς)· απόρριψη:
 *    λόγος **υποχρεωτικός** (Ironclad)· ο νομικός έλεγχος θέλει ρητή επιβεβαίωση — είναι δήλωση, όχι κλικ.
 */

import { useId, useState } from 'react';
import { Check, Scale, Undo2, X, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DatePickerField } from '@/components/ui/date-picker-field';
import { Label } from '@/components/ui/label';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { dateKeyOfPicker, pickerDateOfKey } from '@/lib/calendar/date-key';
import type { LibraryActionBlock, LibraryActionContext } from '@/subapps/procurement/subcontracts/library/library-action-blocks';
import { versionActionBlock } from '@/subapps/procurement/subcontracts/library/library-action-blocks';
import type { SubcontractClauseVersion } from '@/subapps/procurement/subcontracts/types/clause';
import { ReasonDialog } from '../ReasonDialog';
import type { LibraryActions } from './useLibraryActions';

export type VersionDialog = 'approve' | 'reject' | 'withdraw';
type BarAction = VersionDialog | 'markReviewed';

const ICONS: Readonly<Record<BarAction, LucideIcon>> = { approve: Check, reject: X, withdraw: Undo2, markReviewed: Scale };
const ORDER: readonly BarAction[] = ['approve', 'reject', 'withdraw', 'markReviewed'];

interface VersionActionBarProps {
  readonly version: SubcontractClauseVersion;
  /** Η ρήτρα όπως διαβάζεται (τίτλος · έκδοση) — στην περιγραφή του διαλόγου. */
  readonly summary: string;
  readonly context: LibraryActionContext;
  readonly actions: LibraryActions;
  readonly dialog: VersionDialog | null;
  readonly onDialog: (dialog: VersionDialog | null) => void;
}

function ActionButton({ action, block, onClick }: { readonly action: BarAction; readonly block: LibraryActionBlock | null; readonly onClick: () => void }) {
  const { t } = useTranslation('procurement');
  const Icon = ICONS[action];
  const reasonId = useId();
  if (block?.kind === 'hidden') return null;
  const disabled = block !== null;
  return (
    <span className="flex flex-col gap-0.5">
      <Button type="button" size="sm" variant={action === 'reject' ? 'outline' : action === 'approve' ? 'default' : 'secondary'} disabled={disabled} onClick={onClick} aria-describedby={block?.kind === 'explained' ? reasonId : undefined}>
        <Icon className="mr-1 h-4 w-4" aria-hidden />
        {t(`subcontracts.library.actions.${action}`)}
        {(action === 'approve' || action === 'reject') && <kbd className="ml-2 rounded border px-1 font-mono text-[10px] opacity-70">{action === 'approve' ? 'A' : 'R'}</kbd>}
      </Button>
      {block?.kind === 'explained' && <span id={reasonId} className="text-xs text-muted-foreground">{t(`subcontracts.library.reasons.${block.reason}`)}</span>}
    </span>
  );
}

function ApproveDateField({ value, onChange }: { readonly value: string | null; readonly onChange: (value: string | null) => void }) {
  const { t } = useTranslation('procurement');
  const id = useId();
  return (
    <span className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{t('subcontracts.library.actions.effectiveFrom')}</Label>
      <DatePickerField id={id} value={pickerDateOfKey(value)} onSelect={(date) => onChange(dateKeyOfPicker(date))} placeholder={t('subcontracts.library.actions.effectiveNow')} />
    </span>
  );
}

function DecisionDialog({ dialog, version, summary, actions, onClose }: { readonly dialog: VersionDialog } & Omit<VersionActionBarProps, 'dialog' | 'onDialog' | 'context'> & { readonly onClose: () => void }) {
  const { t } = useTranslation('procurement');
  const [effectiveFrom, setEffectiveFrom] = useState<string | null>(null);
  const send = (reason: string | null) => {
    if (dialog === 'approve') return actions.approve(version, effectiveFrom, reason);
    return dialog === 'reject' ? actions.reject(version, reason) : actions.withdraw(version, reason);
  };
  return (
    <ReasonDialog
      title={t(`subcontracts.library.dialog.${dialog}.title`, { version: version.version })}
      description={`${summary} — ${t(`subcontracts.library.dialog.${dialog}.description`)}`}
      confirmLabel={t(`subcontracts.library.actions.${dialog}`)}
      destructive={dialog === 'reject'}
      reasonRequired={dialog === 'reject'}
      extra={dialog === 'approve' ? <ApproveDateField value={effectiveFrom} onChange={setEffectiveFrom} /> : undefined}
      onSend={send}
      onClose={onClose}
    />
  );
}

export function VersionActionBar({ version, summary, context, actions, dialog, onDialog }: VersionActionBarProps) {
  const { t } = useTranslation('procurement');
  const { confirm, dialogProps } = useConfirmDialog();
  const markReviewed = async () => {
    const ok = await confirm({
      title: t('subcontracts.library.dialog.markReviewed.title', { version: version.version }),
      description: `${summary} — ${t('subcontracts.library.dialog.markReviewed.description')}`,
      confirmText: t('subcontracts.library.actions.markReviewed'),
    });
    if (ok) await actions.markReviewed(version);
  };
  const blocks = ORDER.map((action) => [action, versionActionBlock(action, version, context)] as const);
  if (blocks.every(([, block]) => block?.kind === 'hidden')) return null;
  return (
    <section aria-label={t('subcontracts.library.actions.title')} className="flex flex-wrap items-start gap-2 border-t pt-3">
      {blocks.map(([action, block]) => (
        <ActionButton key={action} action={action} block={block} onClick={() => (action === 'markReviewed' ? void markReviewed() : onDialog(action))} />
      ))}
      {dialog && <DecisionDialog dialog={dialog} version={version} summary={summary} actions={actions} onClose={() => onDialog(null)} />}
      <ConfirmDialog {...dialogProps} />
    </section>
  );
}
