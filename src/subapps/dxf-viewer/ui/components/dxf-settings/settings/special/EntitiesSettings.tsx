// 🌐 i18n: All labels converted to i18n keys - 2026-01-19
import React, { useState, useEffect, useMemo } from 'react';
import { ACI_PALETTE } from '../../../../../settings/standards/aci';
import { Minus, Square, Pen, Hexagon, Ruler, Triangle } from 'lucide-react';
// 🏢 ENTERPRISE: Import centralized tabs system (same as Contacts/ΓΕΜΗ/PanelTabs/etc.)
import { TabsOnlyTriggers, type TabDefinition } from '@/components/ui/navigation/TabsComponents';
import { CircleRadiusIcon } from '../../../../toolbar/icons/CircleIcon';
import { useIconSizes } from '../../../../../../../hooks/useIconSizes';
import { useBorderTokens } from '../../../../../../../hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
// ✅ ΝΕΑ UNIFIED HOOKS - ΑΝΤΙΚΑΤΑΣΤΑΣΗ ΤΩΝ ΠΑΛΙΩΝ SPECIFIC CONTEXTS
import {
  useUnifiedLineCompletion,
  useUnifiedTextPreview,
  useUnifiedGripPreview,
  // 🔥 ΝΕΑ ΞΕΧΩΡΙΣΤΑ HOOKS ΓΙΑ ΚΑΘΕ ΚΑΡΤΕΛΑ
  useUnifiedLineDraft,
  useUnifiedLineHover,
  useUnifiedLineSelection
} from '../../../../hooks/useUnifiedSpecificSettings';
import {
  useTextSettingsFromProvider,
  useLineSettingsFromProvider,
  useGripSettingsFromProvider
} from '../../../../../settings-provider';
import { useEntitiesSettingsReducer } from '../../../../reducers/entitiesSettingsReducer';
import { EntitiesToolSettings } from './EntitiesToolSettings';

// 🏢 ENTERPRISE: Import centralized DXF entities settings labels - ZERO HARDCODED VALUES
import {
  DXF_SETTINGS_TAB_LABELS,
  DXF_DRAWING_SIMPLE_LABELS,
  DXF_MEASUREMENT_SIMPLE_LABELS
} from '../../../../../../../constants/property-statuses-enterprise';
import { INTERACTIVE_PATTERNS } from '../../../../../../../components/ui/effects';
import { PANEL_LAYOUT } from '../../../../../config/panel-tokens';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n';
// 🏢 ENTERPRISE: Shadcn Tooltip component
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { DEFAULT_GRIP_SETTINGS } from '../../../../../types/gripSettings';
import { createModuleLogger } from '@/lib/telemetry';
const logger = createModuleLogger('EntitiesSettings');

// Mock data για UI-only functionality - αντιγράφουμε τη δομή από dxf-viewer-kalo
interface DropdownOption {
  value: string;
  label: string;
}

interface MockToolIcon {
  id: string;
  label: string;
  icon: React.ComponentType<React.ComponentProps<'svg'>>; // Αλλάξαμε από emoji σε React component
  hotkey?: string;
  dropdownOptions?: DropdownOption[];
}

// Χρησιμοποιούμε τα constants από το LineSettings component για να αποφύγουμε διπλασιασμό κώδικα


interface EntitiesSettingsProps {
  // Για μελλοντική επέκταση μπορούμε να προσθέσουμε props
}

