/**
 * 🏢 ENTERPRISE MIGRATION: Unified SearchField Implementation
 * Αντικατέστησε το ΔΕΥΤΕΡΟ διπλότυπο implementation με centralized system
 *
 * @version 2.0.0 - Enterprise Unified
 * @migration_date 2025-12-15
 * @backward_compatible 100% - Zero visual changes
 * @note Πλήρης αντικατάσταση του duplicate code
 */

'use client';

import { PropertySearchField } from '@/components/ui/search';
import * as React from 'react';

interface SearchFieldProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

/**
 * 🎯 BACKWARD COMPATIBLE SearchField - ΔΙΠΛΟΤΥΠΟ #2 CONSOLIDATED
 * Delegates στο unified PropertySearchField με την ίδια ακριβώς εμφάνιση
 * Διατηρεί την original interface για backward compatibility
 */
export function SearchField({ value, onChange }: SearchFieldProps) {
  // 🔄 Interface adapter - converts ChangeEvent to string
  const handleChange = (newValue: string) => {
    const syntheticEvent = {
      target: { value: newValue },
      currentTarget: { value: newValue },
    } as React.ChangeEvent<HTMLInputElement>;
    onChange(syntheticEvent);
  };

  return (
    <PropertySearchField
      value={value}
      onChange={handleChange}
    />
  );
}
