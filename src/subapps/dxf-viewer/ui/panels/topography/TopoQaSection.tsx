'use client';
/**
 * ADR-650 M5α — «Έλεγχος ποιότητας» (QA καμπανάκι): the surveyor's blunder-detection pass.
 *
 * Deterministic, offline, zero-cost — «Run → review» (Civil 3D Surface statistics / Trimble
 * Business Center blunder detection). The button runs `runTopoQa`, the store holds the report,
 * this panel LISTS it (severity-sorted) and the sibling overlay drops a ⊙ marker per flag.
 * Clicking a row zooms the 2D view to it (the canonical `canvas-fit-to-view-selected` SSoT —
 * same path as the Z key / clash focus). Nothing here edits the survey: the engineer certifies.
 *
 * i18n: every string via `t()` (N.11). Styles: shared CSS module (N.3). Semantic (N.4).
 */

import * as React from 'react';
import { useTranslation } from '@/i18n';
import { runTopoQa } from '../../../systems/topography/qa/run-topo-qa';
import { topoQaStore, useTopoQaReport } from '../../../systems/topography/qa/topo-qa-store';
import type { TopoQaFlag, TopoQaSeverity } from '../../../systems/topography/qa/topo-qa-types';
import { EventBus } from '../../../systems/events';
import styles from './TopographyPanel.module.css';

/** Half-size (canonical mm) of the box the 2D view fits around a clicked flag (~15 m each side). */
const FOCUS_PAD_MM = 15_000;

const SEVERITY_CLASS: Readonly<Record<TopoQaSeverity, string>> = {
  high: styles.qaHigh!,
  medium: styles.qaMedium!,
  low: styles.qaLow!,
};

/** Zoom the 2D view to a flag — reuse the canonical fit-to-bounds path (flag.at is canvas units). */
function focusFlag(flag: TopoQaFlag): void {
  EventBus.emit('canvas-fit-to-view-selected', {
    bounds: {
      min: { x: flag.at.x - FOCUS_PAD_MM, y: flag.at.y - FOCUS_PAD_MM },
      max: { x: flag.at.x + FOCUS_PAD_MM, y: flag.at.y + FOCUS_PAD_MM },
    },
  });
}

function QaFlagRow({ flag }: { flag: TopoQaFlag }): React.JSX.Element {
  const { t } = useTranslation('dxf-viewer-panels');
  return (
    <button
      type="button"
      className={`${styles.qaItem} ${SEVERITY_CLASS[flag.severity]}`}
      onClick={() => focusFlag(flag)}
      aria-label={t('topography.qa.focusHint')}
    >
      <span className={styles.qaDot} aria-hidden="true" />
      <span className={styles.qaMessage}>{t(flag.messageKey, flag.messageParams)}</span>
    </button>
  );
}

export function TopoQaSection(): React.JSX.Element {
  const { t } = useTranslation('dxf-viewer-panels');
  const report = useTopoQaReport();

  const onRun = React.useCallback(() => topoQaStore.set(runTopoQa('existing')), []);
  const onClear = React.useCallback(() => topoQaStore.reset(), []);

  return (
    <section className={styles.field}>
      <h3 className={styles.label}>{t('topography.qa.title')}</h3>
      <p className={styles.subtitle}>{t('topography.qa.hint')}</p>

      <div className={styles.row}>
        <button type="button" className={styles.generateButton} onClick={onRun}>
          {t('topography.qa.run')}
        </button>
        <button
          type="button" className={styles.generateButton}
          onClick={onClear} disabled={report === null}
        >
          {t('topography.qa.clear')}
        </button>
      </div>

      {report?.notEnoughData && (
        <p className={styles.status}>{t('topography.qa.notEnoughData')}</p>
      )}

      {report && !report.notEnoughData && report.flags.length === 0 && (
        <p className={styles.status}>{t('topography.qa.allClear')}</p>
      )}

      {report && report.flags.length > 0 && (
        <>
          <div className={styles.qaCounts}>
            <span className={styles.qaHigh}>
              <span className={styles.qaDot} aria-hidden="true" />{t('topography.qa.countHigh', { count: report.counts.high })}
            </span>
            <span className={styles.qaMedium}>
              <span className={styles.qaDot} aria-hidden="true" />{t('topography.qa.countMedium', { count: report.counts.medium })}
            </span>
            <span className={styles.qaLow}>
              <span className={styles.qaDot} aria-hidden="true" />{t('topography.qa.countLow', { count: report.counts.low })}
            </span>
          </div>
          <ul className={styles.qaList}>
            {report.flags.map((flag) => (
              <li key={flag.id}><QaFlagRow flag={flag} /></li>
            ))}
          </ul>
          {report.droppedByCap > 0 && (
            <p className={styles.status}>{t('topography.qa.dropped', { count: report.droppedByCap })}</p>
          )}
        </>
      )}
    </section>
  );
}
