"use client";

/**
 * =============================================================================
 * ENTERPRISE CONTACT DROPDOWN
 * =============================================================================
 *
 * Searchable contact dropdown using Radix Popover for positioning.
 * NO INLINE STYLES - uses design system tokens only.
 *
 * @module components/ui/enterprise-contact-dropdown
 * @enterprise ADR-030 - Zero Hardcoded Values
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronDown, Search, Mail, Phone, Building2, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useIconSizes } from '@/hooks/useIconSizes';
import { INTERACTIVE_PATTERNS, TRANSITION_PRESETS } from '@/components/ui/effects';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

// ============================================================================
// TYPES
// ============================================================================

export interface ContactSummary {
  id: string;
  name: string;
  type: 'individual' | 'company' | 'service';
  email?: string;
  phone?: string;
  company?: string;
  department?: string;
  lastActivity?: string;
}

export interface EnterpriseContactDropdownProps {
  value: string;
  onContactSelect: (contact: ContactSummary | null) => void;
  searchResults: ContactSummary[];
  onSearch: (query: string) => void;
  isSearching: boolean;
  label?: string;
  placeholder?: string;
  allowedContactTypes?: ('individual' | 'company' | 'service')[];
  excludeContactIds?: string[];
  required?: boolean;
  error?: string;
  className?: string;
  readonly?: boolean;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getContactIcon(type: string) {
  switch (type) {
    case 'company':
    case 'service':
      return Building2;
    case 'individual':
    default:
      return Mail;
  }
}

// 🏢 ENTERPRISE: Contact type label function moved inside component for i18n access

// ============================================================================
// COMPONENT
// ============================================================================

export const EnterpriseContactDropdown: React.FC<EnterpriseContactDropdownProps> = ({
  value,
  onContactSelect,
  searchResults,
  onSearch,
  isSearching,
  label,
  placeholder,
  required = false,
  error,
  className,
  readonly = false
}) => {
  const { t } = useTranslation('common');
  const iconSizes = useIconSizes();
  const { quick } = useBorderTokens();
  const colors = useSemanticColors();

  // 🏢 ENTERPRISE: i18n-aware contact type label function
  const getContactTypeLabel = (type: string): string => {
    return t(`contactTypes.${type}`, type);
  };

  // 🏢 ENTERPRISE: Use translations for default values
  const displayLabel = label ?? t('labels.contact');
  const displayPlaceholder = placeholder ?? t('placeholders.searchContacts');

  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const inputRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout>();
  const resultsRef = useRef<HTMLDivElement>(null);

  // Get selected contact
  const selectedContact = searchResults.find(contact => contact.id === value);

  // Handle search input change with debounce
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    setHighlightedIndex(-1);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      onSearch(query);
    }, 150);
  }, [onSearch]);

  // Handle contact selection
  const selectContact = useCallback((contact: ContactSummary) => {
    onContactSelect(contact);
    setIsOpen(false);
    setSearchQuery('');
  }, [onContactSelect]);

  // Handle clear selection
  const clearSelection = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onContactSelect(null);
    setSearchQuery('');
  }, [onContactSelect]);

  // Handle open state change
  const handleOpenChange = useCallback((open: boolean) => {
    if (readonly) return;
    setIsOpen(open);
    if (open) {
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  }, [readonly]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (searchResults.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => {
        const newIndex = prev < searchResults.length - 1 ? prev + 1 : 0;
        setTimeout(() => {
          const element = resultsRef.current?.querySelector(`[data-contact-index="${newIndex}"]`);
          element?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }, 0);
        return newIndex;
      });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => {
        const newIndex = prev > 0 ? prev - 1 : searchResults.length - 1;
        setTimeout(() => {
          const element = resultsRef.current?.querySelector(`[data-contact-index="${newIndex}"]`);
          element?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }, 0);
        return newIndex;
      });
    } else if (e.key === 'Enter' && highlightedIndex >= 0) {
      e.preventDefault();
      const contact = searchResults[highlightedIndex];
      if (contact) {
        selectContact(contact);
      }
    }
  }, [searchResults, highlightedIndex, selectContact]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  // Render contact item
  const renderContactItem = (contact: ContactSummary, index: number) => {
    const Icon = getContactIcon(contact.type);
    const isHighlighted = index === highlightedIndex;

    return (
      <div
        key={contact.id}
        data-contact-index={index}
        className={cn(
          "p-3 border-b border-border last:border-b-0 cursor-pointer",
          TRANSITION_PRESETS.STANDARD_COLORS,
          isHighlighted ? "bg-accent text-accent-foreground" : INTERACTIVE_PATTERNS.ACCENT_HOVER
        )}
        onClick={() => selectContact(contact)}
        onMouseEnter={() => setHighlightedIndex(index)}
        role="option"
        aria-selected={isHighlighted}
      >
        <div className="flex items-start space-x-3">
          <Icon className={`${iconSizes.md} text-muted-foreground mt-0.5 flex-shrink-0`} />

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-foreground truncate">
                {contact.name}
              </h4>
              <Badge variant="outline" className="ml-2 text-xs">
                {getContactTypeLabel(contact.type)}
              </Badge>
            </div>

            {(contact.company || contact.department) && (
              <div className="flex items-center space-x-2 mt-1 text-xs text-muted-foreground">
                {contact.company && (
                  <>
                    <Building2 className={iconSizes.xs} />
                    <span>{contact.company}</span>
                  </>
                )}
                {contact.department && (
                  <>
                    {contact.company && <span>•</span>}
                    <span>{contact.department}</span>
                  </>
                )}
              </div>
            )}

            <div className="flex items-center justify-between mt-2">
              <div className="flex items-center space-x-3 text-xs text-muted-foreground">
                {contact.email && (
                  <div className="flex items-center space-x-1">
                    <Mail className={iconSizes.xs} />
                    <span className="truncate">{contact.email}</span>
                  </div>
                )}
                {contact.phone && (
                  <div className="flex items-center space-x-1">
                    <Phone className={iconSizes.xs} />
                    <span>{contact.phone}</span>
                  </div>
                )}
              </div>

              {contact.lastActivity && (
                <span className="text-xs text-muted-foreground">
                  {new Date(contact.lastActivity).toLocaleDateString('el-GR')}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={cn("space-y-2", className)}>
      {/* Label */}
      {displayLabel && (
        <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
          {displayLabel}{required && '*'}
        </label>
      )}

      {/* Popover - Radix handles positioning automatically */}
      <Popover open={isOpen} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            disabled={readonly}
            className={cn(
              `w-full justify-between h-10 px-3 py-2 text-sm border ${colors.bg.primary}`,
              error ? "border-destructive" : "border-input",
              INTERACTIVE_PATTERNS.ACCENT_HOVER,
              "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            )}
            type="button"
            role="combobox"
            aria-expanded={isOpen}
          >
            <div className="flex items-center space-x-2 flex-1 text-left">
              {selectedContact ? (
                <>
                  <span className="text-foreground truncate">{selectedContact.name}</span>
                  <Badge variant="secondary" className="text-xs">
                    {getContactTypeLabel(selectedContact.type)}
                  </Badge>
                </>
              ) : (
                <span className="text-muted-foreground">{displayPlaceholder}</span>
              )}
            </div>

            <div className="flex items-center space-x-1">
              {selectedContact && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={clearSelection}
                      className={cn(
                        `${iconSizes.sm} rounded-sm flex items-center justify-center text-muted-foreground`,
                        INTERACTIVE_PATTERNS.SUBTLE_HOVER,
                        TRANSITION_PRESETS.STANDARD_COLORS
                      )}
                    >
                      <X className={iconSizes.xs} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{t('dropdown.clearSelection')}</TooltipContent>
                </Tooltip>
              )}
              <ChevronDown className={cn(
                iconSizes.sm,
                TRANSITION_PRESETS.STANDARD_TRANSFORM,
                isOpen ? "rotate-180" : ""
              )} />
            </div>
          </Button>
        </PopoverTrigger>

        <PopoverContent
          className={cn(
            "w-[var(--radix-popover-trigger-width)] min-w-[300px] max-w-[450px] p-0",
            quick.card
          )}
          align="start"
          sideOffset={4}
          onKeyDown={handleKeyDown}
        >
          {/* Search Input */}
          <div className="p-3 border-b border-border">
            <div className="relative">
              <Search className={`absolute left-2 top-2.5 ${iconSizes.sm} text-muted-foreground`} />
              <Input
                ref={inputRef}
                value={searchQuery}
                onChange={handleSearchChange}
                placeholder={t('placeholders.searchContacts')}
                className="pl-8"
              />
            </div>
          </div>

          {/* Results - Scrollable Area */}
          <div
            ref={resultsRef}
            className="max-h-[300px] overflow-y-auto overflow-x-hidden"
            role="listbox"
          >
            {isSearching ? (
              <div className="p-4 text-center text-muted-foreground">
                <Loader2 className={`${iconSizes.lg} mx-auto mb-2 animate-spin`} />
                <span className="text-sm">{t('placeholders.searching')}</span>
              </div>
            ) : searchResults.length > 0 ? (
              <>
                {searchResults.map((contact, index) => renderContactItem(contact, index))}
                {searchResults.length > 15 && (
                  <div className="p-3 text-center text-xs text-muted-foreground bg-muted/50 border-t border-border sticky bottom-0">
                    {t('dropdown.totalContacts', { count: searchResults.length })}
                  </div>
                )}
              </>
            ) : (
              <div className="p-4 text-center text-muted-foreground">
                <Search className={`${iconSizes.lg} mx-auto mb-2`} />
                <span className="text-sm">
                  {searchQuery ? t('placeholders.noResults') : t('placeholders.startTyping')}
                </span>
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {/* Error message */}
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  );
};

export default EnterpriseContactDropdown;
