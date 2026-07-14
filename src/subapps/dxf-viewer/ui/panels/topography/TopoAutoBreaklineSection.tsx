'use client';
/**
 * ADR-650 M8β/Γ — «Αυτόματες γραμμές ασυνέχειας»: το σύστημα προτείνει, ο μηχανικός εγκρίνει.
 *
 * Ο δρόμος του Civil 3D («Extract feature lines from surface») και του CloudCompare: η μηχανή
 * διαβάζει την ΙΔΙΑ επιφάνεια που ήδη βλέπει ο χρήστης, βρίσκει πού σπάει το έδαφος και το
 * ΠΡΟΤΕΙΝΕΙ — δεν το γράφει. Καμία από τις δύο δεν βάζει feature line μόνη της, και το §9
 * (human-certifier) το απαγορεύει ρητά: χωρίς το κλικ «Προσθήκη», ο πίνακας σημείων μένει άθικτος.
 *
 * Deterministic, χωρίς LLM — μηδέν κόστος (ίδια πειθαρχία με το M5α «καμπανάκι», του οποίου
 * το pattern «τρέξε → δες → δράσε» ακολουθεί αυτούσιο αυτό το section).
 *
 * i18n: κάθε string μέσω `t()` (N.11). Styles: κοινό CSS module (N.3). Semantic (N.4).
 */

import * as React from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useTranslation } from '@/i18n';
import {
  detectAutoBreaklines,
  acceptAutoBreaklines,
} from '../../../systems/topography/auto-breaklines';
import {
  autoBreaklineStore,
  useAutoBreaklineState,
  selectedCandidates,
} from '../../../systems/topography/auto-breaklines/auto-breakline-store';
import type { AutoBreaklineCandidate } from '../../../systems/topography/auto-breaklines/auto-breakline-types';
import { mmToMetreString } from '../../../systems/topography/qa/topo-qa-format';
import { EventBus } from '../../../systems/events';
import styles from './TopographyPanel.module.css';

/** Περιθώριο (canonical mm) γύρω από την υποψήφια όταν εστιάζει η 2Δ όψη (~5 μ). */
const FOCUS_PAD_MM = 5_000;

/** Ζουμ της 2Δ όψης στην υποψήφια — κανονικό fit-to-bounds (ίδιος δρόμος με το πλήκτρο Z). */
function focusCandidate(candidate: AutoBreaklineCandidate): void {
  const xs = candidate.vertices.map((v) => v.x);
  const ys = candidate.vertices.map((v) => v.y);
  EventBus.emit('canvas-fit-to-view-selected', {
    bounds: {
      min: { x: Math.min(...xs) - FOCUS_PAD_MM, y: Math.min(...ys) - FOCUS_PAD_MM },
      max: { x: Math.max(...xs) + FOCUS_PAD_MM, y: Math.max(...ys) + FOCUS_PAD_MM },
    },
  });
}

interface RowProps {
  readonly candidate: AutoBreaklineCandidate;
  readonly approved: boolean;
}

function CandidateRow({ candidate, approved }: RowProps): React.JSX.Element {
  const { t } = useTranslation('dxf-viewer-panels');
  const label = t('topography.autoBreakline.candidate', {
    length: mmToMetreString(candidate.lengthMm, 1),
    angle: candidate.avgFoldDeg.toFixed(0),
    edges: candidate.edgeCount,
  });

  return (
    <div className={`${styles.abItem} ${approved ? '' : styles.abRejected}`}>
      <input
        type="checkbox"
        checked={approved}
        onChange={() => autoBreaklineStore.toggle(candidate.id)}
        aria-label={label}
      />
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={styles.abFocus}
            onClick={() => focusCandidate(candidate)}
          >
            {label}
            {candidate.closed ? ` ${t('topography.autoBreakline.candidateClosed')}` : ''}
          </button>
        </TooltipTrigger>
        <TooltipContent side="left">{t('topography.autoBreakline.focusHint')}</TooltipContent>
      </Tooltip>
    </div>
  );
}

export function TopoAutoBreaklineSection(): React.JSX.Element {
  const { t } = useTranslation('dxf-viewer-panels');
  const { report, selected } = useAutoBreaklineState();
  const [addedCount, setAddedCount] = React.useState<number | null>(null);

  const onRun = React.useCallback(() => {
    setAddedCount(null);
    autoBreaklineStore.setReport(detectAutoBreaklines('existing'));
  }, []);

  const onClear = React.useCallback(() => {
    setAddedCount(null);
    autoBreaklineStore.reset();
  }, []);

  // §9 — ΤΟ ΜΟΝΟ σημείο όπου γράφεται κάτι στην αποτύπωση, και μόνο ό,τι έχει τσεκάρει ο μηχανικός.
  const onAdd = React.useCallback(() => {
    const created = acceptAutoBreaklines(selectedCandidates(autoBreaklineStore.get()));
    autoBreaklineStore.reset();
    setAddedCount(created.length);
  }, []);

  return (
    <section className={styles.field}>
      <h3 className={styles.label}>{t('topography.autoBreakline.title')}</h3>
      <p className={styles.subtitle}>{t('topography.autoBreakline.hint')}</p>

      <div className={styles.row}>
        <button type="button" className={styles.generateButton} onClick={onRun}>
          {t('topography.autoBreakline.run')}
        </button>
        <button
          type="button" className={styles.generateButton}
          onClick={onClear} disabled={report === null}
        >
          {t('topography.autoBreakline.clear')}
        </button>
      </div>

      {addedCount !== null && (
        <p className={styles.status}>{t('topography.autoBreakline.added', { count: addedCount })}</p>
      )}

      {report?.notEnoughData && (
        <p className={styles.status}>{t('topography.autoBreakline.notEnoughData')}</p>
      )}

      {report && !report.notEnoughData && report.candidates.length === 0 && (
        <p className={styles.status}>{t('topography.autoBreakline.none')}</p>
      )}

      {report && report.candidates.length > 0 && (
        <>
          <p className={styles.status}>
            {t('topography.autoBreakline.found', { count: report.candidates.length })}
          </p>
          <div className={styles.row}>
            <button
              type="button" className={styles.generateButton}
              onClick={() => autoBreaklineStore.setAll(true)}
            >
              {t('topography.autoBreakline.selectAll')}
            </button>
            <button
              type="button" className={styles.generateButton}
              onClick={() => autoBreaklineStore.setAll(false)}
            >
              {t('topography.autoBreakline.selectNone')}
            </button>
          </div>

          <ul className={styles.qaList}>
            {report.candidates.map((candidate) => (
              <li key={candidate.id}>
                <CandidateRow candidate={candidate} approved={selected.has(candidate.id)} />
              </li>
            ))}
          </ul>

          {report.droppedByCap > 0 && (
            <p className={styles.status}>
              {t('topography.autoBreakline.dropped', { count: report.droppedByCap })}
            </p>
          )}

          <button
            type="button" className={styles.generateButton}
            onClick={onAdd} disabled={selected.size === 0}
          >
            {t('topography.autoBreakline.add', { count: selected.size })}
          </button>
        </>
      )}
    </section>
  );
}
