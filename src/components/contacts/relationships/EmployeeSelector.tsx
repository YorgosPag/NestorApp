'use client';

// ============================================================================
// 🏢 ENTERPRISE: EMPLOYEE SELECTOR COMPONENT
// ============================================================================
//
// 🎯 PURPOSE: Searchable contact selector with portal dropdown
// 🔗 SERVICE: employee-selector.service.ts (search logic)
// 🏢 STANDARDS: Enterprise UI patterns, centralized design tokens
//
// SRP-compliant: UI only, service handles data fetching (ADR N.7.1)
// ============================================================================

import React, { useState, useEffect, useRef } from 'react';
import { useClickOutside } from '@/hooks/useClickOutside';
import { formatDateShort } from '@/lib/intl-utils';
import { createModuleLogger } from '@/lib/telemetry';
import { createPortal } from 'react-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { cn, getStatusColor } from '@/lib/design-system';
import { INTERACTIVE_PATTERNS, TRANSITION_PRESETS, HOVER_TEXT_EFFECTS, HOVER_BACKGROUND_EFFECTS } from '@/components/ui/effects';
import { useIconSizes } from '@/hooks/useIconSizes';
import { layoutUtilities } from '@/styles/design-tokens';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  Search,
  X,
  User,
} from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { NAVIGATION_ENTITIES } from '@/components/navigation/config';
import type { ContactType } from '@/types/contacts';
import { getEmployeeSelectorCardStyle } from '@/constants/contacts';
import {
  type ContactSummary,
  searchContacts,
  getContactById,
} from './employee-selector.service';

// Re-export for backward compatibility
export type { ContactSummary };

// ============================================================================
// 🏢 ENTERPRISE: PROPS INTERFACE
// ============================================================================

interface EmployeeSelectorProps {
  value?: string;
  onContactSelect: (contact: ContactSummary | null) => void;
  placeholder?: string;
  allowedContactTypes?: ContactType[];
  excludeContactIds?: string[];
  readonly?: boolean;
  label?: string;
  required?: boolean;
  error?: string;
  className?: string;
  maxResults?: number;
}

const logger = createModuleLogger('EmployeeSelector');

// ============================================================================
// 🏢 ENTERPRISE: MAIN COMPONENT
// ============================================================================

