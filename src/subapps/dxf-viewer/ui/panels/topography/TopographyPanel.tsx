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
import {
  setTopoPoints,
  setTopoBreaklines,
  getTopoBreaklines,
  subscribeTopo,
} from '../../../systems/topography/TopoPointStore';
import { toolStateStore, useActiveTool } from '../../../stores/ToolStateStore';
import { parseTopoPoints } from '../../../systems/topography/parse-topo-points';
import { useTopoContours } from '../../../systems/topography/useTopoContours';
import {
  getTerrain3DState,
  setTerrain3DVisible,
  setTerrain3DStyle,
  subscribeTerrain3D,
} from '../../../systems/topography/terrain-3d-store';
import {
  getContourConfig,
  setContourIntervalMm,
  setContourMajorEvery,
  subscribeContourConfig,
} from '../../../systems/topography/contour-config-store';
import { useContourDisplay } from '../../../systems/topography/useContourDisplay';
import { TopoImportWizard } from './TopoImportWizard';
import { TopoCutFillSection } from './TopoCutFillSection';
import { TopoDeliverablesSection } from './TopoDeliverablesSection';
import { TopoQaSection } from './TopoQaSection';
import { TopoAutoBreaklineSection } from './TopoAutoBreaklineSection';
import { TopoCloud3DSection } from './TopoCloud3DSection';
import styles from './TopographyPanel.module.css';

/** Load state after a file has been parsed. */
interface LoadInfo {
  readonly count: number;
  readonly skipped: number;
}

