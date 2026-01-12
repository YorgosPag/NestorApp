/**
 * 🏢 ENTERPRISE Table Header Search Component with i18n
 * ZERO HARDCODED STRINGS - All labels from centralized translations
 *
 * @version 1.1.0
 * @author Enterprise Team
 * @compliance CLAUDE.md Protocol - Centralized table search functionality
 *
 * FEATURES:
 * - 🎯 Optimized για table/list headers
 * - 🎨 Compact design με consistent styling
 * - ⚡ Debounced search option
 * - ♿ Full accessibility support
 * - 🌐 Full i18n support
 */

'use client';

import React from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useIconSizes } from '@/hooks/useIconSizes';
import { SearchInput } from './SearchInput';
import { SEARCH_UI } from './constants';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';

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
  placeholder,
  className,
  disabled = false,
  debounceMs = 300,
  compact = true
}: TableHeaderSearchProps) {
  // 🏢 ENTERPRISE: i18n hook
  const { t } = useTranslation('common');
  const iconSizes = useIconSizes();

  // Use translation with fallback to prop
  const resolvedPlaceholder = placeholder || t('placeholders.search');

  if (compact) {
    // 🎯 Compact mode για table headers - exact same styling as existing
    return (
      <div className={cn("relative flex-1", className)}>
        <Search className={`absolute left-2 top-1/2 transform -translate-y-1/2 ${iconSizes.xs} text-muted-foreground`} />
        <Input
          type="text"
          placeholder={resolvedPlaceholder}
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          disabled={disabled}
          className={cn(`pl-7 ${iconSizes.xl} text-sm`, SEARCH_UI.INPUT.FOCUS)} // 🏢 Enterprise centralized focus ring
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
        placeholder={resolvedPlaceholder}
        disabled={disabled}
        debounceMs={debounceMs}
        className="h-8 text-sm"
      />
    </div>
  );
}

/**
 * 🏢 Specialized Variants για common use cases
 * Note: All variants use i18n internally via translation keys
 */

// Units List Header Search
export function UnitsHeaderSearch({
  searchTerm,
  onSearchChange,
}: {
  searchTerm: string;
  onSearchChange: (term: string) => void;
}) {
  const { t } = useTranslation('common');
  return (
    <TableHeaderSearch
      searchTerm={searchTerm}
      onSearchChange={onSearchChange}
      placeholder={t('placeholders.searchUnits')}
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
  const { t } = useTranslation('common');
  return (
    <TableHeaderSearch
      searchTerm={searchTerm}
      onSearchChange={onSearchChange}
      placeholder={t('placeholders.searchBuildings')}
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
  const { t } = useTranslation('common');
  return (
    <TableHeaderSearch
      searchTerm={searchTerm}
      onSearchChange={onSearchChange}
      placeholder={t('placeholders.searchProjects')}
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
  const { t } = useTranslation('common');
  return (
    <TableHeaderSearch
      searchTerm={searchTerm}
      onSearchChange={onSearchChange}
      placeholder={t('placeholders.searchContacts')}
      compact={true}
    />
  );
}