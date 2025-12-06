'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Search,
  X,
  User,
  Building2,
  Phone,
  Mail,
  MapPin,
  Check,
  ChevronDown,
  ChevronUp,
  Loader2
} from 'lucide-react';

// 🏢 ENTERPRISE: Import centralized contact types
import type { ContactType } from '@/types/contacts';

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
// 🏢 ENTERPRISE: MOCK DATA SERVICE
// ============================================================================
// This will be replaced with actual API calls in production

const mockContactSearch = async (query: string, filters: {
  allowedTypes?: ContactType[];
  excludeIds?: string[];
  maxResults?: number;
}): Promise<ContactSummary[]> => {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 300));

  const mockContacts: ContactSummary[] = [
    {
      id: '1',
      name: 'Γιάννης Παπαδόπουλος',
      type: 'individual',
      email: 'giannis.papadopoulos@example.com',
      phone: '+30 210 1234567',
      company: 'Τεχνολογικές Λύσεις ΑΕ',
      department: 'Πληροφορικής',
      lastActivity: '2024-12-05'
    },
    {
      id: '2',
      name: 'Μαρία Νικολάου',
      type: 'individual',
      email: 'maria.nikolaou@example.com',
      phone: '+30 210 2345678',
      company: 'Δημόσια Υπηρεσία Α',
      department: 'Διοικητικού',
      lastActivity: '2024-12-04'
    },
    {
      id: '3',
      name: 'Τεχνολογικές Λύσεις ΑΕ',
      type: 'company',
      email: 'info@techsolutions.gr',
      phone: '+30 210 3456789',
      address: 'Βασιλίσσης Σοφίας 123, Αθήνα',
      lastActivity: '2024-12-03'
    },
    {
      id: '4',
      name: 'Υπηρεσία Πολεοδομίας Αθήνας',
      type: 'service',
      email: 'info@cityplanning.athens.gov.gr',
      phone: '+30 213 1357911',
      address: 'Πατησίων 85, Αθήνα',
      lastActivity: '2024-12-02'
    },
    {
      id: '5',
      name: 'Κώστας Γεωργίου',
      type: 'individual',
      email: 'kostas.georgiou@example.com',
      phone: '+30 210 4567890',
      company: 'Υπηρεσία Πολεοδομίας Αθήνας',
      department: 'Τεχνικού',
      lastActivity: '2024-12-01'
    }
  ];

  // Filter by query (name, email, company)
  let filtered = mockContacts.filter(contact => {
    if (!query.trim()) return true;
    const searchTerm = query.toLowerCase();
    return (
      contact.name.toLowerCase().includes(searchTerm) ||
      contact.email?.toLowerCase().includes(searchTerm) ||
      contact.company?.toLowerCase().includes(searchTerm) ||
      contact.department?.toLowerCase().includes(searchTerm)
    );
  });

  // Apply filters
  if (filters.allowedTypes && filters.allowedTypes.length > 0) {
    filtered = filtered.filter(contact => filters.allowedTypes!.includes(contact.type));
  }

  if (filters.excludeIds && filters.excludeIds.length > 0) {
    filtered = filtered.filter(contact => !filters.excludeIds!.includes(contact.id));
  }

  // Limit results
  if (filters.maxResults) {
    filtered = filtered.slice(0, filters.maxResults);
  }

  return filtered;
};

const getContactById = async (id: string): Promise<ContactSummary | null> => {
  const results = await mockContactSearch('', { excludeIds: [], maxResults: 100 });
  return results.find(contact => contact.id === id) || null;
};

// ============================================================================
// 🏢 ENTERPRISE: MAIN COMPONENT
// ============================================================================

