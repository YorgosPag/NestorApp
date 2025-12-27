'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { PROPERTY_TYPE_LABELS, PROPERTY_FILTER_LABELS } from '@/constants/property-statuses-enterprise';

// 🏢 ENTERPRISE: Centralized property type options
const TYPE_OPTIONS = [
  { value: 'all', label: PROPERTY_FILTER_LABELS.ALL_TYPES },
  ...Object.entries(PROPERTY_TYPE_LABELS).map(([value, label]) => ({ value, label }))
] as const;

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
  const { quick, radius } = useBorderTokens();
  const colors = useSemanticColors();

  return (
    <Select value={selected || 'all'} onValueChange={onChange}>
      <SelectTrigger className={`px-4 py-2.5 ${quick.input} dark:bg-muted/30 ${radius.lg} focus:outline-none focus:ring-2 focus:ring-ring ${colors.bg.primary}`}>
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