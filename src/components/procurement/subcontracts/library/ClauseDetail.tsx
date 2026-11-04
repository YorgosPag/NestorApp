'use client';

/**
 * **Μια ρήτρα της βιβλιοθήκης** (ADR-928 Φ3γ-0): η έκδοση σε ισχύ όπως τυπώνεται · το χρονολόγιο με σύγκριση (ποιος
 * πρότεινε, ποιος αποφάσισε, πότε, γιατί) · οι μεταφράσεις · αρχειοθέτηση/επαναφορά.
 *
 * ⚠️ **Όχι `ActivityTab` εδώ, με μέτρηση** (2026-11-04): η τεμπέλικη καρτέλα φέρνει `common-audit` + `listing-detail` εκτός
 *    εκκίνησης ⇒ +2 τριάδες στο χρέος εισδοχής (ADR-744 §27: 336 σφραγισμένες, **μόνο συρρικνώνεται**). Το χρονολόγιο
 *    εκδόσεων είναι ήδη το ιστορικό της διακυβέρνησης· το ίχνος `subcontract_clause` γράφεται κανονικά στον διακομιστή.
 *
 * 🔑 Ανοιχτή πρόταση ⇒ σύνδεσμος στον **έλεγχο** (μία θέση απόφασης, όχι δύο).
 * 🔑 Η αρχειοθέτηση βγάζει τη ρήτρα από κάθε **νέο** συμφωνητικό (`approvedLibraryFrom` την αφήνει έξω)· τα υπάρχοντα
 *    κρατούν την καρφωμένη έκδοση. Θέλει ρητή επιβεβαίωση και `subcontracts:clauses:manage`.
 * Φορτώνεται με `import()` (ADR-744 §34).
 */

import { Archive, ArchiveRestore, FileClock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useClauseVersions } from '@/hooks/procurement/subcontracts/useSubcontractLibrary';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { resolveHumanLanguage } from '@/i18n/languages';
import { localizedIn } from '@/subapps/procurement/subcontracts/document/render-parameter-value';
import type { LibraryActionContext } from '@/subapps/procurement/subcontracts/library/library-action-blocks';
import type { SubcontractClause, SubcontractClauseVersion } from '@/subapps/procurement/subcontracts/types/clause';
import { ClauseTranslationsPanel } from './ClauseTranslationsPanel';
import { ClauseParametersTable, ClausePrintedText } from './ClauseText';
import { LibrarySection } from './LibrarySection';
import { LEGAL_REVIEW_VARIANT } from './library-labels';
import type { LibraryActions } from './useLibraryActions';
import { VersionActionBar } from './VersionActionBar';
import { VersionTimeline } from './VersionTimeline';

export interface ClauseDetailProps {
  readonly clause: SubcontractClause;
  readonly current: SubcontractClauseVersion | null;
  readonly context: LibraryActionContext;
  readonly actions: LibraryActions;
  readonly onOpenReview: () => void;
}

function ArchiveButton({ clause, context, actions }: Pick<ClauseDetailProps, 'clause' | 'context' | 'actions'>) {
  const { t } = useTranslation('procurement');
  const { confirm, dialogProps } = useConfirmDialog();
  const archiving = !clause.isArchived;
  const run = async () => {
    const ok = await confirm({
      title: t(`subcontracts.library.clauses.${archiving ? 'archive' : 'restore'}Title`),
      description: t(`subcontracts.library.clauses.${archiving ? 'archive' : 'restore'}Description`),
      confirmText: t(`subcontracts.library.clauses.${archiving ? 'archive' : 'restore'}`),
      variant: archiving ? 'destructive' : 'default',
    });
    if (ok) await actions.setClauseArchived(clause, archiving);
  };
  const Icon = archiving ? Archive : ArchiveRestore;
  return (
    <span className="flex flex-col gap-0.5">
      <Button type="button" size="sm" variant="outline" disabled={!context.canManage} onClick={() => void run()}>
        <Icon className="mr-1 h-4 w-4" aria-hidden />{t(`subcontracts.library.clauses.${archiving ? 'archive' : 'restore'}`)}
      </Button>
      {!context.canManage && <span className="text-xs text-muted-foreground">{t('subcontracts.library.reasons.notAuthorized')}</span>}
      <ConfirmDialog {...dialogProps} />
    </span>
  );
}

function DetailHeader({ clause, current, onOpenReview }: Pick<ClauseDetailProps, 'clause' | 'current' | 'onOpenReview'>) {
  const { t } = useTranslation('procurement');
  return (
    <header className="space-y-2">
      <p className="m-0 font-mono text-xs text-muted-foreground">{clause.clauseKey}</p>
      <p className="m-0 flex flex-wrap items-center gap-2 text-sm">
        {clause.isArchived && <Badge variant="outline">{t('subcontracts.library.clauses.archived')}</Badge>}
        {clause.currentVersion !== null
          ? <Badge variant="success">{t('subcontracts.library.clauses.inForce', { version: clause.currentVersion })}</Badge>
          : <Badge variant="outline">{t('subcontracts.library.clauses.noCurrent')}</Badge>}
        {current && <Badge variant={LEGAL_REVIEW_VARIANT[current.professionalReview]}>{t(`subcontracts.library.legal.${current.professionalReview}`)}</Badge>}
      </p>
      {clause.openProposal !== null && (
        <Button type="button" size="sm" variant="secondary" onClick={onOpenReview}>
          <FileClock className="mr-1 h-4 w-4" aria-hidden />{t('subcontracts.library.clauses.openReview', { version: clause.openProposal })}
        </Button>
      )}
    </header>
  );
}

export default function ClauseDetail({ clause, current, context, actions, onOpenReview }: ClauseDetailProps) {
  const { t, i18n } = useTranslation('procurement');
  const history = useClauseVersions(clause.id);
  const title = localizedIn(clause.title, resolveHumanLanguage(i18n.language));
  return (
    <article className="space-y-5 p-4">
      <DetailHeader clause={clause} current={current} onOpenReview={onOpenReview} />
      {current && (
        <>
          <LibrarySection id="clause-current" title={t('subcontracts.library.clauses.currentText')}><ClausePrintedText clause={current} /></LibrarySection>
          <LibrarySection id="clause-parameters" title={t('subcontracts.library.parameters.title')}><ClauseParametersTable parameters={current.parameters} /></LibrarySection>
          <VersionActionBar version={current} summary={title} context={context} actions={actions} dialog={null} onDialog={() => undefined} />
          <LibrarySection id="clause-translations" title={t('subcontracts.library.translations.title')}>
            <ClauseTranslationsPanel version={current} history={history.versions} context={context} actions={actions} />
          </LibrarySection>
        </>
      )}
      <LibrarySection id="clause-history" title={t('subcontracts.library.history.title')}>
        {history.loading ? <p className="text-sm text-muted-foreground" role="status">{t('subcontracts.library.loading')}</p> : <VersionTimeline versions={history.versions} />}
      </LibrarySection>
      <ArchiveButton clause={clause} context={context} actions={actions} />
    </article>
  );
}
