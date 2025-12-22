'use client';

import React, { useState, useCallback } from 'react';
import { Users, Edit, Check, X } from 'lucide-react';
import { useEmptyStateMessages, useActionMessages } from '@/hooks/useEnterpriseMessages';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useLayoutClasses } from '@/hooks/useLayoutClasses';
import { Button } from '@/components/ui/button';
import type { Contact } from '@/types/contacts';
import type { ContactFormData } from '@/types/ContactFormTypes'; // 🏢 ENTERPRISE: Type-safe form data
import { ContactDetailsHeader } from './ContactDetailsHeader';
import { AddUnitToContactDialog } from './AddUnitToContactDialog';
import { openGalleryPhotoModal } from '@/core/modals';
import { useGlobalPhotoPreview } from '@/providers/PhotoPreviewProvider';
import { DetailsContainer } from '@/core/containers';
import { ContactsService } from '@/services/contacts.service';
import { mapContactToFormData } from '@/utils/contactForm/contactMapper';
import { UniversalTabsRenderer, CONTACT_COMPONENT_MAPPING, convertToUniversalConfig } from '@/components/generic';
import { getSortedContactTabs } from '@/config/contact-tabs-config';

interface ContactDetailsProps {
  contact: Contact | null;
  onEditContact?: () => void;
  onDeleteContact?: () => void;
  onContactUpdated?: () => void;
}

