'use client';
/**
 * ADR-650 M7 — «Εξαγωγή φακέλου»: το ένα κουμπί που παράγει το ελληνικό παραδοτέο.
 *
 * Ρωτά μόνο ό,τι ΔΕΝ μπορεί να ξέρει από τα δεδομένα: τι λέει ο **τίτλος** (εμβαδόν/περίμετρος
 * συμβολαίου) και αν το οικόπεδο είναι **εντός ή εκτός σχεδίου** — γιατί αυτά και μόνο αυτά
 * καθορίζουν την ανοχή του §10 (±5% / ±10%). Όλα τα υπόλοιπα (σημεία, όριο, επιφάνεια, όγκοι)
 * υπάρχουν ήδη.
 *
 * Το panel δεν κάνει καμία αριθμητική: κρίνει ο νομικός κανόνας (`greek-survey-rules`), χτίζει ο
 * καθαρός πυρήνας (`buildSurveyDeliverables`), ενορχηστρώνει το `useSurveyExport`.
 *
 * i18n: κάθε string μέσω `t()` (N.11). Styles: CSS module (N.3). Semantic structure (N.4).
 */

import * as React from 'react';
import { useTranslation } from '@/i18n';
import { getTopoState, subscribeTopo } from '../../../systems/topography/TopoPointStore';
import type { PlotZone } from '../../../systems/topography/deliverables/greek-survey-rules';
import {
  useSurveyExport,
  type SurveyExportOutcome,
} from '../../../systems/topography/deliverables/useSurveyExport';
import styles from './TopographyPanel.module.css';

/** Η κλίμακα σχεδίου των ελληνικών τοπογραφικών· 1:200 είναι η συνήθης για διάγραμμα οικοπέδου. */
const DEFAULT_SCALE_DENOMINATOR = 200;

