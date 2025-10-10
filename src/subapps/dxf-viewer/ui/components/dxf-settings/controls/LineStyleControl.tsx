/**
 * 🏢 ENTERPRISE LINE STYLE CONTROL Component
 * Standalone control για line type selection
 *
 * @version 2.0.0
 * @migration Migrated from Radix Select to EnterpriseComboBox (PR1: Centralized ComboBox)
 * @see src/subapps/dxf-viewer/ui/components/dxf-settings/settings/shared/EnterpriseComboBox.tsx
 */

import React from 'react';
import { EnterpriseComboBox } from '../settings/shared/EnterpriseComboBox';
import type { LineType } from '../../../../settings-core/types';
import { getDashArray } from '../../../../settings-core/defaults';

interface LineStyleControlProps {
  value: LineType;
  onChange: (value: LineType) => void;
  label?: string;
  disabled?: boolean;
  showPreview?: boolean;
}

// 🏢 ENTERPRISE: Line type options με preview characters
const LINE_TYPE_OPTIONS: Array<{ value: LineType; label: string; preview: string; description?: string }> = [
  { value: 'solid', label: 'Solid', preview: '━━━━━━━━', description: 'Continuous line' },
  { value: 'dashed', label: 'Dashed', preview: '━ ━ ━ ━', description: 'Dashed pattern' },
  { value: 'dotted', label: 'Dotted', preview: '· · · · ·', description: 'Dotted pattern' },
  { value: 'dash-dot', label: 'Dash-Dot', preview: '━ · ━ ·', description: 'Mixed pattern' },
  { value: 'dash-dot-dot', label: 'Dash-Dot-Dot', preview: '━ · · ━', description: 'Complex pattern' },
];

export const LineStyleControl: React.FC<LineStyleControlProps> = ({
  value,
  onChange,
  label = 'Line Style',
  disabled = false,
  showPreview = true,
}) => {
  // 🏢 ENTERPRISE: Custom render function για options με preview
  const renderOption = (option: typeof LINE_TYPE_OPTIONS[0], isSelected: boolean) => (
    <div className="flex items-center justify-between w-full">
      <span className="text-sm">{option.label}</span>
      {showPreview && (
        <span className={`text-xs font-mono ml-4 ${isSelected ? 'text-blue-400' : 'text-gray-400'}`}>
          {option.preview}
        </span>
      )}
    </div>
  );

  return (
    <div className="space-y-2">
      {/* 🏢 ENTERPRISE: EnterpriseComboBox with custom rendering */}
      <EnterpriseComboBox
        label={label}
        value={value}
        options={LINE_TYPE_OPTIONS}
        onChange={(newValue) => onChange(newValue as LineType)}
        disabled={disabled}
        enableTypeahead={false}
        renderOption={renderOption}
        buttonClassName="bg-gray-900 border-gray-700 text-gray-100"
        listboxClassName="bg-gray-900 border-gray-700"
      />

      {/* 🏢 ENTERPRISE: Visual SVG preview (unchanged from original) */}
      {showPreview && (
        <div className="h-8 flex items-center justify-center bg-gray-800 rounded">
          <svg width="100%" height="2" className="overflow-visible">
            <line
              x1="10"
              y1="1"
              x2="90%"
              y2="1"
              stroke="currentColor"
              strokeWidth="2"
              strokeDasharray={getDashArrayForSvg(value)}
              className="text-blue-500"
            />
          </svg>
        </div>
      )}
    </div>
  );
};

// Helper για SVG stroke-dasharray (χρησιμοποιεί την κεντρική getDashArray)
function getDashArrayForSvg(type: LineType): string {
  const result = getDashArray(type, 1);
  return result.length > 0 ? result.join(',') : '';
}