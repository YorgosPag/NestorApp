'use client';

/**
 * ADR-507 — «Γραμμοσκιάσεις ορόφου»: dropdown με όλες τις γραμμοσκιάσεις του τρέχοντος
 * ορόφου (swatch χρώματος + label + εμβαδόν). Επιλογή στοιχείου → επιλογή της οντότητας
 * (το contextual tab δείχνει αμέσως τις ιδιότητές της) + zoom στα bounds της.
 *
 * Leaf widget (ADR-040): δεν κάνει subscribe σε high-freq stores. Re-render όταν αλλάζει
 * η επιλογή (selection context) ή όταν δημιουργείται νέα οντότητα (`drawing:complete` —
 * low-frequency lifecycle event). Self-gate: 0 γραμμοσκιάσεις → `null`.
 *
 * FULL SSoT reuse — μηδέν νέος μηχανισμός:
 *   - λίστα/dropdown pattern = `RibbonMepCircuitPickerWidget`
 *   - επιλογή = `useUniversalSelection().replaceEntitySelection`
 *   - εμβαδόν label = `computeHatchAreaMm2`
 *   - zoom = `calculateCombinedEntityBounds` + EventBus `canvas-fit-to-view-selected`
 *     (ΙΔΙΟ path με το Z key / ClashReportPanel — μηδέν νέο zoom)
 *   - swatch χρώματος = `getDynamicBackgroundClass` (μηδέν inline style — N.3)
 *
 * @see ./RibbonMepCircuitPickerWidget.tsx — dropdown pattern template
 * @see ../../../hooks/canvas/useFitToView.ts — canvas-fit-to-view-selected consumer
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { getDynamicBackgroundClass } from '@/components/ui/utils/dynamic-styles';
import { useSemanticColors } from '@/hooks/useSemanticColors';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { useLevels } from '../../../systems/levels';
import { useUniversalSelection } from '../../../systems/selection';
import { isHatchEntity } from '../../../types/entities';
import type { HatchEntity } from '../../../types/entities';
import { computeHatchAreaMm2 } from '../../../bim/hatch/hatch-completion';
import { calculateCombinedEntityBounds } from '../../../systems/selection/shared/selection-duplicate-utils';
import { formatAreaForDisplay } from '../../../config/display-length-format';
import { EventBus } from '../../../systems/events';

export function RibbonHatchListWidget(): React.JSX.Element | null {
  const { t } = useTranslation('dxf-viewer-shell');
  const colors = useSemanticColors();
  const levelManager = useLevels();
  const universalSelection = useUniversalSelection();
  const selectedId = universalSelection.getPrimaryId();

  // Re-render όταν δημιουργείται νέα οντότητα (low-frequency lifecycle event). Η
  // διαγραφή/επιλογή re-render-άρει ήδη μέσω του selection context (selectedId).
  const [createTick, setCreateTick] = useState(0);
  useEffect(() => {
    const off = EventBus.on('drawing:complete', () => setCreateTick((n) => n + 1));
    return off;
  }, []);

  const hatches = useMemo<HatchEntity[]>(() => {
    if (!levelManager.currentLevelId) return [];
    const scene = levelManager.getLevelScene(levelManager.currentLevelId);
    return (scene?.entities ?? []).filter(isHatchEntity);
    // selectedId/createTick → ξανα-διάβασε τη σκηνή (η σκηνή ζει σε ref, όχι state).
  }, [levelManager, selectedId, createTick]);

  const onSelect = useCallback(
    (hatch: HatchEntity): void => {
      universalSelection.replaceEntitySelection([hatch.id]);
      // Zoom στα bounds της — reuse του ΙΔΙΟΥ SSoT με το Z key (ADR-394).
      const bounds = calculateCombinedEntityBounds([hatch]);
      if (bounds) EventBus.emit('canvas-fit-to-view-selected', { bounds });
    },
    [universalSelection],
  );

  // Self-gate (σαν τα άλλα ribbon widgets): καμία γραμμοσκίαση → μηδέν widget.
  if (hatches.length === 0) return null;

  const label = t('ribbon.commands.hatchEditor.hatchList');

  return (
    <span className="dxf-ribbon-combobox-row">
      <span className="dxf-ribbon-combobox-label">{label}</span>
      <span className="dxf-ribbon-widget-compact">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={cn('dxf-ribbon-wall-length-input', colors.bg.primary)}
              aria-label={label}
            >
              {hatches.length} ▾
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {hatches.map((hatch, i) => (
              <DropdownMenuItem
                key={hatch.id}
                onSelect={() => onSelect(hatch)}
                className="flex items-center gap-2"
              >
                <span
                  className={cn(
                    'inline-block w-3 h-3 rounded-sm border border-border',
                    getDynamicBackgroundClass(hatch.fillColor),
                  )}
                  aria-hidden="true"
                />
                {t('ribbon.commands.hatchEditor.hatchItem', { index: i + 1 })}
                {' • '}
                {formatAreaForDisplay(computeHatchAreaMm2(hatch))}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </span>
    </span>
  );
}
