'use client';
/**
 * ADR-656 M11 — «Κάναβος ΕΓΣΑ87»: the presentation controls for the coordinate graticule.
 *
 * Two concerns, one section (Civil 3D «Coordinate Grid»):
 *   1. A live-toggle for the on-screen graticule (crosses at round ΕΓΣΑ87 values + edge numbering),
 *      the F7-style overlay — it draws NO scene entities, just reflows on pan/zoom.
 *   2. «Αποτύπωση στο σχέδιο» (bake) — commit the grid as native line/text entities at a fixed step
 *      for a LEGAL topographic sheet (DXF/PDF export), via `completeEntities` (ADR-057).
 *
 * The panel owns NO geometry: it reads/sets the display store and calls `useTopoGrid`.
 * i18n: every string via `t()` (N.11). Styles: CSS module (N.3). Semantic structure (N.4).
 */

import * as React from 'react';
import { useTranslation } from '@/i18n';
import { getTopoState, subscribeTopo } from '../../../systems/topography/TopoPointStore';
import {
  getGridDisplayOptions,
  setTopoGridVisible,
  setTopoGridExportStepM,
  subscribeTopoGrid,
} from '../../../systems/topography/topo-grid-store';
import { useTopoGrid } from '../../../systems/topography/useTopoGrid';
import { TopoSectionStatus, type TopoSectionStatusState } from './TopoSectionStatus';
import styles from './TopographyPanel.module.css';

/** The preset export steps (metres) offered as quick buttons — the ΕΓΣΑ87 sheet conventions. */
const STEP_PRESETS_M = [50, 100, 200] as const;

export function TopoGridSection(): React.JSX.Element {
  const { t } = useTranslation('dxf-viewer-panels');
  const { bake } = useTopoGrid();

  // LOW-freq consumers (panel, not a canvas orchestrator) — ADR-040 permits useSyncExternalStore.
  const opts = React.useSyncExternalStore(subscribeTopoGrid, getGridDisplayOptions, getGridDisplayOptions);
  const topo = React.useSyncExternalStore(subscribeTopo, getTopoState, getTopoState);

  const pointCount = topo.surfaces.existing.points.length;
  const [status, setStatus] = React.useState<TopoSectionStatusState | null>(null);

  const onBake = React.useCallback(() => {
    const r = bake();
    if (r.ok) {
      setStatus({ text: t('topography.grid.status.baked', { count: r.entityCount }), error: false });
    } else {
      setStatus({ text: t(`topography.grid.error.${r.reason ?? 'no-points'}`), error: true });
    }
  }, [bake, t]);

  return (
    <section className={styles.field}>
      <h3 className={styles.label}>{t('topography.grid.title')}</h3>
      <p className={styles.subtitle}>{t('topography.grid.hint')}</p>

      <div className={styles.row}>
        <button
          type="button"
          className={`${styles.generateButton} ${opts.visible ? styles.toolActive : ''}`}
          onClick={() => setTopoGridVisible(!opts.visible)}
          aria-pressed={opts.visible}
        >
          {t('topography.grid.show')}
        </button>
      </div>

      <p className={styles.subtitle}>{t('topography.grid.stepLabel')}</p>
      <div className={styles.row}>
        {STEP_PRESETS_M.map((m) => (
          <button
            key={m}
            type="button"
            className={`${styles.generateButton} ${opts.exportStepM === m ? styles.toolActive : ''}`}
            onClick={() => setTopoGridExportStepM(m)}
            aria-pressed={opts.exportStepM === m}
          >
            {t('topography.grid.stepMeters', { m })}
          </button>
        ))}
      </div>

      <button
        type="button" className={styles.generateButton}
        onClick={onBake} disabled={pointCount === 0}
      >
        {t('topography.grid.bake')}
      </button>

      <TopoSectionStatus status={status} />
    </section>
  );
}
