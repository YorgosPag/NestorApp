'use client';

/**
 * ADR-469 — Structural Component Visibility multi-toggle (Revit-grade «Parts»).
 *
 * Ένα chip ανά visual component ενός δομικού στοιχείου — Σώμα σκυροδέματος / Σοβάς
 * / Οπλισμός — δίπλα στο «Στυλ Προβολής». Κάθε chip ανάβει/σβήνει το αντίστοιχο
 * per-view flag (`showStructuralCore` / `showFinishSkin` / `showReinforcement`)
 * στο `useBimRenderSettingsStore` (SSoT, Firestore-persisted), που διαβάζεται
 * event-time από τον 2D orchestrator (`DxfRenderer` + leaf renderers) και τους 3D
 * converters μέσω του `isStructuralComponentVisible` resolver. Κάθε συνδυασμός
 * 8 καταστάσεων είναι έγκυρος (μόνο οπλισμός, σοβάς+οπλισμός, κ.λπ.).
 *
 * Το per-element override (Revit «Override Graphics in View by Element») προστίθεται
 * από το {@link StructuralComponentElementOverride} κάτω από τα view chips όταν
 * υπάρχει επιλεγμένο δομικό στοιχείο.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-469-structural-component-visibility.md
 */

import React, { useCallback } from 'react';
import { Box, PaintRoller, Grid2x2Check } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useBimRenderSettingsStore } from '../../../state/bim-render-settings-store';
import {
  STRUCTURAL_COMPONENTS,
  STRUCTURAL_COMPONENT_LABEL_KEY,
  type StructuralComponent,
} from '../../../config/bim-structural-components';
import { HOVER_BACKGROUND_EFFECTS } from '@/components/ui/effects';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { PANEL_LAYOUT } from '../../../config/panel-tokens';
import { StructuralComponentElementOverride } from './StructuralComponentElementOverride';

/** Lucide icon ανά component (literal map → analyzer-reachable). */
const COMPONENT_ICON: Readonly<Record<StructuralComponent, React.FC<{ className?: string }>>> = {
  core: Box,
  plaster: PaintRoller,
  reinforcement: Grid2x2Check,
};

interface ComponentChipProps {
  readonly component: StructuralComponent;
}

const ComponentChip: React.FC<ComponentChipProps> = ({ component }) => {
  const { t } = useTranslation('dxf-viewer-shell');
  const colors = useSemanticColors();

  // Per-view ορατότητα του component (resolved fields — πάντα boolean).
  const visible = useBimRenderSettingsStore((s) =>
    component === 'core'
      ? s.showStructuralCore
      : component === 'plaster'
        ? s.showFinishSkin
        : s.showReinforcement,
  );
  const setCore = useBimRenderSettingsStore((s) => s.setShowStructuralCore);
  const setPlaster = useBimRenderSettingsStore((s) => s.setShowFinishSkin);
  const setReinforcement = useBimRenderSettingsStore((s) => s.setShowReinforcement);

  const handleToggle = useCallback(() => {
    const next = !visible;
    if (component === 'core') setCore(next);
    else if (component === 'plaster') setPlaster(next);
    else setReinforcement(next);
  }, [component, visible, setCore, setPlaster, setReinforcement]);

  const Icon = COMPONENT_ICON[component];
  const name = t(STRUCTURAL_COMPONENT_LABEL_KEY[component]);
  const title = visible
    ? t('ribbon.commands.componentVisibility.tooltipHide')
    : t('ribbon.commands.componentVisibility.tooltipShow');

  return (
    <button
      type="button"
      onClick={handleToggle}
      aria-pressed={visible}
      aria-label={`${name} — ${title}`}
      className={`flex items-center gap-1 ${PANEL_LAYOUT.SPACING.COMPACT} ${colors.bg.backgroundSecondary} ${visible ? colors.text.info : colors.text.muted} ${PANEL_LAYOUT.TYPOGRAPHY.XS} rounded ${HOVER_BACKGROUND_EFFECTS.MUTED} ${PANEL_LAYOUT.TRANSITION.COLORS} select-none`}
    >
      <Icon className={`w-3 h-3 ${visible ? 'opacity-80' : 'opacity-50'}`} />
      <span>{name}</span>
    </button>
  );
};

export const StructuralComponentVisibilitySelect: React.FC = () => {
  const { t } = useTranslation('dxf-viewer-shell');

  return (
    <span className="dxf-ribbon-combobox-row">
      <span className="dxf-ribbon-combobox-label">
        {t('ribbon.commands.componentVisibility.label')}
      </span>
      {STRUCTURAL_COMPONENTS.map((component) => (
        <ComponentChip key={component} component={component} />
      ))}
      {/* ADR-469 — per-element override row (εμφανίζεται μόνο με επιλεγμένο δομικό). */}
      <StructuralComponentElementOverride />
    </span>
  );
};
