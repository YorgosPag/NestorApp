'use client';

/**
 * ADR-650 M10 — «Γεωαναφορά»: κουμπώνει το αρχιτεκτονικό DXF πάνω στο τοπογραφικό
 * (Revit Shared Coordinates). Δύο δρόμοι, όπως αποφάσισε ο Giorgio:
 *   - «Αυτόματο κούμπωμα» — robust-center μετατόπιση (γρήγορη εκτίμηση, Εύρημα #1).
 *   - «Κοινό σημείο» — pick γνωστού σημείου στο σχέδιο + πληκτρολόγηση ΕΓΣΑ (1 σημείο =
 *     μετατόπιση· 2 σημεία = + στροφή). Rigid (χωρίς κλίμακα).
 *
 * Το transform είναι per-project (ένα IfcSite, ADR-369 `basePoint`/`northRotation`):
 * optimistic `setGeoReference` (οι ισοϋψείς κουμπώνουν live) + debounce-free persist στο
 * Project. LOW-freq consumer (ADR-040 — επιτρεπτό `useSyncExternalStore`).
 *
 * i18n `dxf-viewer-panels` (`topography.geoRef.*`), no inline styles, semantic structure.
 */

import * as React from 'react';
import { useTranslation } from '@/i18n';
import type { Point2D } from '../../../rendering/types/Types';
import { useLevels } from '../../../systems/levels';
import { resolveActiveProjectId } from '../../../systems/levels/level-floor-resolution';
import { toolStateStore, useActiveTool } from '../../../stores/ToolStateStore';
import { getTopoState } from '../../../systems/topography/TopoPointStore';
import {
  getGeoReference, setGeoReference, subscribeGeoReference,
} from '../../../systems/geo-referencing/geo-reference-store';
import {
  getGeoRefPickState, subscribeGeoRefPick, armGeoRefPick, disarmGeoRefPick, clearGeoRefPicks,
  type GeoRefPickSlot,
} from '../../../systems/geo-referencing/geo-ref-pick-store';
import {
  fromOnePointPair, fromTwoPointPairs, pointPairScaleRatio,
} from '../../../systems/geo-referencing/geo-transform';
import { autoAlignByRobustCenters } from '../../../systems/geo-referencing/geo-auto-align';
import { sceneEntityCenters } from '../../../systems/geo-referencing/geo-ref-scene-points';
import {
  persistProjectGeoReference, clearProjectGeoReference,
} from '../../../systems/geo-referencing/geo-reference-persistence';
import styles from './TopographyPanel.module.css';

const M_TO_MM = 1000;
const MM_TO_M = 0.001;

interface Status { readonly text: string; readonly error: boolean }
interface EgsaInput { x: string; y: string }
type TFn = ReturnType<typeof useTranslation>['t'];

function parseNum(s: string): number | null {
  const v = Number(s);
  return s.trim() !== '' && Number.isFinite(v) ? v : null;
}

/** EGSA metres → canonical-mm world point, or `null` if either axis is blank/invalid. */
function egsaToWorldMm(e: EgsaInput): Point2D | null {
  const x = parseNum(e.x);
  const y = parseNum(e.y);
  return x !== null && y !== null ? { x: x * M_TO_MM, y: y * M_TO_MM } : null;
}

