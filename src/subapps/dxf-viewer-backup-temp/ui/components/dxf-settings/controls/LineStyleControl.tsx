/**
 * LINE STYLE CONTROL Component
 * Standalone control για line type selection
 */

import React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../../../components/ui/select';
import type { LineType } from '../../../../settings-core/types';
import { getDashArray } from '../../../../settings-core/defaults';

interface LineStyleControlProps {
  value: LineType;
  onChange: (value: LineType) => void;
  label?: string;
  disabled?: boolean;
  showPreview?: boolean;
}

const LINE_TYPE_OPTIONS: Array<{ value: LineType; label: string; preview: string }> = [
  { value: 'solid', label: 'Solid', preview: '━━━━━━━━' },
  { value: 'dashed', label: 'Dashed', preview: '━ ━ ━ ━' },
  { value: 'dotted', label: 'Dotted', preview: '· · · · ·' },
  { value: 'dash-dot', label: 'Dash-Dot', preview: '━ · ━ ·' },
  { value: 'dash-dot-dot', label: 'Dash-Dot-Dot', preview: '━ · · ━' },
];

export const LineStyleControl: React.FC<LineStyleControlProps> = ({
  value,
  onChange,
  label = 'Line Style',
  disabled = false,
  showPreview = true,
}) => {
  const handleChange = (newValue: string) => {
    onChange(newValue as LineType);
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-gray-300">
        {label}
      </label>

      <Select value={value} onValueChange={handleChange} disabled={disabled}>
        <SelectTrigger className="w-full bg-gray-900 border-gray-700 text-gray-100">
          <SelectValue>
            {showPreview ? (
              <div className="flex items-center justify-between w-full">
                <span className="text-sm">
                  {LINE_TYPE_OPTIONS.find(opt => opt.value === value)?.label}
                </span>
                <span className="text-xs font-mono text-gray-400 ml-2">
                  {LINE_TYPE_OPTIONS.find(opt => opt.value === value)?.preview}
                </span>
              </div>
            ) : (
              LINE_TYPE_OPTIONS.find(opt => opt.value === value)?.label
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="bg-gray-900 border-gray-700">
          {LINE_TYPE_OPTIONS.map((option) => (
            <SelectItem
              key={option.value}
              value={option.value}
              className="text-gray-100 hover:bg-gray-800"
            >
              <div className="flex items-center justify-between w-full">
                <span className="text-sm">{option.label}</span>
                {showPreview && (
                  <span className="text-xs font-mono text-gray-400 ml-4">
                    {option.preview}
                  </span>
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Visual preview of selected style */}
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