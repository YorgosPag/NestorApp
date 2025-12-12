"use client";

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Search, Mail, Phone, Building2, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { INTERACTIVE_PATTERNS, TRANSITION_PRESETS } from '@/components/ui/effects';

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

export const EnterpriseContactDropdown: React.FC<EnterpriseContactDropdownProps> = ({
  value,
  onContactSelect,
  searchResults,
  onSearch,
  isSearching,
  label = "Επαφή",
  placeholder = "Αναζήτηση επαφής...",
  required = false,
  error,
  className,
  readonly = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [buttonRect, setButtonRect] = useState<DOMRect | null>(null);


  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout>();

  // Get selected contact
  const selectedContact = searchResults.find(contact => contact.id === value);

  // Contact type icons
  const getContactIcon = (type: string) => {
    switch (type) {
      case 'company': return Building2;
      case 'service': return Building2;
      case 'individual':
      default: return Mail;
    }
  };

  // Contact type labels
  const getContactTypeLabel = (type: string) => {
    switch (type) {
      case 'company': return 'Εταιρεία';
      case 'service': return 'Υπηρεσία';
      case 'individual':
      default: return 'Άτομο';
    }
  };

  // Handle search input change with debounce to prevent excessive API calls
  const handleSearchChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    setHighlightedIndex(-1);

    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Debounce the search to prevent excessive calls
    searchTimeoutRef.current = setTimeout(() => {
      onSearch(query);
    }, 150);
  }, [onSearch]);

  // Handle contact selection
  const selectContact = (contact: ContactSummary) => {
    onContactSelect(contact);
    setIsOpen(false);
    setSearchQuery('');
  };

  // Handle clear selection
  const clearSelection = (e: React.MouseEvent) => {
    e.stopPropagation();
    onContactSelect(null);
    setSearchQuery('');
  };

  // Handle button click
  const handleToggle = React.useCallback(() => {
    if (readonly) {
      return;
    }

    const newIsOpen = !isOpen;
    setIsOpen(newIsOpen);

    if (newIsOpen) {
      // Use requestAnimationFrame to ensure DOM is updated before focusing
      requestAnimationFrame(() => {
        if (inputRef.current) {
          inputRef.current.focus();
        }
      });
    }
  }, [isOpen, readonly]);

  // Measure button position when dropdown opens
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setButtonRect(rect);
    }
  }, [isOpen]);

  // Handle scroll/resize events with throttling to prevent infinite loops
  useEffect(() => {
    if (!isOpen || !buttonRef.current) return;

    let rafId: number;
    let isThrottling = false;

    const updateButtonPosition = () => {
      if (isThrottling) return;

      isThrottling = true;
      rafId = requestAnimationFrame(() => {
        if (buttonRef.current) {
          const rect = buttonRef.current.getBoundingClientRect();
          setButtonRect(prevRect => {
            // Only update if position actually changed significantly
            if (!prevRect ||
                Math.abs(prevRect.top - rect.top) > 5 ||
                Math.abs(prevRect.left - rect.left) > 5) {
              return rect;
            }
            return prevRect;
          });
        }
        isThrottling = false;
      });
    };

    // Throttled scroll handler
    const handleScroll = () => {
      updateButtonPosition();
    };

    // Throttled resize handler
    const handleResize = () => {
      updateButtonPosition();
    };

    // Add event listeners with passive flag to improve performance
    window.addEventListener('scroll', handleScroll, { passive: true, capture: true });
    window.addEventListener('resize', handleResize, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll, { capture: true });
      window.removeEventListener('resize', handleResize);
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
    };
  }, [isOpen]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard navigation with scroll support
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        return;
      }

      if (searchResults.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightedIndex(prev => {
          const newIndex = prev < searchResults.length - 1 ? prev + 1 : 0;
          // Scroll highlighted item into view
          setTimeout(() => {
            const highlightedElement = document.querySelector(`[data-contact-index="${newIndex}"]`);
            if (highlightedElement && dropdownRef.current) {
              highlightedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }
          }, 0);
          return newIndex;
        });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightedIndex(prev => {
          const newIndex = prev > 0 ? prev - 1 : searchResults.length - 1;
          // Scroll highlighted item into view
          setTimeout(() => {
            const highlightedElement = document.querySelector(`[data-contact-index="${newIndex}"]`);
            if (highlightedElement && dropdownRef.current) {
              highlightedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }
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
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, searchResults, highlightedIndex]);

  // Cleanup search timeout on unmount
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
      >
        <div className="flex items-start space-x-3">
          <Icon className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />

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
              <div className="flex items-center space-x-3 text-xs text-muted-foreground">
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
      {label && (
        <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
          {label}{required && '*'}
        </label>
      )}

      {/* Trigger Button */}
      <Button
        ref={buttonRef}
        variant="outline"
        onClick={handleToggle}
        disabled={readonly}
        className={cn(
          "w-full justify-between h-10 px-3 py-2 text-sm border bg-background",
          error ? "border-destructive" : "border-input",
          INTERACTIVE_PATTERNS.ACCENT_HOVER,
          "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        )}
        type="button"
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
            <span className="text-muted-foreground">{placeholder}</span>
          )}
        </div>

        {/* Right side controls */}
        <div className="flex items-center space-x-1">
          {selectedContact && (
            <button
              type="button"
              onClick={clearSelection}
              className={cn(
                "h-4 w-4 rounded-sm flex items-center justify-center text-muted-foreground hover:text-foreground",
                INTERACTIVE_PATTERNS.SUBTLE_HOVER,
                TRANSITION_PRESETS.STANDARD_COLORS
              )}
              title="Καθαρισμός επιλογής"
            >
              <X className="h-3 w-3" />
            </button>
          )}
          <ChevronDown className={cn(
            "h-4 w-4",
            TRANSITION_PRESETS.STANDARD_TRANSFORM,
            isOpen ? "rotate-180" : ""
          )} />
        </div>
      </Button>

      {/* Error message */}
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {/* Portal Dropdown - Positioned κάτω από το button */}
      {isOpen && buttonRect && typeof document !== 'undefined' && createPortal(
        <div
          ref={dropdownRef}
          className="fixed bg-popover text-popover-foreground border border-border rounded-lg shadow-lg z-[99999]"
          style={{
            top: buttonRect.bottom + 8,
            left: buttonRect.left,
            width: buttonRect.width,
            minWidth: '200px',
            maxHeight: '400px',
            overflow: 'hidden'
          }}
        >
          {/* Search Input */}
          <div className="p-3 border-b border-border">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                ref={inputRef}
                value={searchQuery}
                onChange={handleSearchChange}
                placeholder="Αναζήτηση επαφών..."
                className="pl-8"
              />
            </div>
          </div>

          {/* Results - Scrollable Area */}
          <div
            data-enterprise-contact-dropdown="true"
            className="overflow-y-scroll"
            style={{
              maxHeight: '300px',
              minHeight: '200px',
              scrollbarWidth: 'thin',
              scrollbarColor: '#cbd5e1 transparent',
              WebkitScrollbarWidth: '6px'
            }}
          >
                  {isSearching ? (
                    <div className="p-4 text-center text-muted-foreground">
                      <Loader2 className="h-6 w-6 mx-auto mb-2 animate-spin" />
                      <span className="text-sm">Αναζήτηση...</span>
                    </div>
                  ) : searchResults.length > 0 ? (
                    <>
                      {searchResults.map((contact, index) => renderContactItem(contact, index))}
                      {searchResults.length > 15 && (
                        <div className="p-3 text-center text-xs text-muted-foreground bg-muted/50 border-t border-border sticky bottom-0">
                          {searchResults.length} συνολικές επαφές - χρησιμοποιήστε scroll ή αναζήτηση για πλοήγηση
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="p-4 text-center text-muted-foreground">
                      <Search className="h-6 w-6 mx-auto mb-2" />
                      <span className="text-sm">
                        {searchQuery ? 'Δεν βρέθηκαν αποτελέσματα' : 'Ξεκινήστε να πληκτρολογείτε για αναζήτηση'}
                      </span>
                    </div>
                  )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default EnterpriseContactDropdown;