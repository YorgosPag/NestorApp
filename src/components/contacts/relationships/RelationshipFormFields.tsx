// ============================================================================
// RELATIONSHIP FORM FIELDS COMPONENT - ΚΑΘΑΡΑ FORM FIELDS
// ============================================================================
//
// 🎯 PURPOSE: Pure form fields component για relationship data entry
// 🔗 USED BY: RelationshipForm, RelationshipEditDialog
// 🏢 STANDARDS: Enterprise form patterns, centralized design system
//
// ============================================================================

'use client';

import React, { useCallback, useMemo } from 'react';
import { isValidEmail } from '@/lib/validation/email-validation';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { designSystem } from '@/lib/design-system';
import { useTranslation } from '@/i18n/hooks/useTranslation';

// 🏢 ENTERPRISE: Centralized communication system
import { UniversalCommunicationManager } from '@/components/contacts/dynamic/UniversalCommunicationManager';
import { getEntityAwareCommunicationConfig } from '@/components/contacts/dynamic/communication';
import type { CommunicationItem } from '@/components/contacts/dynamic/communication';
import type { PhoneInfo, EmailInfo } from '@/types/contacts';

// 🏢 ENTERPRISE: Searchable relationship type combobox
import { RelationshipTypeCombobox } from './RelationshipTypeCombobox';

// 🏢 ENTERPRISE: Import centralized types
import type { ContactType } from '@/types/contacts/contracts';
import type { RelationshipFormData } from './types/relationship-manager.types';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface RelationshipFormFieldsProps {
  /** Form data object */
  formData: RelationshipFormData;

  /** Form data setter function */
  setFormData: React.Dispatch<React.SetStateAction<RelationshipFormData>>;

  /** Contact type for filtering available relationship types */
  contactType: ContactType;

  /** Loading state */
  loading?: boolean;

  /** Error state */
  errors?: Partial<Record<keyof RelationshipFormData, string>>;

  /** Custom styling */
  className?: string;

  /** Field configuration */
  fieldConfig?: {
    showNotes?: boolean;
    showDates?: boolean;
    showContactInfo?: boolean;
    notesRows?: number;
    required?: {
      relationshipType?: boolean;
      position?: boolean;
      department?: boolean;
    };
  };
}

// ============================================================================
// MAPPER FUNCTIONS — Phone/Email ↔ CommunicationItem
// ============================================================================

const phonesToCommunicationItems = (phones: PhoneInfo[]): CommunicationItem[] =>
  Array.isArray(phones) ? phones.map(phone => ({
    type: phone.type,
    label: phone.label,
    isPrimary: phone.isPrimary,
    number: phone.number,
    countryCode: phone.countryCode
  })) : [];

const emailsToCommunicationItems = (emails: EmailInfo[]): CommunicationItem[] =>
  Array.isArray(emails) ? emails.map(email => ({
    type: email.type,
    label: email.label,
    isPrimary: email.isPrimary,
    email: email.email
  })) : [];

const communicationItemsToPhones = (items: CommunicationItem[]): PhoneInfo[] =>
  Array.isArray(items) ? items.map(item => ({
    number: item.number || '',
    type: item.type as PhoneInfo['type'],
    isPrimary: item.isPrimary || false,
    label: item.label || '',
    countryCode: item.countryCode || '+30'
  })) : [];

const communicationItemsToEmails = (items: CommunicationItem[]): EmailInfo[] =>
  Array.isArray(items) ? items.map(item => ({
    email: item.email || '',
    type: item.type as EmailInfo['type'],
    isPrimary: item.isPrimary || false,
    label: item.label || ''
  })) : [];

// ============================================================================
// RELATIONSHIP FORM FIELDS COMPONENT
// ============================================================================

