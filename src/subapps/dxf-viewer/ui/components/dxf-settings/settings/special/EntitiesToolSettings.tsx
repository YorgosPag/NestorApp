/**
 * ENTITIES TOOL SETTINGS
 * Extracted from EntitiesSettings.tsx for SRP (ADR-065)
 *
 * Renders the line-tool-specific settings panel with 4 sub-tabs:
 * Draft, Completion, Hover, Selection
 */

import React from 'react';
import { PenLine, CheckCircle2, Mouse, SquareDashedMousePointer, Wrench } from 'lucide-react';
import { TabsOnlyTriggers, type TabDefinition } from '@/components/ui/navigation/TabsComponents';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useBorderTokens } from '../../../../../../../hooks/useBorderTokens';
import { SubTabRenderer } from '../../../shared/SubTabRenderer';
import { LinePreview } from '../shared/LinePreview';
import { DXF_SETTINGS_TAB_LABELS } from '../../../../../../../constants/property-statuses-enterprise';
import { PANEL_LAYOUT } from '../../../../../config/panel-tokens';
import { useTranslation } from '@/i18n';
import { DEFAULT_GRIP_SETTINGS } from '../../../../../types/gripSettings';

// ── Types ────────────────────────────────────────────────────────────

interface OverrideSetting {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description: string;
  statusText?: string;
}

interface EntitiesToolSettingsProps {
  selectedTool: string;
  activeLineTab: string | null;
  setActiveLineTab: (tab: string | null) => void;
  // Draft
  activeDraftSubTab: string;
  setActiveDraftSubTab: (tab: string) => void;
  previewLineDraftSettings: Record<string, unknown>;
  draftOverride: OverrideSetting;
  // Hover
  activeHoverSubTab: string;
  setActiveHoverSubTab: (tab: string) => void;
  previewLineHoverSettings: Record<string, unknown>;
  hoverOverride: OverrideSetting;
  // Selection
  activeSelectionSubTab: string;
  setActiveSelectionSubTab: (tab: string) => void;
  previewLineSelectionSettings: Record<string, unknown>;
  selectionOverride: OverrideSetting;
  // Completion
  activeCompletionSubTab: string;
  setActiveCompletionSubTab: (tab: string) => void;
  previewLineCompletionSettings: Record<string, unknown>;
  completionOverride: OverrideSetting;
  // Shared
  previewTextSettings: Record<string, unknown>;
  previewGripSettings: Record<string, unknown>;
  textOverride: OverrideSetting;
  gripOverride: OverrideSetting;
}

// ── Component ────────────────────────────────────────────────────────

