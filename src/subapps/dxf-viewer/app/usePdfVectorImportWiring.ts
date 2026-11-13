'use client';

/**
 * ADR-941 Φ1 · Δ15 — η καλωδίωση της «Εισαγωγής γραμμών και κειμένων από το PDF» στο πάνελ «Μοντέλο από το σχέδιο»: είναι
 * το υπόβαθρο του ενεργού ορόφου διανυσματικό PDF (`getSourceMedium`, ADR-929 Δ7 Γ — ΙΔΙΟ κριτήριο); τι λένε οι γραμμένες
 * τιμές για την κλίμακα (κάρτα, Δ15); τρέχει εισαγωγή; τι έγινε;
 *
 * Μέσο και κάρτα ξαναρωτιούνται όταν αλλάζει το υπόβαθρο ή η τοποθέτησή του· απάντηση για παλιά κατάσταση πετιέται. Οι
 * εγγραφές ζουν στο `pdf-vector-import-commit` (βαθμονόμηση μέσω `commitCalibration`, εισαγωγή = ένα Ctrl+Z)· εδώ μόνο
 * κατάσταση οθόνης.
 *
 * @module subapps/dxf-viewer/app/usePdfVectorImportWiring
 */

import * as React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { getFloorProvider, useFloorplanBackgroundStore } from '../floorplan-background/stores/floorplanBackgroundStore';
import type { ModelFromDrawingDeps } from '../systems/model-from-drawing/model-from-drawing-session';
import {
  calibrateAndImportFloorPdfVectors, importFloorPdfVectors, readFloorPdfVectorScale,
  type PdfVectorImportOutcome, type PdfVectorImportTarget,
} from '../systems/pdf-vector-import/pdf-vector-import-commit';
import type { PdfVectorScale } from '../systems/pdf-vector-import/pdf-vector-scale';
import { readLiveScene } from '../systems/model-from-drawing/model-from-drawing-live';
import type { PdfVectorImportView } from '../ui/panels/model-from-drawing/PdfVectorImportSection';

export interface PdfVectorImportWiring {
  readonly view: PdfVectorImportView;
  readonly onImport: () => void;
  /** Δ15: βαθμονόμηση από την κάρτα, μετά εισαγωγή. */
  readonly onCalibrateAndImport: () => void;
}

/** Είναι το υπόβαθρο `backgroundId` του ορόφου `floorId` διανυσματικό; (`false` όσο δεν ξέρουμε.) */
function useVectorBackground(floorId: string | null, backgroundId: string | null): boolean {
  const [vector, setVector] = React.useState<{ readonly id: string; readonly vector: boolean } | null>(null);
  React.useEffect(() => {
    if (!floorId || !backgroundId) return undefined;
    let current = true;
    void getFloorProvider(floorId)?.getSourceMedium().then((medium) => {
      if (current) setVector({ id: backgroundId, vector: medium === 'vector' });
    });
    return () => { current = false; };
  }, [floorId, backgroundId]);
  return vector !== null && vector.id === backgroundId && vector.vector;
}

/** Η κάρτα κλίμακας για την τρέχουσα τοποθέτηση (`placementKey`): `null` όσο δεν ξέρουμε ή δεν έχει τι να πει. */
function useVectorScale(floorId: string | null, available: boolean, placementKey: string | null, getDeps: () => ModelFromDrawingDeps): PdfVectorScale | null {
  const [scale, setScale] = React.useState<{ readonly key: string; readonly scale: PdfVectorScale | null } | null>(null);
  React.useEffect(() => {
    if (!floorId || !available || !placementKey) return undefined;
    // Οι μονάδες της ζωντανής σκηνής — ο ίδιος δρόμος με την κάρτα του ADR-929 (`usePlanScaleWiring`).
    const live = readLiveScene(getDeps().accessor);
    if (!live) return undefined;
    let current = true;
    void readFloorPdfVectorScale(floorId, live.sceneUnits).then((next) => {
      if (current) setScale({ key: placementKey, scale: next });
    });
    return () => { current = false; };
  }, [floorId, available, placementKey, getDeps]);
  return scale !== null && scale.key === placementKey ? scale.scale : null;
}

function usePlacementKey(): string | null {
  return useFloorplanBackgroundStore((s) => {
    const bg = s.activeFloorId ? s.floors[s.activeFloorId]?.background : undefined;
    if (!bg) return null;
    const t = bg.transform;
    return `${bg.id}|${t.scaleX}|${t.scaleY}|${t.rotation}|${t.translateX}|${t.translateY}`;
  });
}

export function usePdfVectorImportWiring(getDeps: () => ModelFromDrawingDeps): PdfVectorImportWiring {
  const { t } = useTranslation('dxf-viewer-shell');
  const floorId = useFloorplanBackgroundStore((s) => s.activeFloorId);
  const backgroundId = useFloorplanBackgroundStore((s) => (s.activeFloorId ? s.floors[s.activeFloorId]?.background?.id ?? null : null));
  const available = useVectorBackground(floorId, backgroundId);
  const scale = useVectorScale(floorId, available, usePlacementKey(), getDeps);
  const [running, setRunning] = React.useState(false);
  const [outcome, setOutcome] = React.useState<PdfVectorImportView['outcome']>(null);
  React.useEffect(() => setOutcome(null), [backgroundId]);
  const undoName = t('modelFromDrawing.pdfVector.undoName');

  const run = React.useCallback((write: (target: PdfVectorImportTarget) => Promise<PdfVectorImportOutcome>) => {
    const { accessor } = getDeps();
    const levelId = accessor.currentLevelId;
    if (!floorId || !levelId || running) return;
    setRunning(true);
    void write({ floorId, levelId, getScene: accessor.getLevelScene, setScene: accessor.setLevelScene })
      .then(setOutcome)
      .finally(() => setRunning(false));
  }, [getDeps, floorId, running]);

  const onImport = React.useCallback(() => run((target) => importFloorPdfVectors(target, undoName)), [run, undoName]);
  const onCalibrateAndImport = React.useCallback(() => {
    if (scale?.kind !== 'proposal') return;
    run((target) => calibrateAndImportFloorPdfVectors(target, scale, undoName));
  }, [run, scale, undoName]);

  const view = React.useMemo((): PdfVectorImportView => ({ available, running, outcome, scale }), [available, running, outcome, scale]);
  return { view, onImport, onCalibrateAndImport };
}
