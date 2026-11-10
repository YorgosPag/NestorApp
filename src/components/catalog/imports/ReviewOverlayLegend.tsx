'use client';

/**
 * @fileoverview **Υπόμνημα και διακόπτης του χάρτη κατάστασης** (ADR-923 §5.5.2 Β8), πάνω από το PDF της αναθεώρησης.
 * @module components/catalog/imports/ReviewOverlayLegend
 *
 * 🔑 Κάθε δείγμα ζωγραφίζεται με τα **ίδια** συστατικά με το πλαίσιο (`ReviewMarkOutline` · `ReviewMarkBadge`) — ποτέ δεύτερη
 *    περιγραφή που μπορεί να αποκλίνει — **και** λέξη (CHECK 3.41: «ξέρω ποιο είναι ποιο χωρίς χρώμα;»).
 * 🔑 Διακόπτης «Πλαίσια» (Acrobat «Highlight existing fields»): κλειστός ⇒ μένει μόνο το επιλεγμένο.
 * 🔑 Πλαίσιο με πολλούς στόχους: «1 από 4 · Επόμενο» — ο άνθρωπος ξέρει ότι το κελί τροφοδοτεί κι άλλα πεδία.
 */

import React, { useId } from 'react';
import { ChevronRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { REVIEW_MARK_TONES, type ReviewMarkTone } from '@/subapps/catalog/import/review-marks';
import { REVIEW_TONE_KEYS, useImportText } from './import-text';
import { ReviewMarkBadge, ReviewMarkOutline } from './ImportReviewOverlay';
import type { ReviewBoxCycle } from './use-review-selection';

const SAMPLE = { width: 28, height: 16, glyph: 14 } as const;

function ToneSample({ tone }: { readonly tone: ReviewMarkTone }) {
  return (
    <svg width={SAMPLE.width + SAMPLE.glyph / 2} height={SAMPLE.height + SAMPLE.glyph / 2} className="shrink-0 rounded-sm bg-white" aria-hidden="true">
      <ReviewMarkOutline tone={tone} x={2} y={SAMPLE.glyph / 2} width={SAMPLE.width - 4} height={SAMPLE.height - 4} />
      <g transform={`translate(${SAMPLE.width - 2 - SAMPLE.glyph / 2} 0)`}><ReviewMarkBadge tone={tone} /></g>
    </svg>
  );
}

function CycleNote({ cycle, onNext }: { readonly cycle: ReviewBoxCycle; readonly onNext: () => void }) {
  const { t } = useImportText();
  return (
    <p className="m-0 flex flex-wrap items-center gap-2 text-xs" role="status">
      <span>{t('review.overlay.cycle', { index: cycle.index + 1, total: cycle.box.targets.length })}</span>
      <Button type="button" size="sm" variant="outline" onClick={onNext}>{t('review.overlay.next')}<ChevronRight className="ml-1 h-3 w-3" aria-hidden /></Button>
    </p>
  );
}

interface ReviewOverlayLegendProps {
  readonly counts: Readonly<Record<ReviewMarkTone, number>>;
  readonly showAll: boolean;
  readonly onShowAll: (show: boolean) => void;
  readonly cycle: ReviewBoxCycle | null;
  readonly onNext: () => void;
}

export function ReviewOverlayLegend({ counts, showAll, onShowAll, cycle, onNext }: ReviewOverlayLegendProps) {
  const { t } = useImportText();
  const switchId = useId();
  return (
    <section className="flex flex-col gap-2" aria-label={t('review.overlay.legend')}>
      <header className="flex flex-wrap items-center justify-between gap-2">
        <ul className="m-0 flex list-none flex-wrap gap-3 p-0 text-xs">
          {REVIEW_MARK_TONES.map((tone) => (
            <li key={tone} className="flex items-center gap-1">
              <ToneSample tone={tone} />
              <span>{t(REVIEW_TONE_KEYS[tone])}</span>
              <span className="text-muted-foreground">{counts[tone]}</span>
            </li>
          ))}
        </ul>
        <span className="flex items-center gap-2">
          <Switch id={switchId} checked={showAll} onCheckedChange={onShowAll} />
          <Label htmlFor={switchId} className="text-xs">{t('review.overlay.showBoxes')}</Label>
        </span>
      </header>
      {cycle ? <CycleNote cycle={cycle} onNext={onNext} /> : null}
    </section>
  );
}
