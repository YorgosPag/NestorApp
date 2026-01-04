import React from 'react';
import type { LineSettings, TextSettings, GripSettings } from '../../../settings-core/types';
import { LineSettings as LineSettingsComponent } from '../dxf-settings/settings/core/LineSettings';
import { TextSettings as TextSettingsComponent } from '../dxf-settings/settings/core/TextSettings';
import { GripSettings as GripSettingsComponent } from '../dxf-settings/settings/core/GripSettings';
import { LinePreview } from '../dxf-settings/settings/shared/LinePreview';
import { CurrentSettingsDisplay } from '../dxf-settings/settings/shared/CurrentSettingsDisplay';
import { OverrideToggle } from './OverrideToggle';
import { INTERACTIVE_PATTERNS } from '../../../ui/effects';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { UI_COLORS } from '../../../config/color-config';
// 🏢 ENTERPRISE: Import centralized tabs system (same as Contacts/ΓΕΜΗ/PanelTabs/etc.)
import { TabsOnlyTriggers, type TabDefinition } from '@/components/ui/navigation/TabsComponents';
// 🏢 ENTERPRISE: Lucide icons for sub-tabs
import { Minus, Type, GripVertical } from 'lucide-react';

export type SubTabType = 'draft' | 'completion' | 'hover' | 'selection';
export type SubTabContent = 'line' | 'text' | 'grips';

interface SubTabConfig {
  type: SubTabType;
  label: string;
  color: string;
  badgeColor: string;
  statusText?: string;
}

interface SubTabRendererProps {
  config: SubTabConfig;
  activeTab: string | null;
  activeSubTab: string | null;
  onTabChange: (tab: string | null) => void;
  onSubTabChange: (subTab: string | null) => void;

  // Settings και contexts
  lineSettings: LineSettings;
  textSettings: TextSettings;
  gripSettings: GripSettings;

  // 🔧 ΝΕΟ: Context type για isolation
  contextType?: 'preview' | 'completion';

  // Override settings
  overrideSettings?: {
    line?: {
      checked: boolean;
      onChange: (checked: boolean) => void;
      label: string;
      description: string;
      statusText?: string;
    };
    text?: {
      checked: boolean;
      onChange: (checked: boolean) => void;
      label: string;
      description: string;
    };
    grips?: {
      checked: boolean;
      onChange: (checked: boolean) => void;
      label: string;
      description: string;
      statusText?: string;
    };
  };

  // Optional custom components
  customPreview?: React.ReactNode;
  showPreview?: boolean;
}

