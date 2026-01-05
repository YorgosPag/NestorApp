import React from 'react';
import { HOVER_BACKGROUND_EFFECTS } from '@/components/ui/effects';
import { layoutUtilities } from '@/styles/design-tokens';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { UI_COLORS } from '../../../config/color-config';
import { PANEL_LAYOUT } from '../../../config/panel-tokens';

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
    <div className={`${PANEL_LAYOUT.SPACING.SM} ${semanticColors.bg.secondary} ${PANEL_LAYOUT.INPUT.BORDER_RADIUS} ${PANEL_LAYOUT.SPACING.GAP_SM}`}>
      <div className={`${PANEL_LAYOUT.INPUT.TEXT_SIZE} ${semanticColors.text.primary}`}>
        <div className={PANEL_LAYOUT.TAB.FONT_WEIGHT}>{label}</div>
        <div className={`font-normal ${semanticColors.text.muted}`}>{description.charAt(0).toUpperCase() + description.slice(1)}</div>
      </div>
      <div className={`flex items-center ${PANEL_LAYOUT.GAP.SM}`}>
        <div
          className={`${iconSizes.md} ${PANEL_LAYOUT.INPUT.BORDER_RADIUS} ${getStatusBorder('muted')}`}
          style={layoutUtilities.dxf.swatch.withOpacity(
            colors[colorKey] as string,
            opacityKey ? colors[opacityKey] as number : 1
          )}
        />
        <input
          type="color"
          value={colors[colorKey] as string}
          onChange={(e) => handleColorChange(colorKey, e.target.value)}
          className={`${iconSizes.xl} ${PANEL_LAYOUT.BUTTON.HEIGHT} ${PANEL_LAYOUT.INPUT.BORDER_RADIUS} border-0 cursor-pointer`}
        />
        <input
          type="text"
          value={colors[colorKey] as string}
          onChange={(e) => handleColorChange(colorKey, e.target.value)}
          className={`w-20 ${PANEL_LAYOUT.INPUT.PADDING_COMPACT} ${PANEL_LAYOUT.BUTTON.TEXT_SIZE_XS} ${semanticColors.bg.muted} ${semanticColors.text.primary} ${PANEL_LAYOUT.INPUT.BORDER_RADIUS} ${getStatusBorder('muted')}`}
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
            <div className={`w-8 ${PANEL_LAYOUT.BUTTON.TEXT_SIZE_XS} ${semanticColors.text.secondary} text-center`}>
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
    <div className={`${PANEL_LAYOUT.SPACING.SM} ${semanticColors.bg.secondary} ${PANEL_LAYOUT.INPUT.BORDER_RADIUS} ${PANEL_LAYOUT.SPACING.GAP_SM}`}>
      <div className={`${PANEL_LAYOUT.INPUT.TEXT_SIZE} ${semanticColors.text.primary}`}>
        <div className={PANEL_LAYOUT.TAB.FONT_WEIGHT}>{label}</div>
        <div className={`font-normal ${semanticColors.text.muted}`}>{description}</div>
      </div>
      <div className={`grid grid-cols-2 ${PANEL_LAYOUT.GAP.SM}`}>
        {(['solid', 'dashed', 'dotted', 'dash-dot'] as const).map((style) => {
          const isSelected = colors[styleKey] === style;
          const styleLabels = {
            solid: 'Συνεχόμενη',
            dashed: 'Διακεκομμένη',
            dotted: 'Κουκίδες',
            'dash-dot': 'Παύλα-Τελεία'
          };

          const getLinePreview = (lineStyle: string) => {
            switch (lineStyle) {
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
              className={`${PANEL_LAYOUT.SPACING.SM} ${PANEL_LAYOUT.INPUT.BORDER_RADIUS} ${PANEL_LAYOUT.BUTTON.TEXT_SIZE_XS} border ${PANEL_LAYOUT.TAB.TRANSITIONS} ${
                isSelected
                  ? `${semanticColors.bg.info} ${getStatusBorder('info')}`
                  : `${semanticColors.bg.muted} ${HOVER_BACKGROUND_EFFECTS.BLUE_LIGHT} ${getStatusBorder('muted').replace('border ', '')}`
              }`}
            >
              <div
                className={`w-full ${PANEL_LAYOUT.MARGIN.BOTTOM_XS}`}
                style={layoutUtilities.dxf.linePreview.thin(getLinePreview(style))}
              />
              <span className={`block ${PANEL_LAYOUT.BUTTON.TEXT_SIZE_XS}`}>{styleLabels[style]}</span>
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className={PANEL_LAYOUT.SPACING.GAP_LG}>
      {/* Window Selection */}
      <section>
        <h4 className={`${PANEL_LAYOUT.BUTTON.TEXT_SIZE_XS} ${PANEL_LAYOUT.TAB.FONT_WEIGHT} ${semanticColors.text.secondary} ${PANEL_LAYOUT.MARGIN.BOTTOM_SM}`}>Window Selection</h4>
        <div className={PANEL_LAYOUT.SPACING.GAP_SM}>
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
      </section>

      {/* Crossing Selection */}
      <section className={`${getDirectionalBorder('muted', 'top')} ${PANEL_LAYOUT.PADDING.TOP_SM}`}>
        <h4 className={`${PANEL_LAYOUT.BUTTON.TEXT_SIZE_XS} ${PANEL_LAYOUT.TAB.FONT_WEIGHT} ${semanticColors.text.secondary} ${PANEL_LAYOUT.MARGIN.BOTTOM_SM}`}>Crossing Selection</h4>
        <div className={PANEL_LAYOUT.SPACING.GAP_SM}>
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