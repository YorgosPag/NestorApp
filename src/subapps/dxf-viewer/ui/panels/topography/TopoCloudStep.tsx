'use client';
/**
 * ADR-650 Milestone 8α — the point-cloud «bare-earth» step.
 *
 * A cloud is NOT a described table: there is nothing to map. Instead the engineer reviews HOW
 * the ground gets separated from everything else (source classification, honoured — or a CSF
 * filter, the same four knobs CloudCompare exposes) and how dense the surviving set is, runs the
 * filter, and — critically — SEES what got kept vs cut in a top-down scatter before approving.
 * That last part is the human-certifier step every serious tool (ReCap, CloudCompare, Civil 3D)
 * insists on; nothing here ever reaches `TopoPointStore` without the engineer looking at it.
 *
 * Same conventions as `TopoColumnMapStep`: Radix `@/components/ui/select` (ADR-001), i18n via
 * `t()` (N.11), CSS module (N.3).
 */

import * as React from 'react';
import { useTranslation } from '@/i18n';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PREVIEW_POINT_SIZE_PX } from '../../../systems/topography/pointcloud/pointcloud-defaults';
import type { CsfRigidness, VoxelRepresentative } from '../../../systems/topography/pointcloud/pointcloud-types';
import type { UseTopoImport } from './useTopoImport';
import { drawCloudPreview } from './topo-cloud-preview-canvas';
import styles from './TopoImportWizard.module.css';

const RIGIDNESS_VALUES: readonly CsfRigidness[] = [1, 2, 3];
const REPRESENTATIVE_VALUES: readonly VoxelRepresentative[] = ['lowest', 'mean'];

interface Props {
  readonly wizard: UseTopoImport;
}

export function TopoCloudStep({ wizard }: Props): React.JSX.Element {
  const { t } = useTranslation('dxf-viewer-panels');
  const { csf, decimate, forceCsf, cloudResult, cloudProgress, cloudError, busy } = wizard;

  return (
    <section className={styles.step}>
      <CsfParamsFieldset wizard={wizard} />
      <DecimateParamsFieldset wizard={wizard} />

      <label className={styles.checkboxField}>
        <input
          type="checkbox"
          checked={forceCsf}
          onChange={(e) => wizard.setForceCsf(e.target.checked)}
          disabled={busy}
        />
        <span>{t('topography.pointcloud.forceCsf')}</span>
      </label>

      <button
        type="button"
        className={styles.primaryButton}
        onClick={() => void wizard.runCloudFilter()}
        disabled={busy}
      >
        {t('topography.pointcloud.run')}
      </button>

      {busy && cloudProgress && (
        <p className={styles.status}>
          {t(`topography.pointcloud.stage.${cloudProgress.stageKey}`, { percent: Math.round(cloudProgress.ratio * 100) })}
        </p>
      )}
      {cloudError && <p className={`${styles.status} ${styles.statusError}`}>{t(cloudError)}</p>}

      {cloudResult && <CloudResultPanel result={cloudResult} csf={csf} decimate={decimate} />}
    </section>
  );
}

// ─── CSF parameters ─────────────────────────────────────────────────────────────

