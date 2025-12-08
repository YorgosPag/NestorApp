'use client';

import React, { useState, useCallback } from 'react';
import { Users } from 'lucide-react';
import type { Contact } from '@/types/contacts';
import { ContactDetailsHeader } from './ContactDetailsHeader';
import { AddUnitToContactDialog } from './AddUnitToContactDialog';
import { UnifiedContactTabbedSection } from '@/components/ContactFormSections/UnifiedContactTabbedSection';
import { PhotoPreviewModal, usePhotoPreviewModal } from '@/core/modals';
import { DetailsContainer } from '@/core/containers';

interface ContactDetailsProps {
  contact: Contact | null;
  onEditContact?: () => void;
  onDeleteContact?: () => void;
}

export function ContactDetails({ contact, onEditContact, onDeleteContact }: ContactDetailsProps) {
  const [isAddUnitDialogOpen, setIsAddUnitDialogOpen] = useState(false);
  const photoModal = usePhotoPreviewModal();

  const handleUnitAdded = useCallback(() => {
    // TODO: Refresh data when unit is added
  }, []);

  // 🎯 Handler για άνοιγμα του relationship management modal
  const handleOpenRelationshipModal = useCallback(() => {
    console.log('🏢 Opening edit modal for relationship management');
    onEditContact?.(); // Χρησιμοποιούμε το existing edit modal
  }, [onEditContact]);

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
          formData={contact || {}}
          handleChange={() => {}} // Read-only για details view
          handleSelectChange={() => {}} // Read-only για details view
          disabled={true} // Read-only mode
          relationshipsMode="summary" // 🎯 KEY: Summary mode για main view
          onOpenRelationshipModal={handleOpenRelationshipModal} // 🎯 Handler για relationships management
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

      {/* ✅ Κεντρικοποιημένο Photo Preview Modal */}
      <PhotoPreviewModal {...photoModal.modalProps} />
    </>
  );
}