export function TopoGeoReferenceSection(): React.JSX.Element {
  const { t } = useTranslation('dxf-viewer-panels');
  const { levels, currentLevelId, getLevelScene, saveContext } = useLevels();
  const pickActive = useActiveTool() === 'geo-ref-anchor';

  const pick = React.useSyncExternalStore(subscribeGeoRefPick, getGeoRefPickState, getGeoRefPickState);
  const geo = React.useSyncExternalStore(subscribeGeoReference, getGeoReference, getGeoReference);

  const [egsa, setEgsa] = React.useState<[EgsaInput, EgsaInput]>([{ x: '', y: '' }, { x: '', y: '' }]);
  const [status, setStatus] = React.useState<Status | null>(null);

  const projectId = saveContext?.projectId ?? resolveActiveProjectId(levels) ?? null;

  const onEgsa = React.useCallback((slot: GeoRefPickSlot, axis: 'x' | 'y', value: string) => {
    setEgsa((prev) => {
      const next: [EgsaInput, EgsaInput] = [{ ...prev[0] }, { ...prev[1] }];
      next[slot][axis] = value;
      return next;
    });
  }, []);

  const onArm = React.useCallback((slot: GeoRefPickSlot) => {
    armGeoRefPick(slot);
    toolStateStore.selectTool('geo-ref-anchor');
  }, []);

  const persist = React.useCallback(async (g: ReturnType<typeof getGeoReference>) => {
    if (!projectId || !g) return;
    try {
      await persistProjectGeoReference(projectId, g);
    } catch {
      setStatus({ text: t('topography.geoRef.status.saveError'), error: true });
    }
  }, [projectId, t]);

  const onAutoAlign = React.useCallback(async () => {
    const scene = currentLevelId ? getLevelScene(currentLevelId) : null;
    const localPts = scene ? sceneEntityCenters(scene.entities) : [];
    const terrainPts = getTopoState().surfaces.existing.points.map((p) => ({ x: p.x, y: p.y }));
    const res = autoAlignByRobustCenters(localPts, terrainPts);
    if (!res) {
      setStatus({ text: t('topography.geoRef.status.autoNoData'), error: true });
      return;
    }
    setGeoReference(res.geo);
    await persist(res.geo);
    setStatus({ text: t('topography.geoRef.status.autoDone'), error: false });
  }, [currentLevelId, getLevelScene, persist, t]);

  const onApply = React.useCallback(async () => {
    const p0 = pick.points[0];
    const w0 = egsaToWorldMm(egsa[0]);
    if (!p0 || !w0) {
      setStatus({ text: t('topography.geoRef.status.needPoint'), error: true });
      return;
    }
    const p1 = pick.points[1];
    const w1 = egsaToWorldMm(egsa[1]);
    const next = p1 && w1 ? fromTwoPointPairs(p0, p1, w0, w1) : fromOnePointPair(p0, w0);
    if (p1 && w1) {
      const ratio = pointPairScaleRatio(p0, p1, w0, w1);
      if (Math.abs(ratio - 1) > 0.05) {
        setStatus({ text: t('topography.geoRef.scaleWarn', { ratio: ratio.toFixed(3) }), error: true });
      }
    }
    setGeoReference(next);
    await persist(next);
    setStatus((s) => s?.error ? s : { text: t('topography.geoRef.status.applied'), error: false });
  }, [pick.points, egsa, persist, t]);

  const onClear = React.useCallback(async () => {
    setGeoReference(null);
    clearGeoRefPicks();
    setEgsa([{ x: '', y: '' }, { x: '', y: '' }]);
    if (pickActive) toolStateStore.deselectTool();
    if (projectId) {
      try { await clearProjectGeoReference(projectId); } catch { /* keep optimistic clear */ }
    }
    setStatus({ text: t('topography.geoRef.status.cleared'), error: false });
  }, [pickActive, projectId, t]);

  const activeLabel = geo
    ? t('topography.geoRef.active', {
        x: (geo.originWorld.x * MM_TO_M).toFixed(2),
        y: (geo.originWorld.y * MM_TO_M).toFixed(2),
        rot: geo.rotationDeg.toFixed(2),
      })
    : t('topography.geoRef.inactive');

  return (
    <section className={styles.field}>
      <h3 className={styles.label}>{t('topography.geoRef.title')}</h3>
      <p className={styles.subtitle}>{t('topography.geoRef.hint')}</p>

      <button type="button" className={styles.generateButton} onClick={onAutoAlign}>
        {t('topography.geoRef.autoAlign')}
      </button>
      <p className={styles.subtitle}>{t('topography.geoRef.autoAlignHint')}</p>

      <PointRow slot={0} labelKey="topography.geoRef.point1" local={pick.points[0]}
        armed={pickActive && pick.armedSlot === 0} egsa={egsa[0]} onArm={onArm} onEgsa={onEgsa} t={t} />
      <PointRow slot={1} labelKey="topography.geoRef.point2" local={pick.points[1]}
        armed={pickActive && pick.armedSlot === 1} egsa={egsa[1]} onArm={onArm} onEgsa={onEgsa} t={t} />

      <div className={styles.row}>
        <button type="button" className={styles.generateButton} onClick={onApply} disabled={!pick.points[0]}>
          {t('topography.geoRef.apply')}
        </button>
        <button type="button" className={styles.generateButton} onClick={onClear}>
          {t('topography.geoRef.clear')}
        </button>
      </div>

      <p className={styles.status}>{activeLabel}</p>
      {status && (
        <p className={`${styles.status} ${status.error ? styles.statusError : ''}`}>{status.text}</p>
      )}
    </section>
  );
}

interface PointRowProps {
  readonly slot: GeoRefPickSlot;
  readonly labelKey: string;
  readonly local: Point2D | null;
  readonly armed: boolean;
  readonly egsa: EgsaInput;
  readonly onArm: (slot: GeoRefPickSlot) => void;
  readonly onEgsa: (slot: GeoRefPickSlot, axis: 'x' | 'y', value: string) => void;
  readonly t: TFn;
}

function PointRow(props: PointRowProps): React.JSX.Element {
  const { slot, labelKey, local, armed, egsa, onArm, onEgsa, t } = props;
  const localLabel = local
    ? t('topography.geoRef.picked', { x: (local.x * MM_TO_M).toFixed(2), y: (local.y * MM_TO_M).toFixed(2) })
    : t('topography.geoRef.notPicked');
  return (
    <section className={styles.field}>
      <h3 className={styles.label}>{t(labelKey)}</h3>
      <button
        type="button"
        className={`${styles.generateButton} ${armed ? styles.toolActive : ''}`}
        onClick={() => onArm(slot)}
        aria-pressed={armed}
      >
        {t(armed ? 'topography.geoRef.picking' : 'topography.geoRef.pick')}
      </button>
      <p className={styles.status}>{localLabel}</p>
      <div className={styles.row}>
        <input
          className={styles.input} type="number" inputMode="decimal"
          placeholder={t('topography.geoRef.egsaX')} aria-label={t('topography.geoRef.egsaX')}
          value={egsa.x} onChange={(e) => onEgsa(slot, 'x', e.target.value)}
        />
        <input
          className={styles.input} type="number" inputMode="decimal"
          placeholder={t('topography.geoRef.egsaY')} aria-label={t('topography.geoRef.egsaY')}
          value={egsa.y} onChange={(e) => onEgsa(slot, 'y', e.target.value)}
        />
      </div>
    </section>
  );
}
