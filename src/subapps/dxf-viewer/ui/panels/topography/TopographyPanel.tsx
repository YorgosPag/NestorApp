/**
 * ADR-650 Milestone 1 — Topography panel (thinnest visible slice).
 *
 * "Load survey points → see contours" (Q10). A basic file load (X Y Z per line), an
 * interval + index-every field, and a Generate button that runs the deterministic core
 * and drops native contour entities onto the current level. The full import wizard,
 * smoothing switch and 3D view are Milestone 2 — this panel is intentionally minimal.
 *
 * All copy via i18n (N.11, `dxf-viewer-panels` namespace, `topography.*` keys); no inline
 * styles (N.3); semantic structure (section/header/label) (N.4).
 */

import * as React from 'react';
import { useTranslation } from '@/i18n';
import { setTopoPoints } from '../../../systems/topography/TopoPointStore';
import { parseTopoPoints } from '../../../systems/topography/parse-topo-points';
import { useTopoContours } from '../../../systems/topography/useTopoContours';
import { DEFAULT_CONTOUR_CONFIG } from '../../../systems/topography/contour-config';
import styles from './TopographyPanel.module.css';

/** Load state after a file has been parsed. */
interface LoadInfo {
  readonly count: number;
  readonly skipped: number;
}

export function TopographyPanel(): React.JSX.Element {
  const { t } = useTranslation('dxf-viewer-panels');
  const { generate } = useTopoContours();

  const [intervalM, setIntervalM] = React.useState(DEFAULT_CONTOUR_CONFIG.intervalMm / 1000);
  const [majorEvery, setMajorEvery] = React.useState(DEFAULT_CONTOUR_CONFIG.majorEvery);
  const [load, setLoad] = React.useState<LoadInfo | null>(null);
  const [status, setStatus] = React.useState<{ text: string; error: boolean } | null>(null);

  const onFile = React.useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { points, skipped } = parseTopoPoints(await file.text());
      setTopoPoints(points);
      setLoad({ count: points.length, skipped: skipped.length });
      setStatus(null);
    } catch {
      setStatus({ text: t('topography.status.readError'), error: true });
    }
  }, [t]);

  const onGenerate = React.useCallback(() => {
    const config = {
      ...DEFAULT_CONTOUR_CONFIG,
      intervalMm: Math.max(1, intervalM * 1000),
      majorEvery: Math.max(1, Math.round(majorEvery)),
    };
    const r = generate(config);
    if (r.ok) {
      setStatus({ text: t('topography.status.generated', { contours: r.contourCount, entities: r.entityCount }), error: false });
    } else {
      setStatus({ text: t(`topography.error.${r.reason ?? 'no-contours'}`), error: true });
    }
  }, [generate, intervalM, majorEvery, t]);

  return (
    <section className={styles.panel}>
      <header className={styles.header}>
        <h2 className={styles.title}>{t('topography.title')}</h2>
        <p className={styles.subtitle}>{t('topography.subtitle')}</p>
      </header>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="topo-file">{t('topography.loadLabel')}</label>
        <input id="topo-file" className={styles.input} type="file" accept=".csv,.txt,.xyz,.pts" onChange={onFile} />
        {load && (
          <p className={styles.status}>
            {t('topography.status.loaded', { count: load.count })}
            {load.skipped > 0 ? ` · ${t('topography.status.skipped', { count: load.skipped })}` : ''}
          </p>
        )}
      </div>

      <div className={styles.row}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="topo-interval">{t('topography.intervalLabel')}</label>
          <input
            id="topo-interval" className={styles.input} type="number" min={0.01} step={0.05}
            value={intervalM} onChange={(e) => setIntervalM(Number(e.target.value))}
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="topo-major">{t('topography.majorEveryLabel')}</label>
          <input
            id="topo-major" className={styles.input} type="number" min={1} step={1}
            value={majorEvery} onChange={(e) => setMajorEvery(Number(e.target.value))}
          />
        </div>
      </div>

      <button
        type="button" className={styles.generateButton}
        onClick={onGenerate} disabled={!load || load.count < 3}
      >
        {t('topography.generate')}
      </button>

      {status && (
        <p className={`${styles.status} ${status.error ? styles.statusError : ''}`}>{status.text}</p>
      )}
    </section>
  );
}
