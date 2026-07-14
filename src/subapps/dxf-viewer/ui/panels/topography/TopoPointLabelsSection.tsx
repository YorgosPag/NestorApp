'use client';
/**
 * ADR-656 M10 — «Ετικέτες σημείων»: the presentation controls for survey-point labels.
 *
 * Three independent toggles (Civil 3D COGO point-label style), then a Generate button that
 * drops the label entities onto the current level:
 *   1. Υψόμετρα Ζ         — spot height (κουκίδα + δεκαδικό) on every point. The default.
 *   2. Αρ. / Κωδικός      — the point number and feature code beside each point.
 *   3. Χ,Υ κορυφών ορίου  — full coordinates, ONLY at the parcel boundary vertices.
 *
 * The panel owns NO geometry: it reads/sets the toggle store and calls `useTopoPointLabels`,
 * which builds native text/point entities through `completeEntities` (ADR-057).
 *
 * i18n: every string via `t()` (N.11). Styles: CSS module (N.3). Semantic structure (N.4).
 */

import * as React from 'react';
import { useTranslation } from '@/i18n';
import { getTopoState, subscribeTopo } from '../../../systems/topography/TopoPointStore';
import {
  getPointLabelOptions,
  setPointLabelOption,
  subscribePointLabelOptions,
} from '../../../systems/topography/topo-point-label-store';
import { useTopoPointLabels } from '../../../systems/topography/useTopoPointLabels';
import { TopoSectionStatus, type TopoSectionStatusState } from './TopoSectionStatus';
import styles from './TopographyPanel.module.css';

export function TopoPointLabelsSection(): React.JSX.Element {
  const { t } = useTranslation('dxf-viewer-panels');
  const { generate } = useTopoPointLabels();

  // LOW-freq consumers (panel, not a canvas orchestrator) — ADR-040 permits useSyncExternalStore.
  const opts = React.useSyncExternalStore(subscribePointLabelOptions, getPointLabelOptions, getPointLabelOptions);
  const topo = React.useSyncExternalStore(subscribeTopo, getTopoState, getTopoState);

  const pointCount = topo.surfaces.existing.points.length;
  const hasBoundary = !!topo.boundary;
  const [status, setStatus] = React.useState<TopoSectionStatusState | null>(null);

  const onGenerate = React.useCallback(() => {
    const r = generate(getPointLabelOptions());
    if (r.ok) {
      setStatus({ text: t('topography.pointLabels.status.generated', { count: r.entityCount }), error: false });
    } else {
      setStatus({ text: t(`topography.pointLabels.error.${r.reason ?? 'no-points'}`), error: true });
    }
  }, [generate, t]);

  return (
    <section className={styles.field}>
      <h3 className={styles.label}>{t('topography.pointLabels.title')}</h3>
      <p className={styles.subtitle}>{t('topography.pointLabels.hint')}</p>

      <div className={styles.row}>
        <button
          type="button"
          className={`${styles.generateButton} ${opts.showElevation ? styles.toolActive : ''}`}
          onClick={() => setPointLabelOption('showElevation', !opts.showElevation)}
          aria-pressed={opts.showElevation}
        >
          {t('topography.pointLabels.elevation')}
        </button>
        <button
          type="button"
          className={`${styles.generateButton} ${opts.showPointNumberCode ? styles.toolActive : ''}`}
          onClick={() => setPointLabelOption('showPointNumberCode', !opts.showPointNumberCode)}
          aria-pressed={opts.showPointNumberCode}
        >
          {t('topography.pointLabels.numberCode')}
        </button>
      </div>

      <div className={styles.row}>
        <button
          type="button"
          className={`${styles.generateButton} ${opts.showBoundaryXy ? styles.toolActive : ''}`}
          onClick={() => setPointLabelOption('showBoundaryXy', !opts.showBoundaryXy)}
          aria-pressed={opts.showBoundaryXy}
          disabled={!hasBoundary}
        >
          {t('topography.pointLabels.boundaryXy')}
        </button>
      </div>
      {!hasBoundary && (
        <p className={styles.status}>{t('topography.pointLabels.boundaryHint')}</p>
      )}

      <button
        type="button" className={styles.generateButton}
        onClick={onGenerate} disabled={pointCount === 0}
      >
        {t('topography.pointLabels.generate')}
      </button>

      <TopoSectionStatus status={status} />
    </section>
  );
}
