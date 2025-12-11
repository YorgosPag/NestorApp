
'use client';

import React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';

// ============================================================================
// BUILDING MANAGEMENT: PURE RADIX UI FILTER SELECT
// ============================================================================
//
// 🏢 ΕΠΑΓΓΕΛΜΑΤΙΚΟ: Pure Radix UI implementation για enterprise-grade architecture
// ♿ WAI-ARIA compliant, professional keyboard navigation, battle-tested
// 📱 Mobile ready, touch-friendly, industry standard solution
//
// ============================================================================

interface FilterSelectProps {
  value: string;
  onChange: (value: string) => void; // 🏢 ENTERPRISE: Direct value callback (no event object)
  options?: { id: string; name: string }[];
  placeholder: string;
  className?: string;
}

/**
 * 🏢 Pure Radix UI Filter Select Component
 *
 * Enterprise-grade dropdown για building management filters.
 * Uses industry standard Radix UI Select with professional accessibility.
 */
export function FilterSelect({
  value,
  onChange,
  options = [],
  placeholder,
  className
}: FilterSelectProps) {
  // 🏢 ENTERPRISE: Smart label mapping για status values
  const getDisplayLabel = (name: string): string => {
    const statusLabels: Record<string, string> = {
      'active': 'Ενεργά',
      'construction': 'Υπό Κατασκευή',
      'planned': 'Σχεδιασμένα',
      'completed': 'Ολοκληρωμένα'
    };

    return statusLabels[name] || name; // Fallback to original name
  };

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {/* Always include "all" option first */}
        <SelectItem value="all">{placeholder}</SelectItem>

        {/* Map options with smart label mapping */}
        {options.map(opt => (
          <SelectItem key={opt.id} value={opt.name}>
            {getDisplayLabel(opt.name)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
