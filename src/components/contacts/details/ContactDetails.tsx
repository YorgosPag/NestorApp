'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ScrollArea } from "@/components/ui/scroll-area";
import { TabsContent } from '@/components/ui/tabs';
import { User, CreditCard, Phone, MapPin, Briefcase, StickyNote, Users, Info, FileText, History } from 'lucide-react';
import type { Contact } from '@/types/contacts';
import { ContactDetailsHeader } from './ContactDetailsHeader';
import { ContactInfo } from './ContactInfo';
import { AddUnitToContactDialog } from './AddUnitToContactDialog';
import { TabsOnlyTriggers } from '@/components/ui/navigation/TabsComponents';
import { createTabsFromConfig, createIndividualTabsFromConfig, createServiceTabsFromConfig, getSortedSections } from '@/components/generic';
import { PhotoPreviewModal, usePhotoPreviewModal, openGalleryPhotoModal } from '@/core/modals';
import { getIndividualSortedSections } from '@/config/individual-config';
import { getServiceSortedSections } from '@/config/service-config';


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

  const handleUnitAdded = useCallback(() => {
    // TODO: Refresh data when unit is added
  }, []);

  const handleRefresh = useCallback(() => {
    // TODO: Refresh contact data
  }, []);

  // Handler για photo click στο Individual photos tab
  const handlePhotoClick = useCallback((photoUrl: string, photoIndex: number) => {
    if (!contact) return;

    openGalleryPhotoModal(photoModal, contact, photoIndex);
  }, [photoModal, contact]);

  if (!contact) {
    return <EmptyState />;
  }

  // Define tabs configuration based on contact type
  const isCompanyContact = contact.type === 'company';

  // Get tabs from centralized config based on contact type
  const tabs = isCompanyContact ? createTabsFromConfig(
    getSortedSections(),
    contact
  ) : contact.type === 'individual' ? createIndividualTabsFromConfig(
    getIndividualSortedSections(),
    contact,
    undefined, // customRenderers
    undefined, // valueFormatters
    handlePhotoClick // onPhotoClick callback
  ) : contact.type === 'service' ? createServiceTabsFromConfig(
    getServiceSortedSections(),
    contact
  ) : [];

  return (
    <>
      <div className="flex-1 flex flex-col bg-card border rounded-lg min-w-0 shadow-sm">
        <ContactDetailsHeader contact={contact} onEditContact={onEditContact} onDeleteContact={onDeleteContact} />
        <ScrollArea className="flex-1">
          <div className="p-4">
            <TabsOnlyTriggers
              tabs={tabs}
              defaultTab={tabs[0]?.id || "info"}
              theme="warning"
            >
              {tabs.map((tab) => (
                <TabsContent key={tab.id} value={tab.id} className="mt-4">
                  {tab.content}
                </TabsContent>
              ))}
            </TabsOnlyTriggers>
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
