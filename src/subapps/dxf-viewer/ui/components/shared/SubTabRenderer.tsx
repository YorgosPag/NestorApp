import React from 'react';
import { LineSettings } from '../dxf-settings/settings/core/LineSettings';
import { TextSettings } from '../dxf-settings/settings/core/TextSettings';
import { GripSettings } from '../dxf-settings/settings/core/GripSettings';
import { LinePreview } from '../dxf-settings/settings/shared/LinePreview';
import { CurrentSettingsDisplay } from '../dxf-settings/settings/shared/CurrentSettingsDisplay';
import { OverrideToggle } from './OverrideToggle';
import { INTERACTIVE_PATTERNS } from '../../../ui/effects';

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
  lineSettings: Record<string, unknown>;
  textSettings: Record<string, unknown>;
  gripSettings: Record<string, unknown>;

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
  if (activeTab !== config.type) {
    return null;
  }

  // Helper για τα colors ανά τύπο - memoized για performance
  const getColoredSettings = React.useCallback((baseSettings: Record<string, unknown>) => {
    switch (config.type) {
      case 'hover':
        return { ...baseSettings, color: '#ffaa00' };
      case 'selection':
        return { ...baseSettings, color: '#ff4444' };
      case 'completion':
        return { ...baseSettings, color: '#00ff88' };
      default:
        return baseSettings;
    }
  }, [config.type]);

  // 🔥 FIX: Remove useMemo for textSettings - need to re-render on deep changes
  // When fontSize/color/isBold changes, textSettings object reference stays same
  // → useMemo doesn't re-run → preview doesn't update
  const coloredLineSettings = React.useMemo(() => getColoredSettings(lineSettings), [getColoredSettings, lineSettings]);
  const coloredTextSettings = getColoredSettings(textSettings); // Direct call - no memoization

  // 🐛 DEBUG: Log text settings to console
  console.log('🔍 [SubTabRenderer] textSettings:', textSettings);
  console.log('🔍 [SubTabRenderer] coloredTextSettings:', coloredTextSettings);

  // Memoized sub-tab options
  const subTabOptions = React.useMemo(() => [
    { id: 'line', label: 'Γραμμή' },
    { id: 'text', label: 'Κείμενο' },
    { id: 'grips', label: 'Grips' }
  ], []);

  // Memoized handlers
  const handleSubTabChange = React.useCallback((subTabId: string) => {
    onSubTabChange(activeSubTab === subTabId ? null : subTabId);
  }, [onSubTabChange, activeSubTab]);

  return (
    <div className="p-3 bg-gray-700 rounded-lg space-y-4">
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

      {/* Sub-tabs Navigation */}
      <div className="grid grid-cols-3 gap-1">
        {subTabOptions.map((subTab) => (
          <button
            key={subTab.id}
            onClick={() => handleSubTabChange(subTab.id)}
            className={`py-2 px-3 text-sm font-medium rounded-md transition-colors ${
              activeSubTab === subTab.id
                ? `bg-blue-600 text-white ${INTERACTIVE_PATTERNS.PRIMARY_HOVER}`
                : `bg-gray-600 text-white ${INTERACTIVE_PATTERNS.SUBTLE_HOVER}`
            }`}
          >
            {subTab.label}
          </button>
        ))}
      </div>

      {/* Line Sub-tab Content */}
      {activeSubTab === 'line' && (
        <div className="space-y-4">
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

          <div className="p-3 bg-gray-800 rounded space-y-3">
            {overrideSettings?.line ? null : (
              <div className="flex items-center justify-between">
                <div className="text-sm text-white font-medium">
                  Ρυθμίσεις Γραμμής {config.label}
                </div>
                <span className={`text-xs ${config.badgeColor} px-2 py-1 rounded`}>
                  {config.label}
                </span>
              </div>
            )}
            <LineSettings contextType={contextType} />
          </div>
        </div>
      )}

      {/* Text Sub-tab Content */}
      {activeSubTab === 'text' && (
        <div className="space-y-4">
          {overrideSettings?.text && (
            <OverrideToggle
              checked={overrideSettings.text.checked}
              onChange={overrideSettings.text.onChange}
              label={overrideSettings.text.label}
              description={overrideSettings.text.description}
              className={`border-l-4 border-${config.color}`}
            />
          )}

          <div className="p-3 bg-gray-800 rounded space-y-3">
            <div className="text-sm text-white font-medium">
              Ρυθμίσεις Κειμένου {config.label}
            </div>
            <TextSettings />
          </div>
        </div>
      )}

      {/* Grips Sub-tab Content */}
      {activeSubTab === 'grips' && (
        <div className="space-y-4">
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

          <GripSettings />
        </div>
      )}
    </div>
  );
});