'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
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
  MapPin,
  Check,
  Loader2
} from 'lucide-react';
import { PHOTO_COLORS } from '@/components/generic/config/photo-config';
// 🏢 ENTERPRISE: Centralized entity icons (ZERO hardcoded values)
import { NAVIGATION_ENTITIES } from '@/components/navigation/config';

// 🏢 ENTERPRISE: Import centralized contact types and type guards
import type {
  ContactType,
  IndividualContact,
  CompanyContact,
  ServiceContact
} from '@/types/contacts';
import {
  isIndividualContact,
  isCompanyContact,
  isServiceContact
} from '@/types/contacts';
import { getEmployeeSelectorCardStyle } from '@/constants/contacts';

// ============================================================================
// 🏢 ENTERPRISE: TYPES & INTERFACES
// ============================================================================

export interface ContactSummary {
  id: string;
  name: string;
  type: ContactType;
  email?: string;
  phone?: string;
  address?: string;
  company?: string; // For individual contacts
  department?: string; // For individual contacts
  avatar?: string;
  lastActivity?: string;
}

interface EmployeeSelectorProps {
  /** Current selected contact ID */
  value?: string;
  /** Callback when contact is selected */
  onContactSelect: (contact: ContactSummary | null) => void;
  /** Placeholder text for search input */
  placeholder?: string;
  /** Filter by contact types (default: all types) */
  allowedContactTypes?: ContactType[];
  /** Exclude specific contact IDs from results */
  excludeContactIds?: string[];
  /** Read-only mode (displays selected contact but no searching) */
  readonly?: boolean;
  /** Custom label for the selector */
  label?: string;
  /** Required field indicator */
  required?: boolean;
  /** Error state */
  error?: string;
  /** Custom CSS classes */
  className?: string;
  /** Maximum number of search results to show */
  maxResults?: number;
}

// ============================================================================
// 🏢 ENTERPRISE: REAL CONTACTS SERVICE INTEGRATION
// ============================================================================

import { ContactsService } from '@/services/contacts.service';

const realContactSearch = async (query: string, filters: {
  allowedTypes?: ContactType[];
  excludeIds?: string[];
  maxResults?: number;
}): Promise<ContactSummary[]> => {
  try {
    console.log('🔍 EMPLOYEE SELECTOR: Searching contacts with query:', query, 'filters:', filters);

    // Get all contacts from database
    const result = await ContactsService.getAllContacts();
    const allContacts = result?.contacts || [];
    console.log('🔍 EMPLOYEE SELECTOR: Found', allContacts.length, 'total contacts in database');

    if (!Array.isArray(allContacts)) {
      console.error('❌ EMPLOYEE SELECTOR: ContactsService.getAllContacts() returned invalid contacts array:', result);
      return [];
    }

    // Convert to ContactSummary format with proper type checking
    let filtered = allContacts.map(contact => {
      let name = '';
      let company: string | undefined;
      let department: string | undefined;

      // 🏢 ENTERPRISE: Type-safe name extraction using type guards
      if (isIndividualContact(contact)) {
        name = `${contact.firstName || ''} ${contact.lastName || ''}`.trim();
        company = contact.employer || '';
        department = contact.position || '';
      } else if (isCompanyContact(contact)) {
        name = contact.companyName || '';
      } else if (isServiceContact(contact)) {
        name = contact.serviceName || '';
      }

      const summary: ContactSummary = {
        id: contact.id ?? '',
        name,
        type: contact.type,
        email: contact.emails?.[0]?.email || '',
        phone: contact.phones?.[0]?.number || '',
        company,
        department,
        lastActivity: contact.updatedAt ? new Date(contact.updatedAt).toISOString().split('T')[0] : undefined
      };
      return summary;
    }).filter(contact => contact.name.length > 0); // Only contacts with names

    console.log('🔍 EMPLOYEE SELECTOR: After mapping, have', filtered.length, 'valid contacts');

    // Filter by query (name, email, company)
    if (query.trim()) {
      const searchTerm = query.toLowerCase();
      filtered = filtered.filter(contact =>
        contact.name.toLowerCase().includes(searchTerm) ||
        contact.email?.toLowerCase().includes(searchTerm) ||
        contact.company?.toLowerCase().includes(searchTerm) ||
        contact.department?.toLowerCase().includes(searchTerm)
      );
      console.log('🔍 EMPLOYEE SELECTOR: After text filter, have', filtered.length, 'matching contacts');
    }

    // Filter by contact type
    if (filters.allowedTypes?.length) {
      filtered = filtered.filter(contact =>
        filters.allowedTypes!.includes(contact.type)
      );
      console.log('🔍 EMPLOYEE SELECTOR: After type filter, have', filtered.length, 'contacts');
    }

    // Exclude specific IDs
    if (filters.excludeIds?.length) {
      filtered = filtered.filter(contact =>
        !filters.excludeIds!.includes(contact.id)
      );
      console.log('🔍 EMPLOYEE SELECTOR: After excluding IDs, have', filtered.length, 'contacts');
    }

    // Limit results
    if (filters.maxResults) {
      filtered = filtered.slice(0, filters.maxResults);
      console.log('🔍 EMPLOYEE SELECTOR: After limit, returning', filtered.length, 'contacts');
    }

    return filtered;
  } catch (error) {
    console.error('❌ EMPLOYEE SELECTOR: Failed to search contacts:', error);
    return [];
  }
};

