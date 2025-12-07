'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Users } from 'lucide-react';
import type { Contact } from '@/types/contacts';
import { ContactDetailsHeader } from './ContactDetailsHeader';
import { AddUnitToContactDialog } from './AddUnitToContactDialog';
import { UnifiedContactTabbedSection } from '@/components/ContactFormSections/UnifiedContactTabbedSection';
import { PhotoPreviewModal, usePhotoPreviewModal, openGalleryPhotoModal } from '@/core/modals';


function EmptyState() {
    return (
        <div className="flex-1 flex flex-col items-center justify-center bg-card border rounded-lg min-w-0 shadow-sm text-center p-8">
            <Users className="w-16 h-16 text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold text-foreground">Επιλέξτε μια επαφή</h2>
            <p className="text-muted-foreground">Επιλέξτε μια επαφή από τη λίστα για να δείτε τις λεπτομέρειές της.</p>
        </div>
    );
}

interface ContactDetailsProps {
  contact: Contact | null;
  onEditContact?: () => void;
  onDeleteContact?: () => void;
}

export function ContactDetails({ contact, onEditContact, onDeleteContact }: ContactDetailsProps) {
  const [isAddUnitDialogOpen, setIsAddUnitDialogOpen] = useState(false);
  const photoModal = usePhotoPreviewModal();

  // Contact data is available via props
  useEffect(() => {
    // Contact debugging removed - clean console
  }, [contact]);

  const handleUnitAdded = useCallback(() => {
    // TODO: Refresh data when unit is added
  }, []);

  const handleRefresh = useCallback(() => {
    // TODO: Refresh contact data
  }, []);

  // 🎯 Handler για άνοιγμα του relationship management modal
  const handleOpenRelationshipModal = useCallback(() => {
    console.log('🏢 Opening edit modal for relationship management');
    onEditContact?.(); // Χρησιμοποιούμε το existing edit modal
  }, [onEditContact]);

  // Handler για photo click στα Individual και Company photos
  const handlePhotoClick = useCallback((photoUrl: string, photoIndex: number, galleryPhotos?: (string | null)[]) => {
    if (!contact) return;

    openGalleryPhotoModal(photoModal, contact, photoIndex, galleryPhotos);
  }, [photoModal, contact]);

  if (!contact) {
    return <EmptyState />;
  }

  return (
    <>
      <div className="flex-1 flex flex-col bg-card border rounded-lg min-w-0 shadow-sm">
        <ContactDetailsHeader contact={contact} onEditContact={onEditContact} onDeleteContact={onDeleteContact} />
        <ScrollArea className="flex-1">
          <div className="p-4">
            <UnifiedContactTabbedSection
              contactType={contact.type}
              formData={contact}
              handleChange={() => {}} // Read-only για details view
              handleSelectChange={() => {}} // Read-only για details view
              disabled={true} // Read-only mode
              relationshipsMode="summary" // 🎯 KEY: Summary mode για main view
              onOpenRelationshipModal={handleOpenRelationshipModal} // 🎯 Handler για relationships management
            />
          </div>
        </ScrollArea>
      </div>

      {contact.id && (
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
