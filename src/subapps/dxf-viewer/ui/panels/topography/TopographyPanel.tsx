/**
 * ADR-650 Milestone 1 — Topography panel (thinnest visible slice).
 *
 * "Load survey points → see contours" (Q10). A basic file load (X Y Z per line) and a
 * Generate button that runs the deterministic core and drops native contour entities onto
 * the current level. The full import wizard, smoothing switch and 3D view are Milestone 2.
 *
 * ADR-662 Φάση 2 — τα display/param διπλά (ισοδιάσταση/index, στυλ ισοϋψών, κάναβος ΕΓΣΑ87,
 * βέλος Βορρά) μετακινήθηκαν ΑΠΟΚΛΕΙΣΤΙΚΑ στο ribbon «Τοπογραφικό»· εδώ μένουν μόνο εντολές/
 * ροές που δεν έχουν ribbon-ισοδύναμο ή έχουν μοναδικά controls (import, breaklines, generate,
 * ετικέτες, γεωαναφορά, έδαφος 3Δ, νέφος, cut/fill, QA, auto-breaklines, παραδοτέα).
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
import { getContourConfig } from '../../../systems/topography/contour-config-store';
import { TopoImportWizard } from './TopoImportWizard';
import { TopoPointLabelsSection } from './TopoPointLabelsSection';
import { TopoGeoReferenceSection } from './TopoGeoReferenceSection';
import { Terrain3DSection } from './Terrain3DSection';
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

  // ADR-662 Φάση 2 — contour interval/index + display style (exact ↔ smooth) πλέον ζουν
  // ΑΠΟΚΛΕΙΣΤΙΚΑ στο ribbon «Τοπογραφικό» (Φ1b widgets: contour-interval / contour-index /
  // contour-style πάνω στα ΙΔΙΑ persisted stores). Αφαιρέθηκαν από εδώ ως διπλά — big-player
  // (Revit/Civil 3D): μία θέση για τις παραμέτρους, όχι mega-panel. Το `generate` διαβάζει
  // την τρέχουσα τιμή απευθείας από το store (`getContourConfig()`).
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

      {/* ADR-656 M10 — «Ετικέτες σημείων»: spot Ζ / αρ.·κωδικός / Χ,Υ ΜΟΝΟ στις κορυφές ορίου.
          Επιλεκτικό label ανά τύπο σημείου (Civil 3D COGO point-label style)· ποτέ X,Y στα σημεία. */}
      <TopoPointLabelsSection />

      {/* ADR-662 Φάση 2 — «Κάναβος ΕΓΣΑ87» + «Βέλος Βορρά»: αφαιρέθηκαν από εδώ ως πλήρως διπλά
          με το ribbon «Τοπογραφικό» → «Παρουσίαση» (Φ1b widgets grid-visible/grid-step/north-
          visible/north-mode + Φάση-1 actions grid-bake/north-bake). Κάθε control τους ζει ήδη
          στο ribbon· τα orphaned TopoGridSection/NorthArrowSection component files deprecate στη
          Φάση 4 (ADR-662 §6.5). */}

      {/* ADR-650 M10 — «Γεωαναφορά»: κούμπωμα του DXF πάνω στο τοπογραφικό (Revit Shared
          Coordinates). Auto-align (robust center) + χειροκίνητο κοινό σημείο (1=μετατόπιση,
          2=στροφή). Per-project transform στο Project (surveyPoint/basePoint/northRotation). */}
      <TopoGeoReferenceSection />

      {/* ADR-650 M4/M10d — η ίδια επιφάνεια που κόβει τις ισοϋψείς, ως στερεό στην 3Δ όψη
          (Civil 3D «Surface Style»: υψομετρικό = analysis style, ΔΕΝ αλλάζει την τριγωνοποίηση),
          + έλεγχος διαφάνειας (επιφάνεια ανά style + ισοϋψείς). */}
      <Terrain3DSection />

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