const getContactById = async (id: string): Promise<ContactSummary | null> => {
  const results = await realContactSearch('', { excludeIds: [], maxResults: 100 });
  return results.find(contact => contact.id === id) || null;
};

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

  // ============================================================================
  // 🏢 ENTERPRISE: STATE MANAGEMENT
  // ============================================================================

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ContactSummary[]>([]);
  const [selectedContact, setSelectedContact] = useState<ContactSummary | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number; width: number } | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // ============================================================================
  // 🏢 ENTERPRISE: EFFECTS
  // ============================================================================

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
          setHighlightedIndex(prev =>
            prev < searchResults.length - 1 ? prev + 1 : 0
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setHighlightedIndex(prev =>
            prev > 0 ? prev - 1 : searchResults.length - 1
          );
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

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        searchInputRef.current &&
        !searchInputRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Update dropdown position on scroll/resize
  useEffect(() => {
    const handleResize = () => {
      if (showDropdown) {
        updateDropdownPosition();
      }
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleResize);
    };
  }, [showDropdown]);


  // ✅ CLEAN SOLUTION: Background colors handled directly in renderContactItem with inline styles

  // ============================================================================
  // 🏢 ENTERPRISE: HANDLERS
  // ============================================================================

  const loadSelectedContact = async (contactId: string) => {
    try {
      const contact = await getContactById(contactId);
      setSelectedContact(contact);
    } catch (error) {
      console.error('Error loading selected contact:', error);
    }
  };

  const performSearch = async (query: string) => {
    try {
      console.log('🔍 EMPLOYEE SELECTOR: performSearch called with query:', query);
      console.log('🔍 EMPLOYEE SELECTOR: Search filters:', {
        allowedTypes: allowedContactTypes,
        excludeIds: excludeContactIds,
        maxResults
      });

      setIsSearching(true);
      const results = await realContactSearch(query, {
        allowedTypes: allowedContactTypes,
        excludeIds: excludeContactIds,
        maxResults
      });

      console.log('🔍 EMPLOYEE SELECTOR: Search completed, got', results.length, 'results');
      console.log('🔍 EMPLOYEE SELECTOR: Results:', results);

      setSearchResults(results);
      setHighlightedIndex(-1);
    } catch (error) {
      console.error('❌ EMPLOYEE SELECTOR: Search failed:', error);
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

      // ✅ ENTERPRISE: Use centralized dropdown positioning (NO inline styles)
      layoutUtilities.dropdown.setCSSPositioning(position, 75);
      setDropdownPosition(position);
    }
  };

  const handleInputFocus = () => {
    if (!readonly) {
      updateDropdownPosition();
      setShowDropdown(true);
      if (searchResults.length === 0) {
        performSearch(''); // Load initial results
      }
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    if (!showDropdown) {
      setShowDropdown(true);
    }
  };

  // ============================================================================
  // 🏢 ENTERPRISE: RENDER HELPERS
  // ============================================================================

  // 🏢 ENTERPRISE: Using centralized entity icons
  const getContactIcon = (type: ContactType) => {
    switch (type) {
      case 'company':
        return NAVIGATION_ENTITIES.company.icon;
      case 'service':
        return NAVIGATION_ENTITIES.building.icon;
      default:
        return User;
    }
  };

  const getContactTypeLabel = (type: ContactType) => {
    switch (type) {
      case 'company':
        return t('contactTypes.company');
      case 'service':
        return t('contactTypes.service');
      default:
        return t('contactTypes.individual');
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
              <div className="flex items-center space-x-3 text-xs text-muted-foreground">
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

  const renderSelectedContact = () => {
    if (!selectedContact) return null;

    const Icon = getContactIcon(selectedContact.type);

    return (
      <div className={`flex items-center justify-between p-3 ${colors.bg.info} ${quick.selected}`}>
        <div className="flex items-center space-x-3 flex-1 min-w-0">
          <Icon className={`${iconSizes.md} ${colors.text.info} flex-shrink-0`} />

          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2">
              <h4 className="text-sm font-medium text-foreground truncate">
                {selectedContact.name}
              </h4>
              <Badge className={`bg-accent text-accent-foreground ${quick.info} text-xs`}>
                {getContactTypeLabel(selectedContact.type)}
              </Badge>
            </div>

            {(selectedContact.company || selectedContact.department) && (
              <div className="text-xs text-muted-foreground mt-1 truncate">
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
      {/* Label */}
      {label && (
        <Label className="text-sm font-medium">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </Label>
      )}

      {/* Selected Contact Display or Search Input */}
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
          {/* Search Input */}
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
              <Loader2 className={`absolute right-3 top-1/2 transform -translate-y-1/2 ${colors.text.muted} ${iconSizes.sm} animate-spin`} />
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

          {/* Dropdown Results - Using Portal for proper z-index */}
          {showDropdown && dropdownPosition && typeof document !== 'undefined' && createPortal(
            <Card
              ref={dropdownRef}
              className={cn(
                `shadow-xl ${colors.bg.primary} ${quick.card}`,
                // ✅ ENTERPRISE: Use centralized dropdown classes (NO inline styles)
                layoutUtilities.dropdown.getDropdownClasses('default')
              )}
            >
              <CardContent className={getEmployeeSelectorCardStyle()}>
                {isSearching ? (
                  <div className="p-4 text-center text-muted-foreground">
                    <Loader2 className={`${iconSizes.lg} animate-spin mx-auto mb-2`} />
                    <span className="text-sm">{t('placeholders.searching')}</span>
                  </div>
                ) : searchResults.length > 0 ? (
                  <div className="max-h-64 overflow-y-auto">
                    {searchResults.map((contact, index) => renderContactItem(contact, index))}
                  </div>
                ) : (
                  <div className="p-4 text-center text-muted-foreground">
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

      {/* Error Message */}
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      {/* Help Text */}
      {!readonly && !error && (
        <p className={`text-xs ${colors.text.muted}`}>
          {t('placeholders.keyboardNav')}
        </p>
      )}
    </div>
  );
};

export default EmployeeSelector;

