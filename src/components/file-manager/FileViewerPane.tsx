'use client';

/**
 * =============================================================================
 * ΤΟ ΠΛΑΙΣΙΟ ΤΟΥ ΘΕΑΤΗ — κάθε έκβαση της διεύθυνσης έχει ΟΨΗ (ADR-899 §9 θέμα 10)
 * =============================================================================
 *
 * Το `FilePreviewPanel` ξέρει να δείχνει **ένα αρχείο**. Δεν ξέρει — και δεν πρέπει να μάθει — τι σημαίνει
 * «η διεύθυνση ζήτησε ταυτότητα που δεν δείχνεται». Αυτό είναι εδώ: μήνυμα με όνομα και **επόμενο βήμα**, ή
 * λωρίδα ένδειξης πάνω από το πάνελ. Ποτέ άδειο πάνελ χωρίς εξήγηση.
 *
 * @module components/file-manager/FileViewerPane
 * @see lib/files/file-viewer-outcome — το κλειστό σύνολο των εκβάσεων
 */

import React from 'react';
import { Archive, FileQuestion, Inbox, ListFilter, Trash2, type LucideIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { fileShownBy, type FileViewerOutcome } from '@/lib/files/file-viewer-outcome';
import { cn } from '@/lib/utils';
import type { FileRecord } from '@/types/file-record';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

import { FilePreviewPanel } from './FilePreviewPanel';

type Outcome = FileViewerOutcome<FileRecord>;
type MessageKind = Extract<Outcome['kind'], 'trashed' | 'archived' | 'not-found'>;

/** Η όψη κάθε έκβασης-μηνύματος. `actionKey` μόνο όπου υπάρχει πραγματικό επόμενο βήμα. */
const MESSAGES: Record<MessageKind, { icon: LucideIcon; titleKey: string; hintKey: string; actionKey?: string }> = {
  trashed: { icon: Trash2, titleKey: 'viewer.trashedTitle', hintKey: 'viewer.trashedHint', actionKey: 'viewer.openTrash' },
  archived: { icon: Archive, titleKey: 'viewer.archivedTitle', hintKey: 'viewer.archivedHint' },
  'not-found': { icon: FileQuestion, titleKey: 'viewer.notFoundTitle', hintKey: 'viewer.notFoundHint' },
};

export interface FileViewerPaneProps {
  readonly outcome: Outcome;
  /** Σβήνει την επιλογή από τη διεύθυνση. */
  readonly onDismiss: () => void;
  readonly onClearFilters: () => void;
  readonly onOpenTrash: () => void;
  readonly onOpenInbox: () => void;
  readonly companyId?: string;
  readonly currentUserId?: string;
  readonly currentUserName?: string;
  readonly onRefresh?: () => void;
}

function ViewerMessage({ kind, onDismiss, onOpenTrash }: { kind: MessageKind; onDismiss: () => void; onOpenTrash: () => void }) {
  const { t } = useTranslation(['files']);
  const colors = useSemanticColors();
  const { icon: Icon, titleKey, hintKey, actionKey } = MESSAGES[kind];

  return (
    <section role="status" className="flex flex-col items-center justify-center h-full gap-2 p-8 text-center">
      <Icon className={cn('h-12 w-12 opacity-40', colors.text.muted)} aria-hidden="true" />
      <h2 className="text-sm font-medium">{t(titleKey)}</h2>
      <p className={cn('text-sm', colors.text.muted)}>{t(hintKey)}</p>
      <nav className="flex items-center gap-2 mt-2">
        {actionKey && <Button size="sm" onClick={onOpenTrash}>{t(actionKey)}</Button>}
        <Button size="sm" variant="outline" onClick={onDismiss}>{t('viewer.dismiss')}</Button>
      </nav>
    </section>
  );
}

/** Λωρίδα πάνω από το πάνελ: το αρχείο **δείχνεται**, αλλά κάτι οφείλει να ειπωθεί γι' αυτό. */
function ViewerNotice({ icon: Icon, text, actionLabel, onAction }: {
  icon: LucideIcon; text: string; actionLabel: string; onAction: () => void;
}) {
  const colors = useSemanticColors();
  return (
    <aside role="status" className={cn('flex items-center gap-2 px-3 py-1.5 border-b text-xs bg-muted/40', colors.text.muted)}>
      <Icon className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
      <span className="flex-1">{text}</span>
      <Button size="sm" variant="link" className="h-auto p-0 text-xs" onClick={onAction}>{actionLabel}</Button>
    </aside>
  );
}

export function FileViewerPane({
  outcome, onDismiss, onClearFilters, onOpenTrash, onOpenInbox, ...panel
}: FileViewerPaneProps) {
  const { t } = useTranslation(['files']);
  const colors = useSemanticColors();

  if (outcome.kind === 'resolving') {
    return (
      <section role="status" className={cn('flex items-center justify-center h-full gap-2 text-sm', colors.text.muted)}>
        <Spinner size="small" color="inherit" />
        <span>{t('viewer.resolving')}</span>
      </section>
    );
  }
  if (outcome.kind === 'trashed' || outcome.kind === 'archived' || outcome.kind === 'not-found') {
    return <ViewerMessage kind={outcome.kind} onDismiss={onDismiss} onOpenTrash={onOpenTrash} />;
  }

  return (
    <section className="flex flex-col h-full">
      {outcome.kind === 'shown' && outcome.hiddenByFilters && (
        <ViewerNotice icon={ListFilter} text={t('viewer.hiddenByFilters')} actionLabel={t('viewer.clearFilters')} onAction={onClearFilters} />
      )}
      {outcome.kind === 'inbox' && (
        <ViewerNotice icon={Inbox} text={t('viewer.inboxNotice')} actionLabel={t('viewer.openInbox')} onAction={onOpenInbox} />
      )}
      <FilePreviewPanel file={fileShownBy(outcome)} onClose={onDismiss} className="flex-1 min-h-0" {...panel} />
    </section>
  );
}
