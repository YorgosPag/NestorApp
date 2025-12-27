'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { TYPE_OPTIONS } from '../constants';
import { useSemanticColors } from '@/hooks/useSemanticColors';
import { useBorderTokens } from '@/hooks/useBorderTokens';

// ============================================================================
// PROPERTY GRID: PURE RADIX UI TYPE SELECT
// ============================================================================
//
// 🏢 ΕΠΑΓΓΕΛΜΑΤΙΚΟ: Pure Radix UI implementation για enterprise-grade architecture
// ♿ WAI-ARIA compliant, professional keyboard navigation, battle-tested
// 📱 Mobile ready, touch-friendly, industry standard solution
//
// ============================================================================

/**
 * 🏢 Pure Radix UI Type Select Component for Property Grid
 *
 * Enterprise-grade dropdown για property type filtering.
 * Uses industry standard Radix UI Select with professional accessibility.
 */
export function TypeSelect({
  selected,
  onChange,
}: {
  selected: string | undefined;
  onChange: (v: string) => void;
}) {
  const colors = useSemanticColors();
  const { radius } = useBorderTokens();
  return (
    <Select value={selected || 'all'} onValueChange={onChange}>
      <SelectTrigger className={`px-4 py-2.5 border ${colors.border.muted} ${colors.bg.primary} ${radius.lg} focus:outline-none ${colors.interactive.focus.ring}`}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {TYPE_OPTIONS.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
