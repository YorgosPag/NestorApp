'use client';

/**
 * @fileoverview **Το υποσέλιδο κάθε επεξεργαστή του καταλόγου** — κατάσταση, Αποθήκευση, Απόρριψη, Διαγραφή
 *   (ADR-923 Φάση 1γ).
 * @module components/catalog/shared/EditorFooter
 *
 * 🔑 Η κατάσταση **λέγεται** με λέξη (`aria-live`): «Μη αποθηκευμένες αλλαγές» · «Αποθηκεύεται…» · «Αποθηκεύτηκε».
 * 🔑 Η αποθήκευση **κλειδώνει** όσο υπάρχουν ευρήματα στον πελάτη: ο γραφέας τρέχει τους ίδιους ελέγχους, άρα ένα
 *    γνωστό 422 δεν στέλνεται ποτέ. Η διαγραφή ζητά επιβεβαίωση (`ConfirmDialog`, SSoT).
 */

import React, { useState } from 'react';
import type { LucideIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import type { LocalizedText } from '@/i18n/localized-text';
import type { CatalogIssue } from '@/subapps/catalog/schema/catalog-issues';
import { useCatalogText } from './catalog-ui-hooks';
import type { DefinitionDraft, DraftStatus } from './use-definition-draft';

const STATUS_KEYS: Readonly<Record<DraftStatus, string>> = {
  clean: 'editor.status.clean',
  dirty: 'editor.status.dirty',
  saving: 'editor.status.saving',
  saved: 'editor.status.saved',
};

interface EditorFooterProps {
  /** Το πρόχειρο του επεξεργαστή — η κατάσταση και η απόρριψη έρχονται από εκεί. */
  readonly editor: Pick<DefinitionDraft<unknown>, 'status' | 'discard'>;
  /** Τα ευρήματα **του πελάτη** (κλειδώνουν την αποθήκευση). */
  readonly issues: readonly CatalogIssue[];
  readonly canManage: boolean;
  readonly onSave: () => void;
  /** Μόνο για υπάρχουσα οντότητα. */
  readonly onDelete?: () => void;
  /** Η οντότητα που διαγράφεται — το όνομά της στην επιβεβαίωση. */
  readonly record?: { readonly labels: LocalizedText; readonly code: string } | null;
  /** Μία επιπλέον ενέργεια (π.χ. «Νέα υποκατηγορία», «Διπλασιασμός») — δηλωτικά, ώστε τα κουμπιά να έχουν ΜΙΑ μορφή. */
  readonly extraAction?: EditorFooterAction | null;
}

export interface EditorFooterAction {
  readonly icon: LucideIcon;
  readonly label: string;
  readonly onClick: () => void;
  readonly disabled?: boolean;
}

export function EditorFooter({ editor, issues, canManage, onSave, onDelete, record, extraAction }: EditorFooterProps) {
  const { t, text } = useCatalogText();
  const { status, discard: onDiscard } = editor;
  const issueCount = issues.length;
  const deleteName = record ? text(record.labels, record.code) : '';
  const [confirmDelete, setConfirmDelete] = useState(false);
  if (!canManage) return <p className="m-0 border-t px-4 py-3 text-sm text-muted-foreground">{t('common.readOnly')}</p>;
  const canSave = status === 'dirty' && issueCount === 0;
  return (
    <footer className="flex flex-wrap items-center gap-2 border-t bg-card px-4 py-3">
      <p className="m-0 mr-auto text-sm text-muted-foreground" aria-live="polite">
        {issueCount > 0 ? t('editor.status.issues', { count: issueCount }) : t(STATUS_KEYS[status])}
      </p>
      {extraAction ? (
        <Button type="button" variant="outline" disabled={extraAction.disabled} onClick={extraAction.onClick}>
          <extraAction.icon className="mr-1 h-4 w-4" aria-hidden />{extraAction.label}
        </Button>
      ) : null}
      {onDelete ? (
        <Button type="button" variant="outline" className="text-destructive" onClick={() => setConfirmDelete(true)}>
          {t('common.delete')}
        </Button>
      ) : null}
      {status === 'dirty' ? (
        <Button type="button" variant="ghost" onClick={onDiscard}>{t('common.discard')}</Button>
      ) : null}
      <Button type="button" disabled={!canSave} onClick={onSave}>{t('common.save')}</Button>
      {onDelete ? (
        <ConfirmDialog
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          variant="destructive"
          title={t('editor.deleteTitle', { name: deleteName })}
          description={t('editor.deleteDescription')}
          confirmText={t('common.delete')}
          onConfirm={onDelete}
        />
      ) : null}
    </footer>
  );
}
