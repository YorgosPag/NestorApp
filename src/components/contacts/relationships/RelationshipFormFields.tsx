// ============================================================================
// 📝 RELATIONSHIP FORM FIELDS COMPONENT - ΚΑΘΑΡΑ FORM FIELDS
// ============================================================================
//
// 🎯 PURPOSE: Pure form fields component για relationship data entry
// 🔗 USED BY: RelationshipForm, RelationshipEditDialog
// 🏢 STANDARDS: Enterprise form patterns, centralized design system
//
// ============================================================================

'use client';

import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { designSystem } from '@/lib/design-system';
import { useIconSizes } from '@/hooks/useIconSizes';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';

// 🏢 ENTERPRISE: Import centralized types and utilities
import type { RelationshipType, ContactType } from '@/types/contacts/relationships';
import {
  getRelationshipTypeConfig,
  getAvailableRelationshipTypes
} from './utils/relationship-types';
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

  /** Loading state για disabled fields */
  loading?: boolean;

  /** Error state για form validation */
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
  // 🏢 ENTERPRISE: i18n hook
  const { t } = useTranslation('contacts');
  const iconSizes = useIconSizes();

  // ============================================================================
  // CONFIGURATION με DEFAULTS
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

  /**
   * 🎯 Handle form field changes με type safety
   */
  const handleFieldChange = (field: keyof RelationshipFormData, value: string) => {
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
   * 📋 Get available relationship types για current contact type
   */
  const availableRelationshipTypes = getAvailableRelationshipTypes(contactType);

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  /**
   * 🏷️ Render Field Label με optional required indicator
   */
  const renderFieldLabel = (text: string, required: boolean = false) => (
    <Label className={designSystem.getTypographyClass('sm', 'medium')}>
      {text}{required && <span className={designSystem.getStatusColor('error', 'text')}>*</span>}
    </Label>
  );

  /**
   * 📝 Render Input Field με enterprise styling
   */
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

        {/* Relationship Type Selection */}
        <div className="md:col-span-1">
          {renderFieldLabel(t('relationships.form.labels.relationshipType'), finalFieldConfig.required.relationshipType)}
          <Select
            value={formData.relationshipType}
            onValueChange={(value: string) =>
              handleFieldChange('relationshipType', value as RelationshipType)
            }
            disabled={loading}
          >
            <SelectTrigger
              className={designSystem.cn(
                designSystem.getFormFieldClass(!!errors.relationshipType, loading),
                !formData.relationshipType && finalFieldConfig.required.relationshipType
                  ? designSystem.getStatusColor('error', 'border')
                  : ""
              )}
            >
              <SelectValue placeholder={t('relationships.form.placeholders.selectType')} />
            </SelectTrigger>
            <SelectContent>
              {availableRelationshipTypes.map(type => {
                const config = getRelationshipTypeConfig(type);
                const Icon = config?.icon;

                return (
                  <SelectItem key={type} value={type}>
                    <div className="flex items-center gap-2">
                      {Icon && (
                        <Icon className={designSystem.cn(
                          iconSizes.sm,
                          designSystem.colorScheme.responsive.muted.split(' ')[1] // text-muted-foreground
                        )} />
                      )}
                      <span>{config?.label || type}</span>
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>

          {/* Error message για relationship type */}
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

        {/* Professional Contact Information Section */}
        {finalFieldConfig.showContactInfo && (
          <div className="md:col-span-2">
            <Label className={designSystem.cn(
              designSystem.getTypographyClass('sm', 'medium'),
              "mb-3 block"
            )}>
              {t('relationships.form.labels.professionalInfo')}
            </Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input
                placeholder={t('relationships.form.placeholders.businessPhone')}
                value={formData.contactInfo?.businessPhone || ''}
                onChange={(e) => handleContactInfoChange('businessPhone', e.target.value)}
                disabled={loading}
                className={designSystem.getFormFieldClass(false, loading)}
              />
              <Input
                placeholder={t('relationships.form.placeholders.businessEmail')}
                type="email"
                value={formData.contactInfo?.businessEmail || ''}
                onChange={(e) => handleContactInfoChange('businessEmail', e.target.value)}
                disabled={loading}
                className={designSystem.getFormFieldClass(false, loading)}
              />
              <Input
                placeholder={t('relationships.form.placeholders.extensionNumber')}
                value={formData.contactInfo?.extensionNumber || ''}
                onChange={(e) => handleContactInfoChange('extensionNumber', e.target.value)}
                disabled={loading}
                className={designSystem.getFormFieldClass(false, loading)}
              />
              <Input
                placeholder={t('relationships.form.placeholders.businessAddress')}
                value={formData.contactInfo?.businessAddress || ''}
                onChange={(e) => handleContactInfoChange('businessAddress', e.target.value)}
                disabled={loading}
                className={designSystem.getFormFieldClass(false, loading)}
              />
            </div>
          </div>
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

/**
 * 🔍 Validate Relationship Form Data
 */
export const validateRelationshipFormData = (
  data: RelationshipFormData,
  config: RelationshipFormFieldsProps['fieldConfig'] = {}
): Partial<Record<keyof RelationshipFormData, string>> => {
  const errors: Partial<Record<keyof RelationshipFormData, string>> = {};

  // Required field validation
  if (config?.required?.relationshipType && !data.relationshipType) {
    errors.relationshipType = 'Η επιλογή τύπου σχέσης είναι υποχρεωτική';
  }

  if (config?.required?.position && !data.position?.trim()) {
    errors.position = 'Η θέση είναι υποχρεωτική';
  }

  if (config?.required?.department && !data.department?.trim()) {
    errors.department = 'Το τμήμα είναι υποχρεωτικό';
  }

  // Email validation
  if (data.contactInfo?.businessEmail) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.contactInfo.businessEmail)) {
      // Note: Θα επιστραφεί στο contactInfo error αλλά αυτό χρειάζεται βελτίωση
      // για nested field errors στο μέλλον
    }
  }

  return errors;
};

// ============================================================================
// EXPORTS
// ============================================================================

export default RelationshipFormFields;