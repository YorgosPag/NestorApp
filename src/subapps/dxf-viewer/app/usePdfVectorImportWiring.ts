'use client';

/**
 * ADR-941 Φ1 — η καλωδίωση της «Εισαγωγής γραμμών και κειμένων από το PDF» στο πάνελ «Μοντέλο από το σχέδιο»: είναι το
 * υπόβαθρο του ενεργού ορόφου διανυσματικό PDF (`getSourceMedium`, ADR-929 Δ7 Γ — ΙΔΙΟ κριτήριο); τρέχει εισαγωγή; τι έγινε;
 *
 * Το μέσο ξαναρωτιέται όταν αλλάζει το υπόβαθρο (ταυτότητα `background.id`)· απάντηση για παλιό υπόβαθρο πετιέται. Η εγγραφή
 * ζει στο `importFloorPdfVectors` (ένα Ctrl+Z, ιδεμποτία)· εδώ μόνο κατάσταση οθόνης.
 *
 * @module subapps/dxf-viewer/app/usePdfVectorImportWiring
 */

import * as React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { getFloorProvider, useFloorplanBackgroundStore } from '../floorplan-background/stores/floorplanBackgroundStore';
import type { ModelFromDrawingDeps } from '../systems/model-from-drawing/model-from-drawing-session';
import { importFloorPdfVectors } from '../systems/pdf-vector-import/pdf-vector-import-commit';
import type { PdfVectorImportView } from '../ui/panels/model-from-drawing/PdfVectorImportSection';

export interface PdfVectorImportWiring {
  readonly view: PdfVectorImportView;
  readonly onImport: () => void;
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

export function usePdfVectorImportWiring(getDeps: () => ModelFromDrawingDeps): PdfVectorImportWiring {
  const { t } = useTranslation('dxf-viewer-shell');
  const floorId = useFloorplanBackgroundStore((s) => s.activeFloorId);
  const backgroundId = useFloorplanBackgroundStore((s) => (s.activeFloorId ? s.floors[s.activeFloorId]?.background?.id ?? null : null));
  const available = useVectorBackground(floorId, backgroundId);
  const [running, setRunning] = React.useState(false);
  const [outcome, setOutcome] = React.useState<PdfVectorImportView['outcome']>(null);
  React.useEffect(() => setOutcome(null), [backgroundId]);
  const undoName = t('modelFromDrawing.pdfVector.undoName');

  const onImport = React.useCallback(() => {
    const { accessor } = getDeps();
    const levelId = accessor.currentLevelId;
    if (!floorId || !levelId || running) return;
    setRunning(true);
    const target = { floorId, levelId, getScene: accessor.getLevelScene, setScene: accessor.setLevelScene };
    void importFloorPdfVectors(target, undoName)
      .then(setOutcome)
      .finally(() => setRunning(false));
  }, [getDeps, floorId, running, undoName]);

  const view = React.useMemo((): PdfVectorImportView => ({ available, running, outcome }), [available, running, outcome]);
  return { view, onImport };
}