export const EntitiesToolSettings: React.FC<EntitiesToolSettingsProps> = ({
  selectedTool,
  activeLineTab,
  setActiveLineTab,
  activeDraftSubTab,
  setActiveDraftSubTab,
  previewLineDraftSettings,
  draftOverride,
  activeHoverSubTab,
  setActiveHoverSubTab,
  previewLineHoverSettings,
  hoverOverride,
  activeSelectionSubTab,
  setActiveSelectionSubTab,
  previewLineSelectionSettings,
  selectionOverride,
  activeCompletionSubTab,
  setActiveCompletionSubTab,
  previewLineCompletionSettings,
  completionOverride,
  previewTextSettings,
  previewGripSettings,
  textOverride,
  gripOverride,
}) => {
  const colors = useSemanticColors();
  const { quick } = useBorderTokens();
  const { t } = useTranslation('dxf-viewer');

  const lineToolTabs: TabDefinition[] = [
    { id: 'draft', label: t(DXF_SETTINGS_TAB_LABELS.DRAFT), icon: PenLine, content: null },
    { id: 'completion', label: t(DXF_SETTINGS_TAB_LABELS.COMPLETION), icon: CheckCircle2, content: null },
    { id: 'hover', label: t(DXF_SETTINGS_TAB_LABELS.HOVER), icon: Mouse, content: null },
    { id: 'selection', label: t(DXF_SETTINGS_TAB_LABELS.SELECTION), icon: SquareDashedMousePointer, content: null },
  ];

  const handleLineToolTabChange = (tabId: string) => {
    setActiveLineTab(activeLineTab === tabId ? null : tabId);
  };

  if (selectedTool === 'line') {
    return (
      <div className={`${PANEL_LAYOUT.MARGIN.BOTTOM_LG} ${PANEL_LAYOUT.CONTAINER.INNER_PADDING} ${colors.bg.secondary} ${quick.card}`}>
        <TabsOnlyTriggers
          tabs={lineToolTabs}
          value={activeLineTab || ''}
          onTabChange={handleLineToolTabChange}
          theme="dark"
          alwaysShowLabels
          className={PANEL_LAYOUT.MARGIN.BOTTOM_LG}
        />

        <SubTabRenderer
          config={{ type: 'draft', label: t(DXF_SETTINGS_TAB_LABELS.DRAFT), color: 'blue-500', badgeColor: colors.bg.primary }}
          activeTab={activeLineTab} activeSubTab={activeDraftSubTab}
          onTabChange={setActiveLineTab} onSubTabChange={setActiveDraftSubTab}
          lineSettings={previewLineDraftSettings} textSettings={previewTextSettings}
          gripSettings={previewGripSettings} contextType="preview"
          overrideSettings={{ line: draftOverride, text: textOverride, grips: gripOverride }}
        />

        <SubTabRenderer
          config={{ type: 'hover', label: t(DXF_SETTINGS_TAB_LABELS.HOVER), color: 'yellow-500', badgeColor: colors.bg.warning }}
          activeTab={activeLineTab} activeSubTab={activeHoverSubTab}
          onTabChange={setActiveLineTab} onSubTabChange={setActiveHoverSubTab}
          lineSettings={previewLineHoverSettings} textSettings={previewTextSettings}
          contextType="preview"
          gripSettings={{
            ...previewGripSettings,
            colors: { ...((previewGripSettings as { colors?: typeof DEFAULT_GRIP_SETTINGS.colors }).colors || DEFAULT_GRIP_SETTINGS.colors), cold: ((previewGripSettings as { colors?: typeof DEFAULT_GRIP_SETTINGS.colors }).colors?.warm || DEFAULT_GRIP_SETTINGS.colors.warm) }
          }}
          overrideSettings={{ line: hoverOverride }}
        />

        <SubTabRenderer
          config={{ type: 'selection', label: t(DXF_SETTINGS_TAB_LABELS.SELECTION), color: 'red-500', badgeColor: colors.bg.error }}
          activeTab={activeLineTab} activeSubTab={activeSelectionSubTab}
          onTabChange={setActiveLineTab} onSubTabChange={setActiveSelectionSubTab}
          lineSettings={previewLineSelectionSettings} textSettings={previewTextSettings}
          contextType="preview"
          gripSettings={{
            ...previewGripSettings,
            colors: { ...((previewGripSettings as { colors?: typeof DEFAULT_GRIP_SETTINGS.colors }).colors || DEFAULT_GRIP_SETTINGS.colors), cold: ((previewGripSettings as { colors?: typeof DEFAULT_GRIP_SETTINGS.colors }).colors?.hot || DEFAULT_GRIP_SETTINGS.colors.hot) }
          }}
          overrideSettings={{ line: selectionOverride }}
        />

        <SubTabRenderer
          config={{ type: 'completion', label: t(DXF_SETTINGS_TAB_LABELS.COMPLETION), color: 'green-500', badgeColor: colors.bg.success }}
          activeTab={activeLineTab} activeSubTab={activeCompletionSubTab}
          onTabChange={setActiveLineTab} onSubTabChange={setActiveCompletionSubTab}
          lineSettings={previewLineCompletionSettings} textSettings={previewTextSettings}
          contextType="completion" gripSettings={previewGripSettings}
          customPreview={
            <LinePreview lineSettings={previewLineCompletionSettings} textSettings={previewTextSettings} gripSettings={previewGripSettings} />
          }
          overrideSettings={{ line: completionOverride }}
        />
      </div>
    );
  }

  // Generic tool placeholder
  return (
    <div className={`${PANEL_LAYOUT.MARGIN.BOTTOM_LG} ${PANEL_LAYOUT.CONTAINER.INNER_PADDING} ${colors.bg.secondary} ${quick.card}`}>
      <h3 className={`${PANEL_LAYOUT.TYPOGRAPHY.LG} ${PANEL_LAYOUT.FONT_WEIGHT.SEMIBOLD} ${colors.text.primary} ${PANEL_LAYOUT.MARGIN.BOTTOM_LG}`}>
        {t('entitiesSettings.toolSettings.title', { tool: selectedTool })}
      </h3>
      <div className={`text-center ${PANEL_LAYOUT.PADDING.VERTICAL_XXXL} ${colors.text.muted}`}>
        <div className={`${PANEL_LAYOUT.MARGIN.BOTTOM_LG} flex justify-center`}>
          <Wrench className={`${PANEL_LAYOUT.WIDTH.ICON_LG} ${PANEL_LAYOUT.HEIGHT.ICON_LG}`} />
        </div>
        <h3 className={`${PANEL_LAYOUT.TYPOGRAPHY.LG} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${PANEL_LAYOUT.MARGIN.BOTTOM_SM} ${colors.text.primary}`}>
          {t('entitiesSettings.toolSettings.toolSettingsTitle')}
        </h3>
        <p className={`${PANEL_LAYOUT.TYPOGRAPHY.SM} ${colors.text.muted}`}>
          {t('entitiesSettings.toolSettings.comingSoon')}
        </p>
      </div>
    </div>
  );
};
