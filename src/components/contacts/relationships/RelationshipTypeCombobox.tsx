// ============================================================================
// RELATIONSHIP TYPE COMBOBOX - SEARCHABLE + ADD CUSTOM TYPE
// ============================================================================
//
// 🎯 PURPOSE: Searchable dropdown for relationship types with inline
//    custom type creation. Replaces static Select dropdown.
// 🔗 USED BY: RelationshipFormFields
// 🏢 STANDARDS: Enterprise patterns, centralized design system, i18n
//
// ============================================================================

'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { designSystem } from '@/lib/design-system';
import { useIconSizes } from '@/hooks/useIconSizes';
import { ChevronDown, Search, Plus, Check, User } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { ContactType } from '@/types/contacts/contracts';
import {
  getRelationshipTypeConfig,
  getAvailableRelationshipTypes
} from './utils/relationship-types';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface RelationshipTypeComboboxProps {
  /** Current selected value */
  value: string;
  /** Change handler */
  onChange: (value: string, customLabel?: string) => void;
  /** Contact type for filtering available types */
  contactType: ContactType;
  /** Disabled state */
  disabled?: boolean;
  /** Error state */
  hasError?: boolean;
  /** Placeholder text */
  placeholder?: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

export const RelationshipTypeCombobox: React.FC<RelationshipTypeComboboxProps> = ({
  value,
  onChange,
  contactType,
  disabled = false,
  hasError = false,
  placeholder
}) => {
  const { t } = useTranslation('contacts');
  const iconSizes = useIconSizes();
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddingCustom, setIsAddingCustom] = useState(false);
  const [customTypeInput, setCustomTypeInput] = useState('');
  const [customTypes, setCustomTypes] = useState<string[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const customInputRef = useRef<HTMLInputElement>(null);

  // Focus search input when popover opens
  useEffect(() => {
    if (open && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [open]);

  // Focus custom input when adding custom type
  useEffect(() => {
    if (isAddingCustom && customInputRef.current) {
      setTimeout(() => customInputRef.current?.focus(), 50);
    }
  }, [isAddingCustom]);

  // Get predefined types for this contact type
  const predefinedTypes = useMemo(
    () => getAvailableRelationshipTypes(contactType),
    [contactType]
  );

  // Build full list: predefined + custom
  const allTypes = useMemo(() => {
    const items = predefinedTypes.map(typeKey => {
      const config = getRelationshipTypeConfig(typeKey);
      const translatedLabel = config?.label ? t(config.label) : typeKey;
      return {
        key: typeKey,
        label: translatedLabel,
        icon: config?.icon ?? User,
        isCustom: false
      };
    });

    // Add custom types
    for (const customLabel of customTypes) {
      const customKey = `custom_${customLabel.toLowerCase().replace(/\s+/g, '_')}`;
      items.push({
        key: customKey,
        label: customLabel,
        icon: User,
        isCustom: true
      });
    }

    return items;
  }, [predefinedTypes, customTypes, t]);

  // Filter by search query
  const filteredTypes = useMemo(() => {
    if (!searchQuery.trim()) return allTypes;
    const query = searchQuery.toLowerCase();
    return allTypes.filter(item =>
      item.label.toLowerCase().includes(query) ||
      item.key.toLowerCase().includes(query)
    );
  }, [allTypes, searchQuery]);

  // Get display label for current value
  const displayLabel = useMemo(() => {
    if (!value) return '';
    const found = allTypes.find(item => item.key === value);
    if (found) return found.label;
    // If value is a custom key, extract the label
    if (value.startsWith('custom_')) {
      return value.replace('custom_', '').replace(/_/g, ' ');
    }
    // Try predefined config
    const config = getRelationshipTypeConfig(value);
    return config?.label ? t(config.label) : value;
  }, [value, allTypes, t]);

  // Handle type selection
  const handleSelect = (typeKey: string, label?: string) => {
    onChange(typeKey, label);
    setOpen(false);
    setSearchQuery('');
    setIsAddingCustom(false);
  };

  // Handle adding a custom type
  const handleAddCustomType = () => {
    const trimmed = customTypeInput.trim();
    if (!trimmed) return;

    // Check if already exists
    const exists = allTypes.some(
      item => item.label.toLowerCase() === trimmed.toLowerCase()
    );
    if (exists) {
      const existing = allTypes.find(
        item => item.label.toLowerCase() === trimmed.toLowerCase()
      );
      if (existing) {
        handleSelect(existing.key);
      }
      setCustomTypeInput('');
      setIsAddingCustom(false);
      return;
    }

    // Add new custom type
    setCustomTypes(prev => [...prev, trimmed]);
    const customKey = `custom_${trimmed.toLowerCase().replace(/\s+/g, '_')}`;
    handleSelect(customKey, trimmed);
    setCustomTypeInput('');
    setIsAddingCustom(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={designSystem.cn(
            "flex h-10 w-full items-center justify-between rounded-md border px-3 py-2 text-sm",
            "bg-background ring-offset-background",
            "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
            "disabled:cursor-not-allowed disabled:opacity-50",
            hasError
              ? "border-destructive focus:ring-destructive"
              : "border-input"
          )}
        >
          <span className={value ? "text-foreground" : "text-muted-foreground"}>
            {displayLabel || placeholder || t('relationships.form.placeholders.selectType')}
          </span>
          <ChevronDown className={designSystem.cn(iconSizes.sm, "shrink-0 opacity-50 ml-2")} />
        </button>
      </PopoverTrigger>

      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
        sideOffset={4}
      >
        {/* Search Input */}
        <div className="flex items-center border-b px-3">
          <Search className={designSystem.cn(iconSizes.sm, "shrink-0 opacity-50 mr-2")} />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={t('relationships.form.placeholders.searchType', {
              defaultValue: 'Αναζήτηση τύπου...'
            })}
            className={designSystem.cn(
              "flex h-10 w-full bg-transparent py-3 text-sm outline-none",
              "placeholder:text-muted-foreground"
            )}
          />
        </div>

        {/* Type List */}
        <div className="max-h-60 overflow-y-auto p-1" role="listbox">
          {filteredTypes.length === 0 && !isAddingCustom && (
            <p className="py-4 text-center text-sm text-muted-foreground">
              {t('relationships.form.noTypesFound', {
                defaultValue: 'Δεν βρέθηκαν τύποι'
              })}
            </p>
          )}

          {filteredTypes.map(item => {
            const Icon = item.icon;
            const isSelected = value === item.key;

            return (
              <button
                key={item.key}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => handleSelect(item.key)}
                className={designSystem.cn(
                  "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm cursor-pointer",
                  "hover:bg-accent hover:text-accent-foreground",
                  isSelected && "bg-accent text-accent-foreground"
                )}
              >
                <Icon className={designSystem.cn(iconSizes.sm, "text-muted-foreground shrink-0")} />
                <span className="flex-1 text-left">{item.label}</span>
                {isSelected && (
                  <Check className={designSystem.cn(iconSizes.sm, "text-primary shrink-0")} />
                )}
              </button>
            );
          })}
        </div>

        {/* Add Custom Type Section */}
        <div className="border-t p-1">
          {isAddingCustom ? (
            <div className="flex items-center gap-2 px-2 py-1">
              <Input
                ref={customInputRef}
                type="text"
                value={customTypeInput}
                onChange={e => setCustomTypeInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddCustomType();
                  }
                  if (e.key === 'Escape') {
                    setIsAddingCustom(false);
                    setCustomTypeInput('');
                  }
                }}
                placeholder={t('relationships.form.placeholders.newTypeName', {
                  defaultValue: 'Όνομα νέου τύπου...'
                })}
                className="h-8 text-sm flex-1"
              />
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={handleAddCustomType}
                disabled={!customTypeInput.trim()}
                className="h-8 px-2"
              >
                <Check className={iconSizes.sm} />
              </Button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsAddingCustom(true)}
              className={designSystem.cn(
                "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm cursor-pointer",
                "hover:bg-accent hover:text-accent-foreground",
                "text-primary"
              )}
            >
              <Plus className={designSystem.cn(iconSizes.sm, "shrink-0")} />
              <span>{t('relationships.form.addCustomType', {
                defaultValue: 'Προσθήκη νέου τύπου'
              })}</span>
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default RelationshipTypeCombobox;
