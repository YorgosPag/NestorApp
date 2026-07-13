'use client';
/**
 * ADR-650 M6 — «Όγκοι χωματουργικών» (cut / fill): the deliverable the surveyor gets paid for.
 *
 * Three questions, in the order Civil 3D asks them:
 *   1. Against WHAT?  — a design level («σκάψε μέχρι το +12.50») or a designed ground surface.
 *   2. WHERE?         — the whole survey, or only inside the picked site boundary.
 *   3. → the answer   — cut / fill / net in m³, plus a second-method cross-check (ADR-650 §7).
 *
 * The panel owns NO arithmetic: the volumes come from the pure engine via `cut-fill-store`, and
 * mm³ → m³ happens through the units SSoT at this presentation edge (never inline `/1e9`).
 *
 * i18n: every string via `t()` (N.11). Styles: CSS module (N.3). Semantic structure (N.4).
 */

import * as React from 'react';
import { useTranslation } from '@/i18n';
import {
  getCutFillState,
  runCutFill,
  setCutFillDatumZMm,
  setCutFillMode,
  subscribeCutFill,
} from '../../../systems/topography/cut-fill-store';
import { getTopoState, subscribeTopo } from '../../../systems/topography/TopoPointStore';
import {
  getTerrain3DState,
  setTerrain3DStyle,
  setTerrain3DVisible,
  subscribeTerrain3D,
} from '../../../systems/topography/terrain-3d-store';
import { toolStateStore, useActiveTool } from '../../../stores/ToolStateStore';
import { areaMm2ToM2, volumeMm3ToM3 } from '../../../utils/scene-units';
import { TopoImportWizard } from './TopoImportWizard';
import styles from './TopographyPanel.module.css';

/** Presentation only — the engine is metric-agnostic (canonical mm in, mm³ out). */
const M_TO_MM = 1000;

function formatM3(volumeMm3: number): string {
  return volumeMm3ToM3(volumeMm3).toFixed(2);
}

function formatM2(areaMm2: number): string {
  return areaMm2ToM2(areaMm2).toFixed(2);
}

