'use client';

/**
 * **Η ουρά ελέγχου** (ADR-928 Φ3γ-0): λίστα ανοιχτών προτάσεων | ο έλεγχος της επιλεγμένης, με πληκτρολόγιο.
 *
 * 🔑 J/K κίνηση · A/R ανοίγουν τον **ίδιο** διάλογο με το κουμπί (μόνο όταν η πράξη επιτρέπεται: ίδιος φύλακας) ·
 *    Enter = άνοιγμα στις «Ρήτρες». Ποτέ μέσα σε πεδίο, ποτέ μέσα σε διάλογο, ποτέ με τροποποιητή (`reviewCommandOf`).
 * 🔑 Μετά την απόφαση η ρήτρα φεύγει από την ουρά (ζωντανή ανάγνωση) και η επιλογή πηγαίνει σε όποια πήρε τη θέση της
 *    (`successorOf` — Gmail «archive → next»): ο έλεγχος 29 ρητρών είναι 29 αποφάσεις, όχι 29 αναζητήσεις.
 * 🔑 Η επιλογή ζει στη διεύθυνση (`?clause=`), κοινή με την καρτέλα «Ρήτρες» — το Enter αλλάζει μόνο καρτέλα.
 */

import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCheck, FileClock } from 'lucide-react';
import { SelectableListItem, SelectableListSection } from '@/components/shared/lists/SelectableList';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { resolveHumanLanguage } from '@/i18n/languages';
import { localizedIn } from '@/subapps/procurement/subcontracts/document/render-parameter-value';
import { versionActionBlock, type LibraryActionContext } from '@/subapps/procurement/subcontracts/library/library-action-blocks';
import { movedIndex, reviewCommandOf, successorOf, type ReviewCommand } from '@/subapps/procurement/subcontracts/library/review-keyboard';
import type { ReviewQueueItem } from '@/subapps/procurement/subcontracts/library/review-queue';
import { CatalogSplit } from '@/components/catalog/shared/CatalogSplit';
import type { LibraryActions } from './useLibraryActions';
import type { LibraryScreen } from './useLibraryScreen';
import type { VersionDialog } from './VersionActionBar';

const ClauseReviewPanel = lazy(() => import('./ClauseReviewPanel'));

interface ReviewTabProps {
  readonly screen: LibraryScreen;
  readonly context: LibraryActionContext;
  readonly actions: LibraryActions;
  readonly selected: string | null;
  readonly select: (clauseId: string | null) => void;
  readonly onOpenInClauses: () => void;
}

const EDITABLE = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

/** Πεδίο που δέχεται κείμενο **ή** οτιδήποτε μέσα σε διάλογο: εκεί τα γράμματα ανήκουν στον διάλογο. */
function capturesKeys(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || EDITABLE.has(target.tagName) || target.closest('[role="dialog"],[role="alertdialog"]') !== null;
}

/** Στοιχείο ελέγχου που κρατά το Enter για τον εαυτό του. */
const ownsEnter = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement && target.closest('button,a[href],[role="button"],[role="tab"],[role="option"]') !== null;

/** Η επιλογή ακολουθεί την ουρά: απόφαση ⇒ η επόμενη· άδεια ουρά ⇒ τίποτα. */
function useQueueSuccessor(ids: readonly string[], selected: string | null, select: (id: string | null) => void) {
  const previous = useRef(ids);
  useEffect(() => {
    if (selected !== null && !ids.includes(selected) && previous.current.includes(selected)) select(successorOf(previous.current, ids, selected));
    previous.current = ids;
  }, [ids, selected, select]);
}

function useReviewKeyboard(onCommand: (command: ReviewCommand) => void) {
  const latest = useRef(onCommand);
  latest.current = onCommand;
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const command = reviewCommandOf({ key: event.key, ctrlKey: event.ctrlKey, altKey: event.altKey, metaKey: event.metaKey, typing: capturesKeys(event.target), onControl: ownsEnter(event.target) });
      if (command === null || event.defaultPrevented) return;
      event.preventDefault();
      latest.current(command);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
}

