'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
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
import { Textarea } from '@/components/ui/textarea';
import { SaveButton, CancelButton } from '@/components/ui/form/ActionButtons';
import type { ContactType } from '@/types/contacts';
import { Loader2, User, Building, Shield, Building2, Landmark } from 'lucide-react';
import type { AddNewContactDialogProps, ContactFormData } from '@/types/ContactFormTypes';
import { useContactForm } from '@/hooks/useContactForm';
import { useIconSizes } from '@/hooks/useIconSizes';
import { getTypeIcon, getTypeLabel } from '@/utils/contactFormUtils';
import { UnifiedContactTabbedSection } from '@/components/ContactFormSections/UnifiedContactTabbedSection';
import { RelationshipProvider } from '@/components/contacts/relationships/context/RelationshipProvider';
import { CONTACT_TYPES, getContactIcon, getContactLabel } from '@/constants/contacts';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';

export function TabbedAddNewContactDialog({ open, onOpenChange, onContactAdded, editContact, onLiveChange }: AddNewContactDialogProps) {
  // 🏢 ENTERPRISE: i18n hook for translations
  const { t } = useTranslation('contacts');
  // 🎯 ΚΕΝΤΡΙΚΟΠΟΙΗΜΕΝΑ ICON SIZES - ENTERPRISE PATTERN
  const iconSizes = useIconSizes();

  const {
    formData,
    setFormData,
    loading,
    handleSubmit,
    handleChange,
    handleSelectChange,
    handleFileChange,
    handleDrop,
    handleDragOver,
    handleNestedChange,
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
    <Dialog open={open} onOpenChange={(isOpen) => {
      console.log('🚨 TabbedAddNewContactDialog: onOpenChange called with:', isOpen);
      onOpenChange(isOpen);
    }}>
      <DialogContent className={`sm:max-w-[900px] max-h-[90vh] overflow-y-auto z-50`}>
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
              contactId={formData.id || 'new-contact'}
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