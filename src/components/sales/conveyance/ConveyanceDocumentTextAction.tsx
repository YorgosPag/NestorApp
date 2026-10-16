'use client';

/**
 * ADR-915 §20 — «Ανάγνωση από το έγγραφο»: το δίχτυ της ανάγνωσης στο ανέβασμα, **μέσα** στον διάλογο ελέγχου.
 *
 * Εμφανίζεται μόνο όταν έχει νόημα: η γραμμή είναι είδος που διαβάζεται από κείμενο, το αρχείο είναι **του χώρου**, και
 * οι ημερομηνίες **δεν** έχουν ήδη διαβαστεί από το έγγραφο. Η έκβαση λέγεται **με όνομα** — «δεν αναγνωρίστηκε ως …»,
 * «είναι άλλο έγγραφο» — ποτέ ένα γενικό «απέτυχε»: αυτή είναι η πληροφορία που καμία αυτόματη ανάγνωση δεν δίνει.
 *
 * @module components/sales/conveyance/ConveyanceDocumentTextAction
 */

import React from 'react';
import { FileSearch, Loader2 } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Button } from '@/components/ui/button';
import { DOCUMENT_KIND_LABEL_KEYS } from '@/components/document-registry/document-registry-labels';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useCaseDocumentText, type CaseDocumentTextState } from '@/hooks/useCaseDocumentText';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';
import type { CaseDocumentTextRefusal, CaseDocumentTextResult } from '@/lib/conveyance/case-document-text';
import type { ReviewIssuedOn } from '@/lib/conveyance/review-attestation';
import type { DocumentKind } from '@/config/document-validity/document-validity';
import { documentTextReadersFor, type DocumentTextFacts } from '@/lib/document-validity/document-text-facts';
import type { ChecklistRow } from '@/types/conveyance-case';

/** Ολογράφως — οι πύλες i18n (3.8 · 3.13) διαβάζουν literals. `Record` ⇒ νέα άρνηση χωρίς μήνυμα δεν μεταγλωττίζεται. */
const REFUSAL_KEYS: Readonly<Record<CaseDocumentTextRefusal, string>> = {
  'not-text-readable': 'dialogs.documentText.notReadable',
  'no-file': 'dialogs.documentText.noFile',
  stale: 'dialogs.documentText.stale',
  'contributed-file': 'dialogs.documentText.contributedFile',
};

interface DocumentTextMessage {
  readonly key: string;
  readonly tone: 'muted' | 'warning';
  readonly found?: DocumentKind;
}

/** Η έκβαση → ένα μήνυμα. Κάθε κλάδος της ένωσης έχει **δικό του** όνομα (ο `switch` είναι εξαντλητικός). */
export function documentTextMessageOf(result: CaseDocumentTextResult): DocumentTextMessage {
  switch (result.kind) {
    case 'recorded':
      if (result.verdict === 'no-file') return { key: 'dialogs.documentText.noFile', tone: 'warning' };
      if (result.verdict === 'not-this-object') return { key: 'dialogs.documentText.changed', tone: 'warning' };
      return { key: 'dialogs.documentText.recorded', tone: 'muted' };
    case 'not-recognized':
      return { key: 'dialogs.documentText.notRecognized', tone: 'warning' };
    case 'kind-mismatch':
      return { key: 'dialogs.documentText.kindMismatch', tone: 'warning', found: result.found };
    case 'issue-date-unread':
      return { key: 'dialogs.documentText.issueDateUnread', tone: 'warning' };
    case 'unreadable':
      return { key: result.reason === 'too-large' ? 'dialogs.documentText.tooLarge' : 'dialogs.documentText.unreadable', tone: 'warning' };
    case 'not-tracked':
      return { key: 'dialogs.documentText.notReadable', tone: 'muted' };
    case 'refused':
      return { key: REFUSAL_KEYS[result.reason], tone: 'warning' };
  }
}

/** Έχει νόημα το κουμπί για αυτή τη γραμμή; */
export function canReadDocumentText(row: ChecklistRow, known: ReviewIssuedOn): boolean {
  const kind = row.item.documentKind;
  const file = row.files[0];
  return kind !== undefined
    && documentTextReadersFor([kind]).length > 0
    && file !== undefined
    && file.source.kind === 'owned'
    && known.origin !== 'document-text';
}

function StatusLine({ state, kind }: { readonly state: CaseDocumentTextState; readonly kind: DocumentKind }) {
  const { t } = useTranslation(['conveyance']);
  const colors = useSemanticColors();
  if (state.status === 'idle' || state.status === 'reading') return null;
  const message: DocumentTextMessage = state.status === 'failed' ? { key: 'dialogs.documentText.failed', tone: 'warning' } : documentTextMessageOf(state.result);
  const params = { kind: t(DOCUMENT_KIND_LABEL_KEYS[kind]), found: message.found ? t(DOCUMENT_KIND_LABEL_KEYS[message.found]) : '' };
  return (
    <p role="status" className={cn('text-xs', message.tone === 'warning' ? colors.text.warning : colors.text.muted)}>
      {t(message.key, params)}
    </p>
  );
}

interface ConveyanceDocumentTextActionProps {
  readonly caseId: string;
  readonly row: ChecklistRow;
  readonly known: ReviewIssuedOn;
  /** Ό,τι διαβάστηκε — ο διάλογος το δείχνει αμέσως (η όψη θα ακολουθήσει μέσω CDC). */
  readonly onRead: (facts: DocumentTextFacts) => void;
}

export function ConveyanceDocumentTextAction({ caseId, row, known, onRead }: ConveyanceDocumentTextActionProps) {
  const { t } = useTranslation(['conveyance']);
  const iconSizes = useIconSizes();
  const { state, read } = useCaseDocumentText(caseId);
  const kind = row.item.documentKind;
  const file = row.files[0];
  if (kind === undefined || file === undefined) return null;
  if (!canReadDocumentText(row, known) && state.status === 'idle') return null;

  const onClick = async () => {
    const result = await read(row.itemId, file.fileId);
    if (result?.kind === 'recorded' && (result.verdict === 'write' || result.verdict === 'already-recorded')) onRead(result.facts);
  };
  const reading = state.status === 'reading';
  return (
    <section className="space-y-1" aria-busy={reading}>
      {canReadDocumentText(row, known) && (
        <Button type="button" variant="outline" size="sm" onClick={onClick} disabled={reading}>
          {reading
            ? <Loader2 className={cn(iconSizes.sm, 'animate-spin')} aria-hidden="true" />
            : <FileSearch className={iconSizes.sm} aria-hidden="true" />}
          {reading ? t('dialogs.documentText.reading') : t('dialogs.documentText.action')}
        </Button>
      )}
      <StatusLine state={state} kind={kind} />
    </section>
  );
}
