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

export const RibbonBody: React.FC<RibbonBodyProps> = ({
  activeTab,
  minimizeState,
  settingsTabContent,
  pinnedPanelIds,
  onPinToggle,
}) => {
  const { t } = useTranslation('dxf-viewer-shell');
  if (!activeTab) return null;

  const isSettingsMode = activeTab.id === 'settings' && !!settingsTabContent;

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
          {activeTab.panels.length > 0 && (
            <div className="dxf-ribbon-settings-panels">
              {activeTab.panels.map((panel) => (
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
        activeTab.panels.map((panel) => (
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