/** Κενό πεδίο ⇒ «δεν δηλώθηκε» (`null`), ΠΟΤΕ 0 — το 0 θα περνούσε ως δηλωμένη τιμή. */
function toDeclared(value: string): number | null {
  if (value.trim() === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function TopoDeliverablesSection(): React.JSX.Element {
  const { t } = useTranslation('dxf-viewer-panels');
  const { exportFolder } = useSurveyExport();

  // LOW-freq consumer (panel, όχι canvas orchestrator) — ADR-040 επιτρέπει useSyncExternalStore.
  const topo = React.useSyncExternalStore(subscribeTopo, getTopoState, getTopoState);
  const pointCount = topo.surfaces.existing.points.length;

  const [areaText, setAreaText] = React.useState('');
  const [perimeterText, setPerimeterText] = React.useState('');
  const [zone, setZone] = React.useState<PlotZone>('out-of-plan');
  const [scale, setScale] = React.useState(DEFAULT_SCALE_DENOMINATOR);
  const [projectName, setProjectName] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [outcome, setOutcome] = React.useState<SurveyExportOutcome | null>(null);

  const fallbackName = t('topography.deliverables.defaultProjectName');

  const onExport = React.useCallback(async () => {
    setBusy(true);
    try {
      const result = await exportFolder({
        declared: {
          areaM2: toDeclared(areaText),
          perimeterM: toDeclared(perimeterText),
          zone,
        },
        scaleDenominator: scale,
        projectName: projectName.trim() === '' ? fallbackName : projectName.trim(),
      });
      setOutcome(result);
    } finally {
      setBusy(false);
    }
  }, [areaText, exportFolder, fallbackName, perimeterText, projectName, scale, zone]);

  const verdict = outcome?.deliverables?.verdict ?? null;

  return (
    <section className={styles.field}>
      <h3 className={styles.label}>{t('topography.deliverables.title')}</h3>
      <p className={styles.subtitle}>{t('topography.deliverables.hint')}</p>

      {/* Τι λέει ο τίτλος — χωρίς αυτό δεν υπάρχει έλεγχος ανοχής, μόνο μέτρηση. */}
      <div className={styles.row}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="topo-declared-area">
            {t('topography.deliverables.declaredArea')}
          </label>
          <input
            id="topo-declared-area" className={styles.input} type="number" min={0} step={0.01}
            value={areaText} onChange={(e) => setAreaText(e.target.value)}
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="topo-declared-perimeter">
            {t('topography.deliverables.declaredPerimeter')}
          </label>
          <input
            id="topo-declared-perimeter" className={styles.input} type="number" min={0} step={0.01}
            value={perimeterText} onChange={(e) => setPerimeterText(e.target.value)}
          />
        </div>
      </div>

      {/* Εντός/εκτός σχεδίου — καθορίζει ΜΟΝΟ την ανοχή εμβαδού (±5% / ±10%, §10). */}
      <div className={styles.row}>
        <button
          type="button"
          className={`${styles.generateButton} ${zone === 'in-plan' ? styles.toolActive : ''}`}
          onClick={() => setZone('in-plan')}
          aria-pressed={zone === 'in-plan'}
        >
          {t('topography.deliverables.zoneInPlan')}
        </button>
        <button
          type="button"
          className={`${styles.generateButton} ${zone === 'out-of-plan' ? styles.toolActive : ''}`}
          onClick={() => setZone('out-of-plan')}
          aria-pressed={zone === 'out-of-plan'}
        >
          {t('topography.deliverables.zoneOutOfPlan')}
        </button>
      </div>

      <div className={styles.row}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="topo-project-name">
            {t('topography.deliverables.projectName')}
          </label>
          <input
            id="topo-project-name" className={styles.input} type="text"
            placeholder={fallbackName}
            value={projectName} onChange={(e) => setProjectName(e.target.value)}
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="topo-scale">
            {t('topography.deliverables.scaleLabel')}
          </label>
          <input
            id="topo-scale" className={styles.input} type="number" min={1} step={10}
            value={scale} onChange={(e) => setScale(Number(e.target.value))}
          />
        </div>
      </div>

      <button
        type="button" className={styles.generateButton}
        onClick={onExport} disabled={busy || pointCount === 0}
      >
        {t(busy ? 'topography.deliverables.exporting' : 'topography.deliverables.export')}
      </button>

      {outcome && !outcome.ok && (
        <p className={`${styles.status} ${styles.statusError}`}>
          {t(`topography.deliverables.error.${outcome.reason ?? 'no-points'}`)}
        </p>
      )}

      {outcome?.ok && outcome.zipName && (
        <p className={styles.status}>
          {t('topography.deliverables.done', {
            file: outcome.zipName,
            tables: outcome.placedTables,
          })}
        </p>
      )}

      {/* Ό,τι λείπει ΔΕΝ σιωπά — ο μηχανικός πρέπει να ξέρει τι δεν μπήκε στον φάκελο. */}
      {outcome?.deliverables?.warnings.map((warning) => (
        <p key={warning} className={`${styles.status} ${styles.statusError}`}>
          {t(`topography.deliverables.warn.${warning}`)}
        </p>
      ))}

      {outcome?.droppedCoordinates && (
        <p className={styles.status}>{t('topography.deliverables.coordinatesFileOnly')}</p>
      )}

      {/* Η ετυμηγορία του §10 — «περνάει / δεν περνάει», με τα νούμερα από κάτω. */}
      {verdict && (
        <p className={`${styles.status} ${verdict === 'fail' ? styles.statusError : ''}`}>
          {t(`topography.deliverables.verdict.${verdict}`)}
        </p>
      )}

      {outcome?.deliverables && outcome.deliverables.checks.length > 0 && (
        <table className={styles.resultTable}>
          <tbody>
            {outcome.deliverables.checks.map((check) => (
              <tr key={check.id} className={check.status === 'fail' ? styles.resultNet : undefined}>
                <th scope="row">{t(`topography.deliverables.check.${check.id}`)}</th>
                <td>{check.measured.toFixed(2)}</td>
                <td>{check.declared === null ? '—' : check.declared.toFixed(2)}</td>
                <td>{t(`topography.deliverables.status.${check.status}`)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
