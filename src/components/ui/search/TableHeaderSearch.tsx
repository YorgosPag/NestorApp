/**
 * 🏢 ENTERPRISE Table Header Search Component
 * Unified search για table/list headers με consistent styling
 *
 * @version 1.0.0
 * @author Enterprise Team
 * @compliance CLAUDE.md Protocol - Centralized table search functionality
 *
 * FEATURES:
 * - 🎯 Optimized για table/list headers
 * - 🎨 Compact design με consistent styling
 * - ⚡ Debounced search option
 * - ♿ Full accessibility support
 */

'use client';

import React from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { SearchInput } from './SearchInput';
import { SEARCH_UI } from './constants';

interface TableHeaderSearchProps {
  searchTerm: string;
  onSearchChange: (term: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  debounceMs?: number;
  compact?: boolean;
}

/**
 * 🏢 Enterprise Table Header Search
 * Unified component για table/list header search functionality
 * Διατηρεί την ίδια ακριβώς εμφάνιση με existing table headers
 */
export function TableHeaderSearch({
  searchTerm,
  onSearchChange,
  placeholder = "Αναζήτηση...",
  className,
  disabled = false,
  debounceMs = 300,
  compact = true
}: TableHeaderSearchProps) {

  if (compact) {
    // 🎯 Compact mode για table headers - exact same styling as existing
    return (
      <div className={cn("relative flex-1", className)}>
        <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-muted-foreground" />
        <Input
          type="text"
          placeholder={placeholder}
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          disabled={disabled}
          className={cn("pl-7 h-8 text-sm", SEARCH_UI.INPUT.FOCUS)} // 🏢 Enterprise centralized focus ring
          autoComplete="off"
        />
      </div>
    );
  }

  // 🎯 Standard mode με unified SearchInput
  return (
    <div className={cn("flex-1", className)}>
      <SearchInput
        value={searchTerm}
        onChange={onSearchChange}
        placeholder={placeholder}
        disabled={disabled}
        debounceMs={debounceMs}
        className="h-8 text-sm"
      />
    </div>
  );
}

/**
 * 🏢 Specialized Variants για common use cases
 */

// Units List Header Search
export function UnitsHeaderSearch({
  searchTerm,
  onSearchChange,
}: {
  searchTerm: string;
  onSearchChange: (term: string) => void;
}) {
  return (
    <TableHeaderSearch
      searchTerm={searchTerm}
      onSearchChange={onSearchChange}
      placeholder="Αναζήτηση μονάδων..."
      compact={true}
    />
  );
}

// Buildings List Header Search
export function BuildingsHeaderSearch({
  searchTerm,
  onSearchChange,
}: {
  searchTerm: string;
  onSearchChange: (term: string) => void;
}) {
  return (
    <TableHeaderSearch
      searchTerm={searchTerm}
      onSearchChange={onSearchChange}
      placeholder="Αναζήτηση κτιρίων..."
      compact={true}
    />
  );
}

// Projects Header Search
export function ProjectsHeaderSearch({
  searchTerm,
  onSearchChange,
}: {
  searchTerm: string;
  onSearchChange: (term: string) => void;
}) {
  return (
    <TableHeaderSearch
      searchTerm={searchTerm}
      onSearchChange={onSearchChange}
      placeholder="Αναζήτηση έργων..."
      compact={true}
    />
  );
}

// Contacts Header Search
export function ContactsHeaderSearch({
  searchTerm,
  onSearchChange,
}: {
  searchTerm: string;
  onSearchChange: (term: string) => void;
}) {
  return (
    <TableHeaderSearch
      searchTerm={searchTerm}
      onSearchChange={onSearchChange}
      placeholder="Αναζήτηση επαφών..."
      compact={true}
    />
  );
}