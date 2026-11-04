'use client';

/**
 * **Οι μεταφράσεις μιας έκδοσης** — ανά γλώσσα: κατάσταση, κείμενο όπως θα τυπωθεί, πράξεις (ADR-928 §5.2.2 · Φ3γ-0).
 *
 * 🔑 Η **μπαγιάτικη** λέγεται με το **τι** άλλαξε: η σύγκριση του ελληνικού από την έκδοση που μεταφράστηκε ως τη
 *    σημερινή (`staleSourceOf` + ο ίδιος `ClauseVersionDiffView`). Η επανα-μετάφραση γίνεται πάνω στις αλλαγμένες
 *    προτάσεις, όχι από την αρχή στα τυφλά.
 * 🔑 Πράξεις από τους **ίδιους** φύλακες με τον γραφέα: πρόταση σε **εγκεκριμένη** έκδοση (`versionActionBlock`) ·
 *    έγκριση μόνο τρέχουσας μετάφρασης, από **άλλον** (`translationApprovalBlock`).
 */

import { lazy, Suspense, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { documentLocaleOf, isDocumentLanguage } from '@/subapps/procurement/subcontracts/document/document-locale';
import { clausePrintedBlocks } from '@/subapps/procurement/subcontracts/library/clause-version-diff';
import { translationApprovalBlock, versionActionBlock, type LibraryActionBlock, type LibraryActionContext } from '@/subapps/procurement/subcontracts/library/library-action-blocks';
import { staleSourceOf, translationRowsOf, type TranslationRow } from '@/subapps/procurement/subcontracts/library/translation-status';
import { CLAUSE_AUTHORITATIVE_LANGUAGE, type SubcontractClauseVersion } from '@/subapps/procurement/subcontracts/types/clause';
import { DocumentBlocks } from '../document/AgreementDocumentPreview';
import { ClauseVersionDiffView } from './ClauseVersionDiffView';
import { TRANSLATION_STATE_VARIANT } from './library-labels';
import { useLanguageName } from './TranslationBadges';
import type { LibraryActions } from './useLibraryActions';
import { usePersonLabels } from './usePersonLabels';

const TranslationEditorDialog = lazy(() => import('./TranslationEditorDialog'));

interface ClauseTranslationsPanelProps {
  readonly version: SubcontractClauseVersion;
  readonly history: readonly SubcontractClauseVersion[];
  readonly context: LibraryActionContext;
  readonly actions: LibraryActions;
}

function BlockedButton({ label, block, onClick }: { readonly label: string; readonly block: LibraryActionBlock | null; readonly onClick: () => void }) {
  const { t } = useTranslation('procurement');
  if (block?.kind === 'hidden') return null;
  return (
    <span className="flex flex-col gap-0.5">
      <Button type="button" size="sm" variant="outline" disabled={block !== null} onClick={onClick}>{label}</Button>
      {block !== null && <span className="text-xs text-muted-foreground">{t(`subcontracts.library.reasons.${block.reason}`)}</span>}
    </span>
  );
}

function TranslationText({ version, row }: { readonly version: SubcontractClauseVersion; readonly row: TranslationRow }) {
  if (!row.translation) return null;
  const locale = documentLocaleOf(isDocumentLanguage(row.language) ? row.language : CLAUSE_AUTHORITATIVE_LANGUAGE);
  return (
    <article lang={row.language} className="space-y-2 rounded-md border bg-card p-3 text-sm">
      {row.translation.body.heading && <h5 className="m-0 font-semibold">{row.translation.body.heading}</h5>}
      <DocumentBlocks blocks={clausePrintedBlocks({ body: row.translation.body, parameters: version.parameters }, locale)} />
    </article>
  );
}

function TranslationItem({ row, onEdit, ...props }: ClauseTranslationsPanelProps & { readonly row: TranslationRow; readonly onEdit: () => void }) {
  const { t } = useTranslation('procurement');
  const languageName = useLanguageName();
  const person = usePersonLabels([row.translation?.proposedBy ?? null, row.translation?.approvedBy ?? null]);
  const { version, context, actions, history } = props;
  const source = row.state === 'stale' && row.translation ? staleSourceOf(version, row.translation, history) : null;
  const approveBlock = row.translation ? translationApprovalBlock(version, row.translation, context) : ({ kind: 'hidden' } as const);
  return (
    <li className="space-y-2 border-t pt-3">
      <p className="m-0 flex flex-wrap items-center gap-2 text-sm">
        <strong className="font-semibold">{languageName(row.language)}</strong>
        <Badge variant={TRANSLATION_STATE_VARIANT[row.state]}>{t(`subcontracts.library.translations.state.${row.state}`)}</Badge>
        {row.translation && <span className="text-xs text-muted-foreground">{t(`subcontracts.library.translations.origin.${row.translation.origin}`)} · {t('subcontracts.library.translations.by', { name: person(row.translation.proposedBy) })}</span>}
      </p>
      {row.state === 'stale' && (
        <section className="space-y-2">
          <p className="m-0 text-sm">{source ? t('subcontracts.library.translations.staleSince', { version: source.version }) : t('subcontracts.library.translations.staleUnknown')}</p>
          {source && <ClauseVersionDiffView before={source} after={version} />}
        </section>
      )}
      <TranslationText version={version} row={row} />
      <span className="flex flex-wrap gap-2">
        <BlockedButton label={t(row.translation ? 'subcontracts.library.translations.edit' : 'subcontracts.library.translations.propose')} block={versionActionBlock('proposeTranslation', version, context)} onClick={onEdit} />
        <BlockedButton label={t('subcontracts.library.translations.approve')} block={approveBlock} onClick={() => void actions.approveTranslation(version, row.language)} />
      </span>
    </li>
  );
}

export function ClauseTranslationsPanel(props: ClauseTranslationsPanelProps) {
  const languageName = useLanguageName();
  const [editing, setEditing] = useState<string | null>(null);
  return (
    <>
      <ul className="m-0 list-none space-y-3 p-0">
        {translationRowsOf(props.version).map((row) => <TranslationItem key={row.language} row={row} onEdit={() => setEditing(row.language)} {...props} />)}
      </ul>
      {editing && (
        <Suspense fallback={null}>
          <TranslationEditorDialog version={props.version} language={editing} languageName={languageName(editing)} actions={props.actions} onClose={() => setEditing(null)} />
        </Suspense>
      )}
    </>
  );
}
