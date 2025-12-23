/**
 * LINE COLOR CONTROL Component
 * Standalone control για color selection
 */

import React, { useState } from 'react';
import { Button } from '../../../../../../components/ui/button';
import { Input } from '../../../../../../components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '../../../../../../components/ui/popover';
import { Palette } from 'lucide-react';
import { HOVER_BACKGROUND_EFFECTS, HOVER_BORDER_EFFECTS } from '@/components/ui/effects';
import { useDynamicBackgroundClass } from '@/components/ui/utils/dynamic-styles';
import { useIconSizes } from '@/hooks/useIconSizes';

interface LineColorControlProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  disabled?: boolean;
  showHex?: boolean;
}

// AutoCAD Standard Colors
const PRESET_COLORS = [
  '#FF0000', // Red (ACI 1)
  '#FFFF00', // Yellow (ACI 2)
  '#00FF00', // Green (ACI 3)
  '#00FFFF', // Cyan (ACI 4)
  '#0000FF', // Blue (ACI 5)
  '#FF00FF', // Magenta (ACI 6)
  '#FFFFFF', // White (ACI 7)
  '#808080', // Gray (ACI 8)
  '#C0C0C0', // Light Gray (ACI 9)
];

export const LineColorControl: React.FC<LineColorControlProps> = ({
  value,
  onChange,
  label = 'Color',
  disabled = false,
  showHex = true,
}) => {
  const iconSizes = useIconSizes();
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
      <label className="text-sm font-medium text-gray-300">
        {label}
      </label>

      <div className="flex items-center gap-2">
        {/* Color preview button */}
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              disabled={disabled}
              className={`w-full justify-start gap-2 bg-gray-900 border-gray-700 ${HOVER_BACKGROUND_EFFECTS.GRAY_DARK}`}
            >
              <div
                className={`${iconSizes.md} rounded border border-gray-600 ${valueBgClass}`}
              />
              <span className="text-gray-100 flex-1 text-left">
                {showHex ? value.toUpperCase() : 'Select Color'}
              </span>
              <Palette className={`${iconSizes.sm} text-gray-400`} />
            </Button>
          </PopoverTrigger>

          <PopoverContent className="w-64 bg-gray-900 border-gray-700 p-3">
            <div className="space-y-3">
              {/* Preset colors grid */}
              <div>
                <p className="text-xs text-gray-400 mb-2">AutoCAD Colors</p>
                <div className="grid grid-cols-5 gap-1">
                  {presetColorClasses.map(({ color, bgClass }) => (
                    <button
                      key={color}
                      onClick={() => handlePresetClick(color)}
                      className={`
                        ${iconSizes.xl2} rounded border-2 transition-all
                        ${tempColor === color
                          ? 'border-blue-500 scale-110'
                          : `border-gray-700 ${HOVER_BORDER_EFFECTS.GRAY}`
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
                <p className="text-xs text-gray-400 mb-2">Custom Color</p>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={tempColor}
                    onChange={(e) => handleColorChange(e.target.value)}
                    className="w-16 h-9 p-1 bg-gray-800 border-gray-700"
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
                    placeholder="#FFFFFF"
                    className="flex-1 bg-gray-800 border-gray-700 text-gray-100 font-mono text-sm"
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