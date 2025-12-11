'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { TYPE_OPTIONS } from '../constants';

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
  return (
    <Select value={selected || 'all'} onValueChange={onChange}>
      <SelectTrigger className="px-4 py-2.5 border border-gray-200 dark:border-border dark:bg-muted/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-ring bg-white">
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