function useCommandHandler(props: ReviewTabProps, current: ReviewQueueItem | null, openDialog: (dialog: VersionDialog) => void) {
  const ids = props.screen.queue.map((item) => item.clause.id);
  return (command: ReviewCommand) => {
    if (command === 'next' || command === 'previous') {
      const index = movedIndex(current ? ids.indexOf(current.clause.id) : -1, command, ids.length);
      if (index >= 0) props.select(ids[index]);
      return;
    }
    if (!current) return;
    if (command === 'open') return props.onOpenInClauses();
    if (versionActionBlock(command, current.proposal, props.context) === null) openDialog(command);
  };
}

function QueueItem({ item, selected, onSelect }: { readonly item: ReviewQueueItem; readonly selected: boolean; readonly onSelect: () => void }) {
  const { t, i18n } = useTranslation('procurement');
  const badges = [
    { label: t('subcontracts.library.version.label', { version: item.proposal.version }), variant: 'warning' as const },
    ...(item.current === null ? [{ label: t('subcontracts.library.review.newClause'), variant: 'outline' as const }] : []),
  ];
  return <SelectableListItem primary={localizedIn(item.clause.title, resolveHumanLanguage(i18n.language))} secondary={item.clause.clauseKey} icon={FileClock} badges={badges} selected={selected} onSelect={onSelect} />;
}

function QueueList({ screen, selected, select }: Pick<ReviewTabProps, 'screen' | 'selected' | 'select'>) {
  const { t } = useTranslation('procurement');
  return (
    <SelectableListSection title={t('subcontracts.library.tabs.review')} count={screen.queue.length}>
      <p className="m-0 px-2 text-xs text-muted-foreground">{t('subcontracts.library.review.keyboard')}</p>
      {screen.queue.map((item) => <QueueItem key={item.clause.id} item={item} selected={item.clause.id === selected} onSelect={() => select(item.clause.id)} />)}
      {screen.queueLoading && <p className="m-0 px-2 text-xs text-muted-foreground" role="status">{t('subcontracts.library.review.arriving')}</p>}
    </SelectableListSection>
  );
}

export function ReviewTab(props: ReviewTabProps) {
  const { t, i18n } = useTranslation('procurement');
  const { screen, selected, select } = props;
  const [dialog, setDialog] = useState<VersionDialog | null>(null);
  const ids = useMemo(() => screen.queue.map((item) => item.clause.id), [screen.queue]);
  const current = screen.queue.find((item) => item.clause.id === selected) ?? null;
  useQueueSuccessor(ids, selected, select);
  useReviewKeyboard(useCommandHandler(props, current, setDialog));
  useEffect(() => setDialog(null), [selected]);

  return (
    <CatalogSplit
      listLabel={t('subcontracts.library.tabs.review')}
      list={<QueueList screen={screen} selected={selected} select={select} />}
      open={current !== null}
      title={current ? localizedIn(current.clause.title, resolveHumanLanguage(i18n.language)) : ''}
      onClose={() => select(null)}
      empty={screen.queue.length === 0
        ? { icon: CheckCheck, title: t('subcontracts.library.review.emptyTitle'), description: t('subcontracts.library.review.emptyDescription') }
        : { icon: FileClock, title: t('subcontracts.library.review.chooseTitle'), description: t('subcontracts.library.review.chooseDescription') }}
      details={current && (
        <Suspense fallback={<p className="p-4 text-sm text-muted-foreground" role="status">{t('subcontracts.library.loading')}</p>}>
          <ClauseReviewPanel item={current} templates={screen.templates} context={props.context} actions={props.actions} dialog={dialog} onDialog={setDialog} />
        </Suspense>
      )}
    />
  );
}
