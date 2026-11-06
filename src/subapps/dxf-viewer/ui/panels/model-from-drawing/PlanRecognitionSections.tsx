'use client';

/**
 * ADR-929 Φ5 — τα τμήματα του πάνελ «Μοντέλο από το σχέδιο» για την **πηγή εικόνα**: έναρξη της αναγνώρισης από το
 * υπόβαθρο του ορόφου, και σύνοψη του αποτελέσματος (τμήματα ανά βεβαιότητα, κλίμακα). Καθαρή παρουσίαση: δεν
 * διαβάζουν store, δεν γράφουν σκηνή· ό,τι αποφασίζει ο άνθρωπος φεύγει προς τα πάνω ως callback.
 *
 * @see ./ModelFromDrawingPanel.tsx (η σύνθεση)
 * @see ../../../systems/plan-recognition/plan-recognition-session.ts (ο ελεγκτής)
 */

import * as React from 'react';
import { ImageIcon, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type {
  PlanReadingReview,
  PlanRecognitionFailure,
  PlanRecognitionPhase,
} from '../../../systems/plan-recognition/plan-recognition-store';
import {
  PLAN_CONFIDENCE_ORDER,
  planConfidenceMark,
  type PlanConfidenceTier,
} from '../../../systems/plan-recognition/plan-confidence';
import { MUTED, SECTION_TITLE, type Translate } from './ModelFromDrawingSections';

/** Ό,τι χρειάζεται το πάνελ για την πηγή εικόνα — υπολογισμένο από τον host. */
export interface ImageSourceView {
  /** Ο ενεργός όροφος έχει υπόβαθρο-εικόνα. */
  readonly available: boolean;
  readonly phase: PlanRecognitionPhase;
  readonly failure: PlanRecognitionFailure | null;
  /** Η πηγή της τρέχουσας πρότασης είναι η εικόνα. */
  readonly active: boolean;
  readonly countsByTier: Readonly<Record<PlanConfidenceTier, number>> | null;
  /** ADR-929 Φ5.2ε — τμήματα κάτω από το όριο βεβαιότητας: φαίνονται στην εικόνα, δεν γίνονται τοίχοι. */
  readonly excludedFromWalls: number;
  /** Η θέση της εικόνας είναι βαθμονομημένη (χωρίς αυτήν καμία εγγραφή τοίχων). */
  readonly calibrated: boolean;
  /** ADR-929 Φ5.3β — υπάρχει αποτέλεσμα γεωμετρίας, άρα και όψη που μπορεί να διαβαστεί. */
  readonly readingAvailable: boolean;
  /** ADR-929 Φ5.3β — η όψη υπό έλεγχο πριν την ανάγνωση (`null` = κλειστή). */
  readonly review: PlanReadingReview | null;
}

/** Κάθε αποτυχία με ΡΗΤΟ κλειδί (CHECK 3.8). */
const FAILURE_LABEL_KEY: Readonly<Record<PlanRecognitionFailure, string>> = {
  'no-background': 'modelFromDrawing.image.failure.no-background',
  'no-pixels': 'modelFromDrawing.image.failure.no-pixels',
  'aligner-failed': 'modelFromDrawing.image.failure.aligner-failed',
  'no-segments': 'modelFromDrawing.image.failure.no-segments',
};

const TIER_LABEL_KEY: Readonly<Record<PlanConfidenceTier, string>> = {
  high: 'modelFromDrawing.image.confidence.high',
  medium: 'modelFromDrawing.image.confidence.medium',
  low: 'modelFromDrawing.image.confidence.low',
};

/** Δείγμα γραμμής ενός επιπέδου — το ΙΔΙΟ χρώμα και μοτίβο με την επικάλυψη. */
function TierSwatch({ tier }: { readonly tier: PlanConfidenceTier }): React.ReactElement {
  const mark = planConfidenceMark(tier);
  return (
    <svg width="30" height="10" viewBox="0 0 30 10" className="shrink-0" aria-hidden="true">
      <line
        x1="1" y1="5" x2="29" y2="5" stroke={mark.stroke} strokeWidth={mark.strokeWidth}
        strokeDasharray={mark.dash || undefined} strokeLinecap="round"
      />
    </svg>
  );
}

/** Στην επιλογή δείγματος: η δεύτερη πηγή, «από την εικόνα του υποβάθρου». */
export function ImageSourceStart({ view, onRecognize, t }: {
  readonly view: ImageSourceView;
  readonly onRecognize: () => void;
  readonly t: Translate;
}): React.ReactElement {
  const running = view.phase === 'running';
  return (
    <section className="flex flex-col gap-1.5 border-t border-border pt-2" data-testid="mfd-image-source">
      <p className={MUTED}>{t('modelFromDrawing.image.or')}</p>
      <Button
        type="button" size="sm" variant="outline" disabled={!view.available || running}
        onClick={onRecognize} data-testid="mfd-image-recognize"
      >
        {running
          ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
          : <ImageIcon className="size-3.5" aria-hidden="true" />}
        {running ? t('modelFromDrawing.image.running') : t('modelFromDrawing.image.start')}
      </Button>
      {view.available ? null : <p className={MUTED}>{t('modelFromDrawing.image.unavailable')}</p>}
      {view.failure
        ? <p className="m-0 text-[11px] text-destructive" role="status">{t(FAILURE_LABEL_KEY[view.failure])}</p>
        : null}
    </section>
  );
}

/** Στον έλεγχο, όταν η πηγή είναι η εικόνα: τι βρέθηκε, πόσο βέβαια, και αν μπορεί να γραφτεί. */
export function ImageSourceSummary({ view, onResample, t }: {
  readonly view: ImageSourceView;
  readonly onResample: () => void;
  readonly t: Translate;
}): React.ReactElement | null {
  if (!view.active || !view.countsByTier) return null;
  const counts = view.countsByTier;
  return (
    <section className="flex flex-col gap-1.5" data-testid="mfd-image-summary">
      <p className="m-0 flex items-center gap-1.5 text-xs text-foreground">
        <ImageIcon className="size-3.5 shrink-0" aria-hidden="true" />
        <span className="flex-1">{t('modelFromDrawing.image.source')}</span>
        <Button type="button" variant="ghost" size="xs" onClick={onResample}>
          {t('modelFromDrawing.sample.change')}
        </Button>
      </p>
      <h4 className={SECTION_TITLE}>{t('modelFromDrawing.image.confidence.title')}</h4>
      <ul className="m-0 flex list-none flex-col gap-1 p-0" data-testid="mfd-image-legend">
        {PLAN_CONFIDENCE_ORDER.map((tier) => (
          <li key={tier} className="flex items-center gap-2 text-xs text-foreground" data-tier={tier}>
            <TierSwatch tier={tier} />
            <span className="flex-1">{t(TIER_LABEL_KEY[tier])}</span>
            <span className="font-mono">{counts[tier]}</span>
          </li>
        ))}
      </ul>
      {view.excludedFromWalls > 0
        ? <p className={MUTED} data-testid="mfd-image-excluded">
            {t('modelFromDrawing.image.lowExcluded', { count: view.excludedFromWalls })}
          </p>
        : null}
      {view.calibrated
        ? null
        : <p className="m-0 text-[11px] text-foreground" role="status" data-testid="mfd-image-uncalibrated">
            {t('modelFromDrawing.image.needsCalibration')}
          </p>}
    </section>
  );
}
