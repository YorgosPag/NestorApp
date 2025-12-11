// ============================================================================
// RELATIONSHIP FORM COMPONENT
// ============================================================================
//
// 📝 Form component for adding and editing relationships
// Extracted from ContactRelationshipManager for better modularity
//
// ============================================================================

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EnterpriseDropdown } from '@/components/ui/enterprise-dropdown';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, AlertTriangle } from 'lucide-react';

// 🏢 ENTERPRISE: Import centralized types and utilities
import type { RelationshipType } from '@/types/contacts/relationships';
import { EnterpriseContactDropdown, type ContactSummary } from '@/components/ui/enterprise-contact-dropdown';
import { RelationshipValidationService } from '@/services/contact-relationships/core/RelationshipValidationService';
import {
  getRelationshipTypeConfig,
  getAvailableRelationshipTypes
} from './utils/relationship-types';
import type { RelationshipFormProps } from './types/relationship-manager.types';
import { ContactsService } from '@/services/contacts.service';

/**
 * 📝 RelationshipForm Component
 *
 * Enterprise form component for creating and editing contact relationships
 *
 * Features:
 * - Dynamic relationship type filtering based on contact type
 * - Professional contact information fields
 * - Form validation and error handling
 * - Loading states and user feedback
 */
export const RelationshipForm: React.FC<RelationshipFormProps> = ({
  formData,
  setFormData,
  contactType,
  currentContactId,
  loading,
  error,
  editingId,
  onSubmit,
  onCancel
}) => {
  // ============================================================================
  // LOCAL STATE FOR PROACTIVE VALIDATION
  // ============================================================================

  const [selectedContact, setSelectedContact] = useState<ContactSummary | null>(null);
  const [searchResults, setSearchResults] = useState<ContactSummary[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  // Temporarily disabled proactive validation to fix infinite loop
  // const [validationWarning, setValidationWarning] = useState<string | null>(null);

  // ============================================================================
  // HELPER FUNCTIONS
  // ============================================================================

  /**
   * 📋 Get available relationship types for current contact type
   */
  const availableRelationshipTypes = getAvailableRelationshipTypes(contactType);

  // Temporarily disabled proactive validation to fix infinite loop
  // Will re-implement with simpler approach later

  // ============================================================================
  // EFFECTS
  // ============================================================================

  // Load all contacts initially
  useEffect(() => {
    handleContactSearch(''); // Load all contacts when component mounts
  }, []);

  // Temporarily disabled useEffect for proactive validation to fix infinite loop

  /**
   * 🎯 Handle form field changes with type safety
   */
  const handleFieldChange = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  /**
   * 📞 Handle contact info field changes
   */
  const handleContactInfoChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      contactInfo: { ...prev.contactInfo, [field]: value }
    }));
  };

  /**
   * 🔍 Handle contact search
   */
  const handleContactSearch = async (query: string) => {
    setIsSearching(true);
    try {
      if (!query.trim()) {
        // If no query, show all contacts
        const allContactsResult = await ContactsService.getAllContacts();
        const allContacts = allContactsResult.contacts || [];


        console.log('🔍 DEBUG: All contacts before filtering:', allContacts.map(c => ({
          id: c.id,
          type: c.type,
          name: c.name,
          firstName: c.firstName,
          lastName: c.lastName,
          companyName: c.companyName,
          serviceName: c.serviceName
        })));

        const filteredContacts = allContacts
          .filter(contact => contact.id !== currentContactId)
          .map(contact => {
            // 🏢 ENTERPRISE: Determine display name with strict validation
            let displayName = '';

            if (contact.type === 'individual') {
              // Individuals: firstName + lastName with intelligent fallbacks
              if (contact.firstName && contact.lastName) {
                displayName = `${contact.firstName} ${contact.lastName}`;
              } else if (contact.firstName) {
                displayName = contact.firstName;
              } else if (contact.lastName) {
                displayName = contact.lastName;
              } else if (contact.name) {
                displayName = contact.name;
              } else if (contact.email) {
                displayName = `Φυσικό Πρόσωπο (${contact.email})`;
              } else if (contact.phone) {
                displayName = `Φυσικό Πρόσωπο (${contact.phone})`;
              } else {
                displayName = `Φυσικό Πρόσωπο #${contact.id.substring(0, 8)}`;
              }
            } else if (contact.type === 'company') {
              // Companies: companyName with fallbacks
              displayName = contact.companyName || contact.name || `Εταιρεία #${contact.id.substring(0, 8)}`;
            } else if (contact.type === 'service') {
              // Services: serviceName with intelligent hierarchy
              displayName = contact.serviceName || contact.name || contact.companyName || `Υπηρεσία #${contact.id.substring(0, 8)}`;
            } else {
              displayName = contact.name || `Επαφή #${contact.id.substring(0, 8)}`;
            }

            // Debug για Κατερίνα Αποστόλου
            if (contact.firstName === 'Κατερίνα' || contact.lastName === 'Αποστόλου' || displayName.includes('Κατερίνα') || displayName.includes('Αποστόλου')) {
              console.log('🔍 DEBUG: Found Κατερίνα Αποστόλου:', {
                id: contact.id,
                type: contact.type,
                firstName: contact.firstName,
                lastName: contact.lastName,
                name: contact.name,
                displayName: displayName,
                emails: contact.emails,
                phones: contact.phones,
                rawContact: contact
              });
            }

            // Return contact with display name, will be filtered later
            return {
              id: contact.id,
              name: displayName,
              type: contact.type,
              email: contact.emails?.[0]?.value || contact.email || '',
              phone: contact.phones?.[0]?.value || contact.phone || '',
              company: contact.type === 'individual' && contact.company ? contact.company : undefined,
              department: contact.department || '',
              lastActivity: contact.updatedAt?.toString() || contact.createdAt?.toString()
            } as ContactSummary;
          })
          .filter(contact => {
            // 🏢 ENTERPRISE: Only show contacts with valid names (no empty names)
            const isValid = contact.name && contact.name.trim().length > 0;

            // Debug για επαφές που αποκλείονται
            if (!isValid) {
              console.log('🚫 DEBUG: Contact excluded due to invalid name:', {
                id: contact.id,
                name: contact.name,
                type: contact.type
              });
            }

            return isValid;
          });

        console.log('🔍 DEBUG: Final filtered contacts:', filteredContacts.map(c => ({
          id: c.id,
          name: c.name,
          type: c.type
        })));

        setSearchResults(filteredContacts);
      } else {
        // Search contacts with the query
        const searchResults = await ContactsService.searchContacts({
          searchTerm: query
        });


        const filteredContacts = searchResults
          .filter(contact => contact.id !== currentContactId) // Exclude current contact
          .map(contact => {
            // 🏢 ENTERPRISE: Use same name resolution logic as above
            let displayName = '';

            if (contact.type === 'individual') {
              if (contact.firstName && contact.lastName) {
                displayName = `${contact.firstName} ${contact.lastName}`;
              } else if (contact.firstName) {
                displayName = contact.firstName;
              } else if (contact.lastName) {
                displayName = contact.lastName;
              } else if (contact.name) {
                displayName = contact.name;
              } else if (contact.email) {
                displayName = `Φυσικό Πρόσωπο (${contact.email})`;
              } else if (contact.phone) {
                displayName = `Φυσικό Πρόσωπο (${contact.phone})`;
              } else {
                displayName = `Φυσικό Πρόσωπο #${contact.id.substring(0, 8)}`;
              }
            } else if (contact.type === 'company') {
              displayName = contact.companyName || contact.name || `Εταιρεία #${contact.id.substring(0, 8)}`;
            } else if (contact.type === 'service') {
              displayName = contact.serviceName || contact.name || contact.companyName || `Υπηρεσία #${contact.id.substring(0, 8)}`;
            } else {
              displayName = contact.name || `Επαφή #${contact.id.substring(0, 8)}`;
            }

            return {
              id: contact.id,
              name: displayName,
              type: contact.type,
              email: contact.emails?.[0]?.value || '',
              phone: contact.phones?.[0]?.value || '',
              company: contact.type === 'individual' && contact.company ? contact.company : undefined,
              department: contact.department || '',
              lastActivity: contact.updatedAt?.toString() || contact.createdAt?.toString()
            } as ContactSummary;
          })
          .filter(contact => {
            // 🏢 ENTERPRISE: Only show contacts with valid names
            return contact.name && contact.name.trim().length > 0;
          });

        setSearchResults(filteredContacts);
      }
    } catch (error) {
      console.error('Contact search error:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  /**
   * 👤 Handle contact selection
   */
  const handleContactSelect = (contact: ContactSummary | null) => {
    setSelectedContact(contact);
    setFormData(prev => ({
      ...prev,
      targetContactId: contact?.id || ''
    }));
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Plus className="h-5 w-5" />
          <span>{editingId ? 'Επεξεργασία Σχέσης' : 'Προσθήκη Νέας Σχέσης'}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* Target Contact Selection */}
            <div className="md:col-span-2">
              <EnterpriseContactDropdown
                value={formData.targetContactId}
                onContactSelect={handleContactSelect}
                searchResults={searchResults}
                onSearch={handleContactSearch}
                isSearching={isSearching}
                label="Επαφή*"
                placeholder="Αναζήτηση επαφής..."
                allowedContactTypes={['individual', 'company', 'service']}
                excludeContactIds={[currentContactId]} // 🚫 Exclude current contact από το dropdown
                required
                error={!formData.targetContactId ? 'Η επιλογή επαφής είναι υποχρεωτική' : undefined}
              />
            </div>

            {/* Relationship Type Selection */}
            <div>
              <Label htmlFor="relationshipType">Τύπος Σχέσης*</Label>
              <EnterpriseDropdown
                value={formData.relationshipType}
                onValueChange={(value: string) =>
                  handleFieldChange('relationshipType', value as RelationshipType)
                }
                options={availableRelationshipTypes.map(type => {
                  const config = getRelationshipTypeConfig(type);
                  return {
                    value: type,
                    label: config?.label || type,
                    icon: config?.icon
                  };
                })}
                disabled={loading}
                placeholder="Επιλέξτε τύπο σχέσης"
                error={!formData.relationshipType ? 'Η επιλογή τύπου σχέσης είναι υποχρεωτική' : undefined}
              />
            </div>

            {/* Temporarily disabled proactive validation warning to fix infinite loop */}

            {/* Position Field */}
            <div>
              <Label htmlFor="position">Θέση</Label>
              <Input
                id="position"
                value={formData.position || ''}
                onChange={(e) => handleFieldChange('position', e.target.value)}
                placeholder="π.χ. Διευθυντής Πωλήσεων"
              />
            </div>

            {/* Department Field */}
            <div>
              <Label htmlFor="department">Τμήμα</Label>
              <Input
                id="department"
                value={formData.department || ''}
                onChange={(e) => handleFieldChange('department', e.target.value)}
                placeholder="π.χ. Οικονομικό Τμήμα"
              />
            </div>

            {/* Start Date Field */}
            <div>
              <Label htmlFor="startDate">Ημερομηνία Έναρξης</Label>
              <Input
                id="startDate"
                type="date"
                value={formData.startDate || ''}
                onChange={(e) => handleFieldChange('startDate', e.target.value)}
              />
            </div>

            {/* Professional Contact Information Section */}
            <div className="md:col-span-2">
              <Label className="text-sm font-medium">Επαγγελματικά Στοιχεία Επικοινωνίας</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                <Input
                  placeholder="Επαγγελματικό τηλέφωνο"
                  value={formData.contactInfo?.businessPhone || ''}
                  onChange={(e) => handleContactInfoChange('businessPhone', e.target.value)}
                />
                <Input
                  placeholder="Επαγγελματικό email"
                  type="email"
                  value={formData.contactInfo?.businessEmail || ''}
                  onChange={(e) => handleContactInfoChange('businessEmail', e.target.value)}
                />
                <Input
                  placeholder="Εσωτερικό τηλέφωνο"
                  value={formData.contactInfo?.extensionNumber || ''}
                  onChange={(e) => handleContactInfoChange('extensionNumber', e.target.value)}
                />
                <Input
                  placeholder="Διεύθυνση εργασίας"
                  value={formData.contactInfo?.businessAddress || ''}
                  onChange={(e) => handleContactInfoChange('businessAddress', e.target.value)}
                />
              </div>
            </div>

            {/* Notes Field */}
            <div className="md:col-span-2">
              <Label htmlFor="notes">Σημειώσεις</Label>
              <Textarea
                id="notes"
                value={formData.notes || ''}
                onChange={(e) => handleFieldChange('notes', e.target.value)}
                placeholder="Πρόσθετες πληροφορίες..."
                rows={3}
              />
            </div>
          </div>

          {/* Backend Validation Error Display */}
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="font-medium">
                {error}
              </AlertDescription>
            </Alert>
          )}

          {/* Form Actions */}
          <div className="flex justify-end space-x-2">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={loading}
            >
              Ακύρωση
            </Button>
            <Button
              type="button"
              disabled={loading}
              onClick={onSubmit}
            >
              {loading ? 'Αποθήκευση...' : (editingId ? 'Ενημέρωση' : 'Προσθήκη')}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default RelationshipForm;