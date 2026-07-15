/**
 * Terrain3DSection — the «Έδαφος σε 3Δ» controls (ADR-650 M4 + M10d).
 *
 * Extracted from `TopographyPanel` (N.7.1 size + SRP): the surface show/hide + style toggle live
 * here alongside the M10d transparency sliders. Civil 3D «Surface Style transparency»: the surface
 * opacity is remembered PER style (μονόχρωμο / υψομετρικό / cut-fill) and the contour opacity is its
 * own control, so the user tunes each of the three overlays independently.
 *
 * LOW-freq `useSyncExternalStore` consumer (ADR-040 — a panel, not a canvas orchestrator). Semantic
 * structure + CSS-module classes only (N.3/N.4); all copy via `t()` (N.11).
 *
 * @module ui/panels/topography/Terrain3DSection
 */

import * as React from 'react';
import { useTranslation } from '@/i18n';
import { Slider } from '@/components/ui/slider';
import {
  getTerrain3DState,
  subscribeTerrain3D,
  setTerrain3DVisible,
  setTerrain3DStyle,
  setTerrainSurfaceOpacity,
  setTerrainContourOpacity,
} from '../../../systems/topography/terrain-3d-store';
import styles from './TopographyPanel.module.css';

/** One 0..1 opacity slider with a live percentage read-out (shared by the two rows below). */
function OpacityRow(props: {
  label: string;
  value: number;
  disabled: boolean;
  onChange: (value: number) => void;
}): React.JSX.Element {
  const { label, value, disabled, onChange } = props;
  return (
    <div className={styles.sliderRow}>
      <div className={styles.sliderHeader}>
        <span>{label}</span>
        <span className={styles.sliderValue}>{Math.round(value * 100)}%</span>
      </div>
      <Slider
        value={[value]}
        min={0}
        max={1}
        step={0.05}
        disabled={disabled}
        onValueChange={(v) => onChange(v[0] ?? 1)}
      />
    </div>
  );
}

export function Terrain3DSection(): React.JSX.Element {
  const { t } = useTranslation('dxf-viewer-panels');
  const terrain3d = React.useSyncExternalStore(subscribeTerrain3D, getTerrain3DState, getTerrain3DState);
  const hypsometric = terrain3d.style === 'hypsometric';
  const surfaceOpacity = terrain3d.surfaceOpacity[terrain3d.style] ?? 1;

  const onToggleTerrain = React.useCallback(() => setTerrain3DVisible(!getTerrain3DState().visible), []);
  const onToggleHypsometric = React.useCallback(
    () => setTerrain3DStyle(getTerrain3DState().style === 'hypsometric' ? 'shaded' : 'hypsometric'),
    [],
  );
  // The surface slider drives whichever style is active → each style keeps its own transparency.
  const onSurfaceOpacity = React.useCallback(
    (value: number) => setTerrainSurfaceOpacity(getTerrain3DState().style, value),
    [],
  );
  const onContourOpacity = React.useCallback((value: number) => setTerrainContourOpacity(value), []);

  return (
    <section className={styles.field}>
      <h3 className={styles.label}>{t('topography.terrain3d.title')}</h3>
      <p className={styles.subtitle}>{t('topography.terrain3d.hint')}</p>
      <div className={styles.row}>
        <button
          type="button"
          className={`${styles.generateButton} ${terrain3d.visible ? styles.toolActive : ''}`}
          onClick={onToggleTerrain}
          aria-pressed={terrain3d.visible}
        >
          {t(terrain3d.visible ? 'topography.terrain3d.hide' : 'topography.terrain3d.show')}
        </button>
        <button
          type="button"
          className={`${styles.generateButton} ${hypsometric ? styles.toolActive : ''}`}
          onClick={onToggleHypsometric}
          aria-pressed={hypsometric}
          disabled={!terrain3d.visible}
        >
          {t('topography.terrain3d.hypsometric')}
        </button>
      </div>
      <OpacityRow
        label={t('topography.terrain3d.surfaceOpacity')}
        value={surfaceOpacity}
        disabled={!terrain3d.visible}
        onChange={onSurfaceOpacity}
      />
      <OpacityRow
        label={t('topography.terrain3d.contourOpacity')}
        value={terrain3d.contourOpacity}
        disabled={!terrain3d.visible}
        onChange={onContourOpacity}
      />
    </section>
  );
}
