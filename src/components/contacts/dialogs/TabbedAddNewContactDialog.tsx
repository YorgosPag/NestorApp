'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FormGrid, FormField, FormInput } from '@/components/ui/form/FormComponents';
import { SaveButton, CancelButton } from '@/components/ui/form/ActionButtons';
import type { ContactType } from '@/types/contacts';
import { User, Building2, Landmark } from 'lucide-react';
import type { AddNewContactDialogProps } from '@/types/ContactFormTypes';
import { useContactForm } from '@/hooks/useContactForm';
import { useIconSizes } from '@/hooks/useIconSizes';
import { getTypeIcon, getTypeLabel } from '@/utils/contactFormUtils';
import { UnifiedContactTabbedSection } from '@/components/ContactFormSections/UnifiedContactTabbedSection';
import { RelationshipProvider } from '@/components/contacts/relationships/context/RelationshipProvider';
import { CONTACT_TYPES, getContactLabel } from '@/constants/contacts';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';
// 🏢 ENTERPRISE: Auth context for canonical upload pipeline (ADR-031)
import { useAuth } from '@/auth/hooks/useAuth';
// 🏢 ENTERPRISE: ID generation for new contacts (ADR-031)
import { generateContactId } from '@/services/enterprise-id.service';
import type { CanonicalUploadContext } from '@/components/ContactFormSections/utils/PhotoUploadConfiguration';
// 🏢 ENTERPRISE: Utility for class name composition (canonical pattern)
import { cn } from '@/lib/utils';
// 🏢 ENTERPRISE: Centralized dialog sizing tokens (ADR-031)
import { DIALOG_SIZES, DIALOG_HEIGHT, DIALOG_SCROLL } from '@/styles/design-tokens';