function CsfParamsFieldset({ wizard }: Props): React.JSX.Element {
  const { t } = useTranslation('dxf-viewer-panels');
  const { csf, busy } = wizard;

  return (
    <fieldset className={styles.cloudGrid}>
      <legend className={styles.sectionTitle}>{t('topography.pointcloud.csf.title')}</legend>
      <p className={styles.hint}>{t('topography.pointcloud.csf.hint')}</p>

      <label className={styles.field}>
        <span className={styles.label}>{t('topography.pointcloud.csf.clothResolution')}</span>
        <input
          type="number"
          className={styles.input}
          value={csf.clothResolutionMm}
          min={1}
          disabled={busy}
          onChange={(e) => wizard.updateCsf({ clothResolutionMm: Number(e.target.value) })}
        />
      </label>

      <label className={styles.field}>
        <span className={styles.label}>{t('topography.pointcloud.csf.classThreshold')}</span>
        <input
          type="number"
          className={styles.input}
          value={csf.classThresholdMm}
          min={1}
          disabled={busy}
          onChange={(e) => wizard.updateCsf({ classThresholdMm: Number(e.target.value) })}
        />
      </label>

      <label className={styles.field}>
        <span className={styles.label}>{t('topography.pointcloud.csf.rigidness')}</span>
        <Select
          value={String(csf.rigidness)}
          onValueChange={(v) => wizard.updateCsf({ rigidness: Number(v) as CsfRigidness })}
        >
          <SelectTrigger size="sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            {RIGIDNESS_VALUES.map((r) => (
              <SelectItem key={r} value={String(r)}>{t(`topography.pointcloud.csf.rigidnessValue.${r}`)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>

      <label className={styles.checkboxField}>
        <input
          type="checkbox"
          checked={csf.slopeSmoothing}
          disabled={busy}
          onChange={(e) => wizard.updateCsf({ slopeSmoothing: e.target.checked })}
        />
        <span>{t('topography.pointcloud.csf.slopeSmoothing')}</span>
      </label>
    </fieldset>
  );
}

// ─── Decimation parameters ────────────────────────────────────────────────────

function DecimateParamsFieldset({ wizard }: Props): React.JSX.Element {
  const { t } = useTranslation('dxf-viewer-panels');
  const { decimate, busy } = wizard;

  return (
    <fieldset className={styles.cloudGrid}>
      <legend className={styles.sectionTitle}>{t('topography.pointcloud.decimate.title')}</legend>

      <label className={styles.field}>
        <span className={styles.label}>{t('topography.pointcloud.decimate.cellSize')}</span>
        <input
          type="number"
          className={styles.input}
          value={decimate.cellSizeMm}
          min={1}
          disabled={busy}
          onChange={(e) => wizard.updateDecimate({ cellSizeMm: Number(e.target.value) })}
        />
      </label>

      <label className={styles.field}>
        <span className={styles.label}>{t('topography.pointcloud.decimate.representative')}</span>
        <Select
          value={decimate.representative}
          onValueChange={(v) => wizard.updateDecimate({ representative: v as VoxelRepresentative })}
        >
          <SelectTrigger size="sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            {REPRESENTATIVE_VALUES.map((r) => (
              <SelectItem key={r} value={r}>{t(`topography.pointcloud.decimate.representativeValue.${r}`)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>
    </fieldset>
  );
}

// ─── Result panel (the human-certifier surface) ───────────────────────────────

interface ResultProps {
  readonly result: NonNullable<UseTopoImport['cloudResult']>;
  readonly csf: UseTopoImport['csf'];
  readonly decimate: UseTopoImport['decimate'];
}

function CloudResultPanel({ result }: ResultProps): React.JSX.Element {
  const { t } = useTranslation('dxf-viewer-panels');
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) drawCloudPreview(canvas, result.preview, PREVIEW_POINT_SIZE_PX);
  }, [result]);

  return (
    <div className={styles.step}>
      <p className={styles.summary}>
        {t('topography.pointcloud.result.method', { method: t(`topography.pointcloud.method.${result.method}`) })}
      </p>

      <dl className={styles.resultGrid}>
        <div className={styles.resultStat}>
          <dt>{t('topography.pointcloud.result.ground')}</dt>
          <dd>{result.groundCount.toLocaleString()}</dd>
        </div>
        <div className={styles.resultStat}>
          <dt>{t('topography.pointcloud.result.nonGround')}</dt>
          <dd>{result.nonGroundCount.toLocaleString()}</dd>
        </div>
        <div className={styles.resultStat}>
          <dt>{t('topography.pointcloud.result.total')}</dt>
          <dd>{result.stats.totalPoints.toLocaleString()}</dd>
        </div>
      </dl>

      {result.stats.hasSourceClassification && (
        <p className={styles.hint}>{t('topography.pointcloud.result.sourceClassified')}</p>
      )}

      {result.warnings.length > 0 && (
        <ul className={styles.warningList}>
          {result.warnings.map((key) => <li key={key}>{t(key)}</li>)}
        </ul>
      )}

      <p className={styles.label}>{t('topography.pointcloud.result.previewLabel')}</p>
      <div className={styles.canvasWrap}>
        <canvas ref={canvasRef} className={styles.canvas} width={480} height={320} />
      </div>
    </div>
  );
}
