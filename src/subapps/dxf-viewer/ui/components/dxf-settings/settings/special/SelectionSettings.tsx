/**
 * Selection settings — tab strip over the per-mode appearance panel.
 *
 * The panel body lives in `SelectionModeSettings`, parametrized by mode; this
 * component only owns which tab is active.
 *
 * @module ui/components/dxf-settings/settings/special/SelectionSettings
 */

import React, { useState } from 'react';

// 🏢 ENTERPRISE: Import centralized tabs system (same as Contacts/ΓΕΜΗ/PanelTabs/DxfSettingsPanel)
import { TabsOnlyTriggers, type TabDefinition } from '@/components/ui/navigation/TabsComponents';
// 🌐 i18n
import { useTranslation } from '@/i18n';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

// 🏢 ENTERPRISE: Centralized spacing tokens
import { PANEL_LAYOUT } from '../../../../../config/panel-tokens';
import type { SelectionMode } from '../../../../../systems/cursor/config';
import { SelectionModeSettings } from './selection/SelectionModeSettings';
import {
  SELECTION_MODE_PRESENTATION,
  SELECTION_MODES,
} from './selection/selection-modes';

const I18N_NAMESPACES = ['dxf-viewer', 'dxf-viewer-settings', 'dxf-viewer-wizard', 'dxf-viewer-guides', 'dxf-viewer-panels', 'dxf-viewer-shell'] as const;

export function SelectionSettings() {
  const [activeSelectionTab, setActiveSelectionTab] =
    useState<SelectionMode>('window');
  const colors = useSemanticColors();
  const { t } = useTranslation([...I18N_NAMESPACES]);

  // Content is rendered below the strip, not inside the tabs.
  const selectionTabs: TabDefinition[] = SELECTION_MODES.map((mode) => ({
    id: mode,
    label: t(`selectionSettings.tabs.${mode}`),
    icon: SELECTION_MODE_PRESENTATION[mode].icon,
    content: null,
  }));

  const handleTabChange = (tabId: string) => {
    setActiveSelectionTab(tabId as SelectionMode);
  };

  return (
    <div className={`${colors.bg.primary} ${colors.text.primary}`}>
      {/* 🏢 ENTERPRISE: Selection Tabs - className moved directly to component (ADR-003) */}
      <TabsOnlyTriggers
        tabs={selectionTabs}
        value={activeSelectionTab}
        onTabChange={handleTabChange}
        theme="dark"
        alwaysShowLabels
        className={PANEL_LAYOUT.MARGIN.BOTTOM_LG}
      />

      <SelectionModeSettings mode={activeSelectionTab} />
    </div>
  );
}
