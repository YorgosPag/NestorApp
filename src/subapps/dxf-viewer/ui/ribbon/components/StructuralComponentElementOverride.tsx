'use client';

/**
 * ADR-470 — Structural Component Visibility per-element override (Revit «Override
 * Graphics in View by Element»).
 *
 * Εμφανίζεται κάτω από τα view-level chips ({@link StructuralComponentVisibilitySelect})
 * ΜΟΝΟ όταν υπάρχει επιλεγμένη οντότητα. Ανά component (Σώμα/Σοβάς/Οπλισμός) δίνει
 * τρεις ενέργειες για τα ΕΠΙΛΕΓΜΕΝΑ στοιχεία:
 *   · 👁  Εμφάνιση  (override = true)
 *   · 🚫  Απόκρυψη  (override = false)
 *   · ↺  Επαναφορά (override = null → επιστροφή στο per-view flag)
 *
 * Emit-άρει `bim:set-component-visibility`· ο `useStructuralComponentOverride` hook
 * φιλτράρει τα δομικά στοιχεία και εκτελεί τον undoable command. Το widget δεν
 * αγγίζει scene/command directly (καθαρό decoupling, μηδέν canvas coupling).
 *
 * @see hooks/useStructuralComponentOverride.ts
 * @see docs/centralized-systems/reference/adrs/ADR-470-structural-component-visibility.md
 */

import React, { useContext, useCallback } from 'react';
import { Box, PaintRoller, Grid2x2Check, Eye, EyeOff, RotateCcw } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { SelectionContext } from '../../../systems/selection/SelectionSystem';
import { EventBus } from '../../../systems/events/EventBus';
import {
  STRUCTURAL_COMPONENTS,
  STRUCTURAL_COMPONENT_LABEL_KEY,
  type StructuralComponent,
} from '../../../config/bim-structural-components';
import { HOVER_BACKGROUND_EFFECTS } from '@/components/ui/effects';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { PANEL_LAYOUT } from '../../../config/panel-tokens';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

/** Lucide icon ανά component (UI-local· config κρατιέται React-free). */
const COMPONENT_ICON: Readonly<Record<StructuralComponent, React.FC<{ className?: string }>>> = {
  core: Box,
  plaster: PaintRoller,
  reinforcement: Grid2x2Check,
};

interface OverrideGroupProps {
  readonly component: StructuralComponent;
  readonly entityIds: readonly string[];
}

const OverrideGroup: React.FC<OverrideGroupProps> = ({ component, entityIds }) => {
  const { t } = useTranslation('dxf-viewer-shell');
  const colors = useSemanticColors();
  const Icon = COMPONENT_ICON[component];
  const name = t(STRUCTURAL_COMPONENT_LABEL_KEY[component]);

  const set = useCallback(
    (value: boolean | null): void => {
      EventBus.emit('bim:set-component-visibility', { entityIds, component, value });
    },
    [entityIds, component],
  );

  const btn = `flex items-center ${colors.bg.backgroundSecondary} ${colors.text.secondary} ${PANEL_LAYOUT.TYPOGRAPHY.XS} rounded ${HOVER_BACKGROUND_EFFECTS.MUTED} ${PANEL_LAYOUT.TRANSITION.COLORS} select-none p-0.5`;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="flex items-center gap-0.5">
          <Icon className="w-3 h-3 opacity-70" />
          <button type="button" onClick={() => set(true)} aria-label={`${name} — ${t('ribbon.commands.componentVisibility.overrideShow')}`} className={btn}>
            <Eye className="w-3 h-3" />
          </button>
          <button type="button" onClick={() => set(false)} aria-label={`${name} — ${t('ribbon.commands.componentVisibility.overrideHide')}`} className={btn}>
            <EyeOff className="w-3 h-3" />
          </button>
          <button type="button" onClick={() => set(null)} aria-label={`${name} — ${t('ribbon.commands.componentVisibility.overrideReset')}`} className={btn}>
            <RotateCcw className="w-3 h-3" />
          </button>
        </span>
      </TooltipTrigger>
      <TooltipContent>{name}</TooltipContent>
    </Tooltip>
  );
};

export const StructuralComponentElementOverride: React.FC = () => {
  const { t } = useTranslation('dxf-viewer-shell');
  // Safe read: αν το ribbon δεν είναι μέσα σε SelectionSystem provider → no override row.
  const selection = useContext(SelectionContext);
  const entityIds = selection?.getSelectedIdsByType('dxf-entity') ?? [];
  if (entityIds.length === 0) return null;

  return (
    <span className="dxf-ribbon-combobox-row">
      <span className="dxf-ribbon-combobox-label">
        {t('ribbon.commands.componentVisibility.selectedLabel')}
      </span>
      {STRUCTURAL_COMPONENTS.map((component) => (
        <OverrideGroup key={component} component={component} entityIds={entityIds} />
      ))}
    </span>
  );
};
