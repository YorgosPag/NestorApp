'use client';

/**
 * ADR-363 Phase 7.1 Step 6.5 — Filter panel για multi-selection narrowing.
 *
 * Εμφανίζει N buttons (1 ανά παρόν BIM kind στην επιλογή), κάθε ένα με τον
 * count του kind: "Μόνο Τοίχοι (3)". Click → narrow selection σε entries μόνο
 * αυτού του kind. Είναι το exit-path για μικτή επιλογή που δεν έχει κοινές
 * editable properties.
 *
 * Hide rules:
 *   - mode !== 'multi' → null (single/none)
 *   - Homogeneous selection (1 kind μόνο) → null (no point narrowing)
 */

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useLevels } from '../../../systems/levels';
import { useUniversalSelection } from '../../../systems/selection';
import { useMultiSelectionRibbonBridge } from '../hooks/useMultiSelectionRibbonBridge';
import type { EntityType } from '../../../types/entities';

const FILTER_BUTTON_LABEL_KEY: Readonly<Record<EntityType, string>> = {
  wall:           'ribbon.contextualTabs.multiSelection.filterButtons.wall',
  opening:        'ribbon.contextualTabs.multiSelection.filterButtons.opening',
  slab:           'ribbon.contextualTabs.multiSelection.filterButtons.slab',
  'slab-opening': 'ribbon.contextualTabs.multiSelection.filterButtons.slabOpening',
  column:         'ribbon.contextualTabs.multiSelection.filterButtons.column',
  beam:           'ribbon.contextualTabs.multiSelection.filterButtons.beam',
  stair:          'ribbon.contextualTabs.multiSelection.filterButtons.stair',
} as Record<EntityType, string>;

export function MultiSelectionFilterPanel(): React.JSX.Element | null {
  const { t } = useTranslation('dxf-viewer-shell');
  const levelManager = useLevels();
  const universalSelection = useUniversalSelection();

  const bridge = useMultiSelectionRibbonBridge({ levelManager, universalSelection });

  if (bridge.mode !== 'multi') return null;
  if (bridge.isHomogeneous) return null;

  const entries = Array.from(bridge.kindsCount.entries());

  return (
    <div className="dxf-ribbon-multi-filter">
      {entries.map(([kind, count]) => {
        const labelKey = FILTER_BUTTON_LABEL_KEY[kind];
        if (!labelKey) return null;
        return (
          <button
            key={kind}
            type="button"
            className="dxf-ribbon-multi-filter-button"
            onClick={() => bridge.narrowToKind(kind)}
          >
            <span className="dxf-ribbon-multi-filter-label">{t(labelKey)}</span>
            <span className="dxf-ribbon-multi-filter-count">({count})</span>
          </button>
        );
      })}
    </div>
  );
}
