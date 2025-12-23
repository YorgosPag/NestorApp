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
import { Loader2, User, Building, Shield } from 'lucide-react';
import type { AddNewContactDialogProps, ContactFormData } from '@/types/ContactFormTypes';
import { useContactForm } from '@/hooks/useContactForm';
import { getTypeIcon, getTypeLabel } from '@/utils/contactFormUtils';
import { UnifiedContactTabbedSection } from '@/components/ContactFormSections/UnifiedContactTabbedSection';
import { CONTACT_TYPES, getContactLabel } from '@/constants/contacts';
import { useIconSizes } from '@/hooks/useIconSizes';


export function AddNewContactDialog({ open, onOpenChange, onContactAdded, editContact }: AddNewContactDialogProps) {
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
    handleMultiplePhotoUploadComplete
  } = useContactForm({ onContactAdded, onOpenChange, editContact, isModalOpen: open });

  // 🔧 FIX: TypeScript safety με fallback
  const contactType = formData.type ?? CONTACT_TYPES.INDIVIDUAL;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {getTypeIcon(contactType, iconSizes.sm)}
            {editContact ? 'Επεξεργασία' : 'Προσθήκη Νέας'} Επαφής - {getTypeLabel(contactType)}
          </DialogTitle>
          <DialogDescription>
            {editContact ? 'Επεξεργαστείτε τα στοιχεία της επαφής.' : 'Καταχωρήστε τα βασικά στοιχεία της νέας επαφής.'}
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit}>
          <FormGrid>
            {/* Τύπος Επαφής */}
            <FormField label="Τύπος" htmlFor="type" required>
              <FormInput>
                <Select name="type" value={contactType} onValueChange={(value) => handleSelectChange('type', value)} disabled={loading || !!editContact}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={CONTACT_TYPES.INDIVIDUAL}>👤 {getContactLabel(CONTACT_TYPES.INDIVIDUAL, 'singular')}</SelectItem>
                    <SelectItem value={CONTACT_TYPES.COMPANY}>🏢 {getContactLabel(CONTACT_TYPES.COMPANY, 'singular')}</SelectItem>
                    <SelectItem value={CONTACT_TYPES.SERVICE}>🏛️ {getContactLabel(CONTACT_TYPES.SERVICE, 'singular')}</SelectItem>
                  </SelectContent>
                </Select>
              </FormInput>
            </FormField>

            {/* 🏢 UNIFIED CONTACT SECTION - All contact types centralized */}
            <UnifiedContactTabbedSection
              contactType={contactType}
              formData={formData}
              handleChange={handleChange}
              handleSelectChange={handleSelectChange}
              handleLogoChange={handleLogoChange}
              handleFileChange={handleFileChange}
              handleMultiplePhotosChange={handleMultiplePhotosChange}
              handleMultiplePhotoUploadComplete={handleMultiplePhotoUploadComplete}
              handleUploadedLogoURL={handleUploadedLogoURL}
              handleUploadedPhotoURL={handleUploadedPhotoURL}
              setFormData={setFormData} // 🔧 FIX: Pass setFormData for dynamic arrays
              disabled={loading}
            />

            {/* Σημειώσεις για φυσικά πρόσωπα */}
            {contactType === CONTACT_TYPES.INDIVIDUAL && (
              <div className="col-span-2 border-t pt-4 mt-4">
                <h4 className="font-semibold mb-3 text-sm">📝 Σημειώσεις</h4>
                <FormField label="Σημειώσεις" htmlFor="notes">
                  <FormInput>
                    <Textarea
                      id="notes"
                      name="notes"
                      value={formData.notes}
                      onChange={handleChange}
                      rows={2}
                      disabled={loading}
                      placeholder="Προσθέστε σημειώσεις για αυτή την επαφή..."
                    />
                  </FormInput>
                </FormField>
              </div>
            )}
          </FormGrid>
          
          <DialogFooter>
            <CancelButton onClick={() => onOpenChange(false)} disabled={loading} />
            <SaveButton loading={loading}>
              {editContact ? 'Ενημέρωση' : 'Αποθήκευση'} Επαφής
            </SaveButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