export function TopographyPanel(): React.JSX.Element {
  const { t } = useTranslation('dxf-viewer-panels');
  const { generate } = useTopoContours();

  // ADR-650 M2-Β — οι breaklines ζουν στο vanilla TopoPointStore· το panel είναι LOW-freq
  // consumer (ADR-040: επιτρεπτό `useSyncExternalStore` — δεν είναι canvas orchestrator).
  const breaklines = React.useSyncExternalStore(subscribeTopo, getTopoBreaklines, getTopoBreaklines);
  const activeTool = useActiveTool();
  const breaklineToolActive = activeTool === 'topo-breakline';

  const onToggleBreaklineTool = React.useCallback(() => {
    if (breaklineToolActive) toolStateStore.deselectTool();
    else toolStateStore.selectTool('topo-breakline');
  }, [breaklineToolActive]);

  // ADR-650 M4 — 3D terrain display state (Civil 3D «Surface Style»: the survey is untouched,
  // only how the derived surface is drawn). LOW-freq consumer — same contract as `breaklines`.
  const terrain3d = React.useSyncExternalStore(subscribeTerrain3D, getTerrain3DState, getTerrain3DState);
  const hypsometric = terrain3d.style === 'hypsometric';

  const onToggleTerrain = React.useCallback(() => {
    setTerrain3DVisible(!getTerrain3DState().visible);
  }, []);

  const onToggleHypsometric = React.useCallback(() => {
    setTerrain3DStyle(getTerrain3DState().style === 'hypsometric' ? 'shaded' : 'hypsometric');
  }, []);

  // ADR-650 M3 — plan-view contour display style (exact ↔ smooth). Non-destructive:
  // the surveyed vertices stay exact, so legal export is always the accurate line.
  const contourDisplay = useContourDisplay();
  const contourSmooth = contourDisplay.style === 'smooth';

  // ADR-650 — contour params live in a persistable SSoT store (contour-config-store),
  // so the interval/index survive reload and drive the load-time regenerate. LOW-freq
  // consumer (panel), same contract as the display/terrain stores above.
  const contourConfig = React.useSyncExternalStore(subscribeContourConfig, getContourConfig, getContourConfig);
  const intervalM = contourConfig.intervalMm / 1000;
  const majorEvery = contourConfig.majorEvery;
  const [load, setLoad] = React.useState<LoadInfo | null>(null);
  const [status, setStatus] = React.useState<{ text: string; error: boolean } | null>(null);
  const [wizardOpen, setWizardOpen] = React.useState(false);

  // ADR-650 M2 — the wizard writes straight to TopoPointStore; the panel only mirrors the count.
  const onImported = React.useCallback((count: number) => {
    setLoad({ count, skipped: 0 });
    setStatus(null);
  }, []);

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
    const r = generate(getContourConfig());
    if (r.ok) {
      setStatus({ text: t('topography.status.generated', { contours: r.contourCount, entities: r.entityCount }), error: false });
    } else {
      setStatus({ text: t(`topography.error.${r.reason ?? 'no-contours'}`), error: true });
    }
  }, [generate, t]);

  return (
    <section className={styles.panel}>
      <header className={styles.header}>
        <h2 className={styles.title}>{t('topography.title')}</h2>
        <p className={styles.subtitle}>{t('topography.subtitle')}</p>
      </header>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="topo-file">{t('topography.loadLabel')}</label>
        <input id="topo-file" className={styles.input} type="file" accept=".csv,.txt,.xyz,.pts" onChange={onFile} />
        {/* ADR-650 M2 — the wizard road: any column order / delimiter / unit, plus Excel and DXF. */}
        <button type="button" className={styles.generateButton} onClick={() => setWizardOpen(true)}>
          {t('topography.import.open')}
        </button>
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
            value={intervalM} onChange={(e) => setContourIntervalMm(Number(e.target.value) * 1000)}
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="topo-major">{t('topography.majorEveryLabel')}</label>
          <input
            id="topo-major" className={styles.input} type="number" min={1} step={1}
            value={majorEvery} onChange={(e) => setContourMajorEvery(Number(e.target.value))}
          />
        </div>
      </div>

      {/* ADR-650 M2-Β — breaklines: μαρκάρεις υπάρχουσες γραμμές του σχεδίου ως constraints
          (η επιφάνεια κρατά το κοφτό σκαλί αντί να το εξομαλύνει). */}
      <section className={styles.field}>
        <h3 className={styles.label}>{t('topography.breakline.title')}</h3>
        <p className={styles.subtitle}>{t('topography.breakline.hint')}</p>
        <div className={styles.row}>
          <button
            type="button"
            className={`${styles.generateButton} ${breaklineToolActive ? styles.toolActive : ''}`}
            onClick={onToggleBreaklineTool}
            aria-pressed={breaklineToolActive}
          >
            {t(breaklineToolActive ? 'topography.breakline.stop' : 'topography.breakline.pick')}
          </button>
          <button
            type="button" className={styles.generateButton}
            onClick={() => setTopoBreaklines([])} disabled={breaklines.length === 0}
          >
            {t('topography.breakline.clear')}
          </button>
        </div>
        <p className={styles.status}>{t('topography.breakline.count', { count: breaklines.length })}</p>
      </section>

      <button
        type="button" className={styles.generateButton}
        onClick={onGenerate} disabled={!load || load.count < 3}
      >
        {t('topography.generate')}
      </button>

      {/* ADR-650 M3 — «Ακριβείς ↔ Όμορφες»: display style over the SAME contours
          (Civil 3D «Contour Smoothing»). Το «όμορφο» είναι μόνο παρουσίαση — το
          νόμιμο export βγαίνει πάντα με τις ακριβείς κορυφές. */}
      <section className={styles.field}>
        <h3 className={styles.label}>{t('topography.contourStyle.title')}</h3>
        <p className={styles.subtitle}>{t('topography.contourStyle.hint')}</p>
        <div className={styles.row}>
          <button
            type="button"
            className={`${styles.generateButton} ${!contourSmooth ? styles.toolActive : ''}`}
            onClick={() => contourDisplay.setStyle('exact')}
            aria-pressed={!contourSmooth}
          >
            {t('topography.contourStyle.exact')}
          </button>
          <button
            type="button"
            className={`${styles.generateButton} ${contourSmooth ? styles.toolActive : ''}`}
            onClick={() => contourDisplay.setStyle('smooth')}
            aria-pressed={contourSmooth}
          >
            {t('topography.contourStyle.smooth')}
          </button>
        </div>
        <p className={styles.status}>{t('topography.contourStyle.exportNote')}</p>
      </section>

      {/* ADR-650 M4 — η ίδια επιφάνεια που κόβει τις ισοϋψείς, ως στερεό στην 3Δ όψη.
          Το «υψομετρικό» είναι analysis style (Civil 3D Elevation Banding): χρωματίζει τα
          υψόμετρα, ΔΕΝ αλλάζει την τριγωνοποίηση. */}
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
      </section>

      {/* ADR-650 M8β/Β — το νέφος του import ως 3Δ layer πάνω από το έδαφος. Εμφανίζεται μόνο
          αν έχει εισαχθεί νέφος. ΟΨΗ, ποτέ γεωμετρία μέτρησης (§6). */}
      <TopoCloud3DSection />

      {/* ADR-650 M6 — όγκοι εκσκαφών/επιχώσεων πάνω στην ΙΔΙΑ επιφάνεια (τρίτο style: cut/fill). */}
      <TopoCutFillSection />

      {/* ADR-650 M5α — «καμπανάκι» ποιότητας: deterministic έλεγχοι + inline flags (χωρίς LLM). */}
      <TopoQaSection />

      {/* ADR-650 M8β/Γ — το σύστημα διαβάζει την επιφάνεια και ΠΡΟΤΕΙΝΕΙ τις γραμμές ασυνέχειας
          που λείπουν (Civil 3D «Extract feature lines»). Ο μηχανικός εγκρίνει — §9. */}
      <TopoAutoBreaklineSection />

      {/* ADR-650 M7 — «ένα κουμπί → φάκελος»: πίνακες μέσα στο σχέδιο + ZIP παραδοτέων. */}
      <TopoDeliverablesSection />

      {status && (
        <p className={`${styles.status} ${status.error ? styles.statusError : ''}`}>{status.text}</p>
      )}

      {wizardOpen && (
        <TopoImportWizard onClose={() => setWizardOpen(false)} onImported={onImported} />
      )}
    </section>
  );
}
