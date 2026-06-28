'use client';

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type {
  RibbonMinimizeState,
  RibbonTab,
} from '../types/ribbon-types';
import { RibbonPanel } from './RibbonPanel';

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
  if (!activeTab) return null;

  const isSettingsMode = activeTab.id === 'settings' && !!settingsTabContent;

  // ADR-547 Stage 4 — panel `visibilityKey` filtering moved INTO `RibbonPanel`
  // (each panel does a per-key `useRibbonPanelVisibility` leaf subscription and
  // self-hides). `RibbonBody` no longer subscribes to the volatile field context,
  // so a BIM edit no longer re-renders the whole body. Panels self-hide → render
  // them all here; a hidden panel returns null.
  const allPanels = activeTab.panels;

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
          {allPanels.length > 0 && (
            <div className="dxf-ribbon-settings-panels">
              {allPanels.map((panel) => (
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
        allPanels.map((panel) => (
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
