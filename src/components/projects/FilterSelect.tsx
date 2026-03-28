/* eslint-disable design-system/prefer-design-system-imports */
'use client';

import React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { useTypography } from '@/hooks/useTypography';

// ============================================================================
// PROJECTS: PURE RADIX UI FILTER SELECT
// ============================================================================
//
// 🏢 ΕΠΑΓΓΕΛΜΑΤΙΚΟ: Pure Radix UI implementation για enterprise-grade architecture
// ♿ WAI-ARIA compliant, professional keyboard navigation, battle-tested
// 📱 Mobile ready, touch-friendly, industry standard solution
//
// ============================================================================

interface FilterSelectProps {
  value: string;
  onChange: (value: string) => void; // 🏢 ENTERPRISE: Updated to direct value callback
  options: { id: string; name: string }[];
  placeholder: string;
}

/**
 * 🏢 Pure Radix UI Filter Select Component for Projects
 *
 * Enterprise-grade dropdown για projects filters.
 * Uses industry standard Radix UI Select with professional accessibility.
 */
export function FilterSelect({
  value,
  onChange,
  options,
  placeholder,
}: FilterSelectProps) {
  const typography = useTypography();
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={`h-9 px-2 ${typography.body.sm}`}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {/* Always include "all" option first */}
        <SelectItem value="all">{placeholder}</SelectItem>

        {/* Map options */}
        {options.map((opt) => (
          <SelectItem key={opt.id} value={opt.name}>
            {opt.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