export const EntitiesSettings: React.FC<EntitiesSettingsProps> = () => {
  const iconSizes = useIconSizes();
  const { quick, getStatusBorder } = useBorderTokens();
  const colors = useSemanticColors();
  // 🌐 i18n
  const { t } = useTranslation('dxf-viewer');
  // ✅ Replaced multiple useState hooks with unified reducer for better performance
  const { state: tabState, actions: tabActions, computed } = useEntitiesSettingsReducer();

  // Destructure για easier access (backwards compatibility)
  const {
    selectedTool,
    activeLineTab,
    activeSpecificTab,
    activeDraftSubTab,
    activeCompletionSubTab,
    activeHoverSubTab,
    activeSelectionSubTab
  } = tabState;

  // Action aliases για backwards compatibility
  const setSelectedTool = tabActions.setSelectedTool;
  const setActiveLineTab = tabActions.setActiveLineTab;
  const setActiveSpecificTab = tabActions.setActiveSpecificTab;
  const setActiveDraftSubTab = tabActions.setActiveDraftSubTab;
  const setActiveCompletionSubTab = tabActions.setActiveCompletionSubTab;
  const setActiveHoverSubTab = tabActions.setActiveHoverSubTab;
  const setActiveSelectionSubTab = tabActions.setActiveSelectionSubTab;

  // 🔥 ΞΕΧΩΡΙΣΤΑ HOOKS ΓΙΑ ΚΑΘΕ ΚΑΡΤΕΛΑ - ΚΑΜΙΑ ΚΟΙΝΟΠΟΙΗΣΗ SETTINGS
  const { settings: draftSettings, updateSettings: updateDraftSettings, getEffectiveLineSettings: getEffectiveLineDraftSettings } = useUnifiedLineDraft();
  const { settings: hoverSettings, updateSettings: updateHoverSettings, getEffectiveLineSettings: getEffectiveLineHoverSettings } = useUnifiedLineHover();
  const { settings: selectionSettings, updateSettings: updateSelectionSettings, getEffectiveLineSettings: getEffectiveLineSelectionSettings } = useUnifiedLineSelection();
  const { settings: completionSettings, updateSettings: updateCompletionSettings, getEffectiveLineSettings: getEffectiveLineCompletionSettings } = useUnifiedLineCompletion();

  // Για text και grips χρησιμοποιούμε τα παλιά (αν δεν υπάρχει πρόβλημα εκεί)
  const { settings: specificTextSettings, updateSettings: updateSpecificTextSettings, updateTextSettings, getEffectiveTextSettings } = useUnifiedTextPreview();
  const { settings: specificGripSettings, updateSettings: updateSpecificGripSettings, updateGripSettings, getEffectiveGripSettings } = useUnifiedGripPreview();

  // 🆕 Γενικές ρυθμίσεις (pure General - χωρίς merge με Specific)
  const globalTextSettings = useTextSettingsFromProvider();
  const { settings: globalLineSettings } = useLineSettingsFromProvider();
  const { settings: globalGripSettings } = useGripSettingsFromProvider();

  // 🔥 FIX: useMemo ensures re-calculation when getEffective* functions change
  // These functions are useCallbacks with dependencies [overrideSettings, globalSettings]
  // So when override flag OR specific settings change, these will re-run and preview will update

  // Line settings (4 contexts: Draft, Hover, Selection, Completion)
  const effectiveLineDraftSettings = useMemo(() => getEffectiveLineDraftSettings(), [getEffectiveLineDraftSettings]);
  const effectiveLineHoverSettings = useMemo(() => getEffectiveLineHoverSettings(), [getEffectiveLineHoverSettings]);
  const effectiveLineSelectionSettings = useMemo(() => getEffectiveLineSelectionSettings(), [getEffectiveLineSelectionSettings]);
  const effectiveLineCompletionSettings = useMemo(() => getEffectiveLineCompletionSettings(), [getEffectiveLineCompletionSettings]);

  // Text settings
  const effectiveTextSettings = useMemo(() => getEffectiveTextSettings(), [getEffectiveTextSettings]);

  // Grip settings
  const effectiveGripSettings = useMemo(() => getEffectiveGripSettings(), [getEffectiveGripSettings]);

  // 🆕 CONDITIONAL PREVIEW SETTINGS - για preview box
  // Αν checkbox OFF → pure General | Αν checkbox ON → Effective (merged)
  const previewLineDraftSettings = useMemo(() => {
    if (!globalLineSettings) {
      logger.warn('globalLineSettings is undefined in previewLineDraftSettings');
      return effectiveLineDraftSettings;
    }
    return draftSettings.overrideGlobalSettings ? effectiveLineDraftSettings : globalLineSettings;
  }, [draftSettings.overrideGlobalSettings, effectiveLineDraftSettings, globalLineSettings]);

  const previewLineHoverSettings = useMemo(() => {
    if (!globalLineSettings) {
      logger.warn('globalLineSettings is undefined in previewLineHoverSettings');
      return effectiveLineHoverSettings;
    }
    return hoverSettings.overrideGlobalSettings ? effectiveLineHoverSettings : globalLineSettings;
  }, [hoverSettings.overrideGlobalSettings, effectiveLineHoverSettings, globalLineSettings]);

  const previewLineSelectionSettings = useMemo(() => {
    if (!globalLineSettings) {
      logger.warn('globalLineSettings is undefined in previewLineSelectionSettings');
      return effectiveLineSelectionSettings;
    }
    return selectionSettings.overrideGlobalSettings ? effectiveLineSelectionSettings : globalLineSettings;
  }, [selectionSettings.overrideGlobalSettings, effectiveLineSelectionSettings, globalLineSettings]);

  const previewLineCompletionSettings = useMemo(() => {
    if (!globalLineSettings) {
      logger.warn('globalLineSettings is undefined in previewLineCompletionSettings');
      return effectiveLineCompletionSettings;
    }
    return completionSettings.overrideGlobalSettings ? effectiveLineCompletionSettings : globalLineSettings;
  }, [completionSettings.overrideGlobalSettings, effectiveLineCompletionSettings, globalLineSettings]);

  const previewTextSettings = useMemo(() => {
    if (!globalTextSettings || !globalTextSettings.settings) {
      logger.warn('globalTextSettings is undefined in previewTextSettings');
      return effectiveTextSettings;
    }
    return specificTextSettings.overrideGlobalSettings ? effectiveTextSettings : globalTextSettings.settings;
  }, [specificTextSettings.overrideGlobalSettings, effectiveTextSettings, globalTextSettings, globalTextSettings?.settings]);

  const previewGripSettings = useMemo(() => {
    // 🛡️ Null guard: Ensure all values are defined
    if (!specificGripSettings || specificGripSettings.overrideGlobalSettings === undefined) {
      logger.warn('specificGripSettings invalid', { specificGripSettings });
      return globalGripSettings || DEFAULT_GRIP_SETTINGS;
    }

    if (!globalGripSettings) {
      logger.warn('globalGripSettings is undefined in previewGripSettings');
      return effectiveGripSettings || DEFAULT_GRIP_SETTINGS;
    }

    return specificGripSettings.overrideGlobalSettings ? effectiveGripSettings : globalGripSettings;
  }, [specificGripSettings, specificGripSettings?.overrideGlobalSettings, effectiveGripSettings, globalGripSettings]);


  // Sync: when override is active, global text changes propagate to specific settings
  useEffect(() => {
    if (specificTextSettings.overrideGlobalSettings && globalTextSettings?.settings) {
      updateTextSettings(globalTextSettings.settings);
    }
  }, [globalTextSettings?.settings, specificTextSettings.overrideGlobalSettings, updateTextSettings]);

  // Mock text settings (ISO 3098 standards)
  const [mockTextSettings] = useState({
    fontSize: 2.5, fontFamily: 'Arial, sans-serif', color: ACI_PALETTE[7],
    isBold: false, isItalic: false, isUnderline: false,
    isStrikethrough: false, isSuperscript: false, isSubscript: false
  });

  // Drawing tools (centralized labels)
  const drawingTools: MockToolIcon[] = [
    { id: 'line', label: t(DXF_DRAWING_SIMPLE_LABELS.LINE), icon: Minus, hotkey: 'L' },
    { id: 'rectangle', label: t(DXF_DRAWING_SIMPLE_LABELS.RECTANGLE), icon: Square, hotkey: 'R' },
    { id: 'circle', label: t(DXF_DRAWING_SIMPLE_LABELS.CIRCLE), icon: CircleRadiusIcon, hotkey: 'C', dropdownOptions: [{ value: 'radius', label: t('dxfViewer.tools.radius') }, { value: 'diameter', label: t('dxfViewer.tools.diameter') }] }, // ✅ ENTERPRISE FIX: Proper dropdown option format
    { id: 'polyline', label: t(DXF_DRAWING_SIMPLE_LABELS.POLYLINE), icon: Pen, hotkey: 'PL' },
    { id: 'polygon', label: t(DXF_DRAWING_SIMPLE_LABELS.POLYGON), icon: Hexagon, hotkey: 'POL' }
  ];

  const measurementTools: MockToolIcon[] = [
    { id: 'measure-distance', label: t(DXF_MEASUREMENT_SIMPLE_LABELS.DISTANCE), icon: Ruler, hotkey: 'DI' },
    { id: 'measure-area', label: t(DXF_MEASUREMENT_SIMPLE_LABELS.AREA), icon: Square, hotkey: 'AREA' },
    { id: 'measure-angle', label: t(DXF_MEASUREMENT_SIMPLE_LABELS.ANGLE), icon: Triangle, hotkey: 'ANG' }
  ];

  type SpecificTab = 'drawing' | 'measurements';

  const specificTabs: TabDefinition[] = [
    {
      id: 'drawing',
      label: t(DXF_SETTINGS_TAB_LABELS.DRAWING),
      icon: Pen, // 🏢 ENTERPRISE: Lucide icon
      content: null, // Content rendered separately below
    },
    {
      id: 'measurements',
      label: t(DXF_SETTINGS_TAB_LABELS.MEASUREMENTS),
      icon: Ruler, // 🏢 ENTERPRISE: Lucide icon
      content: null, // Content rendered separately below
    },
  ];

  // 🏢 ENTERPRISE: Handle tab change - convert string to SpecificTab
  const handleSpecificTabChange = (tabId: string) => {
    setActiveSpecificTab(tabId as SpecificTab);
    setSelectedTool(null);
  };

  // Mock template functions
  const getTemplatesByCategory = (category: string) => {
    const templates = {
      engineering: [
        { name: 'Standard Engineering', description: 'Τυπικές τεχνικές γραμμές' },
        { name: 'Hidden Lines', description: 'Κρυφές γραμμές' },
        { name: 'Center Lines', description: 'Κεντρικές γραμμές' }
      ],
      architectural: [
        { name: 'Wall Lines', description: 'Γραμμές τοίχων' },
        { name: 'Dimension Lines', description: 'Γραμμές διαστάσεων' },
        { name: 'Hatch Lines', description: 'Γραμμές εκκλωής' }
      ],
      electrical: [
        { name: 'Power Lines', description: 'Γραμμές ισχύος' },
        { name: 'Signal Lines', description: 'Γραμμές σημάτων' },
        { name: 'Ground Lines', description: 'Γραμμές γείωσης' }
      ]
    };
    return templates[category as keyof typeof templates] || [];
  };

  // Removed duplicate handler functions - these are handled by the LineSettings component

  const resetToDefaults = () => {
    // Mock reset function
  };

  const handleToolClick = (toolId: string) => {
    // Εάν το ίδιο εργαλείο είναι ήδη επιλεγμένο, το κλείνουμε
    if (selectedTool === toolId) {
      setSelectedTool(null);
    } else {
      setSelectedTool(toolId);
    }
  };

  const renderToolbarIcons = () => {
    // Διαχωρίζουμε τα εργαλεία ανάλογα με την ενεργή καρτέλα
    let toolsToShow: MockToolIcon[] = [];

    // Show tools based on the active specific tab
    if (activeSpecificTab === 'drawing') {
      toolsToShow = drawingTools;
    } else if (activeSpecificTab === 'measurements') {
      toolsToShow = measurementTools;
    }

    return (
      <div className={PANEL_LAYOUT.MARGIN.BOTTOM_LG}>
        <div className={`flex flex-wrap ${PANEL_LAYOUT.GAP.XS}`}>
          {toolsToShow.map((tool) => {
            const hasDropdown = tool.dropdownOptions && tool.dropdownOptions.length > 0;
            const isSelected = selectedTool === tool.id;

            if (!hasDropdown) {
              return (
                <Tooltip key={tool.id}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => handleToolClick(tool.id)}
                      className={`
                        ${iconSizes.xl} ${PANEL_LAYOUT.SPACING.NONE} ${quick.button} ${PANEL_LAYOUT.TRANSITION.COLORS} ${PANEL_LAYOUT.DURATION['150']}
                        flex items-center justify-center
                        ${isSelected
                          ? `${colors.bg.primary} ${INTERACTIVE_PATTERNS.PRIMARY_HOVER} ${colors.text.inverted} ${getStatusBorder('info')}`
                          : `${colors.bg.secondary} ${INTERACTIVE_PATTERNS.SUBTLE_HOVER} ${colors.text.secondary} ${getStatusBorder('default')}`
                        }
                      `}
                    >
                      {React.createElement(tool.icon as React.ComponentType<{ size: number }>, { size: 16 })}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{`${tool.label} (${tool.hotkey})`}</TooltipContent>
                </Tooltip>
              );
            }

            return (
              <div key={tool.id} className="relative flex">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => handleToolClick(tool.id)}
                      className={`
                        ${PANEL_LAYOUT.HEIGHT.XL} ${PANEL_LAYOUT.WIDTH.BUTTON_MD} ${PANEL_LAYOUT.SPACING.NONE} ${quick.button} border-r-0 ${PANEL_LAYOUT.TRANSITION.COLORS} ${PANEL_LAYOUT.DURATION['150']}
                        flex items-center justify-center
                        ${isSelected
                          ? `${colors.bg.primary} ${INTERACTIVE_PATTERNS.PRIMARY_HOVER} ${colors.text.inverted} ${getStatusBorder('info')}`
                          : `${colors.bg.secondary} ${INTERACTIVE_PATTERNS.SUBTLE_HOVER} ${colors.text.secondary} ${getStatusBorder('default')}`
                        }
                      `}
                    >
                      {React.createElement(tool.icon as React.ComponentType<{ size: number }>, { size: 14 })}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{`${tool.label} (${tool.hotkey})`}</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      className={`
                        ${PANEL_LAYOUT.HEIGHT.XL} ${PANEL_LAYOUT.WIDTH.INDICATOR_MD} ${PANEL_LAYOUT.SPACING.NONE} ${quick.button} ${PANEL_LAYOUT.TRANSITION.COLORS} ${PANEL_LAYOUT.DURATION['150']}
                        flex items-center justify-center
                        ${isSelected
                          ? `${colors.bg.primary} ${INTERACTIVE_PATTERNS.PRIMARY_HOVER} ${colors.text.inverted} ${getStatusBorder('info')}`
                          : `${colors.bg.secondary} ${INTERACTIVE_PATTERNS.SUBTLE_HOVER} ${colors.text.secondary} ${getStatusBorder('default')}`
                        }
                      `}
                    >
                      <svg className={iconSizes.xs} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{t('entitiesSettings.moreOptions')}</TooltipContent>
                </Tooltip>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // renderToolSettings extracted to EntitiesToolSettings component (ADR-065)
  const renderToolSettings = () => {
    if (!selectedTool) return null;
    return (
      <EntitiesToolSettings
        selectedTool={selectedTool}
        activeLineTab={activeLineTab}
        setActiveLineTab={setActiveLineTab}
        activeDraftSubTab={activeDraftSubTab}
        setActiveDraftSubTab={setActiveDraftSubTab}
        previewLineDraftSettings={previewLineDraftSettings}
        draftOverride={{
          checked: draftSettings.overrideGlobalSettings || false,
          onChange: (checked) => updateDraftSettings({ overrideGlobalSettings: checked }),
          label: t('entitiesSettings.overrideGlobalSettings'),
          description: t('entitiesSettings.overrideDescriptions.lineDraft'),
          statusText: draftSettings.overrideGlobalSettings ? t('entitiesSettings.statusLabels.specificDraft') : t('entitiesSettings.statusLabels.general')
        }}
        activeHoverSubTab={activeHoverSubTab}
        setActiveHoverSubTab={setActiveHoverSubTab}
        previewLineHoverSettings={previewLineHoverSettings}
        hoverOverride={{
          checked: hoverSettings.overrideGlobalSettings || false,
          onChange: (checked) => updateHoverSettings({ overrideGlobalSettings: checked }),
          label: t('entitiesSettings.overrideGlobalSettings'),
          description: t('entitiesSettings.overrideDescriptions.lineHover'),
          statusText: hoverSettings.overrideGlobalSettings ? t('entitiesSettings.statusLabels.specificHover') : t('entitiesSettings.statusLabels.general')
        }}
        activeSelectionSubTab={activeSelectionSubTab}
        setActiveSelectionSubTab={setActiveSelectionSubTab}
        previewLineSelectionSettings={previewLineSelectionSettings}
        selectionOverride={{
          checked: selectionSettings.overrideGlobalSettings || false,
          onChange: (checked) => updateSelectionSettings({ overrideGlobalSettings: checked }),
          label: t('entitiesSettings.overrideGlobalSettings'),
          description: t('entitiesSettings.overrideDescriptions.lineSelection'),
          statusText: selectionSettings.overrideGlobalSettings ? t('entitiesSettings.statusLabels.specificSelection') : t('entitiesSettings.statusLabels.general')
        }}
        activeCompletionSubTab={activeCompletionSubTab}
        setActiveCompletionSubTab={setActiveCompletionSubTab}
        previewLineCompletionSettings={previewLineCompletionSettings}
        completionOverride={{
          checked: completionSettings.overrideGlobalSettings,
          onChange: (checked) => updateCompletionSettings({ overrideGlobalSettings: checked }),
          label: t('entitiesSettings.overrideGlobalSettings'),
          description: t('entitiesSettings.overrideDescriptions.lineCompletion'),
          statusText: completionSettings.overrideGlobalSettings ? t('entitiesSettings.statusLabels.specificCompletion') : t('entitiesSettings.statusLabels.general')
        }}
        previewTextSettings={previewTextSettings}
        previewGripSettings={previewGripSettings}
        textOverride={{
          checked: specificTextSettings.overrideGlobalSettings,
          onChange: (checked) => updateSpecificTextSettings({ overrideGlobalSettings: checked }),
          label: t('entitiesSettings.overrideGlobalSettings'),
          description: t('entitiesSettings.overrideDescriptions.textDraft')
        }}
        gripOverride={{
          checked: specificGripSettings.overrideGlobalSettings || false,
          onChange: (checked) => updateSpecificGripSettings({ overrideGlobalSettings: checked }),
          label: t('entitiesSettings.overrideGlobalSettings'),
          description: t('entitiesSettings.overrideDescriptions.gripsDraft'),
          statusText: specificGripSettings.overrideGlobalSettings ? t('entitiesSettings.statusLabels.specific') : t('entitiesSettings.statusLabels.general')
        }}
      />
    );
  };

  return (
    <div className={PANEL_LAYOUT.SPACING.GAP_XL}>
      {/* ✅ ADR-003: Removed empty wrapper div - content flows directly */}

      {/* 🏢 ENTERPRISE: Tabs για Ειδικές Ρυθμίσεις - className moved directly to component */}
      <TabsOnlyTriggers
        tabs={specificTabs}
        value={activeSpecificTab}
        onTabChange={handleSpecificTabChange}
        theme="dark"
        alwaysShowLabels
        className={PANEL_LAYOUT.MARGIN.BOTTOM_LG}
      />

      {/* Toolbar Icons - ανάλογα με την ενεργή υποκαρτέλα */}
      {renderToolbarIcons()}

      {/* Tool-specific Settings Container */}
      {renderToolSettings()}

      {/* Empty state - shown only when no tool selected */}
      {!selectedTool && (
        <div className={`text-center ${PANEL_LAYOUT.PADDING.VERTICAL_XXXL} ${colors.text.muted}`}>
          <Pen className={`${iconSizes.xl} mx-auto ${PANEL_LAYOUT.MARGIN.BOTTOM_LG}`} />
          <h3 className={`${PANEL_LAYOUT.TYPOGRAPHY.LG} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${PANEL_LAYOUT.MARGIN.BOTTOM_SM} ${colors.text.primary}`}>{t('entitiesSettings.selectTool.title')}</h3>
          <p className={`${PANEL_LAYOUT.TYPOGRAPHY.SM} ${colors.text.muted}`}>
            {t('entitiesSettings.selectTool.description')}
          </p>
        </div>
      )}
    </div>
  );
};

