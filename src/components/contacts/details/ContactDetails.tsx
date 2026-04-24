'use client';

import '@/lib/design-system';
import React from 'react';
import { Users } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { ContactFormData } from '@/types/ContactFormTypes';
import type { PersonaType } from '@/types/contacts/personas';
import { DetailsContainer } from '@/core/containers';
import { UnifiedContactTabbedSection } from '@/components/ContactFormSections/UnifiedContactTabbedSection';
import { AddPropertyToContactDialog } from './AddPropertyToContactDialog';
import { ContactDetailsHeader } from './ContactDetailsHeader';
import { ContactDetailsMobileActions } from './contact-details/ContactDetailsMobileActions';
import { useContactDetailsController } from './contact-details/useContactDetailsController';
import { ContactEditFocusProvider } from './contact-details/ContactEditFocusContext';
import type { ContactDetailsProps } from './contact-details/contact-details-types';

export function ContactDetails({
  contact,
  onEditContact: _onEditContact,
  onDeleteContact,
  onContactUpdated,
  onNewContact,
  readOnly = false,
}: ContactDetailsProps) {
  const { t } = useTranslation(['contacts', 'contacts-banking', 'contacts-core', 'contacts-form', 'contacts-lifecycle', 'contacts-relationships']);
  const [isAddUnitDialogOpen, setIsAddUnitDialogOpen] = React.useState(false);
  const {
    activeTab,
    contactGuardDialogs,
    enhancedFormData,
    handleCancelEdit,
    handleFieldBlur,
    handleFieldChange,
    handleFileChange,
    handleLogoChange,
    handleMultiplePhotosChange,
    handleMultiplePhotoUploadComplete,
    handlePersonaToggle,
    handlePhotoClick,
    handleSaveEdit,
    handleSelectChange,
    handleStartEdit,
    handleUnitAdded,
    handleUploadedLogoURL,
    handleUploadedPhotoURL,
    isEditing,
    isSubcollectionTab,
    setActiveTab,
    setEditedData,
    validationErrors,
    editedData,
  } = useContactDetailsController({
    contact,
    onContactUpdated,
  });

  // ADR-323: editedData holds only the dirty diff (Google-level diff-based
  // updates). In edit mode, merge it on top of enhancedFormData so inputs still
  // display the existing values, while the save path writes only the diff.
  const resolvedFormData = (
    isEditing ? { ...enhancedFormData, ...editedData } : enhancedFormData
  ) as ContactFormData;

  return (
    <ContactEditFocusProvider>
      <DetailsContainer
        selectedItem={contact ?? null}
        header={
          <ContactDetailsHeader
            contact={contact!}
            onDeleteContact={readOnly ? undefined : onDeleteContact}
            onNewContact={readOnly ? undefined : onNewContact}
            isEditing={isEditing}
            onStartEdit={readOnly ? undefined : handleStartEdit}
            onSaveEdit={() => {
              void handleSaveEdit();
            }}
            onCancelEdit={handleCancelEdit}
            hideEditControls={readOnly || isSubcollectionTab}
            activePersonas={enhancedFormData.activePersonas as PersonaType[]}
            onPersonaToggle={readOnly ? undefined : handlePersonaToggle}
          />
        }
        onCreateAction={readOnly ? undefined : onNewContact}
        emptyStateProps={{
          icon: Users,
          title: t('emptyState.title'),
          description: t('emptyState.description'),
        }}
      >
        {!readOnly && (
          <ContactDetailsMobileActions
            isEditing={isEditing}
            onStartEdit={handleStartEdit}
            onSaveEdit={() => {
              void handleSaveEdit();
            }}
            onCancelEdit={handleCancelEdit}
            hideEditControls={isSubcollectionTab}
          />
        )}

        <UnifiedContactTabbedSection
          contactType={contact?.type || 'individual'}
          formData={resolvedFormData}
          handleChange={handleFieldChange}
          handleSelectChange={handleSelectChange}
          setFormData={isEditing ? setEditedData : undefined}
          handleMultiplePhotosChange={isEditing ? handleMultiplePhotosChange : undefined}
          handleMultiplePhotoUploadComplete={isEditing ? handleMultiplePhotoUploadComplete : undefined}
          disabled={!isEditing}
          isContactTrashed={readOnly}
          relationshipsMode={isEditing ? 'full' : 'summary'}
          onPhotoClick={handlePhotoClick}
          initialTab={activeTab}
          onActiveTabChange={setActiveTab}
          handleUploadedLogoURL={isEditing ? handleUploadedLogoURL : undefined}
          handleUploadedPhotoURL={isEditing ? handleUploadedPhotoURL : undefined}
          handleFileChange={isEditing ? handleFileChange : undefined}
          handleLogoChange={isEditing ? handleLogoChange : undefined}
          validationErrors={isEditing ? validationErrors : undefined}
          onFieldBlur={isEditing ? handleFieldBlur : undefined}
        />
      </DetailsContainer>

      {contact?.id && (
        <AddPropertyToContactDialog
          open={isAddUnitDialogOpen}
          onOpenChange={setIsAddUnitDialogOpen}
          contactId={contact.id}
          onPropertyAdded={handleUnitAdded}
        />
      )}

      {contactGuardDialogs}
    </ContactEditFocusProvider>
  );
}
