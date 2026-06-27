'use client';

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type {
  RibbonMinimizeState,
  RibbonTab,
} from '../types/ribbon-types';
import { RibbonPanel } from './RibbonPanel';
import { useRibbonCommand } from '../context/RibbonCommandContext';

interface RibbonBodyProps {
  activeTab: RibbonTab | undefined;
  minimizeState: RibbonMinimizeState;
  /** ADR-345 Fase 6.1 — injected content rendered below the ribbon panels for the settings tab. */
  settingsTabContent?: React.ReactNode;
  /** ADR-345 Fase 7 — panel IDs whose flyout is pinned open. */
  pinnedPanelIds: string[];
  /** ADR-345 Fase 7 — toggle pin state for a panel. */
  onPinToggle: (panelId: string) => void;
}

// ADR-532 Stage 2 (perf) — memoized so that when the in-shell RibbonTabsRegion
// re-renders on a contextual-trigger change but the active tab object is
// referentially unchanged (e.g. trigger flips while the body stays on Home until
// the auto-activate effect runs), the body + its panel/button/tooltip subtree is
// skipped. Command/panel-visibility updates still flow via RibbonCommandContext
// (context consumers re-render regardless of memo).
const RibbonBodyInner: React.FC<RibbonBodyProps> = ({
  activeTab,
  minimizeState,
  settingsTabContent,
  pinnedPanelIds,
  onPinToggle,
}) => {
  const { t } = useTranslation('dxf-viewer-shell');
  const { getPanelVisibility } = useRibbonCommand();
  if (!activeTab) return null;

  const isSettingsMode = activeTab.id === 'settings' && !!settingsTabContent;

  // ADR-358 Phase 7b2b-β Stream F — filter panels by `visibilityKey`. Panels
  // without a key (most panels) are always visible. Panels with a key are
  // shown only when the owning bridge returns `true`.
  const visiblePanels = activeTab.panels.filter(
    (panel) => panel.visibilityKey === undefined || getPanelVisibility(panel.visibilityKey),
  );

  return (
    <div
      className="dxf-ribbon-body"
      data-minimize={minimizeState}
      data-tab-mode={isSettingsMode ? 'settings' : 'panels'}
      role="tabpanel"
      aria-label={t('ribbon.ariaLabels.tabBody')}
    >
      {isSettingsMode ? (
        <>
          {visiblePanels.length > 0 && (
            <div className="dxf-ribbon-settings-panels">
              {visiblePanels.map((panel) => (
                <RibbonPanel
                  key={panel.id}
                  panel={panel}
                  isPinned={pinnedPanelIds.includes(panel.id)}
                  onPinToggle={onPinToggle}
                />
              ))}
            </div>
          )}
          <div className="dxf-ribbon-settings-content">
            {settingsTabContent}
          </div>
        </>
      ) : (
        visiblePanels.map((panel) => (
          <RibbonPanel
            key={panel.id}
            panel={panel}
            isPinned={pinnedPanelIds.includes(panel.id)}
            onPinToggle={onPinToggle}
          />
        ))
      )}
    </div>
  );
};

export const RibbonBody = React.memo(RibbonBodyInner);
