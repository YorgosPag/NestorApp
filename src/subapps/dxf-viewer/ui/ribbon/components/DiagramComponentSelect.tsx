'use client';

/**
 * ADR-483 (T3-UI / Slice 4b) — «Μέγεθος διαγράμματος» ribbon dropdown (View tab,
 * Robot/SAP2000 M/V/N selector).
 *
 * A single Radix `@/components/ui/select` (ADR-001 — NOT EnterpriseComboBox / native
 * `<select>`) που επιλέγει ποιο εντατικό μέγεθος σχεδιάζει το overlay διαγραμμάτων:
 * ροπή Μ / τέμνουσα V / αξονική Ν (ένα κάθε φορά, Robot-style). Thin reader/writer του
 * `diagramComponent` στο TRANSIENT `useAnalysisDiagramViewStore` — ίδιο shape με το
 * {@link VisualStyleSelect}. Το `StructuralDiagramOverlay` ξαναχτίζει τις διαδρομές
 * όταν αλλάζει το πεδίο.
 */

import React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useAnalysisDiagramViewStore } from '../../../state/analysis-diagram-view-store';
import type { DiagramComponent } from '../../../bim/structural/analytical/diagrams/member-diagram-geometry';

/** Σειρά εμφάνισης Μ → V → N (Robot-style). */
const DIAGRAM_COMPONENTS: readonly DiagramComponent[] = ['moment', 'shear', 'axial'];

export const DiagramComponentSelect: React.FC = () => {
  const { t } = useTranslation('dxf-viewer-shell');
  const diagramComponent = useAnalysisDiagramViewStore((s) => s.diagramComponent);
  const setDiagramComponent = useAnalysisDiagramViewStore((s) => s.setDiagramComponent);

  return (
    <span className="dxf-ribbon-combobox-row">
      <span className="dxf-ribbon-combobox-label">{t('ribbon.commands.diagramComponent.label')}</span>
      <Select value={diagramComponent} onValueChange={(v) => setDiagramComponent(v as DiagramComponent)}>
        <SelectTrigger size="sm" aria-label={t('ribbon.commands.diagramComponent.label')}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="w-auto min-w-[11rem]">
          {DIAGRAM_COMPONENTS.map((component) => (
            <SelectItem key={component} value={component} className="whitespace-nowrap">
              {t(`ribbon.commands.diagramComponent.options.${component}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </span>
  );
};
