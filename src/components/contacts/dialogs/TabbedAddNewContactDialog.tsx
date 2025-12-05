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
import { getTypeIcon, getTypeLabel } from '@/utils/contactFormUtils';
import { UnifiedContactTabbedSection } from '@/components/ContactFormSections/UnifiedContactTabbedSection';

export function TabbedAddNewContactDialog({ open, onOpenChange, onContactAdded, editContact, onLiveChange }: AddNewContactDialogProps) {
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

  const isCompany = formData.type === 'company';
  const isIndividual = formData.type === 'individual';
  const isService = formData.type === 'service';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`sm:max-w-[900px] max-h-[90vh] overflow-y-auto z-50`}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {getTypeIcon(formData.type)}
            {editContact ? 'Επεξεργασία' : 'Προσθήκη Νέας'} Επαφής - {getTypeLabel(formData.type)}
          </DialogTitle>
          <DialogDescription>
            {editContact ? 'Επεξεργαστείτε τα στοιχεία της επαφής.' : 'Καταχωρήστε τα βασικά στοιχεία της νέας επαφής.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            {/* Contact Type Selection */}
            <FormGrid>
              <FormField label="Τύπος" htmlFor="type" required>
                <FormInput>
                  <Select name="type" value={formData.type} onValueChange={(value) => handleSelectChange('type', value)} disabled={loading || !!editContact}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="individual">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4" />
                          <span>Φυσικό Πρόσωπο</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="company">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4" />
                          <span>Εταιρεία</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="service">
                        <div className="flex items-center gap-2">
                          <Landmark className="w-4 h-4" />
                          <span>Δημόσια Υπηρεσία</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </FormInput>
              </FormField>
            </FormGrid>

            {/* 🏢 UNIFIED CONTACT SECTION - All contact types centralized */}
            <UnifiedContactTabbedSection
              contactType={formData.type}
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

          </div>

          <DialogFooter className="mt-6">
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