export function ContactDetails({ contact, onEditContact, onDeleteContact, onContactUpdated }: ContactDetailsProps) {
  const [isAddUnitDialogOpen, setIsAddUnitDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedData, setEditedData] = useState<Partial<ContactFormData>>({});
  const photoModal = useGlobalPhotoPreview();

  // 🗨️ ENTERPRISE: Centralized systems
  const emptyStateMessages = useEmptyStateMessages();
  const actionMessages = useActionMessages();
  const iconSizes = useIconSizes();
  const layout = useLayoutClasses();

  const handleUnitAdded = useCallback(() => {
    // TODO: Refresh data when unit is added
  }, []);


  // 🔧 FIX: Use proper mapper to convert Contact to ContactFormData
  const enhancedFormData = React.useMemo(() => {
    if (!contact) return {};

    // Use the enterprise mapper system instead of manual conversion
    const mappingResult = mapContactToFormData(contact);
    console.log('🔧 ContactDetails: Using mapper for contact type:', contact.type, {
      contactId: contact.id,
      mappingWarnings: mappingResult.warnings,
      email: mappingResult.formData.email,
      phone: mappingResult.formData.phone,
      website: mappingResult.formData.website
    });

    // Additional multiplePhotoURLs conversion for backward compatibility
    const multiplePhotoURLs = (contact as any).multiplePhotoURLs || [];
    if (multiplePhotoURLs.length > 0) {
      const multiplePhotos = multiplePhotoURLs.map((url: string) => ({
        file: null,
        preview: undefined,
        uploadUrl: url,
        fileName: undefined,
        isUploading: false,
        uploadProgress: 0,
        error: undefined
      }));

      return {
        ...mappingResult.formData,
        multiplePhotos: [...(mappingResult.formData.multiplePhotos || []), ...multiplePhotos]
      };
    }

    return mappingResult.formData;
  }, [contact]);

  // 🎯 EDIT MODE HANDLERS
  const handleStartEdit = useCallback(() => {
    if (contact) {
      // Use mapper for consistent data structure in edit mode
      const mappingResult = mapContactToFormData(contact);
      setEditedData(mappingResult.formData);
      setIsEditing(true);
    }
  }, [contact]);

  const handleCancelEdit = useCallback(() => {
    setIsEditing(false);
    setEditedData({});
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!contact?.id) return;

    try {
      // 🏢 ENTERPRISE: Use new form-to-arrays conversion method
      await ContactsService.updateContactFromForm(contact.id, editedData);
      setIsEditing(false);
      setEditedData({});

      // 🔄 TRIGGER REFRESH: Notify parent component to refresh data
      console.log('✅ Contact updated successfully with enterprise structure');
      if (onContactUpdated) {
        console.log('🔄 CONTACT DETAILS: Triggering parent refresh after save');
        onContactUpdated();
      }
    } catch (error) {
      console.error('❌ Failed to update contact:', error);
      // TODO: Show error toast
    }
  }, [contact?.id, editedData, onContactUpdated]);

  const handleFieldChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setEditedData((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleSelectChange = useCallback((name: string, value: string) => {
    setEditedData((prev) => ({ ...prev, [name]: value }));
  }, []);

  // 🖼️ Photo click handler για gallery preview
  const handlePhotoClick = React.useCallback((index: number) => {
    console.log('🔍 DEBUG ContactDetails: Photo click triggered', {
      index,
      contactExists: !!contact,
      photoModalExists: !!photoModal,
      openModalExists: !!photoModal?.openModal,
      multiplePhotoURLs: (contact as any)?.multiplePhotoURLs?.length || 0
    });

    if (contact) {
      console.log('🖼️ ContactDetails: Opening photo gallery at index:', index);
      openGalleryPhotoModal(photoModal, contact, index);
    }
  }, [contact, photoModal]);

  return (
    <>
      <DetailsContainer
        selectedItem={contact}
        header={
          <ContactDetailsHeader
            contact={contact!}
            onDeleteContact={onDeleteContact}
            isEditing={isEditing}
            onStartEdit={handleStartEdit}
            onSaveEdit={handleSaveEdit}
            onCancelEdit={handleCancelEdit}
          />
        }
        emptyStateProps={{
          icon: Users,
          ...emptyStateMessages.contact
        }}
      >
        {/* 🎯 EDIT MODE TOOLBAR - Μόνο για Mobile (Desktop κουμπιά στην επικεφαλίδα) */}
        <div className="md:hidden">
          {!isEditing ? (
            <div className="flex justify-end mb-4">
              <Button
                onClick={handleStartEdit}
                className={layout.flexCenterGap2}
                variant="outline"
              >
                <Edit className={iconSizes.sm} />
                {actionMessages.edit}
              </Button>
            </div>
          ) : (
            <div className={`${layout.flexGap2} justify-end mb-4`}>
              <Button
                onClick={handleSaveEdit}
                className={layout.flexCenterGap2}
                variant="default"
              >
                <Check className={iconSizes.sm} />
                {actionMessages.save}
              </Button>
              <Button
                onClick={handleCancelEdit}
                className={layout.flexCenterGap2}
                variant="outline"
              >
                <X className={iconSizes.sm} />
                {actionMessages.cancel}
              </Button>
            </div>
          )}
        </div>

        <UniversalTabsRenderer
          tabs={getSortedContactTabs(contact?.type || 'individual').map(convertToUniversalConfig)}
          data={contact!}
          componentMapping={CONTACT_COMPONENT_MAPPING}
          defaultTab="basicInfo"
          theme="default"
          additionalData={{
            formData: isEditing ? editedData : enhancedFormData,
            handleChange: handleFieldChange,
            handleSelectChange: handleSelectChange,
            setFormData: isEditing ? setEditedData : undefined,
            disabled: !isEditing,
            relationshipsMode: isEditing ? "full" : "summary",
            onPhotoClick: handlePhotoClick,
          }}
          globalProps={{
            contactId: contact?.id || '',
            contactType: contact?.type || 'individual',
          }}
        />
      </DetailsContainer>

      {contact?.id && (
        <AddUnitToContactDialog
            open={isAddUnitDialogOpen}
            onOpenChange={setIsAddUnitDialogOpen}
            contactId={contact.id}
            onUnitAdded={handleUnitAdded}
        />
      )}

      {/* ✅ PhotoPreviewModal τώρα global - δεν χρειάζεται εδώ */}
    </>
  );
}
