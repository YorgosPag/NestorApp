'use client';

/**
 * @fileoverview **Μπάρα σύνοψης πρότασης** (ADR-923 §5.5.2 Α6): μετρητές, προβολή, «Επόμενο που θέλει απόφαση».
 * @module components/catalog/imports/ProposalSummaryBar
 */

import React from 'react';
import { ArrowDown } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { SegmentedControl, SegmentedControlItem } from '@/components/ui/segmented-control';
import { PROPOSAL_VIEWS, type ProposalSummary, type ProposalView } from './proposal-summary';
import { useImportText } from './import-text';

const VIEW_KEYS: Readonly<Record<ProposalView, string>> = {
  pending: 'review.viewPending',
  changes: 'review.viewChanges',
  all: 'review.viewAll',
};

interface ProposalSummaryBarProps {
  readonly summary: ProposalSummary;
  readonly unmapped: number;
  readonly view: ProposalView;
  readonly onView: (view: ProposalView) => void;
  readonly onNextPending: () => void;
}

/** Η εκκρεμότητα μένει στην κεφαλίδα, δίπλα στην έγκριση που κλειδώνει· εδώ ό,τι έχει ήδη κριθεί. */
function SummaryCounts({ summary, unmapped }: Pick<ProposalSummaryBarProps, 'summary' | 'unmapped'>) {
  const { t } = useImportText();
  const parts = [
    summary.acceptedByRule > 0 ? t('review.summaryAuto', { count: summary.acceptedByRule }) : null,
    summary.acceptedByHuman > 0 ? t('review.summaryHuman', { count: summary.acceptedByHuman }) : null,
    summary.rejected > 0 ? t('review.summaryRejected', { count: summary.rejected }) : null,
    summary.unchanged > 0 ? t('review.summaryUnchanged', { count: summary.unchanged }) : null,
    unmapped > 0 ? t('review.summaryUnmapped', { count: unmapped }) : null,
  ].filter((part): part is string => part !== null);
  return <p className="m-0 text-sm text-muted-foreground">{parts.join(' · ')}</p>;
}

export function ProposalSummaryBar({ summary, unmapped, view, onView, onNextPending }: ProposalSummaryBarProps) {
  const { t } = useImportText();
  return (
    <section className="flex flex-col gap-2" aria-label={t('review.summaryTitle')}>
      <SummaryCounts summary={summary} unmapped={unmapped} />
      <span className="flex flex-wrap items-center gap-2">
        <SegmentedControl<ProposalView> value={view} onValueChange={onView} aria-label={t('review.viewLabel')}>
          {PROPOSAL_VIEWS.map((key) => (
            <SegmentedControlItem key={key} value={key}>{t(VIEW_KEYS[key])}</SegmentedControlItem>
          ))}
        </SegmentedControl>
        {summary.pending > 0 ? (
          <Button type="button" size="sm" variant="outline" onClick={onNextPending}>
            <ArrowDown className="mr-1 h-3 w-3" aria-hidden />{t('review.nextPending')}
          </Button>
        ) : null}
      </span>
    </section>
  );
}
