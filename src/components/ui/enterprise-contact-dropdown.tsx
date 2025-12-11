"use client";

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Search, Mail, Phone, Building2, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

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

  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    onSearch(query);
    setHighlightedIndex(-1);
  };

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
  const handleToggle = () => {
    if (readonly) {
      return;
    }

    if (!isOpen) {
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }, 100);
    }

    setIsOpen(!isOpen);
  };

  // Measure button position when dropdown opens and on scroll
  useEffect(() => {
    const updateButtonPosition = () => {
      if (buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect();
        setButtonRect(rect);
      }
    };

    if (isOpen) {
      updateButtonPosition();

      // Listen to scroll events to update position
      const handleScroll = () => {
        updateButtonPosition();
      };

      // Listen to window resize to update position
      const handleResize = () => {
        updateButtonPosition();
      };

      window.addEventListener('scroll', handleScroll, true); // true για capture phase
      window.addEventListener('resize', handleResize);

      return () => {
        window.removeEventListener('scroll', handleScroll, true);
        window.removeEventListener('resize', handleResize);
      };
    }
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

  // Render contact item
  const renderContactItem = (contact: ContactSummary, index: number) => {
    const Icon = getContactIcon(contact.type);
    const isHighlighted = index === highlightedIndex;

    return (
      <div
        key={contact.id}
        className={cn(
          "p-3 border-b border-border last:border-b-0 transition-colors cursor-pointer",
          isHighlighted ? "bg-accent text-accent-foreground" : "hover:bg-accent hover:text-accent-foreground"
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
          "hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
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
              className="h-4 w-4 rounded-sm hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
              title="Καθαρισμός επιλογής"
            >
              <X className="h-3 w-3" />
            </button>
          )}
          <ChevronDown className={cn("h-4 w-4 transition-transform", isOpen ? "rotate-180" : "")} />
        </div>
      </Button>

      {/* Error message */}
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {/* Portal Dropdown - Positioned κάτω από το button */}
      {isOpen && buttonRect && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed bg-popover text-popover-foreground border border-border rounded-lg shadow-lg z-[99999] max-h-[400px] overflow-y-auto"
          style={{
            top: buttonRect.bottom + 8,
            left: buttonRect.left,
            width: buttonRect.width,
            minWidth: '200px'
          }}
        >
          <div
            ref={dropdownRef}
            className="bg-popover rounded-lg"
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

                {/* Results */}
                <div className="max-h-[300px] overflow-y-auto">
                  {isSearching ? (
                    <div className="p-4 text-center text-muted-foreground">
                      <Loader2 className="h-6 w-6 mx-auto mb-2 animate-spin" />
                      <span className="text-sm">Αναζήτηση...</span>
                    </div>
                  ) : searchResults.length > 0 ? (
                    <>
                      {searchResults.slice(0, 8).map((contact, index) => renderContactItem(contact, index))}
                      {searchResults.length > 8 && (
                        <div className="p-3 text-center text-xs text-muted-foreground bg-muted border-t border-border">
                          +{searchResults.length - 8} επιπλέον επαφές. Πληκτρολογήστε για περισσότερο συγκεκριμένη αναζήτηση.
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
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default EnterpriseContactDropdown;