/**
 * LINE COLOR CONTROL Component
 * Standalone control για color selection
 */

import React, { useState } from 'react';
import { Button } from '../../../../../../components/ui/button';
import { Input } from '../../../../../../components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '../../../../../../components/ui/popover';
import { Palette } from 'lucide-react';
import { UI_COLORS } from '../../../../config/color-config';
import { ACI_PALETTE } from '../../../../settings/standards/aci';
import { HOVER_BACKGROUND_EFFECTS, createHoverBorderEffects } from '@/components/ui/effects';
import { useDynamicBackgroundClass } from '@/components/ui/utils/dynamic-styles';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

interface LineColorControlProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  disabled?: boolean;
  showHex?: boolean;
}

// AutoCAD Standard Colors - Using centralized ACI palette
const PRESET_COLORS = [
  ACI_PALETTE[1], // Red (ACI 1)
  ACI_PALETTE[2], // Yellow (ACI 2)
  ACI_PALETTE[3], // Green (ACI 3)
  ACI_PALETTE[4], // Cyan (ACI 4)
  ACI_PALETTE[5], // Blue (ACI 5)
  ACI_PALETTE[6], // Magenta (ACI 6)
  ACI_PALETTE[7], // White (ACI 7)
  ACI_PALETTE[8], // Gray (ACI 8)
  ACI_PALETTE[9], // Light Gray (ACI 9)
];

export const LineColorControl: React.FC<LineColorControlProps> = ({
  value,
  onChange,
  label = 'Color',
  disabled = false,
  showHex = true,
}) => {
  const iconSizes = useIconSizes();
  const borderTokens = useBorderTokens();
  const { getStatusBorder } = borderTokens;
  const colors = useSemanticColors();
  const hoverBorderEffects = createHoverBorderEffects(borderTokens);
  const [isOpen, setIsOpen] = useState(false);
  const [tempColor, setTempColor] = useState(value);

  // 🎨 ENTERPRISE DYNAMIC STYLING - NO INLINE STYLES (CLAUDE.md compliant)
  const valueBgClass = useDynamicBackgroundClass(value);
  const tempColorBgClass = useDynamicBackgroundClass(tempColor);

  // Precompute all preset color classes
  const presetColorClasses = PRESET_COLORS.map(color => ({
    color,
    bgClass: useDynamicBackgroundClass(color)
  }));

  const handleColorChange = (color: string) => {
    setTempColor(color);
    onChange(color);
  };

  const handlePresetClick = (color: string) => {
    handleColorChange(color);
    setIsOpen(false);
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium ${colors.text.muted}">
        {label}
      </label>

      <div className="flex items-center gap-2">
        {/* Color preview button */}
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              disabled={disabled}
              className={`w-full justify-start gap-2 ${colors.bg.primary} ${getStatusBorder('muted')} ${HOVER_BACKGROUND_EFFECTS.GRAY_DARK}`}
            >
              <div
                className={`${iconSizes.md} rounded ${getStatusBorder('muted')} ${valueBgClass}`}
              />
              <span className="${colors.text.secondary} flex-1 text-left">
                {showHex ? value.toUpperCase() : 'Select Color'}
              </span>
              <Palette className={`${iconSizes.sm} ${colors.text.muted}`} />
            </Button>
          </PopoverTrigger>

          <PopoverContent className={`w-64 ${colors.bg.primary} ${getStatusBorder('muted')} p-3`}>
            <div className="space-y-3">
              {/* Preset colors grid */}
              <div>
                <p className="text-xs ${colors.text.muted} mb-2">AutoCAD Colors</p>
                <div className="grid grid-cols-5 gap-1">
                  {presetColorClasses.map(({ color, bgClass }) => (
                    <button
                      key={color}
                      onClick={() => handlePresetClick(color)}
                      className={`
                        ${iconSizes.xl2} rounded border transition-all
                        ${tempColor === color
                          ? `${getStatusBorder('info').replace('border ', '')} scale-110`
                          : `${getStatusBorder('muted').replace('border ', '')} ${hoverBorderEffects.GRAY}`
                        }
                        ${bgClass}
                      `}
                      title={color}
                    />
                  ))}
                </div>
              </div>

              {/* Custom color input */}
              <div>
                <p className="text-xs ${colors.text.muted} mb-2">Custom Color</p>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={tempColor}
                    onChange={(e) => handleColorChange(e.target.value)}
                    className={`w-16 h-9 p-1 ${colors.bg.secondary} ${getStatusBorder('muted').replace('border ', '')}`}
                  />
                  <Input
                    type="text"
                    value={tempColor}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (/^#[0-9A-Fa-f]{0,6}$/.test(val)) {
                        setTempColor(val);
                        if (val.length === 7) {
                          onChange(val);
                        }
                      }
                    }}
                    placeholder={UI_COLORS.WHITE}
                    className={`flex-1 ${colors.bg.secondary} ${getStatusBorder('muted').replace('border ', '')} ${colors.text.secondary} font-mono text-sm`}
                  />
                </div>
              </div>

              {/* Live preview */}
              <div className={`h-2 rounded ${tempColorBgClass}`} />
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
};