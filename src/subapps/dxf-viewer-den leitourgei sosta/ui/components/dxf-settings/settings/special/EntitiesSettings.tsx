import React, { useState, useEffect, useMemo } from 'react';
import { Minus, Square, Pen, Hexagon, Ruler, Triangle } from 'lucide-react';
import { CircleRadiusIcon } from '../../../../toolbar/icons/CircleIcon';
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
import { useTextSettingsFromProvider } from '../../../../../providers/DxfSettingsProvider';
import { LineSettings } from '../core/LineSettings';
import { TextSettings } from '../core/TextSettings';
import { GripSettings } from '../core/GripSettings';
import { LinePreview } from '../shared/LinePreview';
import { CurrentSettingsDisplay } from '../shared/CurrentSettingsDisplay';
import { OverrideToggle } from '../../../shared/OverrideToggle';
import { SubTabRenderer, SubTabType } from '../../../shared/SubTabRenderer';
import { useEntitiesSettingsReducer } from '../../../../reducers/entitiesSettingsReducer';
import { updateDraftSettingsStore } from '../../../../../hooks/useLinePreviewStyle';
import { updateDraftTextSettingsStore } from '../../../../../hooks/useTextPreviewStyle';
import { updateDraftGripSettingsStore } from '../../../../../hooks/useGripPreviewStyle';