export function TopoCutFillSection(): React.JSX.Element {
  const { t } = useTranslation('dxf-viewer-panels');

  // LOW-freq consumers (panel, not a canvas orchestrator) — ADR-040 permits useSyncExternalStore.
  const cutFill = React.useSyncExternalStore(subscribeCutFill, getCutFillState, getCutFillState);
  const topo = React.useSyncExternalStore(subscribeTopo, getTopoState, getTopoState);
  const terrain3d = React.useSyncExternalStore(subscribeTerrain3D, getTerrain3DState, getTerrain3DState);

  const activeTool = useActiveTool();
  const boundaryToolActive = activeTool === 'topo-boundary';
  const [wizardOpen, setWizardOpen] = React.useState(false);

  const proposedCount = topo.surfaces.proposed.points.length;
  const surfaceMode = cutFill.mode === 'surface';
  const { result, crossCheck } = cutFill;

  const onToggleBoundaryTool = React.useCallback(() => {
    if (boundaryToolActive) toolStateStore.deselectTool();
    else toolStateStore.selectTool('topo-boundary');
  }, [boundaryToolActive]);

  const onDatumChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setCutFillDatumZMm(Number(e.target.value) * M_TO_MM);
  }, []);

  // Showing the analysis is part of ANSWERING: the table says how much, the coloured hill says
  // where. Running the numbers therefore switches the 3D terrain to the cut/fill style — Civil 3D
  // does exactly this when a volume analysis is created.
  const onCompute = React.useCallback(() => {
    const next = runCutFill();
    if (!next.result) return;
    setTerrain3DStyle('cutfill');
    setTerrain3DVisible(true);
  }, []);

  return (
    <section className={styles.field}>
      <h3 className={styles.label}>{t('topography.cutfill.title')}</h3>
      <p className={styles.subtitle}>{t('topography.cutfill.hint')}</p>

      {/* 1. Against what — the reference. */}
      <div className={styles.row}>
        <button
          type="button"
          className={`${styles.generateButton} ${!surfaceMode ? styles.toolActive : ''}`}
          onClick={() => setCutFillMode('datum')}
          aria-pressed={!surfaceMode}
        >
          {t('topography.cutfill.modeDatum')}
        </button>
        <button
          type="button"
          className={`${styles.generateButton} ${surfaceMode ? styles.toolActive : ''}`}
          onClick={() => setCutFillMode('surface')}
          aria-pressed={surfaceMode}
        >
          {t('topography.cutfill.modeSurface')}
        </button>
      </div>

      {!surfaceMode && (
        <div className={styles.field}>
          <label className={styles.label} htmlFor="topo-datum">{t('topography.cutfill.datumLabel')}</label>
          <input
            id="topo-datum" className={styles.input} type="number" step={0.05}
            value={cutFill.datumZMm / M_TO_MM} onChange={onDatumChange}
          />
        </div>
      )}

      {surfaceMode && (
        <div className={styles.field}>
          <button type="button" className={styles.generateButton} onClick={() => setWizardOpen(true)}>
            {t('topography.cutfill.importProposed')}
          </button>
          <p className={styles.status}>
            {proposedCount > 0
              ? t('topography.cutfill.proposedLoaded', { count: proposedCount })
              : t('topography.cutfill.proposedMissing')}
          </p>
        </div>
      )}

      {/* 2. Where — the optional site boundary. */}
      <div className={styles.row}>
        <button
          type="button"
          className={`${styles.generateButton} ${boundaryToolActive ? styles.toolActive : ''}`}
          onClick={onToggleBoundaryTool}
          aria-pressed={boundaryToolActive}
        >
          {t(boundaryToolActive ? 'topography.cutfill.boundaryStop' : 'topography.cutfill.boundaryPick')}
        </button>
      </div>
      <p className={styles.status}>
        {topo.boundary
          ? t('topography.cutfill.boundarySet', { count: topo.boundary.vertices.length })
          : t('topography.cutfill.boundaryNone')}
      </p>

      {/* 3. The answer. */}
      <button type="button" className={styles.generateButton} onClick={onCompute}>
        {t('topography.cutfill.compute')}
      </button>

      {cutFill.error && (
        <p className={`${styles.status} ${styles.statusError}`}>
          {t(`topography.cutfill.error.${cutFill.error}`)}
        </p>
      )}

      {result && (
        <table className={styles.resultTable}>
          <tbody>
            <tr>
              <th scope="row">{t('topography.cutfill.cut')}</th>
              <td>{t('topography.cutfill.volumeValue', { value: formatM3(result.cutVolumeMm3) })}</td>
              <td>{t('topography.cutfill.areaValue', { value: formatM2(result.cutAreaMm2) })}</td>
            </tr>
            <tr>
              <th scope="row">{t('topography.cutfill.fill')}</th>
              <td>{t('topography.cutfill.volumeValue', { value: formatM3(result.fillVolumeMm3) })}</td>
              <td>{t('topography.cutfill.areaValue', { value: formatM2(result.fillAreaMm2) })}</td>
            </tr>
            <tr className={styles.resultNet}>
              <th scope="row">
                {t(result.netVolumeMm3 >= 0 ? 'topography.cutfill.netSurplus' : 'topography.cutfill.netDeficit')}
              </th>
              <td>{t('topography.cutfill.volumeValue', { value: formatM3(Math.abs(result.netVolumeMm3)) })}</td>
              <td />
            </tr>
          </tbody>
        </table>
      )}

      {result && result.skippedTriangles > 0 && (
        <p className={styles.status}>
          {t('topography.cutfill.skipped', { count: result.skippedTriangles })}
        </p>
      )}

      {/* The CASS second opinion — a silent volume report is a volume report nobody can trust. */}
      {crossCheck && (
        <p className={`${styles.status} ${crossCheck.diverges ? styles.statusError : ''}`}>
          {t(crossCheck.diverges ? 'topography.cutfill.crossCheckWarn' : 'topography.cutfill.crossCheckOk', {
            value: crossCheck.divergencePct.toFixed(1),
          })}
        </p>
      )}

      {result && !terrain3d.visible && (
        <p className={styles.status}>{t('topography.cutfill.analysisHint')}</p>
      )}

      {wizardOpen && (
        <TopoImportWizard
          surface="proposed"
          onClose={() => setWizardOpen(false)}
          onImported={() => setWizardOpen(false)}
        />
      )}
    </section>
  );
}
