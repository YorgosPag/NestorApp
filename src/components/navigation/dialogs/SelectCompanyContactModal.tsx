'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ContactsService } from '@/services/contacts.service';
import type { Contact } from '@/types/contacts';
import { getContactDisplayName } from '@/types/contacts';
import { Loader2, Factory, CheckCircle2, Search } from 'lucide-react';
import { SearchInput } from '@/components/ui/search';
import { INTERACTIVE_PATTERNS, TRANSITION_PRESETS } from '../../ui/effects';

interface SelectCompanyContactModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCompanySelected: (contact: Contact) => void;
  // 🏢 ENTERPRISE: Existing companies για intelligent filtering
  existingCompanyIds?: string[];
}

export function SelectCompanyContactModal({
  open,
  onOpenChange,
  onCompanySelected,
  existingCompanyIds = [],
}: SelectCompanyContactModalProps) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Φόρτωση επαφών όταν ανοίγει το modal
  useEffect(() => {
    if (open) {
      loadCompanyContacts();
    }
  }, [open]);

  // Φιλτράρισμα based on search term
  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredContacts(contacts);
    } else {
      const searchLower = searchTerm.toLowerCase();
      const filtered = contacts.filter(contact => {
        const displayName = getContactDisplayName(contact).toLowerCase();
        const companyName = contact.type === 'company' ? contact.companyName?.toLowerCase() : '';
        const vatNumber = contact.type === 'company' ? contact.vatNumber : '';

        return (
          displayName.includes(searchLower) ||
          companyName?.includes(searchLower) ||
          vatNumber?.includes(searchLower)
        );
      });
      setFilteredContacts(filtered);
    }
  }, [searchTerm, contacts]);

  const loadCompanyContacts = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const result = await ContactsService.getAllContacts({
        limitCount: 100,
        orderByField: 'updatedAt',
        orderDirection: 'desc',
      });

      // Φιλτράρισμα για νομικά πρόσωπα μόνο
      // 🏢 ENTERPRISE FILTERING: Φιλτράρουμε εταιρείες που είναι active + δεν υπάρχουν ήδη
      const companyContacts = result.contacts.filter(
        contact => contact.type === 'company' &&
                   contact.status === 'active' &&
                   !existingCompanyIds.includes(contact.id)  // 🚫 EXCLUDE existing companies
      );

      if (companyContacts.length === 0 && existingCompanyIds.length > 0) {
        console.log(`🔍 ENTERPRISE FILTER: All ${result.contacts.filter(c => c.type === 'company' && c.status === 'active').length} companies already in navigation. Available companies: 0`);
      } else {
        console.log(`🔍 ENTERPRISE FILTER: ${companyContacts.length} available companies (${existingCompanyIds.length} already in navigation)`);
      }

      setContacts(companyContacts);
      setFilteredContacts(companyContacts);
    } catch (err) {
      setError('Σφάλμα φόρτωσης επαφών νομικών προσώπων');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectCompany = (contact: Contact) => {
    onCompanySelected(contact);
    onOpenChange(false);
    setSearchTerm('');
  };

  const handleClose = () => {
    onOpenChange(false);
    setSearchTerm('');
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Factory className="h-5 w-5 text-blue-600" />
            Επιλογή Εταιρείας
          </DialogTitle>
          <DialogDescription>
            Επιλέξτε μια εταιρεία από τις επαφές σας για προσθήκη στην πλοήγηση.
            {existingCompanyIds.length > 0 && (
              <span className="text-muted-foreground block mt-1 text-sm">
                Εμφανίζονται μόνο εταιρείες που δεν υπάρχουν ήδη στη λίστα ({existingCompanyIds.length} εταιρείες ήδη προστεθεί).
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* 🏢 ENTERPRISE LIST-STYLE HEADER - Same pattern as GenericListHeader */}
          <div className="flex items-center gap-2">
            {/* Left: Icon + Title + Count - Same as lists */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <Factory className="h-4 w-4 text-blue-600" />
              <span className="font-medium text-sm whitespace-nowrap">
                Εταιρείες ({filteredContacts.length})
              </span>
            </div>

            {/* Right: Search Input - Same as lists */}
            <SearchInput
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="Αναζήτηση εταιρείας..."
              debounceMs={300}
              showClearButton={true}
              className="h-8 text-sm flex-1"
            />
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
              <span className="ml-2 text-sm text-gray-600">Φόρτωση εταιρειών...</span>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="text-center py-8">
              <p className="text-red-500 mb-4">{error}</p>
              <Button onClick={loadCompanyContacts} variant="outline" size="sm">
                Επανάληψη
              </Button>
            </div>
          )}

          {/* Companies List */}
          {!isLoading && !error && (
            <ScrollArea className="h-[400px] w-full">
              {filteredContacts.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  {contacts.length === 0 ? (
                    <div>
                      <Factory className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                      {existingCompanyIds.length > 0 ? (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-6 w-6 text-green-500" />
                            <p className="font-medium">Όλες οι εταιρείες έχουν προστεθεί!</p>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Όλες οι {existingCompanyIds.length} διαθέσιμες εταιρείες βρίσκονται ήδη στη λίστα πλοήγησης.
                          </p>
                        </div>
                      ) : (
                        <p>Δεν βρέθηκαν εταιρείες στις επαφές σας.</p>
                      )}
                    </div>
                  ) : (
                    <div>
                      <Search className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                      <p>Δεν βρέθηκαν εταιρείες για "{searchTerm}"</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredContacts.map((contact) => (
                    <div
                      key={contact.id}
                      onClick={() => handleSelectCompany(contact)}
                      className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer ${INTERACTIVE_PATTERNS.SUBTLE_HOVER} ${TRANSITION_PRESETS.STANDARD_COLORS}`}
                    >
                      <Factory className="h-5 w-5 text-blue-600 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 dark:text-foreground truncate">
                          {getContactDisplayName(contact)}
                        </div>
                        {contact.type === 'company' && contact.vatNumber && (
                          <div className="text-sm text-gray-500 dark:text-muted-foreground">
                            ΑΦΜ: {contact.vatNumber}
                          </div>
                        )}
                        {contact.type === 'company' && contact.industry && (
                          <div className="text-sm text-gray-500 dark:text-muted-foreground">
                            {contact.industry}
                          </div>
                        )}
                      </div>
                      <div className="text-xs text-gray-400 flex-shrink-0">
                        Επιλογή →
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={handleClose}>
            Ακύρωση
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default SelectCompanyContactModal;