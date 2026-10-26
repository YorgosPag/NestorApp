'use client';
/**
 * ADR-650 M5α — «Έλεγχος ποιότητας» (QA καμπανάκι): the surveyor's blunder-detection pass.
 *
 * Deterministic, offline, zero-cost — «Run → review» (Civil 3D Surface statistics / Trimble
 * Business Center blunder detection). The button runs `runTopoQa`, the store holds the report,
 * this panel LISTS it (severity-sorted) and the sibling overlays drop a ⊙ marker per flag in
 * BOTH views. Nothing here edits the survey: the engineer certifies.
 *
 * Clicking a row zooms to the flag in whichever view is active (ADR-650 M5α.2) — the routing
 * itself is the topo {@link focusTopoReviewTarget} boundary (WORLD→DISPLAY, ADR-920 Β3.1) over the shared
 * `focusReviewTarget` SSoT (3D camera via the view-focus bus, 2D via
 * the canonical `canvas-*` EventBus events, same path as the Z key). Mirror of
 * `ClashReportPanel.focusClash`, and for the same reason: a report row that silently does nothing
 * in one of the two views reads as a broken report.
 *
 * i18n: every string via `t()` (N.11). Styles: shared CSS module (N.3). Semantic (N.4).
 */

import * as React from 'react';
import { useTranslation } from '@/i18n';
import { runTopoQa } from '../../../systems/topography/qa/run-topo-qa';
import { topoQaStore, useTopoQaReport, useTopoQaSelectedFlagId } from '../../../systems/topography/qa/topo-qa-store';
import type { TopoQaFlag } from '../../../systems/topography/qa/topo-qa-types';
import type { TopoSurfaceId } from '../../../systems/topography/topo-types';
import { focusTopoReviewTarget, TOPO_REVIEW_FOCUS_PAD_MM } from '../../../systems/topography/topo-review-focus';
import { resolveTopoQaFlagWorld } from '../../../bim-3d/coordination/topo-qa-flag-world';
import { TopoQaFlagRow } from './TopoQaFlagRow';
import styles from './TopographyPanel.module.css';

/**
 * Zoom to a flag in whichever view is active (3D focus bus ⟷ 2D fit-to-bounds EventBus SSoT) and
 * mark it as the one under inspection, so its ⊙ stands out among the others.
 *
 * The selection is recorded FIRST and unconditionally: even when 3D cannot resolve an elevation
 * (so the camera does not move), the engineer clicked that row and the list must say so. Tying the
 * highlight to a successful zoom would make a click look like it did nothing at all.
 */
function focusFlag(flag: TopoQaFlag, surfaceId: TopoSurfaceId): void {
  /**
   * FIRST jump of this review pass, or a subsequent one? Read BEFORE `select`, which overwrites it.
   *
   * The first click has no scale worth keeping — the engineer may be looking at the whole site — so
   * it frames the finding and establishes one. From then on the scale is THEIRS: every later row
   * slides the view over at whatever zoom they have since dialled in. Re-fitting each time would
   * quietly undo their zoom on every click, which is the behaviour Giorgio reported.
   *
   * The «pass» resets exactly when the selection does — a fresh Run or Clear (see `topoQaStore`).
   */
  const preserveZoom = topoQaStore.getSelectedFlagId() !== null;
  topoQaStore.select(flag.id);

  // `flag.at` is WORLD (ΕΓΣΑ): the topo boundary projects it for the 2D canvas (ADR-920 Β3.1 — before
  // it, a geo-referenced project zoomed ~4·10⁵ mm off). Non-finite coordinates → nothing moves, the row
  // still highlights. The 3D conversion stays a thunk and is the SAME resolver the 3D marker overlay uses,
  // so the row and its own ⊙ can never point at different spots.
  focusTopoReviewTarget([flag.at], TOPO_REVIEW_FOCUS_PAD_MM.point, () => resolveTopoQaFlagWorld(flag, surfaceId), preserveZoom);
}

export function TopoQaSection(): React.JSX.Element {
  const { t } = useTranslation('dxf-viewer-panels');
  const report = useTopoQaReport();
  const selectedFlagId = useTopoQaSelectedFlagId();

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
              <li key={flag.id}>
                <TopoQaFlagRow
                  flag={flag}
                  selected={flag.id === selectedFlagId}
                  onFocus={(f) => focusFlag(f, report.surfaceId)}
                  focusHintKey="topography.qa.focusHint"
                />
              </li>
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
