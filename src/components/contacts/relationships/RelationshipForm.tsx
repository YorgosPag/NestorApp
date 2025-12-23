// ============================================================================
// RELATIONSHIP FORM COMPONENT - ΚΕΝΤΡΙΚΟΠΟΙΗΜΕΝΗ ARCHITECTURE
// ============================================================================
//
// 🎯 PURPOSE: Orchestrates relationship form using centralized components
// 🔗 USES: ContactSearchManager, RelationshipFormFields, ContactNameResolver
// 🏢 STANDARDS: Enterprise modular architecture, centralized design system
//
// ============================================================================

'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, AlertTriangle } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';

// 🏢 ENTERPRISE: Import centralized components and utilities
import type { ContactSummary } from '@/components/ui/enterprise-contact-dropdown';
import type { RelationshipFormProps } from './types/relationship-manager.types';
import { ContactSearchManager } from './ContactSearchManager';
import { RelationshipFormFields, validateRelationshipFormData } from './RelationshipFormFields';
import { designSystem } from '@/lib/design-system';

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
  // LOCAL STATE - SIMPLIFIED με κεντρικοποιημένα components
  // ============================================================================

  const iconSizes = useIconSizes();
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // ============================================================================
  // HELPER FUNCTIONS
  // ============================================================================

  /**
   * 👤 Handle contact selection από το ContactSearchManager
   */
  const handleContactSelect = (contact: ContactSummary | null) => {
    setFormData(prev => ({
      ...prev,
      targetContactId: contact?.id || ''
    }));

    // Clear validation errors when contact is selected
    if (contact) {
      setValidationErrors(prev => {
        const { targetContactId, ...rest } = prev;
        return rest;
      });
    }
  };

  /**
   * ✅ Handle form validation
   */
  const validateForm = () => {
    const errors: Record<string, string> = {};

    // Validate required fields
    if (!formData.targetContactId) {
      errors.targetContactId = 'Η επιλογή επαφής είναι υποχρεωτική';
    }

    if (!formData.relationshipType) {
      errors.relationshipType = 'Ο τύπος σχέσης είναι υποχρεωτικός';
    }

    // Add form fields validation
    const formFieldErrors = validateRelationshipFormData(formData, {
      required: {
        relationshipType: true
      }
    });

    setValidationErrors({ ...errors, ...formFieldErrors });
    return Object.keys({ ...errors, ...formFieldErrors }).length === 0;
  };

  /**
   * 📤 Handle form submission με validation
   */
  const handleSubmit = () => {
    if (validateForm()) {
      onSubmit();
    }
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <Card className={designSystem.cn(
      "mb-6",
      "rounded-lg border bg-card text-card-foreground shadow-sm"
    )}>
      <CardHeader>
        <CardTitle className={designSystem.cn(
          "flex items-center space-x-2",
          designSystem.presets.text.subtitle
        )}>
          <Plus className={iconSizes.md} />
          <span>{editingId ? 'Επεξεργασία Σχέσης' : 'Προσθήκη Νέας Σχέσης'}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form className={designSystem.getSpacingClass('p', 'md')}>
          {/* 🔍 CONTACT SEARCH SECTION - Κεντρικοποιημένο */}
          <div className="mb-6">
            <ContactSearchManager
              selectedContactId={formData.targetContactId}
              onContactSelect={handleContactSelect}
              excludeContactIds={[currentContactId]}
              allowedContactTypes={['individual', 'company', 'service']}
              label="Επαφή*"
              placeholder="Αναζήτηση επαφής..."
              required
              error={validationErrors.targetContactId}
              disabled={loading}
              searchConfig={{
                debug: false, // Set to true για debugging
                autoLoadContacts: true,
                maxResults: 50
              }}
            />
          </div>

          {/* 📝 FORM FIELDS SECTION - Κεντρικοποιημένο */}
          <RelationshipFormFields
            formData={formData}
            setFormData={setFormData}
            contactType={contactType}
            loading={loading}
            errors={validationErrors}
            fieldConfig={{
              showNotes: true,
              showDates: true,
              showContactInfo: true,
              notesRows: 3,
              required: {
                relationshipType: true,
                position: false,
                department: false
              }
            }}
          />

          {/* Backend Validation Error Display */}
          {error && (
            <Alert variant="destructive" className="mt-4">
              <AlertTriangle className={iconSizes.sm} />
              <AlertDescription className={designSystem.getTypographyClass('sm', 'medium')}>
                {error}
              </AlertDescription>
            </Alert>
          )}

          {/* Form Actions - με κεντρικοποιημένο styling */}
          <div className={designSystem.cn(
            "flex justify-end space-x-2 mt-6 pt-4 border-t",
            designSystem.colorScheme.responsive.muted.split(' ')[0] // border-muted
          )}>
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={loading}
              className={designSystem.presets.button.outline}
            >
              Ακύρωση
            </Button>
            <Button
              type="button"
              disabled={loading || Object.keys(validationErrors).length > 0}
              onClick={handleSubmit}
              className={designSystem.presets.button.primary}
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