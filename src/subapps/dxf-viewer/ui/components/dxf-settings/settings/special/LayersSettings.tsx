import React, { useState } from 'react';
import { INTERACTIVE_PATTERNS, HOVER_BACKGROUND_EFFECTS, CORE_HOVER_TRANSFORMS, HOVER_TEXT_EFFECTS } from '../../../../../ui/effects';
import { useDynamicBackgroundClass, useDynamicBorderClass } from '@/components/ui/utils/dynamic-styles';
import { ENHANCED_STATUS_LABELS as PROPERTY_STATUS_LABELS, ENHANCED_STATUS_COLORS as PROPERTY_STATUS_COLORS } from '@/constants/property-statuses-enterprise';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { Palette, Pencil, RotateCcw, Construction, Layers } from 'lucide-react';

interface LayersSettingsProps {
  // Για μελλοντική επέκταση μπορούμε να προσθέσουμε props
}

export const LayersSettings: React.FC<LayersSettingsProps> = () => {
  const iconSizes = useIconSizes();
  const { quick, getStatusBorder, getDirectionalBorder, radius } = useBorderTokens();
  const colors = useSemanticColors();
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
    <section className={`p-4 ${colors.bg.primary} ${colors.text.primary}`}>
      {/* Header */}
      <header className={`${getDirectionalBorder('muted', 'bottom')} pb-3 mb-4`}>
        <h2 className={`text-lg font-semibold ${colors.text.primary} flex items-center gap-2`}>
          <Layers className="w-5 h-5" />
          <span>Ρυθμίσεις Layers</span>
        </h2>
        <p className={`text-xs ${colors.text.muted} mt-1`}>
          Χρώματα και εμφάνιση επιπέδων σχεδίασης
        </p>
      </header>

      {/* Layer Preview */}
      <div className={`mb-4 p-2 ${colors.bg.secondary} rounded space-y-2`}>
        <div className={`text-sm ${colors.text.primary}`}>
          <div className="font-medium">Προεπισκόπηση Layer</div>
          <div className={`font-normal ${colors.text.muted}`}>Δείτε πώς θα φαίνονται τα layers</div>
        </div>
        <div className={`p-2 ${colors.bg.muted} ${quick.card} ${getStatusBorder('muted')} flex justify-center`}>
          <div className="flex gap-1">
            {presetClasses.map((preset, index) => (
              <div
                key={preset.name}
                className={`
                  border ${quick.card} cursor-pointer transition-transform ${iconSizes.lg}
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
        <div className={`flex gap-1 ${colors.bg.secondary} p-1 ${radius.lg}`}>
          <button
            onClick={() => setActiveTab('outlines')}
            className={`flex-1 px-3 py-2 text-xs font-medium ${radius.md} transition-colors duration-150 flex items-center justify-center gap-1.5 ${
              activeTab === 'outlines'
                ? `${colors.bg.info} ${colors.text.inverted}`
                : `${colors.text.tertiary} ${HOVER_TEXT_EFFECTS.WHITE} ${HOVER_BACKGROUND_EFFECTS.MUTED}`
            }`}
          >
            <Pencil className="w-3.5 h-3.5" />
            <span>Περιγράμματα</span>
          </button>
          <button
            onClick={() => setActiveTab('fills')}
            className={`flex-1 px-3 py-2 text-xs font-medium ${radius.md} transition-colors duration-150 flex items-center justify-center gap-1.5 ${
              activeTab === 'fills'
                ? `${colors.bg.info} ${colors.text.inverted}`
                : `${colors.text.tertiary} ${HOVER_TEXT_EFFECTS.WHITE} ${HOVER_BACKGROUND_EFFECTS.MUTED}`
            }`}
          >
            <Palette className="w-3.5 h-3.5" />
            <span>Γεμίσματα</span>
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="space-y-4">
        {activeTab === 'outlines' && (
          <>
            {/* Preset Outline Colors */}
            <div className={`p-2 ${colors.bg.secondary} rounded space-y-2`}>
              <div className={`text-sm ${colors.text.primary} font-medium`}>Χρώματα Περιγραμμάτων</div>
              <div className="grid grid-cols-5 gap-2">
                {presetClasses.map((preset, index) => (
                  <button
                    key={preset.name}
                    onClick={() => setSelectedPreset(index)}
                    className={`p-2 ${quick.button} transition-colors ${
                      selectedPreset === index
                        ? `${colors.bg.info} ${getStatusBorder('info')}`
                        : `${colors.bg.muted} ${INTERACTIVE_PATTERNS.PRIMARY_HOVER} ${getStatusBorder('default')}`
                    }`}
                  >
                    <div
                      className={`w-full ${iconSizes.lg} ${quick.card} ${getStatusBorder('subtle')} ${preset.bgClass}`}
                    />
                    <div className={`text-xs ${colors.text.primary} mt-1 truncate`}>{preset.name}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Outline Settings */}
            <div className={`p-2 ${colors.bg.secondary} rounded`}>
              <div className="flex items-center justify-between">
                <div className={`text-sm ${colors.text.primary}`}>
                  <div className="font-medium">Εμφάνιση Περιγραμμάτων</div>
                  <div className={`font-normal ${colors.text.muted}`}>Ενεργοποίηση/Απενεργοποίηση των περιγραμμάτων</div>
                </div>
                <div className={`relative inline-flex ${iconSizes.lg} ${iconSizes.xl3} flex-shrink-0 cursor-pointer ${radius.full} border border-transparent ${colors.bg.success}`}>
                  <span className={`pointer-events-none inline-block ${iconSizes.sm} ${radius.full} ${colors.bg.primary} shadow transition duration-200 ease-in-out transform translate-x-5`} />
                </div>
              </div>
            </div>
          </>
        )}

        {activeTab === 'fills' && (
          <>
            {/* Preset Fill Colors */}
            <div className={`p-2 ${colors.bg.secondary} rounded space-y-2`}>
              <div className={`text-sm ${colors.text.primary} font-medium`}>Χρώματα Γεμισμάτων</div>
              <div className="grid grid-cols-5 gap-2">
                {presetClasses.map((preset, index) => (
                  <button
                    key={preset.name}
                    onClick={() => setSelectedPreset(index)}
                    className={`p-2 ${quick.button} transition-colors ${
                      selectedPreset === index
                        ? `${colors.bg.info} ${getStatusBorder('info')}`
                        : `${colors.bg.muted} ${INTERACTIVE_PATTERNS.PRIMARY_HOVER} ${getStatusBorder('default')}`
                    }`}
                  >
                    <div
                      className={`w-full ${iconSizes.lg} ${quick.card} ${getStatusBorder('subtle')} ${preset.bgClass}`}
                    />
                    <div className={`text-xs ${colors.text.primary} mt-1 truncate`}>{preset.name}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Opacity Control */}
            <div className={`p-2 ${colors.bg.secondary} rounded space-y-2`}>
              <div className={`text-sm ${colors.text.primary}`}>
                <div className="font-medium">Διαφάνεια Γεμίσματος</div>
                <div className={`font-normal ${colors.text.muted}`}>Επίπεδο διαφάνειας για το γέμισμα</div>
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
                <div className={`${iconSizes.xl3} text-xs ${colors.bg.muted} ${colors.text.inverted} rounded px-2 py-1 text-center`}>
                  100%
                </div>
              </div>
            </div>

            {/* Fill Settings */}
            <div className={`p-2 ${colors.bg.secondary} rounded`}>
              <div className="flex items-center justify-between">
                <div className={`text-sm ${colors.text.primary}`}>
                  <div className="font-medium">Εμφάνιση Γεμισμάτων</div>
                  <div className={`font-normal ${colors.text.muted}`}>Ενεργοποίηση/Απενεργοποίηση των γεμισμάτων</div>
                </div>
                <div className={`relative inline-flex ${iconSizes.lg} ${iconSizes.xl3} flex-shrink-0 cursor-pointer ${radius.full} border border-transparent ${colors.bg.success}`}>
                  <span className={`pointer-events-none inline-block ${iconSizes.sm} ${radius.full} ${colors.bg.primary} shadow transition duration-200 ease-in-out transform translate-x-5`} />
                </div>
              </div>
            </div>
          </>
        )}

        {/* Reset Button */}
        <article className={`p-2 ${colors.bg.secondary} rounded space-y-2`}>
          <div className={`text-sm ${colors.text.primary}`}>
            <div className="font-medium">Επαναφορά</div>
            <div className={`font-normal ${colors.text.muted}`}>Επαναφορά στις προεπιλεγμένες ρυθμίσεις</div>
          </div>
          <button className={`w-full px-3 py-2 text-xs flex items-center justify-center gap-2 ${colors.bg.error} ${INTERACTIVE_PATTERNS.DESTRUCTIVE_HOVER} ${colors.text.inverted} rounded transition-colors`}>
            <RotateCcw className="w-4 h-4" />
            <span>Επαναφορά Ρυθμίσεων Layers</span>
          </button>
        </article>

        {/* Coming Soon Features */}
        <aside className={`p-2 ${colors.bg.secondary} ${quick.card} ${getStatusBorder('muted')}`}>
          <div className={`text-sm ${colors.text.primary} font-medium mb-2 flex items-center gap-2`}>
            <Construction className="w-4 h-4" />
            <span>Σύντομα Διαθέσιμο</span>
          </div>
          <ul className={`text-xs ${colors.text.muted} space-y-1`}>
            <li>• Χρώματα γεμίσματος layers</li>
            <li>• Ρυθμίσεις πάχους γραμμών</li>
            <li>• Στυλ γραμμών (διακεκομμένη, κλπ)</li>
            <li>• Εξατομικευμένες παλέτες χρωμάτων</li>
            <li>• Import/Export προφίλ χρωμάτων</li>
          </ul>
        </aside>
      </div>
    </section>
  );
};