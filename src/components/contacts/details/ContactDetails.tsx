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
import { createCompanyTabsFromConfig, createIndividualTabsFromConfig, createServiceTabsFromConfig, getSortedSections } from '@/components/generic';
import { PhotoPreviewModal, usePhotoPreviewModal, openGalleryPhotoModal } from '@/core/modals';
import { getIndividualSortedSections } from '@/config/individual-config';
import { getServiceSortedSections } from '@/config/service-config';
import { ContactRelationshipManager } from '@/components/contacts/relationships';
import { RelationshipsSummary } from '@/components/contacts/relationships/RelationshipsSummary';


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

  // Handler για photo click στα Individual και Company photos
  const handlePhotoClick = useCallback((photoUrl: string, photoIndex: number, galleryPhotos?: (string | null)[]) => {
    if (!contact) return;

    openGalleryPhotoModal(photoModal, contact, photoIndex, galleryPhotos);
  }, [photoModal, contact]);

  // 🏢 ENTERPRISE: Custom renderers for specialized tabs
  const customRenderers = {
    relationships: () => {
      console.log('🔍 DEBUG: Relationships custom renderer called!', {
        contactId: contact.id,
        contactType: contact.type
      });

      try {
        return (
          <RelationshipsSummary
            contactId={contact.id}
            contactType={contact.type}
            readonly={false}
            onManageRelationships={() => {
              console.log('🏢 Opening relationships management modal...');
              // TODO: Open relationships management modal with ContactRelationshipManager
            }}
          />
        );
      } catch (error) {
        console.error('❌ ERROR: RelationshipsSummary crashed!', error);
        return (
          <div className="p-4 border border-red-300 bg-red-50 rounded-lg">
            <h3 className="text-red-800 font-bold">Error Loading Relationships</h3>
            <p className="text-red-600">{error?.message || 'Unknown error'}</p>
            <p className="text-xs text-gray-600 mt-2">Check console for details</p>
          </div>
        );
      }
    }
  };

  if (!contact) {
    return <EmptyState />;
  }

  // Define tabs configuration based on contact type
  const isCompanyContact = contact.type === 'company';

  // Get tabs from centralized config based on contact type
  const tabs = isCompanyContact ? createCompanyTabsFromConfig(
    getSortedSections(),
    contact,
    customRenderers, // customRenderers για relationships tab
    undefined, // valueFormatters
    handlePhotoClick // onPhotoClick callback για εταιρείες
  ) : contact.type === 'individual' ? createIndividualTabsFromConfig(
    getIndividualSortedSections(),
    contact,
    customRenderers, // customRenderers για relationships tab
    undefined, // valueFormatters
    handlePhotoClick // onPhotoClick callback
  ) : contact.type === 'service' ? createServiceTabsFromConfig(
    getServiceSortedSections(),
    contact,
    customRenderers, // customRenderers για relationships tab
    undefined, // valueFormatters
    handlePhotoClick // onPhotoClick callback για δημόσιες υπηρεσίες
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
