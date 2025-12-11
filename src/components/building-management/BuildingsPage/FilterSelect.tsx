
'use client';

import React from 'react';
import { EnterpriseDropdown, type DropdownOption } from '@/components/ui/enterprise-dropdown';

// ============================================================================
// BUILDING MANAGEMENT: ENTERPRISE FILTER SELECT
// ============================================================================
//
// 🏢 Κεντρικοποιημένο filter component που χρησιμοποιεί το Enterprise Dropdown system
// Διατηρεί την ίδια API για backward compatibility αλλά με modern implementation
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
 * 🏢 Enterprise Filter Select Component
 *
 * Centralized dropdown για building management filters.
 * Χρησιμοποιεί το κεντρικοποιημένο EnterpriseDropdown system.
 */
export function FilterSelect({
  value,
  onChange,
  options = [],
  placeholder,
  className
}: FilterSelectProps) {
  // 🏢 ENTERPRISE: Convert data format to EnterpriseDropdown format
  const dropdownOptions: DropdownOption[] = [
    // Always include "all" option first
    { value: 'all', label: placeholder },
    // Convert options to dropdown format με smart label mapping
    ...options.map(opt => {
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

      return {
        value: opt.name, // Use name as value για consistency
        label: getDisplayLabel(opt.name)
      };
    })
  ];

  return (
    <EnterpriseDropdown
      value={value}
      onValueChange={onChange}
      options={dropdownOptions}
      placeholder={placeholder}
      className={className}
    />
  );
}
