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


export function AddNewContactDialog({ open, onOpenChange, onContactAdded, editContact }: AddNewContactDialogProps) {
  const {
    formData,
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


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
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
          <FormGrid>
            {/* Τύπος Επαφής */}
            <FormField label="Τύπος" htmlFor="type" required>
              <FormInput>
                <Select name="type" value={formData.type} onValueChange={(value) => handleSelectChange('type', value)} disabled={loading || !!editContact}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="individual">👤 Φυσικό Πρόσωπο</SelectItem>
                    <SelectItem value="company">🏢 Εταιρεία</SelectItem>
                    <SelectItem value="service">🏛️ Δημόσια Υπηρεσία</SelectItem>
                  </SelectContent>
                </Select>
              </FormInput>
            </FormField>

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
              handleUploadedLogoURL={handleUploadedLogoURL}
              handleUploadedPhotoURL={handleUploadedPhotoURL}
              disabled={loading}
            />

            {/* Σημειώσεις για φυσικά πρόσωπα */}
            {formData.type === 'individual' && (
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
