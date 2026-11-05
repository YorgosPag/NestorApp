'use client';

/**
 * Η γραμμή εργαλείων του επεξεργαστή (ADR-928 Φ3γ): κατάσταση του πρόχειρου (Google Docs: «Όλες οι αλλαγές
 * αποθηκεύτηκαν» / «Μη αποθηκευμένες αλλαγές»), Αποθήκευση, Απόρριψη αλλαγών, και η λωρίδα σύγκρουσης.
 *
 * 🔑 Η «Αποθήκευση» λέει **γιατί** δεν προσφέρεται (ελέγχεται · ευρήματα · σύγκρουση) — ποτέ σιωπηλά ανενεργό κουμπί.
 * 🔑 Σύγκρουση (`behind`): δύο ρητές επιλογές, καμία σιωπηλή — «Φόρτωσε τη νέα εκδοχή» (απορρίπτει τις δικές μου, με
 *    επιβεβαίωση) ή «Κράτα τις αλλαγές μου» (η επόμενη αποθήκευση αντικαθιστά συνειδητά την αλλαγή του άλλου).
 */

import { AlertTriangle, Loader2, Save, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { DraftStatus } from '@/hooks/drafts/useRevisionedDraft';
import type { EditorSaveBlock } from './useAgreementEditor';

/**
 * Ό,τι χρειάζεται η γραμμή εργαλείων από **οποιονδήποτε** επεξεργαστή πρόχειρου (συμφωνητικό · ρήτρα · πρότυπο,
 * ADR-928 §5.22) — δομικό συμβόλαιο, όχι ο τύπος ενός επεξεργαστή.
 */
export interface DraftEditorChrome {
  readonly status: DraftStatus;
  readonly unsaved: boolean;
  readonly behind: boolean;
  readonly saveBlock: EditorSaveBlock | null;
  readonly discard: () => void;
  readonly adoptLatestBase: () => void;
  readonly save: () => Promise<boolean>;
}

/** Οι λέξεις που αλλάζουν ανά επεξεργαστή (π.χ. «Υποβολή πρότασης» αντί για «Αποθήκευση») — ήδη μεταφρασμένες. */
export interface DraftEditorCopy {
  readonly status?: Readonly<Record<DraftStatus, string>>;
  readonly saveAction?: string;
  readonly conflictMessage?: string;
}

interface EditorToolbarProps {
  readonly editor: DraftEditorChrome;
  readonly copy?: DraftEditorCopy;
}

function useBlockText(): (block: EditorSaveBlock) => string | null {
  const { t } = useTranslation('procurement');
  return (block) => {
    switch (block.kind) {
      case 'clean':
      case 'saving': return null;
      case 'checking': return t('subcontracts.actions.checking');
      case 'conflict': return t('subcontracts.editor.save.blockedConflict');
      case 'notAuthorized': return t('subcontracts.library.reasons.notAuthorized');
      case 'proposalPending': return t('subcontracts.library.authoring.blockedProposalPending', { version: block.version });
      case 'issues': return t('subcontracts.editor.save.blockedIssues', { count: block.count });
    }
  };
}

export function ConflictBanner({ editor, copy }: EditorToolbarProps) {
  const { t } = useTranslation('procurement');
  const { confirm, dialogProps } = useConfirmDialog();
  if (!editor.behind) return null;
  const reload = async () => {
    const ok = await confirm({ title: t('subcontracts.editor.conflict.reloadTitle'), description: t('subcontracts.editor.conflict.reloadDescription'), confirmText: t('subcontracts.editor.conflict.reload'), variant: 'destructive' });
    if (ok) editor.discard();
  };
  return (
    <aside role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
      <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" aria-hidden />
      <span className="flex-1">{copy?.conflictMessage ?? t('subcontracts.editor.conflict.message')}</span>
      <Button type="button" size="sm" variant="outline" onClick={reload}>{t('subcontracts.editor.conflict.reload')}</Button>
      <Button type="button" size="sm" onClick={editor.adoptLatestBase}>{t('subcontracts.editor.conflict.keepMine')}</Button>
      <ConfirmDialog {...dialogProps} />
    </aside>
  );
}

export function EditorToolbar({ editor, copy }: EditorToolbarProps) {
  const { t } = useTranslation('procurement');
  const blockText = useBlockText();
  const { confirm, dialogProps } = useConfirmDialog();
  const reason = editor.saveBlock ? blockText(editor.saveBlock) : null;
  const discard = async () => {
    const ok = await confirm({ title: t('subcontracts.editor.discard.title'), description: t('subcontracts.editor.discard.description'), confirmText: t('subcontracts.editor.discard.confirm'), variant: 'destructive' });
    if (ok) editor.discard();
  };
  return (
    <header className="flex flex-wrap items-center gap-3">
      <p role="status" aria-live="polite" className="flex-1 text-sm text-muted-foreground">{copy?.status?.[editor.status] ?? t(`subcontracts.editor.status.${editor.status}`)}</p>
      {reason && <p className="text-sm text-muted-foreground">{reason}</p>}
      <Button type="button" variant="outline" disabled={!editor.unsaved} onClick={discard}>
        <Undo2 className="mr-2 h-4 w-4" aria-hidden />{t('subcontracts.editor.discard.action')}
      </Button>
      <Button type="button" disabled={editor.saveBlock !== null} onClick={() => void editor.save()}>
        {editor.status === 'saving' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : <Save className="mr-2 h-4 w-4" aria-hidden />}
        {copy?.saveAction ?? t('subcontracts.editor.save.action')}
      </Button>
      <ConfirmDialog {...dialogProps} />
    </header>
  );
}
