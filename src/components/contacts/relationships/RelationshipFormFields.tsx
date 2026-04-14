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

import React, { useCallback, useMemo, useState } from 'react';
import { isValidEmail } from '@/lib/validation/email-validation';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { designSystem } from '@/lib/design-system';
import { useTranslation } from '@/i18n/hooks/useTranslation';

// 🏢 ENTERPRISE: Centralized SearchableCombobox — single source of truth
import { SearchableCombobox } from '@/components/ui/searchable-combobox';
import type { ComboboxOption } from '@/components/ui/searchable-combobox';

// 🏢 ENTERPRISE: Centralized presets — positions, departments, types
import {
  getRelationshipTypeOptions,
  getPositionOptions,
  getDepartmentOptions
} from './config/relationship-form-presets';

// 🏢 ENTERPRISE: Centralized communication system
import { UniversalCommunicationManager } from '@/components/contacts/dynamic/UniversalCommunicationManager';
import { getEntityAwareCommunicationConfig } from '@/components/contacts/dynamic/communication';
import type { CommunicationItem } from '@/components/contacts/dynamic/communication';
import type { PhoneInfo, EmailInfo } from '@/types/contacts';

// 🏢 ENTERPRISE: Import centralized types
import type { ContactType } from '@/types/contacts/contracts';
import type { RelationshipFormData } from './types/relationship-manager.types';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface RelationshipFormFieldsProps {
  formData: RelationshipFormData;
  setFormData: React.Dispatch<React.SetStateAction<RelationshipFormData>>;
  contactType: ContactType;
  loading?: boolean;
  errors?: Partial<Record<keyof RelationshipFormData, string>>;
  /** Relationship types already used for the selected target contact — excluded from dropdown */
  usedRelationshipTypes?: string[];
  className?: string;
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
// COMPONENT
// ============================================================================

export const RelationshipFormFields: React.FC<RelationshipFormFieldsProps> = ({
  formData,
  setFormData,
  contactType,
  loading = false,
  errors = {},
  usedRelationshipTypes = [],
  className,
  fieldConfig = {}
}) => {
  const { t } = useTranslation(['contacts', 'contacts-banking', 'contacts-core', 'contacts-form', 'contacts-lifecycle', 'contacts-relationships']);

  // Local state for custom options added by the user (session-scoped)
  const [customRelTypes, setCustomRelTypes] = useState<ComboboxOption[]>([]);
  const [customPositions, setCustomPositions] = useState<ComboboxOption[]>([]);
  const [customDepartments, setCustomDepartments] = useState<ComboboxOption[]>([]);

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
  // COMBOBOX OPTIONS — built from centralized presets + user custom entries
  // ============================================================================

  const relationshipTypeOptions = useMemo(() => {
    const presets = getRelationshipTypeOptions(contactType, t);
    const allOptions = [...presets, ...customRelTypes];
    // 🏢 ENTERPRISE: Mark already-used types as disabled (not removed)
    // Shows all options but prevents re-selection — Google-level UX
    if (usedRelationshipTypes.length === 0) return allOptions;
    return allOptions.map(option => usedRelationshipTypes.includes(option.value)
      ? { ...option, disabled: true, disabledHint: t('relationships.form.alreadyRegistered') }
      : option
    );
  }, [contactType, t, customRelTypes, usedRelationshipTypes]);

  const positionOptions = useMemo(() => {
    const presets = getPositionOptions(t);
    return [...presets, ...customPositions];
  }, [t, customPositions]);

  const departmentOptions = useMemo(() => {
    const presets = getDepartmentOptions(t);
    return [...presets, ...customDepartments];
  }, [t, customDepartments]);

  // ============================================================================
  // "ADD NEW" HANDLERS
  // ============================================================================

  const handleAddNewRelType = useCallback((label: string) => {
    const value = `custom_${label.toLowerCase().replace(/\s+/g, '_')}`;
    // Check for duplicates
    if (relationshipTypeOptions.some(o => o.label.toLowerCase() === label.toLowerCase())) return;
    setCustomRelTypes(prev => [...prev, { value, label }]);
    setFormData(prev => ({ ...prev, relationshipType: value }));
  }, [relationshipTypeOptions, setFormData]);

  const handleAddNewPosition = useCallback((label: string) => {
    const value = `custom_${label.toLowerCase().replace(/\s+/g, '_')}`;
    if (positionOptions.some(o => o.label.toLowerCase() === label.toLowerCase())) return;
    setCustomPositions(prev => [...prev, { value, label }]);
    setFormData(prev => ({ ...prev, position: label }));
  }, [positionOptions, setFormData]);

  const handleAddNewDepartment = useCallback((label: string) => {
    const value = `custom_${label.toLowerCase().replace(/\s+/g, '_')}`;
    if (departmentOptions.some(o => o.label.toLowerCase() === label.toLowerCase())) return;
    setCustomDepartments(prev => [...prev, { value, label }]);
    setFormData(prev => ({ ...prev, department: label }));
  }, [departmentOptions, setFormData]);

  // ============================================================================
  // COMMUNICATION HANDLERS
  // ============================================================================

  const phoneConfig = useMemo(
    () => getEntityAwareCommunicationConfig('phone', contactType),
    [contactType]
  );
  const emailConfig = useMemo(
    () => getEntityAwareCommunicationConfig('email', contactType),
    [contactType]
  );

  const phoneItems = useMemo(
    () => phonesToCommunicationItems(formData.phones || []),
    [formData.phones]
  );
  const emailItems = useMemo(
    () => emailsToCommunicationItems(formData.emails || []),
    [formData.emails]
  );

  const handlePhonesChange = useCallback((items: CommunicationItem[]) => {
    const phones = communicationItemsToPhones(items);
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

  const handleEmailsChange = useCallback((items: CommunicationItem[]) => {
    const emails = communicationItemsToEmails(items);
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

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  const renderFieldLabel = (text: string, required: boolean = false) => (
    <Label className={designSystem.getTypographyClass('sm', 'medium')}>
      {text}{required && <span className={designSystem.getStatusColor('error', 'text')}>*</span>}
    </Label>
  );

  const renderError = (field: keyof RelationshipFormData) => {
    if (!errors[field]) return null;
    return (
      <p className={designSystem.cn(
        designSystem.getTypographyClass('sm'),
        designSystem.getStatusColor('error', 'text'),
        "mt-1"
      )}>
        {errors[field]}
      </p>
    );
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className={designSystem.cn("space-y-2", className)}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">

        {/* ── Relationship Type ── */}
        <div className="md:col-span-1 space-y-2">
          {renderFieldLabel(
            t('relationships.form.labels.relationshipType'),
            finalFieldConfig.required.relationshipType
          )}
          <SearchableCombobox
            value={formData.relationshipType}
            onValueChange={(value) => setFormData(prev => ({ ...prev, relationshipType: value }))}
            options={relationshipTypeOptions}
            placeholder={t('relationships.form.placeholders.selectType')}
            emptyMessage={t('relationships.form.noTypesFound')}
            disabled={loading}
            error={errors.relationshipType}
            onAddNew={handleAddNewRelType}
            addNewButtonLabel={t('relationships.form.addCustomType')}
          />
          {renderError('relationshipType')}
        </div>

        {/* ── Position (Θέση) — SearchableCombobox ── */}
        <div className="md:col-span-1 space-y-2">
          {renderFieldLabel(
            t('relationships.form.labels.position'),
            finalFieldConfig.required.position
          )}
          <SearchableCombobox
            value={formData.position || ''}
            onValueChange={(value, option) => {
              setFormData(prev => ({ ...prev, position: option?.label || value }));
            }}
            options={positionOptions}
            placeholder={t('relationships.form.placeholders.position')}
            emptyMessage={t('relationships.form.noTypesFound')}
            disabled={loading}
            error={errors.position}
            allowFreeText
            onAddNew={handleAddNewPosition}
            addNewButtonLabel={t('relationships.form.addCustomType')}
          />
          {renderError('position')}
        </div>

        {/* ── Department (Τμήμα) — SearchableCombobox ── */}
        <div className="md:col-span-1 space-y-2">
          {renderFieldLabel(
            t('relationships.form.labels.department'),
            finalFieldConfig.required.department
          )}
          <SearchableCombobox
            value={formData.department || ''}
            onValueChange={(value, option) => {
              setFormData(prev => ({ ...prev, department: option?.label || value }));
            }}
            options={departmentOptions}
            placeholder={t('relationships.form.placeholders.department')}
            emptyMessage={t('relationships.form.noTypesFound')}
            disabled={loading}
            error={errors.department}
            allowFreeText
            onAddNew={handleAddNewDepartment}
            addNewButtonLabel={t('relationships.form.addCustomType')}
          />
          {renderError('department')}
        </div>

        {/* ── Start Date ── */}
        {finalFieldConfig.showDates && (
          <div className="md:col-span-1 space-y-2">
            {renderFieldLabel(t('relationships.form.labels.startDate'))}
            <input
              type="date"
              value={formData.startDate || ''}
              onChange={e => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
              disabled={loading}
              className={designSystem.cn(
                designSystem.getFormFieldClass(false, loading),
                "w-full"
              )}
            />
          </div>
        )}

        {/* ── Centralized Communication Section ── */}
        {finalFieldConfig.showContactInfo && (
          <section className="md:col-span-2 space-y-2" aria-label={t('relationships.form.labels.professionalInfo')}>
            <Label className={designSystem.cn(
              designSystem.getTypographyClass('sm', 'medium'),
              "block"
            )}>
              {t('relationships.form.labels.professionalInfo')}
            </Label>

            <UniversalCommunicationManager
              config={phoneConfig}
              items={phoneItems}
              disabled={loading}
              onChange={handlePhonesChange}
            />

            <UniversalCommunicationManager
              config={emailConfig}
              items={emailItems}
              disabled={loading}
              onChange={handleEmailsChange}
            />
          </section>
        )}

        {/* ── Notes ── */}
        {finalFieldConfig.showNotes && (
          <div className="md:col-span-2">
            {renderFieldLabel(t('relationships.form.labels.notes'))}
            <Textarea
              value={formData.notes || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder={t('relationships.form.placeholders.notes')}
              rows={finalFieldConfig.notesRows}
              disabled={loading}
              className={designSystem.getFormFieldClass(false, loading)}
            />
            {renderError('notes')}
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// VALIDATION HELPER
// ============================================================================

export const validateRelationshipFormData = (
  data: RelationshipFormData,
  config: RelationshipFormFieldsProps['fieldConfig'] = {},
  t?: (key: string) => string
): Partial<Record<keyof RelationshipFormData, string>> => {
  const errors: Partial<Record<keyof RelationshipFormData, string>> = {};

  const msg = (key: string, fallback: string) => (t ? t(key) : fallback);

  if (config?.required?.relationshipType && !data.relationshipType) {
    errors.relationshipType = msg(
      'relationships.form.validation.relationshipTypeRequired',
      'Relationship type is required'
    );
  }

  if (config?.required?.position && !data.position?.trim()) {
    errors.position = msg(
      'relationships.form.validation.positionRequired',
      'Position is required'
    );
  }

  if (config?.required?.department && !data.department?.trim()) {
    errors.department = msg(
      'relationships.form.validation.departmentRequired',
      'Department is required'
    );
  }

  if (data.emails && data.emails.length > 0) {
    for (const emailEntry of data.emails) {
      if (emailEntry.email && !isValidEmail(emailEntry.email)) {
        break;
      }
    }
  }

  return errors;
};

export default RelationshipFormFields;
