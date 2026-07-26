'use client';
/**
 * ADR-650 M5α — «Έλεγχος ποιότητας» (QA καμπανάκι): the surveyor's blunder-detection pass.
 *
 * Deterministic, offline, zero-cost — «Run → review» (Civil 3D Surface statistics / Trimble
 * Business Center blunder detection). The button runs `runTopoQa`, the store holds the report,
 * this panel LISTS it (severity-sorted) and the sibling overlays drop a ⊙ marker per flag in
 * BOTH views. Nothing here edits the survey: the engineer certifies.
 *
 * Clicking a row zooms to the flag in whichever view is active (ADR-650 M5α.2) — 3D frames the
 * camera through the shared view-focus bus, 2D reuses the canonical `canvas-fit-to-view-selected`
 * SSoT (same path as the Z key). Mirror of `ClashReportPanel.focusClash`, and for the same reason:
 * a report row that silently does nothing in one of the two views reads as a broken report.
 *
 * i18n: every string via `t()` (N.11). Styles: shared CSS module (N.3). Semantic (N.4).
 */

import * as React from 'react';
import { useTranslation } from '@/i18n';
import { runTopoQa } from '../../../systems/topography/qa/run-topo-qa';
import { topoQaStore, useTopoQaReport, useTopoQaSelectedFlagId } from '../../../systems/topography/qa/topo-qa-store';
import type { TopoQaFlag, TopoQaSeverity } from '../../../systems/topography/qa/topo-qa-types';
import type { TopoSurfaceId } from '../../../systems/topography/topo-types';
import { EventBus } from '../../../systems/events';
import { useViewMode3DStore, selectIs3D } from '../../../bim-3d/stores/ViewMode3DStore';
import { requestViewFocus } from '../../../systems/coordination/view-focus-bus';
import { resolveTopoQaFlagWorld } from '../../../bim-3d/coordination/topo-qa-flag-world';
import styles from './TopographyPanel.module.css';

/**
 * Half-size (METRES) of the neighbourhood framed around a clicked flag — the ONE extent for both
 * views, so «zoom to» lands equally close whether you are in plan or orbiting. A survey blunder is
 * only legible next to its neighbours (that is what makes it a blunder), hence metres, not the
 * centimetres a clash needs.
 */
const TOPO_QA_FOCUS_HALF_EXTENT_M = 15;
/** The same extent in canonical mm — `flag.at` is WORLD canonical mm, which IS the 2D canvas frame. */
const FOCUS_PAD_MM = TOPO_QA_FOCUS_HALF_EXTENT_M * 1000;

const SEVERITY_CLASS: Readonly<Record<TopoQaSeverity, string>> = {
  high: styles.qaHigh!,
  medium: styles.qaMedium!,
  low: styles.qaLow!,
};

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

  if (selectIs3D(useViewMode3DStore.getState())) {
    // Convert HERE, in the survey domain (the bus carries three-world metres) — the SAME resolver
    // the 3D marker overlay uses, so the row and its own ⊙ can never point at different spots.
    const world = resolveTopoQaFlagWorld(flag, surfaceId);
    // `null` = no elevation anything can answer for. Framing the camera on an invented height
    // would send the engineer to the wrong place; doing nothing at least does not mislead.
    if (world) {
      requestViewFocus({ point: world, halfExtentM: TOPO_QA_FOCUS_HALF_EXTENT_M, preserveZoom });
    }
    return;
  }

  if (preserveZoom) {
    EventBus.emit('canvas-center-on-point', { point: flag.at });
    return;
  }
  EventBus.emit('canvas-fit-to-view-selected', {
    bounds: {
      min: { x: flag.at.x - FOCUS_PAD_MM, y: flag.at.y - FOCUS_PAD_MM },
      max: { x: flag.at.x + FOCUS_PAD_MM, y: flag.at.y + FOCUS_PAD_MM },
    },
  });
}

interface QaFlagRowProps {
  readonly flag: TopoQaFlag;
  readonly surfaceId: TopoSurfaceId;
  readonly selected: boolean;
}

function QaFlagRow({ flag, surfaceId, selected }: QaFlagRowProps): React.JSX.Element {
  const { t } = useTranslation('dxf-viewer-panels');
  return (
    <button
      type="button"
      className={`${styles.qaItem} ${SEVERITY_CLASS[flag.severity]} ${selected ? styles.qaItemSelected : ''}`}
      onClick={() => focusFlag(flag, surfaceId)}
      aria-label={t('topography.qa.focusHint')}
      aria-current={selected ? 'true' : undefined}
    >
      <span className={styles.qaDot} aria-hidden="true" />
      <span className={styles.qaMessage}>{t(flag.messageKey, flag.messageParams)}</span>
    </button>
  );
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
                <QaFlagRow
                  flag={flag}
                  surfaceId={report.surfaceId}
                  selected={flag.id === selectedFlagId}
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
