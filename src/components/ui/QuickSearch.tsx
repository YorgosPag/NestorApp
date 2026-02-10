/**
 * 🏢 ENTERPRISE MIGRATION: Unified QuickSearch
 * Αντικατέστησε με centralized QuickSearch component
 *
 * @version 2.0.0 - Enterprise Unified
 * @migration_date 2025-12-15
 * @backward_compatible 100% - Zero visual changes
 */

'use client';

import { QuickSearch as UnifiedQuickSearch } from '@/components/ui/search/QuickSearch';

interface QuickSearchProps {
  searchTerm: string;
  onSearchChange: (term: string) => void;
  placeholder?: string;
}

/**
 * 🎯 BACKWARD COMPATIBLE QuickSearch
 * Delegates στο unified QuickSearch με την ίδια ακριβώς εμφάνιση
 */
export function QuickSearch({ searchTerm, onSearchChange, placeholder = "Search..." }: QuickSearchProps) {
  return (
    <UnifiedQuickSearch
      searchTerm={searchTerm}
      onSearchChange={onSearchChange}
      placeholder={placeholder}
      compact // Preserves original compact styling
    />
  );
}