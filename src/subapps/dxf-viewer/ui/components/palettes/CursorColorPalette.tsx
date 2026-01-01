import React from 'react';
import { HOVER_BACKGROUND_EFFECTS } from '@/components/ui/effects';
import { layoutUtilities } from '@/styles/design-tokens';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { UI_COLORS } from '../../../config/color-config';

export interface CursorColors {
  crosshairColor: string;
  
  // Window Selection (Μπλε κουτί - πάνω-αριστερά → κάτω-δεξιά)
  windowFillColor: string;
  windowFillOpacity: number;        // διαφάνεια γεμίσματος
  windowBorderColor: string;
  windowBorderOpacity: number;      // διαφάνεια περιγράμματος
  windowBorderStyle: 'solid' | 'dashed' | 'dotted' | 'dash-dot';
  windowBorderWidth: number;        // πάχος γραμμής σε pixels
  
  // Crossing Selection (Πράσινο κουτί - κάτω-δεξιά → πάνω-αριστερά)  
  crossingFillColor: string;
  crossingFillOpacity: number;      // διαφάνεια γεμίσματος
  crossingBorderColor: string;
  crossingBorderOpacity: number;    // διαφάνεια περιγράμματος
  crossingBorderStyle: 'solid' | 'dashed' | 'dotted' | 'dash-dot';
  crossingBorderWidth: number;      // πάχος γραμμής σε pixels
}

interface CursorColorPaletteProps {
  colors: CursorColors;
  onColorsChange: (colors: CursorColors) => void;
}

export function CursorColorPalette({ colors, onColorsChange }: CursorColorPaletteProps) {
  const iconSizes = useIconSizes();
  const { getStatusBorder, getDirectionalBorder } = useBorderTokens();
  const semanticColors = useSemanticColors();

  const handleColorChange = (key: keyof CursorColors, value: string) => {
    const newColors = { ...colors, [key]: value };
    onColorsChange(newColors);
  };

  const ColorRow = ({ 
    label, 
    description,
    colorKey, 
    opacityKey
  }: { 
    label: string; 
    description: string;
    colorKey: keyof CursorColors; 
    opacityKey?: keyof CursorColors;
  }) => (
    <div className={`p-2 ${semanticColors.bg.secondary} rounded space-y-2`}>
      <div className="text-sm text-white">
        <div className="font-medium">{label}</div>
        <div className={`font-normal ${semanticColors.text.muted}`}>{description.charAt(0).toUpperCase() + description.slice(1)}</div>
      </div>
      <div className="flex items-center gap-2">
        <div 
          className={`${iconSizes.md} rounded ${getStatusBorder('muted')}`}
          style={layoutUtilities.dxf.swatch.withOpacity(
            colors[colorKey] as string,
            opacityKey ? colors[opacityKey] as number : 1
          )}
        />
        <input
          type="color"
          value={colors[colorKey] as string}
          onChange={(e) => handleColorChange(colorKey, e.target.value)}
          className={`${iconSizes.xl} w-8 h-6 rounded border-0 cursor-pointer`}
        />
        <input
          type="text"
          value={colors[colorKey] as string}
          onChange={(e) => handleColorChange(colorKey, e.target.value)}
          className={`w-20 px-2 py-1 text-xs ${semanticColors.bg.muted} text-white rounded ${getStatusBorder('muted')}`}
          placeholder={UI_COLORS.WHITE}
        />
        {opacityKey && (
          <>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={colors[opacityKey] as number}
              onChange={(e) => handleColorChange(opacityKey, String(parseFloat(e.target.value)))}
              className="w-16"
            />
            <div className={`w-8 text-xs ${semanticColors.text.secondary} text-center`}>
              {Math.round((colors[opacityKey] as number) * 100)}%
            </div>
          </>
        )}
      </div>
    </div>
  );

  const BorderStyleRow = ({ 
    label, 
    description,
    styleKey, 
    color 
  }: { 
    label: string; 
    description: string;
    styleKey: 'windowBorderStyle' | 'crossingBorderStyle'; 
    color: string;
  }) => (
    <div className={`p-2 ${semanticColors.bg.secondary} rounded space-y-2`}>
      <div className="text-sm text-white">
        <div className="font-medium">{label}</div>
        <div className={`font-normal ${semanticColors.text.muted}`}>{description}</div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {(['solid', 'dashed', 'dotted', 'dash-dot'] as const).map((style) => {
          const isSelected = colors[styleKey] === style;
          const styleLabels = {
            solid: 'Συνεχόμενη',
            dashed: 'Διακεκομμένη', 
            dotted: 'Κουκίδες',
            'dash-dot': 'Παύλα-Τελεία'
          };

          const getLinePreview = (style: string) => {
            switch (style) {
              case 'dashed':
                return `repeating-linear-gradient(to right, ${color} 0, ${color} 4px, transparent 4px, transparent 8px)`;
              case 'dotted':
                return `repeating-linear-gradient(to right, ${color} 0, ${color} 2px, transparent 2px, transparent 4px)`;
              case 'dash-dot':
                return `repeating-linear-gradient(to right, ${color} 0, ${color} 6px, transparent 6px, transparent 8px, ${color} 8px, ${color} 10px, transparent 10px, transparent 12px)`;
              default:
                return color;
            }
          };

          return (
            <button 
              key={style}
              onClick={() => handleColorChange(styleKey, style)}
              className={`p-2 rounded text-xs border transition-colors ${
                isSelected
                  ? `${semanticColors.bg.info} ${getStatusBorder('info')}`
                  : `${semanticColors.bg.muted} ${HOVER_BACKGROUND_EFFECTS.BLUE_LIGHT} ${getStatusBorder('muted').replace('border ', '')}`
              }`}
            >
              <div 
                className="w-full mb-1" 
                style={layoutUtilities.dxf.linePreview.thin(getLinePreview(style))}
              />
              <span className="block text-xs">{styleLabels[style]}</span>
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Window Selection */}
      <div>
        <h4 className={`text-xs font-medium ${semanticColors.text.secondary} mb-2`}>🔵 Window Selection</h4>
        <div className="space-y-2">
          <ColorRow
            label="Γέμισμα"
            description="Εσωτερικό κουτιού"
            colorKey="windowFillColor"
            opacityKey="windowFillOpacity"
          />
          <ColorRow
            label="Περίγραμμα"
            description="Εξωτερική γραμμή"
            colorKey="windowBorderColor"
            opacityKey="windowBorderOpacity"
          />
          <BorderStyleRow
            label="Είδος Περιγράμματος"
            description="Τύπος γραμμής περιγράμματος"
            styleKey="windowBorderStyle"
            color={colors.windowBorderColor}
          />
        </div>
      </div>

      {/* Crossing Selection */}
      <div className={`${getDirectionalBorder('muted', 'top')} pt-3`}>
        <h4 className={`text-xs font-medium ${semanticColors.text.secondary} mb-2`}>🟢 Crossing Selection</h4>
        <div className="space-y-2">
          <ColorRow
            label="Γέμισμα"
            description="Εσωτερικό κουτιού"
            colorKey="crossingFillColor"
            opacityKey="crossingFillOpacity"
          />
          <ColorRow
            label="Περίγραμμα"
            description="Εξωτερική γραμμή"
            colorKey="crossingBorderColor"
            opacityKey="crossingBorderOpacity"
          />
          <BorderStyleRow
            label="Είδος Περιγράμματος"
            description="Τύπος γραμμής περιγράμματος"
            styleKey="crossingBorderStyle"
            color={colors.crossingBorderColor}
          />
        </div>
      </div>
    </div>
  );
}