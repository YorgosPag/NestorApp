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
import { Plus, AlertTriangle, Info } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';

// 🏢 ENTERPRISE: Import centralized components and utilities
import type { ContactSummary } from '@/components/ui/enterprise-contact-dropdown';
import type { RelationshipFormProps } from './types/relationship-manager.types';
import { ContactSearchManager } from './ContactSearchManager';
import { RelationshipFormFields, validateRelationshipFormData } from './RelationshipFormFields';
import { designSystem } from '@/lib/design-system';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';

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

  // 🏢 ENTERPRISE: i18n hook
  const { t } = useTranslation('contacts');
  const iconSizes = useIconSizes();
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // ============================================================================
  // HELPER FUNCTIONS
  // ============================================================================

  /**
   * 👤 Handle contact selection από το ContactSearchManager
   */
  const handleContactSelect = (contact: ContactSummary | null) => {
    setFormData(prev => {
      // Auto-populate centralized phones/emails from selected contact
      // Only fill if currently empty — don't overwrite user edits
      const autoPhones = (prev.phones && prev.phones.length > 0)
        ? prev.phones
        : (contact?.phone
          ? [{ number: contact.phone, type: 'work' as const, isPrimary: true, label: '', countryCode: '+30' }]
          : []);

      const autoEmails = (prev.emails && prev.emails.length > 0)
        ? prev.emails
        : (contact?.email
          ? [{ email: contact.email, type: 'work' as const, isPrimary: true, label: '' }]
          : []);

      return {
        ...prev,
        targetContactId: contact?.id || '',
        phones: autoPhones,
        emails: autoEmails,
        contactInfo: {
          ...prev.contactInfo,
          businessPhone: autoPhones[0]?.number || '',
          businessEmail: autoEmails[0]?.email || ''
        }
      };
    });

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
      errors.targetContactId = t('relationships.form.validation.contactRequired');
    }

    if (!formData.relationshipType) {
      errors.relationshipType = t('relationships.form.validation.relationshipTypeRequired');
    }

    // Add form fields validation
    const formFieldErrors = validateRelationshipFormData(formData, {
      required: {
        relationshipType: true
      }
    });

    const allErrors = { ...errors, ...formFieldErrors };
    setValidationErrors(allErrors);
    return Object.keys(allErrors).length === 0;
  };

  /**
   * 📤 Handle form submission με validation
   */
  const handleSubmit = () => {
    const isValid = validateForm();
    if (isValid) {
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
          <span>{editingId ? t('relationships.form.editTitle') : t('relationships.form.title')}</span>
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
              label={`${t('relationships.form.labels.contact')}*`}
              placeholder={t('relationships.form.placeholders.searchContact')}
              required
              error={validationErrors.targetContactId}
              disabled={loading}
              searchConfig={{
                debug: false,
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
                {t(error, { defaultValue: error })}
              </AlertDescription>
            </Alert>
          )}

          {/* 🛡️ ENTERPRISE: Pending data reminder — shows when form has data but not yet submitted */}
          {formData.targetContactId && !loading && (
            <Alert className="mt-4 border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/30">
              <Info className={designSystem.cn(iconSizes.sm, "text-amber-600 dark:text-amber-400")} />
              <AlertDescription className="text-amber-700 dark:text-amber-300 text-sm">
                {t('relationships.form.pendingReminder', {
                  defaultValue: 'Πάτησε "Προσθήκη" για να αποθηκεύσεις τη σχέση. Η σχέση αποθηκεύεται επίσης αυτόματα όταν αποθηκεύεις την επαφή.'
                })}
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
              {t('relationships.form.buttons.cancel')}
            </Button>
            <Button
              type="button"
              disabled={loading || Object.keys(validationErrors).length > 0}
              onClick={handleSubmit}
              className={designSystem.presets.button.primary}
            >
              {loading ? t('relationships.form.buttons.save') : (editingId ? t('relationships.form.buttons.update') : t('relationships.form.buttons.add'))}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default RelationshipForm;