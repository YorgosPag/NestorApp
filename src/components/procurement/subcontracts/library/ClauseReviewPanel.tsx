'use client';

/**
 * **Ο έλεγχος μιας πρότασης** (ADR-928 Φ3γ-0): ό,τι χρειάζεται ο εγκρίνων για να αποφασίσει, σε μία οθόνη —
 * το κείμενο όπως θα τυπωθεί · οι ζώνες · η σύγκριση με την έκδοση σε ισχύ · οι μεταφράσεις που κληρονομούνται ·
 * η επίπτωση σε πρότυπα και πρόχειρα · οι πράξεις με αιτίες.
 *
 * 🔑 Η σειρά είναι η σειρά της απόφασης: πρώτα **τι** εγκρίνω (κείμενο), μετά **τι αλλάζει** (σύγκριση), μετά **ποιον
 *    αγγίζει** (επίπτωση), και στο τέλος τα κουμπιά. Η έγκριση ζητά ορατό το πλήρες κείμενο: δεν υπάρχει σύντομη μορφή.
 * Φορτώνεται με `import()` από την ουρά (ADR-744 §34): κριτής, σύγκριση και κείμενα εκτός του slice της σελίδας.
 */

import { Badge } from '@/components/ui/badge';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { resolveHumanLanguage } from '@/i18n/languages';
import { localizedIn } from '@/subapps/procurement/subcontracts/document/render-parameter-value';
import type { LibraryActionContext } from '@/subapps/procurement/subcontracts/library/library-action-blocks';
import type { ReviewQueueItem } from '@/subapps/procurement/subcontracts/library/review-queue';
import type { SubcontractTradeTemplate } from '@/subapps/procurement/subcontracts/types/trade-template';
import { ClauseParametersTable, ClausePrintedText } from './ClauseText';
import { LibrarySection } from './LibrarySection';
import { ClauseUsagePanel } from './ClauseUsagePanel';
import { ClauseVersionDiffView } from './ClauseVersionDiffView';
import { LEGAL_REVIEW_VARIANT } from './library-labels';
import { TranslationBadges } from './TranslationBadges';
import type { LibraryActions } from './useLibraryActions';
import { usePersonLabels } from './usePersonLabels';
import { VersionActionBar, type VersionDialog } from './VersionActionBar';

export interface ClauseReviewPanelProps {
  readonly item: ReviewQueueItem;
  readonly templates: readonly SubcontractTradeTemplate[];
  readonly context: LibraryActionContext;
  readonly actions: LibraryActions;
  readonly dialog: VersionDialog | null;
  readonly onDialog: (dialog: VersionDialog | null) => void;
}

function ProposalHeader({ item }: { readonly item: ReviewQueueItem }) {
  const { t } = useTranslation('procurement');
  const person = usePersonLabels([item.proposal.proposedBy]);
  const { proposal, current } = item;
  return (
    <header className="space-y-2">
      <p className="m-0 flex flex-wrap items-center gap-2 text-sm">
        <Badge variant="warning">{t('subcontracts.library.version.label', { version: proposal.version })}</Badge>
        <span>{current ? t('subcontracts.library.review.replaces', { version: current.version }) : t('subcontracts.library.review.newClause')}</span>
        <Badge variant={LEGAL_REVIEW_VARIANT[proposal.professionalReview]}>{t(`subcontracts.library.legal.${proposal.professionalReview}`)}</Badge>
      </p>
      <p className="m-0 text-sm text-muted-foreground">{t('subcontracts.library.review.proposedBy', { name: person(proposal.proposedBy) })}</p>
      {proposal.proposalReason && <blockquote className="m-0 border-l-2 pl-3 text-sm">{proposal.proposalReason}</blockquote>}
    </header>
  );
}

export default function ClauseReviewPanel({ item, templates, context, actions, dialog, onDialog }: ClauseReviewPanelProps) {
  const { t, i18n } = useTranslation('procurement');
  const title = localizedIn(item.clause.title, resolveHumanLanguage(i18n.language));
  const summary = `${title} · ${t('subcontracts.library.version.label', { version: item.proposal.version })}`;
  return (
    <article className="space-y-5 p-4">
      <ProposalHeader item={item} />
      <LibrarySection id="review-text" title={t('subcontracts.library.review.text')}>
        <ClausePrintedText clause={item.proposal} />
      </LibrarySection>
      <LibrarySection id="review-parameters" title={t('subcontracts.library.parameters.title')}>
        <ClauseParametersTable parameters={item.proposal.parameters} />
      </LibrarySection>
      <LibrarySection id="review-diff" title={item.current ? t('subcontracts.library.diff.titleAgainst', { version: item.current.version }) : t('subcontracts.library.diff.title')}>
        <ClauseVersionDiffView before={item.current} after={item.proposal} />
      </LibrarySection>
      <LibrarySection id="review-translations" title={t('subcontracts.library.translations.title')}>
        <TranslationBadges version={item.proposal} />
      </LibrarySection>
      <ClauseUsagePanel clause={item.clause} templates={templates} />
      <VersionActionBar version={item.proposal} summary={summary} context={context} actions={actions} dialog={dialog} onDialog={onDialog} />
    </article>
  );
}
