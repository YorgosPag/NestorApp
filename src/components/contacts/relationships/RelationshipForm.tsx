// ============================================================================
// RELATIONSHIP FORM COMPONENT - ΚΕΝΤΡΙΚΟΠΟΙΗΜΕΝΗ ARCHITECTURE
// ============================================================================

'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, AlertTriangle, Info } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';

import type { ContactSummary } from '@/components/ui/enterprise-contact-dropdown';
import type { RelationshipFormProps } from './types/relationship-manager.types';
import { ContactSearchManager } from './ContactSearchManager';
import { RelationshipFormFields, validateRelationshipFormData } from './RelationshipFormFields';
import { designSystem } from '@/lib/design-system';
import { useTranslation } from '@/i18n/hooks/useTranslation';

export const RelationshipForm: React.FC<RelationshipFormProps> = ({
  formData,
  setFormData,
  contactType,
  currentContactId,
  loading,
  error,
  editingId,
  usedRelationshipTypes,
  onSubmit,
  onCancel
}) => {
  const { t } = useTranslation('contacts');
  const iconSizes = useIconSizes();
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [localError, setLocalError] = useState<string | null>(null);

  // Clear validation errors when the user edits key fields
  useEffect(() => {
    if (formData.targetContactId && validationErrors.targetContactId) {
      setValidationErrors(prev => {
        const { targetContactId, ...rest } = prev;
        return rest;
      });
    }
  }, [formData.targetContactId, validationErrors.targetContactId]);

  useEffect(() => {
    if (formData.relationshipType && validationErrors.relationshipType) {
      setValidationErrors(prev => {
        const { relationshipType, ...rest } = prev;
        return rest;
      });
    }
  }, [formData.relationshipType, validationErrors.relationshipType]);

  // Clear local error when hook error changes
  useEffect(() => {
    if (error) setLocalError(null);
  }, [error]);

  const handleContactSelect = useCallback((contact: ContactSummary | null) => {
    setFormData(prev => {
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

    setLocalError(null);
  }, [setFormData]);

  /**
   * Validate + submit (async)
   */
  const handleSubmit = useCallback(async () => {
    setLocalError(null);
    const errors: Record<string, string> = {};

    if (!formData.targetContactId) {
      errors.targetContactId = t('relationships.form.validation.contactRequired');
    }

    if (!formData.relationshipType) {
      errors.relationshipType = t('relationships.form.validation.relationshipTypeRequired');
    }

    const formFieldErrors = validateRelationshipFormData(formData, {
      required: { relationshipType: true }
    });

    const allErrors = { ...errors, ...formFieldErrors };
    setValidationErrors(allErrors);

    if (Object.keys(allErrors).length > 0) {
      return;
    }

    // Call the hook's async submit and await it
    try {
      await onSubmit();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setLocalError(message);
    }
  }, [formData, onSubmit, t]);

  // Prevent native form submission (Enter key)
  const preventFormSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
  }, []);

  // Contact selected — fields unlocked
  const hasContact = !!formData.targetContactId;

  // Combined error (hook error + local error)
  const displayError = error || localError;

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
        <form onSubmit={preventFormSubmit} className={designSystem.getSpacingClass('p', 'md')}>
          {/* Contact Search */}
          <div className="mb-6">
            <ContactSearchManager
              selectedContactId={formData.targetContactId}
              onContactSelect={handleContactSelect}
              excludeContactIds={[currentContactId]}
              allowedContactTypes={['individual', 'company', 'service']}
              label={`${t('relationships.form.labels.contact')}**`}
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

          {/* Form Fields — disabled until contact is selected */}
          <RelationshipFormFields
            formData={formData}
            setFormData={setFormData}
            contactType={contactType}
            loading={loading || !hasContact}
            errors={validationErrors}
            usedRelationshipTypes={usedRelationshipTypes}
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

          {/* Hint: select contact first */}
          {!hasContact && (
            <Alert className="mt-4 border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-950/30">
              <Info className={designSystem.cn(iconSizes.sm, "text-blue-600 dark:text-blue-400")} />
              <AlertDescription className="text-blue-700 dark:text-blue-300 text-sm">
                {t('relationships.form.selectContactFirst')}
              </AlertDescription>
            </Alert>
          )}

          {/* Error Display */}
          {displayError && (
            <Alert variant="destructive" className="mt-4">
              <AlertTriangle className={iconSizes.sm} />
              <AlertDescription className={designSystem.getTypographyClass('sm', 'medium')}>
                {t(displayError, { defaultValue: displayError })}
              </AlertDescription>
            </Alert>
          )}

          {/* Pending data reminder */}
          {hasContact && !loading && !displayError && (
            <Alert className="mt-4 border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/30">
              <Info className={designSystem.cn(iconSizes.sm, "text-amber-600 dark:text-amber-400")} />
              <AlertDescription className="text-amber-700 dark:text-amber-300 text-sm">
                {t('relationships.form.pendingReminder')}
              </AlertDescription>
            </Alert>
          )}

          {/* Form Actions */}
          <div className={designSystem.cn(
            "flex justify-end space-x-2 mt-6 pt-4 border-t",
            designSystem.colorScheme.responsive.muted.split(' ')[0]
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
              disabled={loading}
              onClick={handleSubmit}
              className={designSystem.presets.button.primary}
            >
              {loading
                ? t('relationships.form.buttons.save')
                : (editingId
                  ? t('relationships.form.buttons.update')
                  : t('relationships.form.buttons.add')
                )
              }
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default RelationshipForm;
