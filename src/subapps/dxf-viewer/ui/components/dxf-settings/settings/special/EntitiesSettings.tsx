import React, { useState, useEffect, useMemo } from 'react';
import { ACI_PALETTE } from '../../../../../settings/standards/aci';
import { UI_COLORS } from '../../../../../config/color-config';
import { Minus, Square, Pen, Hexagon, Ruler, Triangle } from 'lucide-react';
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
import { LineSettings } from '../core/LineSettings';
import { TextSettings } from '../core/TextSettings';
import { GripSettings } from '../core/GripSettings';
import { LinePreview } from '../shared/LinePreview';
import { CurrentSettingsDisplay } from '../shared/CurrentSettingsDisplay';
import { OverrideToggle } from '../../../shared/OverrideToggle';
import { SubTabRenderer, SubTabType } from '../../../shared/SubTabRenderer';
import { useEntitiesSettingsReducer } from '../../../../reducers/entitiesSettingsReducer';

// 🏢 ENTERPRISE: Import centralized DXF entities settings labels - ZERO HARDCODED VALUES
import {
  DXF_SETTINGS_TAB_LABELS,
  DXF_SETTINGS_OVERRIDE_LABELS,
  DXF_DRAWING_SIMPLE_LABELS,
  DXF_MEASUREMENT_SIMPLE_LABELS
} from '../../../../../../../constants/property-statuses-enterprise';
import { updateDraftSettingsStore } from '../../../../../hooks/useLinePreviewStyle';
import { updateDraftTextSettingsStore } from '../../../../../hooks/useTextPreviewStyle';
import { updateDraftGripSettingsStore } from '../../../../../hooks/useGripPreviewStyle';
import { INTERACTIVE_PATTERNS } from '../../../../../../../components/ui/effects';

