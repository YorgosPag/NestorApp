/**
 * LINE PREVIEW CONTROL Component
 * Live preview του line style
 */

import React from 'react';
import type { LineSettings } from '../../../../settings-core/types';

interface LinePreviewControlProps {
  settings: Partial<LineSettings>;
  height?: number;
  label?: string;
}

export const LinePreviewControl: React.FC<LinePreviewControlProps> = ({
  settings,
  height = 40,
  label = 'Preview',
}) => {
  const getDashArray = (type?: string, scale: number = 1): string => {
    const patterns: Record<string, string> = {
      solid: '',
      dotted: '2,4',
      dashed: '8,4',
      'dash-dot': '8,4,2,4',
      'dash-dot-dot': '8,4,2,4,2,4',
    };
    const pattern = patterns[type || 'solid'] || '';
    if (!pattern) return '';

    return pattern.split(',')
      .map(val => (parseFloat(val) * (scale || 1)).toString())
      .join(',');
  };

  return (
    <div className="space-y-2">
      {label && (
        <label className="text-sm font-medium text-gray-300">
          {label}
        </label>
      )}

      <div
        className="bg-gray-900 rounded border border-gray-700 p-4 flex items-center justify-center"
        style={{ height }}
      >
        <svg width="100%" height="100%" className="overflow-visible">
          {/* Main line */}
          <line
            x1="10%"
            y1="50%"
            x2="90%"
            y2="50%"
            stroke={settings.color || '#FFFFFF'}
            strokeWidth={(settings.lineWidth || 0.25) * 4} // Scale for visibility
            strokeOpacity={settings.opacity || 1}
            strokeDasharray={getDashArray(settings.lineType, settings.dashScale)}
            strokeLinecap={settings.lineCap || 'butt'}
            strokeLinejoin={settings.lineJoin || 'miter'}
            className="transition-all duration-150"
          />

          {/* Start point marker */}
          <circle
            cx="10%"
            cy="50%"
            r="3"
            fill={settings.color || '#FFFFFF'}
            opacity={settings.opacity || 1}
          />

          {/* End point marker */}
          <circle
            cx="90%"
            cy="50%"
            r="3"
            fill={settings.color || '#FFFFFF'}
            opacity={settings.opacity || 1}
          />
        </svg>
      </div>

      {/* Info text */}
      <div className="flex items-center justify-between text-xs text-gray-400">
        <span>{settings.lineType || 'solid'}</span>
        <span>{(settings.lineWidth || 0.25).toFixed(2)}mm</span>
        <span>{settings.color || '#FFFFFF'}</span>
      </div>
    </div>
  );
};