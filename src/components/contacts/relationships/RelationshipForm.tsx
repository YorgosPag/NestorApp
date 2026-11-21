// ============================================================================
// RELATIONSHIP FORM COMPONENT - ΚΕΝΤΡΙΚΟΠΟΙΗΜΕΝΗ ARCHITECTURE
// ============================================================================

'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { HeaderBar } from '@/components/ui/header-bar';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, AlertTriangle, Info } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';

import type { ContactSummary } from '@/components/ui/enterprise-contact-dropdown';
import type { RelationshipFormProps } from './types/relationship-manager.types';
import { ContactSearchManager } from './ContactSearchManager';
import { RelationshipFormFields, validateRelationshipFormData } from './RelationshipFormFields';
import { designSystem, getStatusColor } from '@/lib/design-system';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useContactName } from './hooks/useContactName';
import { projectContactInfo } from '@/services/contact-relationships/core/relationship-field-codec';

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
        const { targetContactId: _targetContactId, ...rest } = prev;
        return rest;
      });
    }
  }, [formData.targetContactId, validationErrors.targetContactId]);

  useEffect(() => {
    if (formData.relationshipType && validationErrors.relationshipType) {
      setValidationErrors(prev => {
        const { relationshipType: _relationshipType, ...rest } = prev;
        return rest;
      });
    }
  }, [formData.relationshipType, validationErrors.relationshipType]);

  // Clear local error when hook error changes
  useEffect(() => {
    if (error) setLocalError(null);
  }, [error]);

  // ADR-372 §8.5 b1: the picked contact's type is also needed when a STORED relationship is
  // opened (edit sets only the id) — it decides whose channels these are and the crossing filter.
  const { contactType: pickedContactType } = useContactName(
    formData.targetContactId && !formData.targetContactType ? formData.targetContactId : undefined
  );
  useEffect(() => {
    if (!pickedContactType) return;
    setFormData(prev => (prev.targetContactId && !prev.targetContactType
      ? { ...prev, targetContactType: pickedContactType }
      : prev));
  }, [pickedContactType, setFormData]);

  // ADR-372 §8.5 b1: picking a contact NO LONGER copies its channels (bare string, guessed +30,
  // forced `work`, the previous contact's lines kept). Copying is the explicit «Copy from contact»;
  // channels it copied belong to the old pick, so a new pick clears them. Typed rows stay.
  const handleContactSelect = useCallback((contact: ContactSummary | null) => {
    setFormData(prev => {
      const nextId = contact?.id || '';
      const dropCopied = !!prev.channelsCopiedFrom && nextId !== prev.targetContactId;
      return {
        ...prev,
        targetContactId: nextId,
        // ADR-372: capture target type to enable 2D crossing filter in form fields
        targetContactType: contact?.type ?? undefined,
        // Reset type when target changes — old selection may be invalid for new crossing
        relationshipType: contact?.type === prev.targetContactType ? prev.relationshipType : '',
        ...(dropCopied
          ? { phones: [], emails: [], channelsCopiedFrom: undefined, contactInfo: projectContactInfo(prev.contactInfo, [], []) ?? undefined }
          : {}),
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
      "mb-2",
      "rounded-lg border bg-card text-card-foreground shadow-sm"
    )}>
      <CardHeader className="pb-2">
        <HeaderBar
          actions={
            <>
              {/* 🏢 ENTERPRISE: Action buttons at header level — always visible without scrolling */}
              <div className="flex items-center space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onCancel}
                  disabled={loading}
                >
                  {t('relationships.form.buttons.cancel')}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={loading}
                  onClick={handleSubmit}
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
            </>
          }
        >
          <CardTitle className={designSystem.cn(
            "flex items-center space-x-2",
            designSystem.presets.text.subtitle
          )}>
            <Plus className={iconSizes.md} />
            <span>{editingId ? t('relationships.form.editTitle') : t('relationships.form.title')}</span>
          </CardTitle>
        </HeaderBar>
      </CardHeader>
      <CardContent>
        <form onSubmit={preventFormSubmit} className={designSystem.getSpacingClass('p', 'md')}>
          {/* Hint: select contact first — positioned at top for visibility */}
          {!hasContact && (
            <Alert className={`mb-4 ${getStatusColor('info', 'border')}`}>
              <Info className={designSystem.cn(iconSizes.sm, getStatusColor('info', 'text'))} />
              <AlertDescription className={`${getStatusColor('info', 'text')} text-sm`}>
                {t('relationships.form.selectContactFirst')}
              </AlertDescription>
            </Alert>
          )}

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
            currentContactId={currentContactId}
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
            <Alert className="mt-4 border-[hsl(var(--text-warning))] bg-[hsl(var(--bg-warning))]/40">
              <Info className={designSystem.cn(iconSizes.sm, "text-[hsl(var(--text-warning))]")} />
              <AlertDescription className="text-[hsl(var(--text-warning))] text-sm">
                {t('relationships.form.pendingReminder')}
              </AlertDescription>
            </Alert>
          )}

          {/* Form Actions */}
          <div className={designSystem.cn(
            "flex justify-end space-x-2 mt-2 pt-2 border-t",
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