export const EmployeeSelector: React.FC<EmployeeSelectorProps> = ({
  value,
  onContactSelect,
  placeholder = 'Αναζήτηση επαφής...',
  allowedContactTypes = ['individual', 'company', 'service'],
  excludeContactIds = [],
  readonly = false,
  label,
  required = false,
  error,
  className = '',
  maxResults = 10
}) => {
  // ============================================================================
  // 🏢 ENTERPRISE: STATE MANAGEMENT
  // ============================================================================

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ContactSummary[]>([]);
  const [selectedContact, setSelectedContact] = useState<ContactSummary | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

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
      setIsSearching(true);
      const results = await mockContactSearch(query, {
        allowedTypes: allowedContactTypes,
        excludeIds: excludeContactIds,
        maxResults
      });
      setSearchResults(results);
      setHighlightedIndex(-1);
    } catch (error) {
      console.error('Search error:', error);
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

  const handleInputFocus = () => {
    if (!readonly) {
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

  const getContactIcon = (type: ContactType) => {
    switch (type) {
      case 'company':
        return Building2;
      case 'service':
        return Building2;
      default:
        return User;
    }
  };

  const getContactTypeLabel = (type: ContactType) => {
    switch (type) {
      case 'company':
        return 'Εταιρεία';
      case 'service':
        return 'Υπηρεσία';
      default:
        return 'Άτομο';
    }
  };

  const renderContactItem = (contact: ContactSummary, index: number) => {
    const Icon = getContactIcon(contact.type);
    const isHighlighted = index === highlightedIndex;

    return (
      <div
        key={contact.id}
        className={`p-3 cursor-pointer border-b last:border-b-0 hover:bg-gray-50 transition-colors ${
          isHighlighted ? 'bg-blue-50 border-blue-200' : ''
        }`}
        onClick={() => selectContact(contact)}
        onMouseEnter={() => setHighlightedIndex(index)}
      >
        <div className="flex items-start space-x-3">
          <Icon className="h-5 w-5 text-gray-500 mt-0.5 flex-shrink-0" />

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-gray-900 truncate">
                {contact.name}
              </h4>
              <Badge variant="outline" className="ml-2 text-xs">
                {getContactTypeLabel(contact.type)}
              </Badge>
            </div>

            {(contact.company || contact.department) && (
              <div className="flex items-center space-x-2 mt-1 text-xs text-gray-600">
                {contact.company && (
                  <>
                    <Building2 className="h-3 w-3" />
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
              <div className="flex items-center space-x-3 text-xs text-gray-500">
                {contact.email && (
                  <div className="flex items-center space-x-1">
                    <Mail className="h-3 w-3" />
                    <span className="truncate">{contact.email}</span>
                  </div>
                )}
                {contact.phone && (
                  <div className="flex items-center space-x-1">
                    <Phone className="h-3 w-3" />
                    <span>{contact.phone}</span>
                  </div>
                )}
              </div>

              {contact.lastActivity && (
                <span className="text-xs text-gray-400">
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
      <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-md">
        <div className="flex items-center space-x-3 flex-1 min-w-0">
          <Icon className="h-5 w-5 text-blue-600 flex-shrink-0" />

          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2">
              <h4 className="text-sm font-medium text-blue-900 truncate">
                {selectedContact.name}
              </h4>
              <Badge className="bg-blue-100 text-blue-800 border-blue-300 text-xs">
                {getContactTypeLabel(selectedContact.type)}
              </Badge>
            </div>

            {(selectedContact.company || selectedContact.department) && (
              <div className="text-xs text-blue-700 mt-1 truncate">
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
            className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-100 flex-shrink-0"
          >
            <X className="h-4 w-4" />
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
              Αλλαγή επιλογής
            </Button>
          )}
        </div>
      ) : (
        <>
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              ref={searchInputRef}
              value={searchQuery}
              onChange={handleInputChange}
              onFocus={handleInputFocus}
              placeholder={placeholder}
              className={`pl-10 pr-10 ${error ? 'border-red-500' : ''}`}
              disabled={readonly}
            />
            {isSearching && (
              <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 animate-spin" />
            )}
            {searchQuery && !isSearching && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSearchQuery('')}
                className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
              >
                <X className="w-4 h-4" />
              </Button>
            )}
            {showDropdown && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                {showDropdown ? (
                  <ChevronUp className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                )}
              </div>
            )}
          </div>

          {/* Dropdown Results */}
          {showDropdown && (
            <Card
              ref={dropdownRef}
              className="absolute z-50 w-full mt-1 shadow-lg border border-gray-200 bg-white"
            >
              <CardContent className="p-0">
                {isSearching ? (
                  <div className="p-4 text-center text-gray-500">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                    <span className="text-sm">Αναζήτηση...</span>
                  </div>
                ) : searchResults.length > 0 ? (
                  <ScrollArea className="max-h-80">
                    {searchResults.map((contact, index) => renderContactItem(contact, index))}
                  </ScrollArea>
                ) : (
                  <div className="p-4 text-center text-gray-500">
                    <Search className="h-6 w-6 mx-auto mb-2 text-gray-300" />
                    <span className="text-sm">
                      {searchQuery ? 'Δεν βρέθηκαν αποτελέσματα' : 'Ξεκινήστε να πληκτρολογείτε για αναζήτηση'}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Error Message */}
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      {/* Help Text */}
      {!readonly && !error && (
        <p className="text-xs text-gray-500">
          Χρησιμοποιήστε τα βελάκια ↑↓ για πλοήγηση και Enter για επιλογή
        </p>
      )}
    </div>
  );
};

export default EmployeeSelector;