export const SubTabRenderer = React.memo<SubTabRendererProps>(function SubTabRenderer({
  config,
  activeTab,
  activeSubTab,
  onTabChange,
  onSubTabChange,
  lineSettings,
  textSettings,
  gripSettings,
  contextType,
  overrideSettings,
  customPreview,
  showPreview = true
}) {
  const colors = useSemanticColors();

  // 🏢 ENTERPRISE: All hooks MUST be called before any early returns (React Rules of Hooks)
  // Helper για τα colors ανά τύπο - memoized για performance
  const getColoredSettings = React.useCallback((baseSettings: Record<string, unknown>) => {
    switch (config.type) {
      case 'hover':
        return { ...baseSettings, color: UI_COLORS.ORANGE };
      case 'selection':
        return { ...baseSettings, color: UI_COLORS.RED };
      case 'completion':
        return { ...baseSettings, color: UI_COLORS.SUCCESS_BRIGHT };
      default:
        return baseSettings;
    }
  }, [config.type]);

  // 🔥 FIX: Remove useMemo for textSettings - need to re-render on deep changes
  // When fontSize/color/isBold changes, textSettings object reference stays same
  // → useMemo doesn't re-run → preview doesn't update
  const coloredLineSettings = React.useMemo(() => getColoredSettings(lineSettings), [getColoredSettings, lineSettings]);
  const coloredTextSettings = getColoredSettings(textSettings); // Direct call - no memoization

  // ============================================================================
  // SUB-TAB CONFIGURATION - 🏢 ENTERPRISE: Using centralized TabDefinition interface
  // ============================================================================

  const subTabOptions: TabDefinition[] = React.useMemo(() => [
    {
      id: 'line',
      label: 'Γραμμή',
      icon: Minus, // 🏢 ENTERPRISE: Lucide icon
      content: null,
    },
    {
      id: 'text',
      label: 'Κείμενο',
      icon: Type, // 🏢 ENTERPRISE: Lucide icon
      content: null,
    },
    {
      id: 'grips',
      label: 'Grips',
      icon: GripVertical, // 🏢 ENTERPRISE: Lucide icon
      content: null,
    }
  ], []);

  // 🏢 ENTERPRISE: Handle sub-tab change - toggle behavior (click again to close)
  const handleSubTabChange = React.useCallback((subTabId: string) => {
    onSubTabChange(activeSubTab === subTabId ? null : subTabId);
  }, [onSubTabChange, activeSubTab]);

  // 🏢 ENTERPRISE: Early return AFTER all hooks (React Rules of Hooks compliance)
  if (activeTab !== config.type) {
    return null;
  }

  return (
    <div className={`p-3 ${colors.bg.secondary} rounded-lg space-y-4`}>
      {/* Preview Section */}
      {showPreview && (
        <>
          {customPreview || (
            <LinePreview
              lineSettings={coloredLineSettings}
              textSettings={coloredTextSettings}
              gripSettings={gripSettings}
            />
          )}

          {/* Current Settings Display */}
          <CurrentSettingsDisplay
            key={`${JSON.stringify(coloredTextSettings)}-${JSON.stringify(coloredLineSettings)}-${JSON.stringify(gripSettings)}`}
            activeTab={activeSubTab}
            lineSettings={coloredLineSettings}
            textSettings={coloredTextSettings}
            gripSettings={gripSettings}
          />
        </>
      )}

      {/* 🏢 ENTERPRISE: Sub-tabs Navigation - Using centralized TabsOnlyTriggers */}
      <TabsOnlyTriggers
        tabs={subTabOptions}
        value={activeSubTab || ''}
        onTabChange={handleSubTabChange}
        theme="dark"
        alwaysShowLabels={true}
      />

      {/* Line Sub-tab Content - 🏢 ENTERPRISE: Removed redundant wrapper (ADR-011) */}
      {/* LineSettingsComponent now handles its own layout via conditional wrapper */}
      {activeSubTab === 'line' && (
        <section className="space-y-4" aria-label={`Ρυθμίσεις Γραμμής ${config.label}`}>
          {overrideSettings?.line && (
            <OverrideToggle
              checked={overrideSettings.line.checked}
              onChange={overrideSettings.line.onChange}
              label={overrideSettings.line.label}
              description={overrideSettings.line.description}
              showStatusBadge={true}
              statusText={overrideSettings.line.statusText || config.statusText || config.label}
              className={`border-l-4 border-${config.color}`}
            />
          )}
          {/* 🏢 ENTERPRISE: LineSettingsComponent renders directly without extra wrapper */}
          <LineSettingsComponent contextType={contextType} />
        </section>
      )}

      {/* Text Sub-tab Content - 🏢 ENTERPRISE: Removed redundant wrapper (ADR-011) */}
      {/* TextSettingsComponent now handles its own layout via conditional wrapper */}
      {activeSubTab === 'text' && (
        <section className="space-y-4" aria-label={`Ρυθμίσεις Κειμένου ${config.label}`}>
          {overrideSettings?.text && (
            <OverrideToggle
              checked={overrideSettings.text.checked}
              onChange={overrideSettings.text.onChange}
              label={overrideSettings.text.label}
              description={overrideSettings.text.description}
              className={`border-l-4 border-${config.color}`}
            />
          )}
          {/* 🏢 ENTERPRISE: TextSettingsComponent renders directly without extra wrapper */}
          <TextSettingsComponent contextType={contextType} />
        </section>
      )}

      {/* Grips Sub-tab Content - 🏢 ENTERPRISE: Removed redundant wrapper (ADR-011) */}
      {/* GripSettingsComponent now handles its own layout via conditional wrapper */}
      {activeSubTab === 'grips' && (
        <section className="space-y-4" aria-label={`Ρυθμίσεις Grips ${config.label}`}>
          {overrideSettings?.grips && (
            <OverrideToggle
              checked={overrideSettings.grips.checked}
              onChange={overrideSettings.grips.onChange}
              label={overrideSettings.grips.label}
              description={overrideSettings.grips.description}
              showStatusBadge={true}
              statusText={overrideSettings.grips.statusText || config.statusText || config.label}
              className={`border-l-4 border-${config.color}`}
            />
          )}
          {/* 🏢 ENTERPRISE: GripSettingsComponent renders directly without extra wrapper */}
          <GripSettingsComponent contextType={contextType} />
        </section>
      )}
    </div>
  );
});