// Default grip settings for LinePreview
const DEFAULT_GRIP_SETTINGS = {
  enabled: true,
  gripSize: 5,              // ✅ AutoCAD GRIPSIZE default: 5 DIP
  pickBoxSize: 3,           // ✅ AutoCAD PICKBOX default: 3 DIP
  apertureSize: 10,         // ✅ AutoCAD APERTURE default: 10 pixels
  opacity: 1.0,
  colors: {
    cold: ACI_PALETTE[5],   // ✅ AutoCAD standard: Blue (ACI 5) - unselected grips
    warm: '#FF69B4',        // ✅ AutoCAD standard: Hot Pink - hover grips (Custom color)
    hot: ACI_PALETTE[1],    // ✅ AutoCAD standard: Red (ACI 1) - selected grips
    contour: UI_COLORS.BLACK // ✅ AutoCAD standard: Black contour
  },
  showAperture: true,
  multiGripEdit: true,
  snapToGrips: true,
  showMidpoints: true,
  showCenters: true,
  showQuadrants: true,      // ✅ Show quadrant grips
  maxGripsPerEntity: 50
};

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
      console.warn('⚠️ [previewLineDraftSettings] globalLineSettings is undefined!');
      return effectiveLineDraftSettings;
    }
    return draftSettings.overrideGlobalSettings ? effectiveLineDraftSettings : globalLineSettings;
  }, [draftSettings.overrideGlobalSettings, effectiveLineDraftSettings, globalLineSettings]);

  const previewLineHoverSettings = useMemo(() => {
    if (!globalLineSettings) {
      console.warn('⚠️ [previewLineHoverSettings] globalLineSettings is undefined!');
      return effectiveLineHoverSettings;
    }
    return hoverSettings.overrideGlobalSettings ? effectiveLineHoverSettings : globalLineSettings;
  }, [hoverSettings.overrideGlobalSettings, effectiveLineHoverSettings, globalLineSettings]);

  const previewLineSelectionSettings = useMemo(() => {
    if (!globalLineSettings) {
      console.warn('⚠️ [previewLineSelectionSettings] globalLineSettings is undefined!');
      return effectiveLineSelectionSettings;
    }
    return selectionSettings.overrideGlobalSettings ? effectiveLineSelectionSettings : globalLineSettings;
  }, [selectionSettings.overrideGlobalSettings, effectiveLineSelectionSettings, globalLineSettings]);

  const previewLineCompletionSettings = useMemo(() => {
    if (!globalLineSettings) {
      console.warn('⚠️ [previewLineCompletionSettings] globalLineSettings is undefined!');
      return effectiveLineCompletionSettings;
    }
    return completionSettings.overrideGlobalSettings ? effectiveLineCompletionSettings : globalLineSettings;
  }, [completionSettings.overrideGlobalSettings, effectiveLineCompletionSettings, globalLineSettings]);

  const previewTextSettings = useMemo(() => {
    if (!globalTextSettings || !globalTextSettings.settings) {
      console.warn('⚠️ [previewTextSettings] globalTextSettings is undefined!');
      return effectiveTextSettings;
    }
    return specificTextSettings.overrideGlobalSettings ? effectiveTextSettings : globalTextSettings.settings;
  }, [specificTextSettings.overrideGlobalSettings, effectiveTextSettings, globalTextSettings, globalTextSettings?.settings]);

  const previewGripSettings = useMemo(() => {
    // 🛡️ Null guard: Ensure all values are defined
    if (!specificGripSettings || specificGripSettings.overrideGlobalSettings === undefined) {
      console.warn('⚠️ [previewGripSettings] specificGripSettings invalid:', specificGripSettings);
      return globalGripSettings || DEFAULT_GRIP_SETTINGS;
    }

    if (!globalGripSettings) {
      console.warn('⚠️ [previewGripSettings] globalGripSettings is undefined!');
      return effectiveGripSettings || DEFAULT_GRIP_SETTINGS;
    }

    return specificGripSettings.overrideGlobalSettings ? effectiveGripSettings : globalGripSettings;
  }, [specificGripSettings, specificGripSettings?.overrideGlobalSettings, effectiveGripSettings, globalGripSettings]);


  // 🏢 ENTERPRISE PATTERN: Explicit Sync (No Auto-Sync)
  // Settings sync happens ONLY when drawing tool is activated (event-driven)
  // This prevents unwanted side effects and keeps Scene/Canvas stable

  // ❌ REMOVED: Automatic useEffect sync (caused scene to lose entities)
  // ✅ NEW: Manual sync will be called from tool activation handlers

  // Example usage (to be implemented in drawing tool handlers):
  // const syncSettingsToCanvas = useCallback(() => {
  //   updateDraftSettingsStore({
  //     overrideGlobalSettings: draftSettings.overrideGlobalSettings || false,
  //     settings: previewLineDraftSettings
  //   });
  //   updateDraftTextSettingsStore({
  //     overrideGlobalSettings: specificTextSettings.overrideGlobalSettings || false,
  //     settings: previewTextSettings
  //   });
  //   updateDraftGripSettingsStore({
  //     overrideGlobalSettings: specificGripSettings.overrideGlobalSettings || false,
  //     settings: previewGripSettings
  //   });
  // }, [previewLineDraftSettings, previewTextSettings, previewGripSettings]);

  // Συγχρονισμός: Όταν το override είναι ενεργό, οι αλλαγές στις γενικές ρυθμίσεις
  // προωθούνται στις ειδικές ρυθμίσεις για άμεση ενημέρωση
  useEffect(() => {
    if (specificTextSettings.overrideGlobalSettings && globalTextSettings?.settings) {
      updateTextSettings(globalTextSettings.settings);
    }
  }, [globalTextSettings?.settings, specificTextSettings.overrideGlobalSettings, updateTextSettings]);

  // ✅ Grip settings πλέον από unified SpecificGripPreviewContext

  // Mock text settings - ✅ Updated to ISO 3098 standards
  const [mockTextSettings] = useState({
    fontSize: 2.5,           // ✅ ISO 3098: Standard 2.5mm text height
    fontFamily: 'Arial, sans-serif',  // ✅ ISO 3098: Sans-serif font recommended
    color: ACI_PALETTE[7],   // ✅ AutoCAD ACI 7: White for text
    isBold: false,
    isItalic: false,
    isUnderline: false,
    isStrikethrough: false,
    isSuperscript: false,
    isSubscript: false
  });

  // ❌ REMOVED: Mock global line settings - now using real settings from useLineSettingsFromProvider()
  // The real globalLineSettings is defined at line ~110 via useLineSettingsFromProvider hook

  // Drawing tools - χρησιμοποιούν τα ίδια εικονίδια με την κεντρική εργαλειοθήκη
  // ✅ CENTRALIZED: Using DXF_DRAWING_SIMPLE_LABELS from central system - ZERO HARDCODED VALUES
  const drawingTools: MockToolIcon[] = [
    { id: 'line', label: DXF_DRAWING_SIMPLE_LABELS.LINE, icon: Minus, hotkey: 'L' },
    { id: 'rectangle', label: DXF_DRAWING_SIMPLE_LABELS.RECTANGLE, icon: Square, hotkey: 'R' },
    { id: 'circle', label: DXF_DRAWING_SIMPLE_LABELS.CIRCLE, icon: CircleRadiusIcon, hotkey: 'C', dropdownOptions: [{ value: 'radius', label: 'Radius' }, { value: 'diameter', label: 'Diameter' }] }, // ✅ ENTERPRISE FIX: Proper dropdown option format
    { id: 'polyline', label: DXF_DRAWING_SIMPLE_LABELS.POLYLINE, icon: Pen, hotkey: 'PL' },
    { id: 'polygon', label: DXF_DRAWING_SIMPLE_LABELS.POLYGON, icon: Hexagon, hotkey: 'POL' }
  ];

  // ✅ CENTRALIZED: Using DXF_MEASUREMENT_SIMPLE_LABELS from central system - ZERO HARDCODED VALUES
  const measurementTools: MockToolIcon[] = [
    { id: 'measure-distance', label: DXF_MEASUREMENT_SIMPLE_LABELS.DISTANCE, icon: Ruler, hotkey: 'DI' },
    { id: 'measure-area', label: DXF_MEASUREMENT_SIMPLE_LABELS.AREA, icon: Square, hotkey: 'AREA' },
    { id: 'measure-angle', label: DXF_MEASUREMENT_SIMPLE_LABELS.ANGLE, icon: Triangle, hotkey: 'ANG' }
  ];

  // Removed updateGripSettings mock function - now using context

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
      <div className="mb-6">
        <div className="flex flex-wrap gap-1">
          {toolsToShow.map((tool) => {
            const hasDropdown = tool.dropdownOptions && tool.dropdownOptions.length > 0;
            const isSelected = selectedTool === tool.id;

            if (!hasDropdown) {
              return (
                <button
                  key={tool.id}
                  onClick={() => handleToolClick(tool.id)}
                  title={`${tool.label} (${tool.hotkey})`}
                  className={`
                    ${iconSizes.xl} p-0 ${quick.button} transition-colors duration-150
                    flex items-center justify-center
                    ${isSelected
                      ? `${colors.bg.primary} ${INTERACTIVE_PATTERNS.PRIMARY_HOVER} text-white ${getStatusBorder('info')}`
                      : `${colors.bg.secondary} ${INTERACTIVE_PATTERNS.SUBTLE_HOVER} ${colors.text.secondary} ${getStatusBorder('default')}`
                    }
                  `}
                >
                  {React.createElement(tool.icon as React.ComponentType<{ size: number }>, { size: 16 })}
                </button>
              );
            }

            return (
              <div key={tool.id} className="relative flex">
                <button
                  onClick={() => handleToolClick(tool.id)}
                  title={`${tool.label} (${tool.hotkey})`}
                  className={`
                    h-8 w-7 p-0 ${quick.button} border-r-0 transition-colors duration-150
                    flex items-center justify-center
                    ${isSelected
                      ? `${colors.bg.primary} ${INTERACTIVE_PATTERNS.PRIMARY_HOVER} text-white ${getStatusBorder('info')}`
                      : `${colors.bg.secondary} ${INTERACTIVE_PATTERNS.SUBTLE_HOVER} ${colors.text.secondary} ${getStatusBorder('default')}`
                    }
                  `}
                >
                  {React.createElement(tool.icon as React.ComponentType<{ size: number }>, { size: 14 })}
                </button>
                <button
                  className={`
                    h-8 w-4 p-0 ${quick.button} transition-colors duration-150
                    flex items-center justify-center
                    ${isSelected
                      ? `${colors.bg.primary} ${INTERACTIVE_PATTERNS.PRIMARY_HOVER} text-white ${getStatusBorder('info')}`
                      : `${colors.bg.secondary} ${INTERACTIVE_PATTERNS.SUBTLE_HOVER} ${colors.text.secondary} ${getStatusBorder('default')}`
                    }
                  `}
                  title="Περισσότερες επιλογές"
                >
                  <svg className={iconSizes.xs} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderToolSettings = () => {
    if (!selectedTool) return null;

    // Ειδική λογική για το line tool (πλήρης από dxf-viewer-kalo)
    if (selectedTool === 'line') {
      return (
        <div className={`mb-6 p-4 ${colors.bg.tertiary} ${quick.card}`}>
          {/* Καρτέλες για Line Tool σε δύο σειρές */}
          <div className="grid grid-cols-2 gap-2 mb-4">
            {[
              { id: 'draft', label: DXF_SETTINGS_TAB_LABELS.DRAFT },
              { id: 'completion', label: DXF_SETTINGS_TAB_LABELS.COMPLETION },
              { id: 'hover', label: DXF_SETTINGS_TAB_LABELS.HOVER },
              { id: 'selection', label: DXF_SETTINGS_TAB_LABELS.SELECTION }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveLineTab(activeLineTab === tab.id ? null : tab.id)}
                className={`py-2 px-3 text-sm font-medium ${quick.button} transition-colors ${
                  activeLineTab === tab.id
                    ? `${colors.bg.primary} text-white ${INTERACTIVE_PATTERNS.PRIMARY_HOVER}`
                    : `${colors.bg.muted} text-white ${INTERACTIVE_PATTERNS.SUBTLE_HOVER}`
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Περιεχόμενο για Προσχεδίαση με υποκαρτέλες */}
          <SubTabRenderer
            config={{
              type: 'draft',
              label: DXF_SETTINGS_TAB_LABELS.DRAFT,
              color: 'blue-500',
              badgeColor: colors.bg.primary
            }}
            activeTab={activeLineTab}
            activeSubTab={activeDraftSubTab}
            onTabChange={setActiveLineTab}
            onSubTabChange={setActiveDraftSubTab}
            lineSettings={previewLineDraftSettings}
            textSettings={previewTextSettings}
            gripSettings={previewGripSettings}
            contextType="preview"
            overrideSettings={{
              line: {
                checked: draftSettings.overrideGlobalSettings || false,
                onChange: (checked) => updateDraftSettings({ overrideGlobalSettings: checked }),
                label: DXF_SETTINGS_OVERRIDE_LABELS.OVERRIDE_GLOBAL_SETTINGS,
                description: "Χρήση ειδικών ρυθμίσεων γραμμής για προσχεδίαση",
                statusText: draftSettings.overrideGlobalSettings ? 'Ειδικές Ρυθμίσεις Draft' : 'Γενικές Ρυθμίσεις'
              },
              text: {
                checked: specificTextSettings.overrideGlobalSettings,
                onChange: (checked) => updateSpecificTextSettings({ overrideGlobalSettings: checked }),
                label: DXF_SETTINGS_OVERRIDE_LABELS.OVERRIDE_GLOBAL_SETTINGS,
                description: "Χρήση ειδικών ρυθμίσεων κειμένου για προσχεδίαση"
              },
              grips: {
                checked: specificGripSettings.overrideGlobalSettings || false,
                onChange: (checked) => updateSpecificGripSettings({ overrideGlobalSettings: checked }),
                label: DXF_SETTINGS_OVERRIDE_LABELS.OVERRIDE_GLOBAL_SETTINGS,
                description: "Χρήση ειδικών ρυθμίσεων grips για προσχεδίαση",
                statusText: specificGripSettings.overrideGlobalSettings ? 'Ειδικές Ρυθμίσεις' : 'Γενικές Ρυθμίσεις'
              }
            }}
          />

          {/* Περιεχόμενο για Hover με υποκαρτέλες */}
          <SubTabRenderer
            config={{
              type: 'hover',
              label: DXF_SETTINGS_TAB_LABELS.HOVER,
              color: 'yellow-500',
              badgeColor: colors.bg.warning
            }}
            activeTab={activeLineTab}
            activeSubTab={activeHoverSubTab}
            onTabChange={setActiveLineTab}
            onSubTabChange={setActiveHoverSubTab}
            lineSettings={previewLineHoverSettings}
            textSettings={previewTextSettings}
            contextType="preview"
            gripSettings={{
              ...previewGripSettings,
              colors: {
                ...(previewGripSettings.colors || DEFAULT_GRIP_SETTINGS.colors),
                cold: (previewGripSettings.colors?.warm || DEFAULT_GRIP_SETTINGS.colors.warm) // Hover state = warm grips
              }
            }}
            overrideSettings={{
              line: {
                checked: hoverSettings.overrideGlobalSettings || false,
                onChange: (checked) => updateHoverSettings({ overrideGlobalSettings: checked }),
                label: DXF_SETTINGS_OVERRIDE_LABELS.OVERRIDE_GLOBAL_SETTINGS,
                description: "Χρήση ειδικών ρυθμίσεων γραμμής για hover",
                statusText: hoverSettings.overrideGlobalSettings ? 'Ειδικές Ρυθμίσεις Hover' : 'Γενικές Ρυθμίσεις'
              }
            }}
          />

          {/* Περιεχόμενο για Επιλογή με υποκαρτέλες */}
          <SubTabRenderer
            config={{
              type: 'selection',
              label: DXF_SETTINGS_TAB_LABELS.SELECTION,
              color: 'red-500',
              badgeColor: colors.bg.error
            }}
            activeTab={activeLineTab}
            activeSubTab={activeSelectionSubTab}
            onTabChange={setActiveLineTab}
            onSubTabChange={setActiveSelectionSubTab}
            lineSettings={previewLineSelectionSettings}
            textSettings={previewTextSettings}
            contextType="preview"
            gripSettings={{
              ...previewGripSettings,
              colors: {
                ...(previewGripSettings.colors || DEFAULT_GRIP_SETTINGS.colors),
                cold: (previewGripSettings.colors?.hot || DEFAULT_GRIP_SETTINGS.colors.hot) // Selection state = hot grips
              }
            }}
            overrideSettings={{
              line: {
                checked: selectionSettings.overrideGlobalSettings || false,
                onChange: (checked) => updateSelectionSettings({ overrideGlobalSettings: checked }),
                label: DXF_SETTINGS_OVERRIDE_LABELS.OVERRIDE_GLOBAL_SETTINGS,
                description: "Χρήση ειδικών ρυθμίσεων γραμμής για επιλογή",
                statusText: selectionSettings.overrideGlobalSettings ? 'Ειδικές Ρυθμίσεις Selection' : 'Γενικές Ρυθμίσεις'
              }
            }}
          />

          {/* Περιεχόμενο για Ολοκλήρωση με υποκαρτέλες */}
          <SubTabRenderer
            config={{
              type: 'completion',
              label: DXF_SETTINGS_TAB_LABELS.COMPLETION,
              color: 'green-500',
              badgeColor: colors.bg.success
            }}
            activeTab={activeLineTab}
            activeSubTab={activeCompletionSubTab}
            onTabChange={setActiveLineTab}
            onSubTabChange={setActiveCompletionSubTab}
            lineSettings={previewLineCompletionSettings}
            textSettings={previewTextSettings}
            contextType="completion"
            gripSettings={previewGripSettings}
            customPreview={
              <LinePreview
                lineSettings={previewLineCompletionSettings}
                textSettings={previewTextSettings}
                gripSettings={previewGripSettings}
              />
            }
            overrideSettings={{
              line: {
                checked: completionSettings.overrideGlobalSettings,
                onChange: (checked) => updateCompletionSettings({ overrideGlobalSettings: checked }),
                label: DXF_SETTINGS_OVERRIDE_LABELS.OVERRIDE_GLOBAL_SETTINGS,
                description: "Χρήση ειδικών ρυθμίσεων γραμμής για ολοκλήρωση",
                statusText: completionSettings.overrideGlobalSettings ? 'Ειδικές Ρυθμίσεις Completion' : 'Γενικές Ρυθμίσεις'
              }
            }}
          />
        </div>
      );
    }

    // Για όλα τα άλλα εργαλεία - κενό container
    return (
      <div className={`mb-6 p-4 ${colors.bg.tertiary} ${quick.card}`}>
        <h3 className="text-lg font-semibold text-white mb-4">
          Ρυθμίσεις {selectedTool}
        </h3>
        <div className={`text-center py-8 ${colors.text.muted}`}>
          <div className="text-4xl mb-4">🔧</div>
          <h3 className="text-lg font-medium mb-2">Ρυθμίσεις Εργαλείου</h3>
          <p className={`text-sm ${colors.text.muted}`}>
            Οι ρυθμίσεις για αυτό το εργαλείο θα προστεθούν σύντομα
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="p-4 space-y-6">
      {/* Removed duplicate tabs - EntitiesSettings shows only entity-specific settings */}

      {/* Removed duplicate General Settings section - these belong in the General Settings tab */}

      {/* Entity-Specific Settings - Tools and specialized functions */}
      <div>
          {/* Tabs για Ειδικές Ρυθμίσεις */}
          <div className={`flex space-x-1 ${colors.bg.secondary} ${quick.card} p-1 mb-4`}>
            {[
              { id: 'drawing', label: DXF_SETTINGS_TAB_LABELS.DRAWING },
              { id: 'measurements', label: DXF_SETTINGS_TAB_LABELS.MEASUREMENTS }
            ].map((subTab) => (
              <button
                key={subTab.id}
                onClick={() => {
                  setActiveSpecificTab(subTab.id);
                  setSelectedTool(null);
                }}
                className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition-colors ${
                  activeSpecificTab === subTab.id
                    ? `${colors.bg.primary} text-white ${INTERACTIVE_PATTERNS.PRIMARY_HOVER}`
                    : `${colors.bg.muted} text-white ${INTERACTIVE_PATTERNS.SUBTLE_HOVER}`
                }`}
              >
                {subTab.label}
              </button>
            ))}
          </div>

          {/* Toolbar Icons - ανάλογα με την ενεργή υποκαρτέλα */}
          {renderToolbarIcons()}

          {/* Tool-specific Settings Container */}
          {renderToolSettings()}

          {/* Κενές καρτέλες - περιεχόμενο θα προστεθεί μέσω των tool containers */}
          <div className="min-h-[50px]">
            {/* Κενό χώρο - οι ρυθμίσεις θα εμφανίζονται μόνο όταν επιλέγεται εργαλείο */}
            {!selectedTool && (
              <div className={`text-center py-8 ${colors.text.muted}`}>
                <div className="text-4xl mb-4">🎨</div>
                <h3 className="text-lg font-medium mb-2">Επιλέξτε Εργαλείο</h3>
                <p className={`text-sm ${colors.text.muted}`}>
                  Κάντε κλικ σε ένα εργαλείο για να δείτε τις ρυθμίσεις του
                </p>
              </div>
            )}
          </div>
        </div>
    </div>
  );
};