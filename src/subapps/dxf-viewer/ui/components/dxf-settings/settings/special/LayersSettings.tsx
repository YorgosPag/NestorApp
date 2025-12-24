import React, { useState } from 'react';
import { INTERACTIVE_PATTERNS, HOVER_BACKGROUND_EFFECTS, CORE_HOVER_TRANSFORMS, HOVER_TEXT_EFFECTS } from '../../../../../ui/effects';
import { useDynamicBackgroundClass, useDynamicBorderClass } from '@/components/ui/utils/dynamic-styles';
import { ENHANCED_STATUS_LABELS as PROPERTY_STATUS_LABELS, ENHANCED_STATUS_COLORS as PROPERTY_STATUS_COLORS } from '@/constants/property-statuses-enterprise';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';

interface LayersSettingsProps {
  // Για μελλοντική επέκταση μπορούμε να προσθέσουμε props
}

export const LayersSettings: React.FC<LayersSettingsProps> = () => {
  const iconSizes = useIconSizes();
  const { quick } = useBorderTokens();
  const [activeTab, setActiveTab] = useState<'outlines' | 'fills'>('outlines');
  const [selectedPreset, setSelectedPreset] = useState<number>(0);

  // 🎯 ΚΕΝΤΡΙΚΟΠΟΙΗΜΕΝΟ: Χρησιμοποιούμε τα centralized constants αντί για διάσπαρτα
  const presetColors = [
    { name: PROPERTY_STATUS_LABELS['for-sale'], color: PROPERTY_STATUS_COLORS['for-sale'] },
    { name: PROPERTY_STATUS_LABELS['for-rent'], color: PROPERTY_STATUS_COLORS['for-rent'] },
    { name: PROPERTY_STATUS_LABELS['reserved'], color: PROPERTY_STATUS_COLORS['reserved'] },
    { name: PROPERTY_STATUS_LABELS['sold'], color: PROPERTY_STATUS_COLORS['sold'] },
    { name: PROPERTY_STATUS_LABELS['landowner'], color: PROPERTY_STATUS_COLORS['landowner'] }
  ];

  // 🎨 ENTERPRISE DYNAMIC STYLING - NO INLINE STYLES (CLAUDE.md compliant)
  // Precompute all dynamic classes for preset colors
  const presetClasses = presetColors.map(preset => ({
    ...preset,
    borderClass: useDynamicBorderClass(preset.color, '2px'),
    bgClass: useDynamicBackgroundClass(preset.color),
    bgWithOpacityClass: useDynamicBackgroundClass(preset.color, 0.5)
  }));

  return (
    <div className="p-4">
      {/* Header */}
      <div className="border-b border-gray-600 pb-3 mb-4">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          🎨 Ρυθμίσεις Layers
        </h2>
        <p className="text-xs text-gray-400 mt-1">
          Χρώματα και εμφάνιση επιπέδων σχεδίασης
        </p>
      </div>

      {/* Layer Preview */}
      <div className="mb-4 p-2 bg-gray-700 rounded space-y-2">
        <div className="text-sm text-white">
          <div className="font-medium">Προεπισκόπηση Layer</div>
          <div className="font-normal text-gray-400">Δείτε πώς θα φαίνονται τα layers</div>
        </div>
        <div className={`p-2 bg-gray-800 ${quick.card} border-gray-600 flex justify-center`}>
          <div className="flex gap-1">
            {presetClasses.map((preset, index) => (
              <div
                key={preset.name}
                className={`
                  border-2 ${quick.card} cursor-pointer transition-transform ${iconSizes.lg}
                  ${CORE_HOVER_TRANSFORMS.SCALE_UP}
                  ${preset.borderClass}
                  ${activeTab === 'fills' ? preset.bgWithOpacityClass : ''}
                `}
                title={preset.name}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="mb-4">
        <div className="flex gap-1 bg-gray-700 p-1 rounded-lg">
          <button
            onClick={() => setActiveTab('outlines')}
            className={`flex-1 px-3 py-2 text-xs font-medium rounded-md transition-colors duration-150 ${
              activeTab === 'outlines'
                ? 'bg-blue-600 text-white'
                : `text-gray-300 ${HOVER_TEXT_EFFECTS.WHITE} ${HOVER_BACKGROUND_EFFECTS.MUTED}`
            }`}
          >
            ✏️ Περιγράμματα
          </button>
          <button
            onClick={() => setActiveTab('fills')}
            className={`flex-1 px-3 py-2 text-xs font-medium rounded-md transition-colors duration-150 ${
              activeTab === 'fills'
                ? 'bg-blue-600 text-white'
                : `text-gray-300 ${HOVER_TEXT_EFFECTS.WHITE} ${HOVER_BACKGROUND_EFFECTS.MUTED}`
            }`}
          >
            🎨 Γεμίσματα
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="space-y-4">
        {activeTab === 'outlines' && (
          <>
            {/* Preset Outline Colors */}
            <div className="p-2 bg-gray-700 rounded space-y-2">
              <div className="text-sm text-white font-medium">Χρώματα Περιγραμμάτων</div>
              <div className="grid grid-cols-5 gap-2">
                {presetClasses.map((preset, index) => (
                  <button
                    key={preset.name}
                    onClick={() => setSelectedPreset(index)}
                    className={`p-2 ${quick.button} transition-colors ${
                      selectedPreset === index
                        ? 'bg-blue-600 border-blue-500'
                        : `bg-gray-600 ${INTERACTIVE_PATTERNS.PRIMARY_HOVER} border-gray-500`
                    }`}
                  >
                    <div
                      className={`w-full ${iconSizes.lg} ${quick.card} border-gray-400 ${preset.bgClass}`}
                    />
                    <div className="text-xs text-white mt-1 truncate">{preset.name}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Outline Settings */}
            <div className="p-2 bg-gray-700 rounded">
              <div className="flex items-center justify-between">
                <div className="text-sm text-white">
                  <div className="font-medium">Εμφάνιση Περιγραμμάτων</div>
                  <div className="font-normal text-gray-400">Ενεργοποίηση/Απενεργοποίηση των περιγραμμάτων</div>
                </div>
                <div className={`relative inline-flex ${iconSizes.lg} ${iconSizes.xl3} flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent bg-green-600`}>
                  <span className={`pointer-events-none inline-block ${iconSizes.sm} rounded-full bg-white shadow transition duration-200 ease-in-out transform translate-x-5`} />
                </div>
              </div>
            </div>
          </>
        )}

        {activeTab === 'fills' && (
          <>
            {/* Preset Fill Colors */}
            <div className="p-2 bg-gray-700 rounded space-y-2">
              <div className="text-sm text-white font-medium">Χρώματα Γεμισμάτων</div>
              <div className="grid grid-cols-5 gap-2">
                {presetClasses.map((preset, index) => (
                  <button
                    key={preset.name}
                    onClick={() => setSelectedPreset(index)}
                    className={`p-2 ${quick.button} transition-colors ${
                      selectedPreset === index
                        ? 'bg-blue-600 border-blue-500'
                        : `bg-gray-600 ${INTERACTIVE_PATTERNS.PRIMARY_HOVER} border-gray-500`
                    }`}
                  >
                    <div
                      className={`w-full ${iconSizes.lg} ${quick.card} border-gray-400 ${preset.bgClass}`}
                    />
                    <div className="text-xs text-white mt-1 truncate">{preset.name}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Opacity Control */}
            <div className="p-2 bg-gray-700 rounded space-y-2">
              <div className="text-sm text-white">
                <div className="font-medium">Διαφάνεια Γεμίσματος</div>
                <div className="font-normal text-gray-400">Επίπεδο διαφάνειας για το γέμισμα</div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="0.1"
                  max="1"
                  step="0.1"
                  defaultValue="1.0"
                  className="flex-1"
                />
                <div className={`${iconSizes.xl3} text-xs bg-gray-600 text-white rounded px-2 py-1 text-center`}>
                  100%
                </div>
              </div>
            </div>

            {/* Fill Settings */}
            <div className="p-2 bg-gray-700 rounded">
              <div className="flex items-center justify-between">
                <div className="text-sm text-white">
                  <div className="font-medium">Εμφάνιση Γεμισμάτων</div>
                  <div className="font-normal text-gray-400">Ενεργοποίηση/Απενεργοποίηση των γεμισμάτων</div>
                </div>
                <div className={`relative inline-flex ${iconSizes.lg} ${iconSizes.xl3} flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent bg-green-600`}>
                  <span className={`pointer-events-none inline-block ${iconSizes.sm} rounded-full bg-white shadow transition duration-200 ease-in-out transform translate-x-5`} />
                </div>
              </div>
            </div>
          </>
        )}

        {/* Reset Button */}
        <div className="p-2 bg-gray-700 rounded space-y-2">
          <div className="text-sm text-white">
            <div className="font-medium">Επαναφορά</div>
            <div className="font-normal text-gray-400">Επαναφορά στις προεπιλεγμένες ρυθμίσεις</div>
          </div>
          <button className={`w-full px-3 py-2 text-xs bg-red-600 ${INTERACTIVE_PATTERNS.DESTRUCTIVE_HOVER} text-white rounded transition-colors`}>
            🔄 Επαναφορά Ρυθμίσεων Layers
          </button>
        </div>

        {/* Coming Soon Features */}
        <div className={`p-2 bg-gray-800 ${quick.card} border-gray-600`}>
          <div className="text-sm text-white font-medium mb-2">🚧 Σύντομα Διαθέσιμο</div>
          <ul className="text-xs text-gray-400 space-y-1">
            <li>• Χρώματα γεμίσματος layers</li>
            <li>• Ρυθμίσεις πάχους γραμμών</li>
            <li>• Στυλ γραμμών (διακεκομμένη, κλπ)</li>
            <li>• Εξατομικευμένες παλέτες χρωμάτων</li>
            <li>• Import/Export προφίλ χρωμάτων</li>
          </ul>
        </div>
      </div>
    </div>
  );
};