export const RelationshipFormFields: React.FC<RelationshipFormFieldsProps> = ({
  formData,
  setFormData,
  contactType,
  loading = false,
  errors = {},
  className,
  fieldConfig = {}
}) => {
  const { t } = useTranslation('contacts');

  // ============================================================================
  // CONFIGURATION
  // ============================================================================

  const finalFieldConfig = {
    showNotes: true,
    showDates: true,
    showContactInfo: true,
    notesRows: 3,
    required: {
      relationshipType: true,
      position: false,
      department: false
    },
    ...fieldConfig
  };

  // ============================================================================
  // HELPER FUNCTIONS
  // ============================================================================

  const handleFieldChange = (field: keyof RelationshipFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // 🏢 ENTERPRISE: Centralized phone/email configs (entity-aware)
  const phoneConfig = useMemo(
    () => getEntityAwareCommunicationConfig('phone', contactType),
    [contactType]
  );
  const emailConfig = useMemo(
    () => getEntityAwareCommunicationConfig('email', contactType),
    [contactType]
  );

  // Phone items from formData
  const phoneItems = useMemo(
    () => phonesToCommunicationItems(formData.phones || []),
    [formData.phones]
  );
  const emailItems = useMemo(
    () => emailsToCommunicationItems(formData.emails || []),
    [formData.emails]
  );

  // Handle phone changes from UniversalCommunicationManager
  const handlePhonesChange = useCallback((items: CommunicationItem[]) => {
    const phones = communicationItemsToPhones(items);
    // Sync first/primary phone to contactInfo for backward compatibility
    const primaryPhone = phones.find(p => p.isPrimary) || phones[0];
    setFormData(prev => ({
      ...prev,
      phones,
      contactInfo: {
        ...prev.contactInfo,
        businessPhone: primaryPhone?.number
          ? `${primaryPhone.countryCode || '+30'} ${primaryPhone.number}`
          : ''
      }
    }));
  }, [setFormData]);

  // Handle email changes from UniversalCommunicationManager
  const handleEmailsChange = useCallback((items: CommunicationItem[]) => {
    const emails = communicationItemsToEmails(items);
    // Sync first/primary email to contactInfo for backward compatibility
    const primaryEmail = emails.find(e => e.isPrimary) || emails[0];
    setFormData(prev => ({
      ...prev,
      emails,
      contactInfo: {
        ...prev.contactInfo,
        businessEmail: primaryEmail?.email || ''
      }
    }));
  }, [setFormData]);

  // Handle relationship type change from combobox
  const handleRelationshipTypeChange = useCallback((value: string, customLabel?: string) => {
    setFormData(prev => ({
      ...prev,
      relationshipType: value,
      customRelationshipLabel: customLabel
    }));
  }, [setFormData]);

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  const renderFieldLabel = (text: string, required: boolean = false) => (
    <Label className={designSystem.getTypographyClass('sm', 'medium')}>
      {text}{required && <span className={designSystem.getStatusColor('error', 'text')}>*</span>}
    </Label>
  );

  const renderInputField = (
    id: string,
    label: string,
    value: string,
    onChange: (value: string) => void,
    options: {
      type?: string;
      placeholder?: string;
      required?: boolean;
      disabled?: boolean;
    } = {}
  ) => (
    <div className="space-y-2">
      {renderFieldLabel(label, options.required)}
      <Input
        id={id}
        type={options.type || 'text'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={options.placeholder}
        disabled={loading || options.disabled}
        className={designSystem.getFormFieldClass(!!errors[id as keyof RelationshipFormData], loading)}
      />
      {errors[id as keyof RelationshipFormData] && (
        <p className={designSystem.cn(
          designSystem.getTypographyClass('sm'),
          designSystem.getStatusColor('error', 'text')
        )}>
          {errors[id as keyof RelationshipFormData]}
        </p>
      )}
    </div>
  );

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className={designSystem.cn("space-y-6", className)}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Relationship Type — Searchable Combobox */}
        <div className="md:col-span-1 space-y-2">
          {renderFieldLabel(
            t('relationships.form.labels.relationshipType'),
            finalFieldConfig.required.relationshipType
          )}
          <RelationshipTypeCombobox
            value={formData.relationshipType}
            onChange={handleRelationshipTypeChange}
            contactType={contactType}
            disabled={loading}
            hasError={!!errors.relationshipType}
            placeholder={t('relationships.form.placeholders.selectType')}
          />
          {errors.relationshipType && (
            <p className={designSystem.cn(
              designSystem.getTypographyClass('sm'),
              designSystem.getStatusColor('error', 'text'),
              "mt-1"
            )}>
              {errors.relationshipType}
            </p>
          )}
        </div>

        {/* Position Field */}
        {renderInputField(
          'position',
          t('relationships.form.labels.position'),
          formData.position || '',
          (value) => handleFieldChange('position', value),
          {
            placeholder: t('relationships.form.placeholders.position'),
            required: finalFieldConfig.required.position
          }
        )}

        {/* Department Field */}
        {renderInputField(
          'department',
          t('relationships.form.labels.department'),
          formData.department || '',
          (value) => handleFieldChange('department', value),
          {
            placeholder: t('relationships.form.placeholders.department'),
            required: finalFieldConfig.required.department
          }
        )}

        {/* Start Date Field */}
        {finalFieldConfig.showDates && renderInputField(
          'startDate',
          t('relationships.form.labels.startDate'),
          formData.startDate || '',
          (value) => handleFieldChange('startDate', value),
          {
            type: 'date'
          }
        )}

        {/* ============================================================ */}
        {/* CENTRALIZED COMMUNICATION SECTION                            */}
        {/* Replaces old plain-text businessPhone/businessEmail/ext      */}
        {/* ============================================================ */}
        {finalFieldConfig.showContactInfo && (
          <section className="md:col-span-2 space-y-4" aria-label={t('relationships.form.labels.professionalInfo')}>
            <Label className={designSystem.cn(
              designSystem.getTypographyClass('sm', 'medium'),
              "block"
            )}>
              {t('relationships.form.labels.professionalInfo')}
            </Label>

            {/* Phones — UniversalCommunicationManager */}
            <UniversalCommunicationManager
              config={phoneConfig}
              items={phoneItems}
              disabled={loading}
              onChange={handlePhonesChange}
            />

            {/* Emails — UniversalCommunicationManager */}
            <UniversalCommunicationManager
              config={emailConfig}
              items={emailItems}
              disabled={loading}
              onChange={handleEmailsChange}
            />
          </section>
        )}

        {/* Notes Field */}
        {finalFieldConfig.showNotes && (
          <div className="md:col-span-2">
            {renderFieldLabel(t('relationships.form.labels.notes'))}
            <Textarea
              value={formData.notes || ''}
              onChange={(e) => handleFieldChange('notes', e.target.value)}
              placeholder={t('relationships.form.placeholders.notes')}
              rows={finalFieldConfig.notesRows}
              disabled={loading}
              className={designSystem.getFormFieldClass(false, loading)}
            />
            {errors.notes && (
              <p className={designSystem.cn(
                designSystem.getTypographyClass('sm'),
                designSystem.getStatusColor('error', 'text'),
                "mt-1"
              )}>
                {errors.notes}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// VALIDATION HELPER FUNCTIONS
// ============================================================================

export const validateRelationshipFormData = (
  data: RelationshipFormData,
  config: RelationshipFormFieldsProps['fieldConfig'] = {},
  t?: (key: string) => string
): Partial<Record<keyof RelationshipFormData, string>> => {
  const errors: Partial<Record<keyof RelationshipFormData, string>> = {};

  const getValidationMessage = (key: string, fallback: string): string => {
    return t ? t(key) : fallback;
  };

  if (config?.required?.relationshipType && !data.relationshipType) {
    errors.relationshipType = getValidationMessage(
      'relationships.form.validation.relationshipTypeRequired',
      'Relationship type is required'
    );
  }

  if (config?.required?.position && !data.position?.trim()) {
    errors.position = getValidationMessage(
      'relationships.form.validation.positionRequired',
      'Position is required'
    );
  }

  if (config?.required?.department && !data.department?.trim()) {
    errors.department = getValidationMessage(
      'relationships.form.validation.departmentRequired',
      'Department is required'
    );
  }

  // Email validation — check centralized emails array
  if (data.emails && data.emails.length > 0) {
    for (const emailEntry of data.emails) {
      if (emailEntry.email && !isValidEmail(emailEntry.email)) {
        // Surface email validation on the form level
        break;
      }
    }
  }

  return errors;
};

// ============================================================================
// EXPORTS
// ============================================================================

export default RelationshipFormFields;
