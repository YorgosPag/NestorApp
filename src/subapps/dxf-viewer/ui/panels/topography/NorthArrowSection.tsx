'use client';
/**
 * ADR-656 M12 — «Βέλος Βορρά»: the presentation controls for the north arrow.
 *
 * A live-toggle HUD (top-right corner) plus the north mode (Civil 3D style):
 *   - Βορράς Κανάβου  — parallel to the ΕΓΣΑ87 grid (+Northing).
 *   - Πραγματικός     — Grid North + meridian convergence γ (geodetically correct). The default.
 * «Αποτύπωση στο σχέδιο» bakes the arrow as native entities for the legal sheet (DXF/PDF).
 *
 * The panel owns NO geometry: it reads/sets the north-arrow store and calls `useNorthArrow`.
 * i18n: every string via `t()` (N.11). Styles: CSS module (N.3). Semantic structure (N.4).
 */

import * as React from 'react';
import { useTranslation } from '@/i18n';
import { getTopoState, subscribeTopo } from '../../../systems/topography/TopoPointStore';
import {
  getNorthArrowOptions,
  setNorthArrowVisible,
  setNorthArrowMode,
  subscribeNorthArrow,
} from '../../../systems/topography/north-arrow-store';
import { useNorthArrow } from '../../../systems/topography/useNorthArrow';
import type { NorthMode } from '../../../systems/topography/north-arrow-config';
import { TopoSectionStatus, type TopoSectionStatusState } from './TopoSectionStatus';
import styles from './TopographyPanel.module.css';

/** The two north modes, in UI order (default first). */
const MODES: readonly { readonly mode: NorthMode; readonly key: string }[] = [
  { mode: 'true', key: 'topography.north.modeTrue' },
  { mode: 'grid', key: 'topography.north.modeGrid' },
];

export function NorthArrowSection(): React.JSX.Element {
  const { t } = useTranslation('dxf-viewer-panels');
  const { bake } = useNorthArrow();

  // LOW-freq consumers (panel, not a canvas orchestrator) — ADR-040 permits useSyncExternalStore.
  const opts = React.useSyncExternalStore(subscribeNorthArrow, getNorthArrowOptions, getNorthArrowOptions);
  const topo = React.useSyncExternalStore(subscribeTopo, getTopoState, getTopoState);

  const pointCount = topo.surfaces.existing.points.length;
  const [status, setStatus] = React.useState<TopoSectionStatusState | null>(null);

  const onBake = React.useCallback(() => {
    const r = bake();
    if (r.ok) {
      setStatus({ text: t('topography.north.status.baked', { count: r.entityCount }), error: false });
    } else {
      setStatus({ text: t(`topography.north.error.${r.reason ?? 'no-points'}`), error: true });
    }
  }, [bake, t]);

  return (
    <section className={styles.field}>
      <h3 className={styles.label}>{t('topography.north.title')}</h3>
      <p className={styles.subtitle}>{t('topography.north.hint')}</p>

      <div className={styles.row}>
        <button
          type="button"
          className={`${styles.generateButton} ${opts.visible ? styles.toolActive : ''}`}
          onClick={() => setNorthArrowVisible(!opts.visible)}
          aria-pressed={opts.visible}
        >
          {t('topography.north.show')}
        </button>
      </div>

      <div className={styles.row}>
        {MODES.map(({ mode, key }) => (
          <button
            key={mode}
            type="button"
            className={`${styles.generateButton} ${opts.mode === mode ? styles.toolActive : ''}`}
            onClick={() => setNorthArrowMode(mode)}
            aria-pressed={opts.mode === mode}
          >
            {t(key)}
          </button>
        ))}
      </div>

      <button
        type="button" className={styles.generateButton}
        onClick={onBake} disabled={pointCount === 0}
      >
        {t('topography.north.bake')}
      </button>

      <TopoSectionStatus status={status} />
    </section>
  );
}