export function TabbedAddNewContactDialog({ open, onOpenChange, onContactAdded, editContact, onLiveChange }: AddNewContactDialogProps) {
  // 🏢 ENTERPRISE: i18n hook for translations
  const { t } = useTranslation('contacts');
  // 🎯 ΚΕΝΤΡΙΚΟΠΟΙΗΜΕΝΑ ICON SIZES - ENTERPRISE PATTERN
  const iconSizes = useIconSizes();
  // 🏢 ENTERPRISE: Auth context for canonical upload pipeline (ADR-031)
  const { user } = useAuth();

  const {
    formData,
    setFormData,
    loading,
    handleSubmit,
    handleChange,
    handleSelectChange,
    handleFileChange,
    handleLogoChange,
    handleUploadedPhotoURL,
    handleUploadedLogoURL,
    handleMultiplePhotosChange,
    handleMultiplePhotoUploadComplete,
    handleProfilePhotoSelection
  } = useContactForm({ onContactAdded, onOpenChange, editContact, isModalOpen: open, onLiveChange });

  // 🔧 TypeScript safety με fallback
  const contactType = (formData.type || CONTACT_TYPES.INDIVIDUAL) as ContactType;

  const isCompany = contactType === CONTACT_TYPES.COMPANY;
  const isIndividual = contactType === CONTACT_TYPES.INDIVIDUAL;
  const isService = contactType === CONTACT_TYPES.SERVICE;

  // ==========================================================================
  // 🏢 ENTERPRISE: Canonical Upload Context (ADR-031)
  // ==========================================================================
  // Pre-generate contactId for new contacts so uploads use canonical pipeline
  // For edit mode, use existing contact ID
  // ==========================================================================
  const [preGeneratedContactId] = useState<string>(() => {
    // If editing, use existing ID; if new, generate one
    return editContact?.id || generateContactId();
  });

  // ==========================================================================
  // 🏢 ENTERPRISE: Option A - Set formData.id to preGeneratedContactId (ADR-031)
  // ==========================================================================
  // Ensure formData.id is set early for new contacts so uploads + save use same ID
  // ==========================================================================
  useEffect(() => {
    // Only set for new contacts (not editing)
    if (!editContact && !formData.id && preGeneratedContactId) {
      setFormData(prev => ({ ...prev, id: preGeneratedContactId }));
    }
  }, [editContact, formData.id, preGeneratedContactId, setFormData]);

  // Build canonical upload context (only if user has required claims)
  const canonicalUploadContext = useMemo<CanonicalUploadContext | undefined>(() => {
    // 🛡️ SECURITY: Only enable canonical pipeline if user has companyId claim
    // Falls back to legacy pipeline (with deprecation warning) if not available
    if (!user?.uid || !user?.companyId) {
      return undefined;
    }

    // Use pre-generated ID for new contacts, existing ID for edits
    const contactId = formData.id || preGeneratedContactId;

    return {
      companyId: user.companyId,
      createdBy: user.uid,
      contactId,
      contactName: isIndividual
        ? `${formData.firstName || ''} ${formData.lastName || ''}`.trim()
        : formData.companyName || formData.serviceName || formData.name,
    };
  }, [user, formData.id, preGeneratedContactId, formData.firstName, formData.lastName, formData.companyName, formData.serviceName, formData.name, isIndividual]);

  // 🏷️ GET CONTACT NAME: Helper function to get contact name based on type
  const getContactName = () => {
    if (isIndividual) {
      return formData.firstName && formData.lastName
        ? `${formData.firstName} ${formData.lastName}`
        : t('form.noName');
    }
    if (isCompany) {
      return formData.companyName || t('form.noCompanyName');
    }
    if (isService) {
      return formData.serviceName || formData.name || t('form.noCompanyName');
    }
    return '';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(DIALOG_SIZES.xl, DIALOG_HEIGHT.standard, DIALOG_SCROLL.scrollable)}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {getTypeIcon(contactType, iconSizes.sm)}
            {editContact ? t('form.editTitle') : t('form.addTitle')} - {getTypeLabel(contactType)}
            {editContact && getContactName() && ` - ${getContactName()}`}
          </DialogTitle>

          <DialogDescription>
            {editContact
              ? t('form.editDescription')
              : t('form.addDescription')
            }
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            {/* Contact Type Selection */}
            <FormGrid>
              <FormField label={t('form.typeLabel')} htmlFor="type" required>
                <FormInput>
                  <Select name="type" value={contactType} onValueChange={(value) => handleSelectChange('type', value)} disabled={loading || !!editContact}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={CONTACT_TYPES.INDIVIDUAL}>
                        <div className="flex items-center gap-2">
                          <User className={iconSizes.sm} />
                          <span>{getContactLabel(CONTACT_TYPES.INDIVIDUAL, 'singular')}</span>
                        </div>
                      </SelectItem>
                      <SelectItem value={CONTACT_TYPES.COMPANY}>
                        <div className="flex items-center gap-2">
                          <Building2 className={iconSizes.sm} />
                          <span>{getContactLabel(CONTACT_TYPES.COMPANY, 'singular')}</span>
                        </div>
                      </SelectItem>
                      <SelectItem value={CONTACT_TYPES.SERVICE}>
                        <div className="flex items-center gap-2">
                          <Landmark className={iconSizes.sm} />
                          <span>{getContactLabel(CONTACT_TYPES.SERVICE, 'singular')}</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </FormInput>
              </FormField>
            </FormGrid>

            {/* 🏢 UNIFIED CONTACT SECTION - All contact types centralized */}
            {/* 🔧 FIX: Wrap με RelationshipProvider για proper state management */}
            <RelationshipProvider
              contactId={formData.id || preGeneratedContactId}
              contactType={contactType}
            >
              <UnifiedContactTabbedSection
                contactType={contactType}
                formData={formData}
                handleChange={handleChange}
                handleSelectChange={handleSelectChange}
                handleLogoChange={handleLogoChange}
                handleFileChange={handleFileChange}
                handleMultiplePhotosChange={handleMultiplePhotosChange}
                handleMultiplePhotoUploadComplete={handleMultiplePhotoUploadComplete}
                handleProfilePhotoSelection={handleProfilePhotoSelection}
                handleUploadedLogoURL={handleUploadedLogoURL}
                handleUploadedPhotoURL={handleUploadedPhotoURL}
                setFormData={setFormData}
                disabled={loading}
                canonicalUploadContext={canonicalUploadContext}
              />
            </RelationshipProvider>

          </div>

          <DialogFooter className="mt-6">
            <CancelButton onClick={() => onOpenChange(false)} disabled={loading} />
            <SaveButton loading={loading}>
              {editContact ? t('form.updateContact') : t('form.saveContact')}
            </SaveButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}