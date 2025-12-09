'use client';

import React, { useState, useCallback } from 'react';
import { Users } from 'lucide-react';
import type { Contact } from '@/types/contacts';
import { ContactDetailsHeader } from './ContactDetailsHeader';
import { AddUnitToContactDialog } from './AddUnitToContactDialog';
import { UnifiedContactTabbedSection } from '@/components/ContactFormSections/UnifiedContactTabbedSection';
import { openGalleryPhotoModal } from '@/core/modals';
import { useGlobalPhotoPreview } from '@/providers/PhotoPreviewProvider';
import { DetailsContainer } from '@/core/containers';

interface ContactDetailsProps {
  contact: Contact | null;
  onEditContact?: () => void;
  onDeleteContact?: () => void;
}

export function ContactDetails({ contact, onEditContact, onDeleteContact }: ContactDetailsProps) {
  const [isAddUnitDialogOpen, setIsAddUnitDialogOpen] = useState(false);
  const photoModal = useGlobalPhotoPreview();

  const handleUnitAdded = useCallback(() => {
    // TODO: Refresh data when unit is added
  }, []);

  // 🎯 Handler για άνοιγμα του relationship management modal
  const handleOpenRelationshipModal = useCallback(() => {
    console.log('🏢 Opening edit modal for relationship management');
    onEditContact?.(); // Χρησιμοποιούμε το existing edit modal
  }, [onEditContact]);

  // 📸 Convert multiplePhotoURLs to PhotoSlot format for MultiplePhotosUpload
  const enhancedFormData = React.useMemo(() => {
    if (!contact) return {};

    const multiplePhotoURLs = (contact as any).multiplePhotoURLs || [];
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
      ...contact,
      multiplePhotos
    };
  }, [contact]);

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
            onEditContact={onEditContact}
            onDeleteContact={onDeleteContact}
          />
        }
        emptyStateProps={{
          icon: Users,
          title: "Επιλέξτε μια επαφή",
          description: "Επιλέξτε μια επαφή από τη λίστα για να δείτε τις λεπτομέρειές της."
        }}
      >
        <UnifiedContactTabbedSection
          contactType={contact?.type || 'individual'}
          formData={enhancedFormData} // 📸 Use enhanced data with multiplePhotos
          handleChange={() => {}} // Read-only για details view
          handleSelectChange={() => {}} // Read-only για details view
          disabled={true} // Read-only mode
          relationshipsMode="summary" // 🎯 KEY: Summary mode για main view
          onOpenRelationshipModal={handleOpenRelationshipModal} // 🎯 Handler για relationships management
          onPhotoClick={handlePhotoClick} // 🖼️ Photo click handler για gallery preview
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