export const EmployeeSelector: React.FC<EmployeeSelectorProps> = ({
  value,
  onContactSelect,
  placeholder,
  allowedContactTypes = ['individual', 'company', 'service'],
  excludeContactIds = [],
  readonly = false,
  label,
  required = false,
  error,
  className = '',
  maxResults = 50
}) => {
  const { t } = useTranslation('common');
  const iconSizes = useIconSizes();
  const { quick } = useBorderTokens();
  const colors = useSemanticColors();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ContactSummary[]>([]);
  const [selectedContact, setSelectedContact] = useState<ContactSummary | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number; width: number } | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load selected contact on value change
  useEffect(() => {
    if (value && value !== selectedContact?.id) {
      loadSelectedContact(value);
    } else if (!value) {
      setSelectedContact(null);
    }
  }, [value]);

  // Search debouncing
  useEffect(() => {
    if (!showDropdown || readonly) return;
    const debounceTimer = setTimeout(() => {
      performSearch(searchQuery);
    }, 300);
    return () => clearTimeout(debounceTimer);
  }, [searchQuery, showDropdown]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!showDropdown || searchResults.length === 0) return;
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setHighlightedIndex(prev => prev < searchResults.length - 1 ? prev + 1 : 0);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setHighlightedIndex(prev => prev > 0 ? prev - 1 : searchResults.length - 1);
          break;
        case 'Enter':
          e.preventDefault();
          if (highlightedIndex >= 0 && highlightedIndex < searchResults.length) {
            selectContact(searchResults[highlightedIndex]);
          }
          break;
        case 'Escape':
          setShowDropdown(false);
          setHighlightedIndex(-1);
          break;
      }
    };
    if (showDropdown) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showDropdown, searchResults, highlightedIndex]);

  useClickOutside([dropdownRef, searchInputRef], () => setShowDropdown(false));

  // Update dropdown position on scroll/resize
  useEffect(() => {
    const handleResize = () => {
      if (showDropdown) updateDropdownPosition();
    };
    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleResize);
    };
  }, [showDropdown]);

  // ============================================================================
  // 🏢 ENTERPRISE: HANDLERS
  // ============================================================================

  const loadSelectedContact = async (contactId: string) => {
    try {
      const contact = await getContactById(contactId);
      setSelectedContact(contact);
    } catch (err) {
      logger.error('Error loading selected contact', { error: err });
    }
  };

  const performSearch = async (query: string) => {
    try {
      setIsSearching(true);
      const results = await searchContacts(query, {
        allowedTypes: allowedContactTypes,
        excludeIds: excludeContactIds,
        maxResults
      });
      setSearchResults(results);
      setHighlightedIndex(-1);
    } catch (err) {
      logger.error('Search failed', { error: err });
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const selectContact = (contact: ContactSummary) => {
    setSelectedContact(contact);
    setSearchQuery('');
    setShowDropdown(false);
    setHighlightedIndex(-1);
    onContactSelect(contact);
  };

  const clearSelection = () => {
    setSelectedContact(null);
    setSearchQuery('');
    setShowDropdown(false);
    onContactSelect(null);
  };

  const updateDropdownPosition = () => {
    if (searchInputRef.current) {
      const rect = searchInputRef.current.getBoundingClientRect();
      const position = {
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width
      };
      layoutUtilities.dropdown.setCSSPositioning(position, 75);
      setDropdownPosition(position);
    }
  };

  const handleInputFocus = () => {
    if (!readonly) {
      updateDropdownPosition();
      setShowDropdown(true);
      if (searchResults.length === 0) {
        performSearch('');
      }
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    if (!showDropdown) setShowDropdown(true);
  };

  // ============================================================================
  // 🏢 ENTERPRISE: RENDER HELPERS
  // ============================================================================

  const getContactIcon = (type: ContactType) => {
    switch (type) {
      case 'company': return NAVIGATION_ENTITIES.company.icon;
      case 'service': return NAVIGATION_ENTITIES.building.icon;
      default: return User;
    }
  };

  const getContactTypeLabel = (type: ContactType) => {
    switch (type) {
      case 'company': return t('contactTypes.company');
      case 'service': return t('contactTypes.service');
      default: return t('contactTypes.individual');
    }
  };

  const renderContactItem = (contact: ContactSummary, index: number) => {
    const Icon = getContactIcon(contact.type);
    const isHighlighted = index === highlightedIndex;
    return (
      <div
        key={contact.id}
        data-dropdown-contact-item="true"
        className={cn(
          "p-3 border-b border-border last:border-b-0 cursor-pointer",
          TRANSITION_PRESETS.STANDARD_COLORS,
          isHighlighted ? 'bg-accent text-accent-foreground' : INTERACTIVE_PATTERNS.ACCENT_HOVER
        )}
        onClick={() => selectContact(contact)}
        onMouseEnter={() => setHighlightedIndex(index)}
      >
        <div className="flex items-start space-x-2">
          <Icon className={`${iconSizes.md} ${colors.text.muted} mt-0.5 flex-shrink-0`} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-foreground truncate">{contact.name}</h4>
              <Badge variant="outline" className="ml-2 text-xs">
                {getContactTypeLabel(contact.type)}
              </Badge>
            </div>
            {(contact.company || contact.department) && (
              <div className={cn("flex items-center space-x-2 mt-1 text-xs", colors.text.muted)}>
                {contact.company && (
                  <>
                    <NAVIGATION_ENTITIES.building.icon className={cn(iconSizes.xs, NAVIGATION_ENTITIES.building.color)} />
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
              <div className={cn("flex items-center space-x-2 text-xs", colors.text.muted)}>
                {contact.email && (
                  <div className="flex items-center space-x-1">
                    <NAVIGATION_ENTITIES.email.icon className={cn(iconSizes.xs, NAVIGATION_ENTITIES.email.color)} />
                    <span className="truncate">{contact.email}</span>
                  </div>
                )}
                {contact.phone && (
                  <div className="flex items-center space-x-1">
                    <NAVIGATION_ENTITIES.phone.icon className={cn(iconSizes.xs, NAVIGATION_ENTITIES.phone.color)} />
                    <span>{contact.phone}</span>
                  </div>
                )}
              </div>
              {contact.lastActivity && (
                <span className={cn("text-xs", colors.text.muted)}>
                  {formatDateShort(new Date(contact.lastActivity))}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderSelectedContact = () => {
    if (!selectedContact) return null;
    const Icon = getContactIcon(selectedContact.type);
    return (
      <div className={`flex items-center justify-between p-2 ${colors.bg.info} ${quick.selected}`}>
        <div className="flex items-center space-x-2 flex-1 min-w-0">
          <Icon className={`${iconSizes.md} ${colors.text.info} flex-shrink-0`} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2">
              <h4 className="text-sm font-medium text-foreground truncate">{selectedContact.name}</h4>
              <Badge className={`bg-accent text-accent-foreground ${quick.info} text-xs`}>
                {getContactTypeLabel(selectedContact.type)}
              </Badge>
            </div>
            {(selectedContact.company || selectedContact.department) && (
              <div className={cn("text-xs mt-1 truncate", colors.text.muted)}>
                {selectedContact.company}
                {selectedContact.company && selectedContact.department && ' • '}
                {selectedContact.department}
              </div>
            )}
          </div>
        </div>
        {!readonly && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearSelection}
            className={cn(
              `${iconSizes.xl} p-0 flex-shrink-0`,
              HOVER_TEXT_EFFECTS.BLUE,
              HOVER_BACKGROUND_EFFECTS.BLUE_LIGHT
            )}
          >
            <X className={iconSizes.sm} />
          </Button>
        )}
      </div>
    );
  };

  // ============================================================================
  // 🏢 ENTERPRISE: MAIN RENDER
  // ============================================================================

  return (
    <div className={`relative space-y-2 ${className}`}>
      {label && (
        <Label className="text-sm font-medium">
          {label}
          {required && <span className={`${getStatusColor('error', 'text')} ml-1`}>*</span>}
        </Label>
      )}
      {selectedContact && readonly ? (
        renderSelectedContact()
      ) : selectedContact ? (
        <div>
          {renderSelectedContact()}
          {!readonly && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSelectedContact(null);
                onContactSelect(null);
                setShowDropdown(true);
              }}
              className="mt-2 text-sm"
            >
              {t('buttons.changeSelection')}
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="relative">
            <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 ${colors.text.muted} ${iconSizes.sm}`} />
            <Input
              ref={searchInputRef}
              value={searchQuery}
              onChange={handleInputChange}
              onFocus={handleInputFocus}
              placeholder={placeholder ?? t('placeholders.searchContact')}
              className={`pl-10 pr-10 ${error ? quick.error : ''}`}
              disabled={readonly}
            />
            {isSearching && (
              <Spinner size="small" className="absolute right-3 top-1/2 transform -translate-y-1/2" />
            )}
            {searchQuery && !isSearching && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSearchQuery('')}
                className={`absolute right-1 top-1/2 transform -translate-y-1/2 ${iconSizes.lg} p-0`}
              >
                <X className={iconSizes.sm} />
              </Button>
            )}
          </div>
          {showDropdown && dropdownPosition && typeof document !== 'undefined' && createPortal(
            <Card
              ref={dropdownRef}
              className={cn(
                `shadow-xl ${colors.bg.primary} ${quick.card}`,
                layoutUtilities.dropdown.getDropdownClasses('default')
              )}
            >
              <CardContent className={getEmployeeSelectorCardStyle()}>
                {isSearching ? (
                  <div className={cn("p-4 text-center", colors.text.muted)}>
                    <Spinner size="large" className="mx-auto mb-2" />
                    <span className="text-sm">{t('placeholders.searching')}</span>
                  </div>
                ) : searchResults.length > 0 ? (
                  <div className="max-h-64 overflow-y-auto">
                    {searchResults.map((contact, index) => renderContactItem(contact, index))}
                  </div>
                ) : (
                  <div className={cn("p-4 text-center", colors.text.muted)}>
                    <Search className={`${iconSizes.lg} mx-auto mb-2`} />
                    <span className="text-sm">
                      {searchQuery ? t('placeholders.noResults') : t('placeholders.startTyping')}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>,
            document.body
          )}
        </>
      )}
      {error && (
        <p className={`text-sm ${getStatusColor('error', 'text')}`}>{error}</p>
      )}
      {!readonly && !error && (
        <p className={`text-xs ${colors.text.muted}`}>
          {t('placeholders.keyboardNav')}
        </p>
      )}
    </div>
  );
};

export default EmployeeSelector;