// Default grip settings for LinePreview
const DEFAULT_GRIP_SETTINGS = {
  enabled: true,
  gripSize: 5,              // ✅ AutoCAD GRIPSIZE default: 5 DIP
  pickBoxSize: 3,           // ✅ AutoCAD PICKBOX default: 3 DIP
  apertureSize: 10,         // ✅ AutoCAD APERTURE default: 10 pixels
  opacity: 1.0,
  colors: {
    cold: '#0000FF',        // ✅ AutoCAD standard: Blue (ACI 5) - unselected grips
    warm: '#FF69B4',        // ✅ AutoCAD standard: Hot Pink - hover grips
    hot: '#FF0000',         // ✅ AutoCAD standard: Red (ACI 1) - selected grips
    contour: '#000000'      // ✅ AutoCAD standard: Black contour
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

  // Γενικές ρυθμίσεις κειμένου για συγχρονισμό
  const globalTextSettings = useTextSettingsFromProvider();

  // 🔥 ΔΙΟΡΘΩΣΗ: Memoized effective text settings που εξαρτώνται από τα specificTextSettings
  // Αυτό εξαναγκάζει re-render στα SubTabRenderer components όταν αλλάζουν τα text settings
  const effectiveTextSettings = useMemo(() => {
    return getEffectiveTextSettings();
  }, [specificTextSettings.overrideGlobalSettings, specificTextSettings.textSettings, globalTextSettings.settings]);

  // ✅ ΝΕΟ: Συγχρονισμός draft settings με το global store για PhaseManager
  useEffect(() => {
    updateDraftSettingsStore({
      overrideGlobalSettings: draftSettings.overrideGlobalSettings || false,
      settings: getEffectiveLineDraftSettings()
    });
  }, [draftSettings.overrideGlobalSettings, draftSettings.lineSettings, getEffectiveLineDraftSettings]);

  // ✅ ΝΕΟ: Συγχρονισμός draft text settings με το global store για PhaseManager
  useEffect(() => {
    updateDraftTextSettingsStore({
      overrideGlobalSettings: specificTextSettings.overrideGlobalSettings || false,
      settings: effectiveTextSettings
    });
  }, [specificTextSettings.overrideGlobalSettings, specificTextSettings.textSettings, effectiveTextSettings]);

  // ✅ ΝΕΟ: Συγχρονισμός draft grip settings με το global store για PhaseManager
  useEffect(() => {
    updateDraftGripSettingsStore({
      overrideGlobalSettings: specificGripSettings.overrideGlobalSettings || false,
      settings: getEffectiveGripSettings()
    });
  }, [specificGripSettings.overrideGlobalSettings, specificGripSettings.gripSettings, getEffectiveGripSettings]);

  // Συγχρονισμός: Όταν το override είναι ενεργό, οι αλλαγές στις γενικές ρυθμίσεις
  // προωθούνται στις ειδικές ρυθμίσεις για άμεση ενημέρωση
  useEffect(() => {
    if (specificTextSettings.overrideGlobalSettings) {
      updateTextSettings(globalTextSettings.settings);
    }
  }, [globalTextSettings.settings, specificTextSettings.overrideGlobalSettings, updateTextSettings]);

  // ✅ Grip settings πλέον από unified SpecificGripPreviewContext

  // Mock text settings - ✅ Updated to ISO 3098 standards
  const [mockTextSettings] = useState({
    fontSize: 2.5,           // ✅ ISO 3098: Standard 2.5mm text height
    fontFamily: 'Arial, sans-serif',  // ✅ ISO 3098: Sans-serif font recommended
    color: '#FFFFFF',        // ✅ AutoCAD ACI 7: White for text
    isBold: false,
    isItalic: false,
    isUnderline: false,
    isStrikethrough: false,
    isSuperscript: false,
    isSubscript: false
  });

  // Mock global line settings - ✅ Updated to ISO 128 standards
  const [globalLineSettings] = useState({
    lineType: 'solid' as string,      // ✅ ISO 128: Continuous line as default
    lineWidth: 0.25,                  // ✅ ISO 128: Standard 0.25mm line weight
    color: '#FFFFFF',                 // ✅ AutoCAD ACI 7: White for main lines
    opacity: 100,
    dashScale: 1.0,                   // ✅ Standard dash scale
    dashOffset: 0,                    // ✅ No offset standard
    lineCap: 'round' as string,       // ✅ Round caps standard
    lineJoin: 'round' as string,      // ✅ Round joins standard
    breakAtCenter: false,             // ✅ No break at center default
    activeTemplate: null as string | null
  });

  // Removed duplicate dropdown state - these are handled by the LineSettings component

  // Drawing tools - χρησιμοποιούν τα ίδια εικονίδια με την κεντρική εργαλειοθήκη
  const drawingTools: MockToolIcon[] = [
    { id: 'line', label: 'Γραμμή', icon: Minus, hotkey: 'L' },
    { id: 'rectangle', label: 'Ορθογώνιο', icon: Square, hotkey: 'R' },
    { id: 'circle', label: 'Κύκλος', icon: CircleRadiusIcon, hotkey: 'C', dropdownOptions: ['radius', 'diameter'] },
    { id: 'polyline', label: 'Πολυγραμμή', icon: Pen, hotkey: 'PL' },
    { id: 'polygon', label: 'Πολύγωνο', icon: Hexagon, hotkey: 'POL' }
  ];

  const measurementTools: MockToolIcon[] = [
    { id: 'measure-distance', label: 'Απόσταση', icon: Ruler, hotkey: 'DI' },
    { id: 'measure-area', label: 'Εμβαδόν', icon: Square, hotkey: 'AREA' },
    { id: 'measure-angle', label: 'Γωνία', icon: Triangle, hotkey: 'ANG' }
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
                    h-8 w-8 p-0 rounded-md border transition-colors duration-150
                    flex items-center justify-center
                    ${isSelected
                      ? 'bg-blue-600 hover:bg-blue-700 text-white border-blue-500'
                      : 'bg-gray-700 hover:bg-gray-600 text-gray-200 border-gray-500'
                    }
                  `}
                >
                  <tool.icon size={16} />
                </button>
              );
            }

            return (
              <div key={tool.id} className="relative flex">
                <button
                  onClick={() => handleToolClick(tool.id)}
                  title={`${tool.label} (${tool.hotkey})`}
                  className={`
                    h-8 w-7 p-0 rounded-l-md border-r-0 border transition-colors duration-150
                    flex items-center justify-center
                    ${isSelected
                      ? 'bg-blue-600 hover:bg-blue-700 text-white border-blue-500'
                      : 'bg-gray-700 hover:bg-gray-600 text-gray-200 border-gray-500'
                    }
                  `}
                >
                  <tool.icon size={14} />
                </button>
                <button
                  className={`
                    h-8 w-4 p-0 rounded-r-md border transition-colors duration-150
                    flex items-center justify-center
                    ${isSelected
                      ? 'bg-blue-600 hover:bg-blue-700 text-white border-blue-500'
                      : 'bg-gray-700 hover:bg-gray-600 text-gray-200 border-gray-500'
                    }
                  `}
                  title="Περισσότερες επιλογές"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
        <div className="mb-6 p-4 bg-gray-800 rounded-lg">
          {/* Καρτέλες για Line Tool σε δύο σειρές */}
          <div className="grid grid-cols-2 gap-2 mb-4">
            {[
              { id: 'draft', label: 'Προσχεδίαση' },
              { id: 'completion', label: 'Ολοκλήρωση' },
              { id: 'hover', label: 'Hover' },
              { id: 'selection', label: 'Επιλογή' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveLineTab(activeLineTab === tab.id ? null : tab.id)}
                className={`py-2 px-3 text-sm font-medium rounded-md transition-colors ${
                  activeLineTab === tab.id
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-600 text-white hover:bg-gray-500'
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
              label: 'Προσχεδίαση',
              color: 'blue-500',
              badgeColor: 'bg-blue-600'
            }}
            activeTab={activeLineTab}
            activeSubTab={activeDraftSubTab}
            onTabChange={setActiveLineTab}
            onSubTabChange={setActiveDraftSubTab}
            lineSettings={getEffectiveLineDraftSettings()}
            textSettings={effectiveTextSettings}
            gripSettings={getEffectiveGripSettings()}
            contextType="preview"
            overrideSettings={{
              line: {
                checked: draftSettings.overrideGlobalSettings || false,
                onChange: (checked) => updateDraftSettings({ overrideGlobalSettings: checked }),
                label: "Παράκαμψη Γενικών Ρυθμίσεων",
                description: "Χρήση ειδικών ρυθμίσεων γραμμής για προσχεδίαση",
                statusText: draftSettings.overrideGlobalSettings ? 'Ειδικές Ρυθμίσεις Draft' : 'Γενικές Ρυθμίσεις'
              },
              text: {
                checked: specificTextSettings.overrideGlobalSettings,
                onChange: (checked) => updateSpecificTextSettings({ overrideGlobalSettings: checked }),
                label: "Παράκαμψη Γενικών Ρυθμίσεων",
                description: "Χρήση ειδικών ρυθμίσεων κειμένου για προσχεδίαση"
              },
              grips: {
                checked: specificGripSettings.overrideGlobalSettings || false,
                onChange: (checked) => updateSpecificGripSettings({ overrideGlobalSettings: checked }),
                label: "Παράκαμψη Γενικών Ρυθμίσεων Grips",
                description: "Χρήση ειδικών ρυθμίσεων grips για προσχεδίαση",
                statusText: specificGripSettings.overrideGlobalSettings ? 'Ειδικές Ρυθμίσεις' : 'Γενικές Ρυθμίσεις'
              }
            }}
          />

          {/* Περιεχόμενο για Hover με υποκαρτέλες */}
          <SubTabRenderer
            config={{
              type: 'hover',
              label: 'Hover',
              color: 'yellow-500',
              badgeColor: 'bg-yellow-600'
            }}
            activeTab={activeLineTab}
            activeSubTab={activeHoverSubTab}
            onTabChange={setActiveLineTab}
            onSubTabChange={setActiveHoverSubTab}
            lineSettings={getEffectiveLineHoverSettings()}
            textSettings={effectiveTextSettings}
            contextType="preview"
            gripSettings={{
              ...getEffectiveGripSettings(),
              colors: {
                ...getEffectiveGripSettings().colors,
                cold: getEffectiveGripSettings().colors.warm // Hover state = warm grips
              }
            }}
            overrideSettings={{
              line: {
                checked: hoverSettings.overrideGlobalSettings || false,
                onChange: (checked) => updateHoverSettings({ overrideGlobalSettings: checked }),
                label: "Παράκαμψη Γενικών Ρυθμίσεων",
                description: "Χρήση ειδικών ρυθμίσεων γραμμής για hover",
                statusText: hoverSettings.overrideGlobalSettings ? 'Ειδικές Ρυθμίσεις Hover' : 'Γενικές Ρυθμίσεις'
              }
            }}
          />

          {/* Περιεχόμενο για Επιλογή με υποκαρτέλες */}
          <SubTabRenderer
            config={{
              type: 'selection',
              label: 'Επιλογή',
              color: 'red-500',
              badgeColor: 'bg-red-600'
            }}
            activeTab={activeLineTab}
            activeSubTab={activeSelectionSubTab}
            onTabChange={setActiveLineTab}
            onSubTabChange={setActiveSelectionSubTab}
            lineSettings={getEffectiveLineSelectionSettings()}
            textSettings={effectiveTextSettings}
            contextType="preview"
            gripSettings={{
              ...getEffectiveGripSettings(),
              colors: {
                ...getEffectiveGripSettings().colors,
                cold: getEffectiveGripSettings().colors.hot // Selection state = hot grips
              }
            }}
            overrideSettings={{
              line: {
                checked: selectionSettings.overrideGlobalSettings || false,
                onChange: (checked) => updateSelectionSettings({ overrideGlobalSettings: checked }),
                label: "Παράκαμψη Γενικών Ρυθμίσεων",
                description: "Χρήση ειδικών ρυθμίσεων γραμμής για επιλογή",
                statusText: selectionSettings.overrideGlobalSettings ? 'Ειδικές Ρυθμίσεις Selection' : 'Γενικές Ρυθμίσεις'
              }
            }}
          />

          {/* Περιεχόμενο για Ολοκλήρωση με υποκαρτέλες */}
          <SubTabRenderer
            config={{
              type: 'completion',
              label: 'Ολοκλήρωση',
              color: 'green-500',
              badgeColor: 'bg-green-600'
            }}
            activeTab={activeLineTab}
            activeSubTab={activeCompletionSubTab}
            onTabChange={setActiveLineTab}
            onSubTabChange={setActiveCompletionSubTab}
            lineSettings={getEffectiveLineCompletionSettings()}
            textSettings={effectiveTextSettings}
            contextType="completion"
            gripSettings={getEffectiveGripSettings()}
            customPreview={
              <LinePreview
                lineSettings={getEffectiveLineCompletionSettings()}
                textSettings={effectiveTextSettings}
                gripSettings={getEffectiveGripSettings()}
              />
            }
            overrideSettings={{
              line: {
                checked: completionSettings.overrideGlobalSettings,
                onChange: (checked) => updateCompletionSettings({ overrideGlobalSettings: checked }),
                label: "Παράκαμψη Γενικών Ρυθμίσεων",
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
      <div className="mb-6 p-4 bg-gray-800 rounded-lg border border-gray-600">
        <h3 className="text-lg font-semibold text-white mb-4">
          Ρυθμίσεις {selectedTool}
        </h3>
        <div className="text-center py-8 text-gray-500">
          <div className="text-4xl mb-4">🔧</div>
          <h3 className="text-lg font-medium mb-2">Ρυθμίσεις Εργαλείου</h3>
          <p className="text-sm text-gray-400">
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
          <div className="flex space-x-1 bg-gray-700 rounded-lg p-1 mb-4">
            {[
              { id: 'drawing', label: 'Σχεδίαση' },
              { id: 'measurements', label: 'Μετρήσεις' }
            ].map((subTab) => (
              <button
                key={subTab.id}
                onClick={() => {
                  setActiveSpecificTab(subTab.id as 'line' | 'polyline' | 'circle' | 'arc' | 'text' | 'block' | 'rectangle');
                  setSelectedTool(null);
                }}
                className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition-colors ${
                  activeSpecificTab === subTab.id
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-600 text-white hover:bg-gray-500'
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
              <div className="text-center py-8 text-gray-500">
                <div className="text-4xl mb-4">🎨</div>
                <h3 className="text-lg font-medium mb-2">Επιλέξτε Εργαλείο</h3>
                <p className="text-sm text-gray-400">
                  Κάντε κλικ σε ένα εργαλείο για να δείτε τις ρυθμίσεις του
                </p>
              </div>
            )}
          </div>
        </div>
    </div>
  );
};