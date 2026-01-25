/**
 * 🏢 ENTERPRISE LINE STYLE CONTROL Component
 * Standalone control για line type selection
 *
 * @version 3.0.0
 * @migration ADR-001: Migrated from EnterpriseComboBox to Radix Select (canonical component)
 * @see src/components/ui/select.tsx
 * @decision 2026-01-01: Radix Select is the ONLY canonical dropdown component
 */

import React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { LineType } from '../../../../settings-core/types';
import { getDashArray } from '../../../../settings-core/defaults';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
// 🏢 ENTERPRISE: Centralized spacing tokens
import { PANEL_LAYOUT } from '../../../../config/panel-tokens';

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
  const { quick } = useBorderTokens();
  const colors = useSemanticColors();

  return (
    <div className={PANEL_LAYOUT.SPACING.GAP_SM}>
      {/* 🏢 ADR-001: Radix Select - Canonical dropdown component */}
      {label && (
        <label className={`block ${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${colors.text.secondary}`}>
          {label}
        </label>
      )}
      <Select
        value={value}
        onValueChange={(newValue) => onChange(newValue as LineType)}
        disabled={disabled}
      >
        <SelectTrigger className={`w-full ${colors.bg.secondary}`}>
          <SelectValue placeholder="Select line style..." />
        </SelectTrigger>
        <SelectContent>
          {LINE_TYPE_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              <span className={`flex items-center ${PANEL_LAYOUT.GAP.SM}`}>
                <span className={`${PANEL_LAYOUT.FONT_FAMILY.CODE} ${PANEL_LAYOUT.TYPOGRAPHY.XS} ${PANEL_LAYOUT.OPACITY['70']}`}>{option.preview}</span>
                <span>{option.label}</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* 🏢 ENTERPRISE: Visual SVG preview - Using semantic colors */}
      {showPreview && (
        <div className={`${PANEL_LAYOUT.HEIGHT.XL} flex items-center justify-center ${colors.bg.secondary} ${quick.rounded}`}>
          <svg width="100%" height="2" className={PANEL_LAYOUT.OVERFLOW.VISIBLE}>
            <line
              x1="10"
              y1="1"
              x2="90%"
              y2="1"
              stroke="currentColor"
              strokeWidth="2"
              strokeDasharray={getDashArrayForSvg(value)}
              className={colors.text.info}
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