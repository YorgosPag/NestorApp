/**
 * 🏢 ENTERPRISE Unified Search Field Component
 * Αντικαθιστά τα διπλότυπα SearchField implementations
 *
 * @version 1.0.0
 * @author Enterprise Team
 * @compliance CLAUDE.md Protocol - Eliminates duplicates, centralized system
 *
 * REPLACES:
 * - components/public-property-filters/parts/SearchField.tsx
 * - components/property-filters/public/components/SearchField.tsx
 *
 * FEATURES:
 * - 🎯 100% backward compatible εμφάνιση
 * - 🏗️ Consolidated logic από διπλότυπα components
 * - 🎨 Exact same markup structure
 * - 📝 Improved TypeScript typing
 */

'use client';

import React from 'react';
import { Search } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { SearchFieldProps } from './types';
import { SEARCH_UI, LEGACY_PATTERNS } from './constants';

/**
 * 🏢 Enterprise Search Field με Label
 *
 * Unified component που διατηρεί την ΑΚΡΙΒΩΣ ίδια εμφάνιση
 * με τα existing SearchField components αλλά με centralized implementation
 */
export function SearchField({
  value,
  onChange,
  placeholder = 'Αναζήτηση ακινήτου...', // Default από existing implementation
  label = 'Αναζήτηση',
  labelIcon = true,
  disabled = false,
  className,
  id = 'search',
}: SearchFieldProps) {
  // 📝 Handle value changes - support both string and ChangeEvent
  const handleChange = (newValue: string | React.ChangeEvent<HTMLInputElement>) => {
    if (!onChange) return; // 🛡️ Guard check - prevent crash when onChange is undefined

    if (typeof newValue === 'string') {
      onChange(newValue);
    } else {
      onChange(newValue.target.value);
    }
  };

  return (
    <div className={cn(SEARCH_UI.CONTAINER.SPACING, className)}>
      {/* 🏷️ Label με optional icon - exact same structure as existing */}
      <Label
        htmlFor={id}
        className={cn(
          SEARCH_UI.LABEL.BASE,
          labelIcon && SEARCH_UI.LABEL.WITH_ICON
        )}
      >
        {labelIcon && <Search className={SEARCH_UI.ICON.SIZE} />}
        {label}
      </Label>

      {/* 🔍 Search Input Container - exact same structure */}
      <div className={SEARCH_UI.CONTAINER.BASE}>
        <Search className={cn(
          LEGACY_PATTERNS.PROPERTY_SEARCH.iconClasses
        )} />
        <Input
          id={id}
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          disabled={disabled}
          className={cn(LEGACY_PATTERNS.PROPERTY_SEARCH.inputClasses, SEARCH_UI.INPUT.FOCUS)} // 🏢 Enterprise focus + legacy compatibility
          autoComplete="off"
        />
      </div>
    </div>
  );
}

/**
 * 🏢 Backward Compatibility Exports
 * Για smooth transition από τα existing implementations
 */

// Property Search variant - exact same interface as existing
export function PropertySearchField(props: Omit<SearchFieldProps, 'placeholder'>) {
  return (
    <SearchField
      {...props}
      placeholder="Αναζήτηση ακινήτου..."
    />
  );
}

// Company Search variant - για το navigation modal
export function CompanySearchField(props: Omit<SearchFieldProps, 'placeholder' | 'label'>) {
  return (
    <SearchField
      {...props}
      placeholder="Αναζήτηση εταιρείας..."
      label="Αναζήτηση Εταιρείας"
      labelIcon={false} // Company search δεν έχει label icon
    />
  );
}