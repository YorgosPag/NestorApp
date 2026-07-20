'use client';

/**
 * ADR-507 — «Γραμμοσκιάσεις ορόφου»: dropdown με όλες τις γραμμοσκιάσεις του τρέχοντος
 * ορόφου (swatch χρώματος + label + εμβαδόν). Επιλογή στοιχείου → επιλογή της οντότητας
 * (το contextual tab δείχνει αμέσως τις ιδιότητές της) + zoom στα bounds της.
 *
 * Leaf widget (ADR-040): δεν κάνει subscribe σε high-freq stores. Re-render ΜΟΝΟ όταν
 * αλλάζει η φέτα των γραμμοσκιάσεων του ορόφου (`useSceneEntitiesByType`, ADR-547) —
 * add/remove/edit. Self-gate: 0 γραμμοσκιάσεις → `null`.
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

import React, { useCallback } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { getDynamicBackgroundClass } from '@/components/ui/utils/dynamic-styles';
import { RibbonCompactDropdown } from './RibbonCompactDropdown';
import { useLevels } from '../../../systems/levels';
import { useUniversalSelection } from '../../../systems/selection';
import { useSceneEntitiesByType } from '../../../systems/scene/useSceneSelectors';
import { isHatchEntity } from '../../../types/entities';
import type { HatchEntity } from '../../../types/entities';
import { computeHatchAreaMm2 } from '../../../bim/hatch/hatch-completion';
import { calculateCombinedEntityBounds } from '../../../systems/selection/shared/selection-duplicate-utils';
import { formatAreaForDisplay } from '../../../config/display-length-format';
import { EventBus } from '../../../systems/events';

export function RibbonHatchListWidget(): React.JSX.Element | null {
  const { t } = useTranslation('dxf-viewer-shell');
  const levelManager = useLevels();
  const universalSelection = useUniversalSelection();

  // ΖΩΝΤΑΝΗ λίστα (SSoT `useSceneEntitiesByType`, ADR-547): re-render ΜΟΝΟ όταν
  // αλλάζει η φέτα των γραμμοσκιάσεων. Αντικαθιστά το `useMemo([levelManager,
  // selectedId, createTick])` — το `levelManager` είναι σταθερό ref (οι σκηνές
  // ζουν στο SceneStore), οπότε η λίστα ανανεωνόταν μόνο ως **παρενέργεια** των
  // δύο ψευδο-deps: επιλογή + ένα `drawing:complete` tick. Δηλαδή διαγραφή ή
  // επεξεργασία γραμμοσκίασης χωρίς αλλαγή επιλογής άφηνε μπαγιάτικη λίστα, και
  // το tick ήταν χειροκίνητο υποκατάστατο της subscription (ADR-547 2026-07-20).
  const hatches = useSceneEntitiesByType(levelManager.currentLevelId, isHatchEntity);

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
    <RibbonCompactDropdown
      label={label}
      triggerContent={hatches.length}
      items={hatches.map((hatch, i) => ({
        key: hatch.id,
        onSelect: () => onSelect(hatch),
        itemClassName: 'flex items-center gap-2',
        content: (
          <>
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
          </>
        ),
      }))}
    />
  );
}
