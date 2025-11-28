'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ScrollArea } from "@/components/ui/scroll-area";
import { TabsContent } from '@/components/ui/tabs';
import { User, CreditCard, Phone, MapPin, Briefcase, StickyNote, Users, Info, FileText, History, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import type { Contact } from '@/types/contacts';
import { ContactDetailsHeader } from './ContactDetailsHeader';
import { ContactInfo } from './ContactInfo';
import { AddUnitToContactDialog } from './AddUnitToContactDialog';
import { TabsOnlyTriggers } from '@/components/ui/navigation/TabsComponents';
import { createTabsFromConfig, createIndividualTabsFromConfig, getSortedSections } from '@/components/generic';
import { getIndividualSortedSections } from '@/config/individual-config';


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
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);

  const handleUnitAdded = useCallback(() => {
    // TODO: Refresh data when unit is added
  }, []);

  const handleRefresh = useCallback(() => {
    // TODO: Refresh contact data
  }, []);

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
    contact
  ) : contact.type === 'service' ? [
    {
      id: 'serviceInfo',
      label: 'Στοιχεία Υπηρεσίας',
      icon: Info,
      content: (
        <div className="p-4 border rounded-lg space-y-4">
          <h4 className="font-semibold mb-3">Στοιχεία Δημόσιας Υπηρεσίας</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Όνομα Υπηρεσίας</label>
              <p className="text-sm text-muted-foreground">{(contact as any).serviceName || 'Δεν έχει οριστεί'}</p>
            </div>
            <div>
              <label className="text-sm font-medium">Τύπος Υπηρεσίας</label>
              <p className="text-sm text-muted-foreground">{(contact as any).serviceType || 'Δεν έχει οριστεί'}</p>
            </div>
            <div>
              <label className="text-sm font-medium">Email</label>
              <p className="text-sm text-muted-foreground">{(contact as any).emails?.[0]?.email || 'Δεν έχει οριστεί'}</p>
            </div>
            <div>
              <label className="text-sm font-medium">Τηλέφωνο</label>
              <p className="text-sm text-muted-foreground">{(contact as any).phones?.[0]?.number || 'Δεν έχει οριστεί'}</p>
            </div>
            <div>
              <label className="text-sm font-medium">Κωδικός Υπηρεσίας</label>
              <p className="text-sm text-muted-foreground">{(contact as any).serviceCode || 'Δεν έχει οριστεί'}</p>
            </div>
            <div>
              <label className="text-sm font-medium">Κατάσταση</label>
              <p className="text-sm text-muted-foreground">{(contact as any).status || 'Δεν έχει οριστεί'}</p>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'contacts',
      label: 'Στοιχεία Επικοινωνίας',
      icon: Users,
      content: (
        <div className="p-4 border rounded-lg space-y-4">
          <h4 className="font-semibold mb-3">Στοιχεία Επικοινωνίας</h4>

          {(contact as any).responsiblePersons && (contact as any).responsiblePersons.length > 0 ? (
            <div className="space-y-3">
              <h5 className="font-medium">Υπεύθυνοι Επικοινωνίας</h5>
              {(contact as any).responsiblePersons.map((person: any, index: number) => (
                <div key={index} className="border border-gray-200 rounded p-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                    <div><span className="font-medium">Όνομα:</span> {person.name || 'Δεν έχει οριστεί'}</div>
                    <div><span className="font-medium">Θέση:</span> {person.position || 'Δεν έχει οριστεί'}</div>
                    <div><span className="font-medium">Email:</span> {person.email || 'Δεν έχει οριστεί'}</div>
                    <div><span className="font-medium">Τηλέφωνο:</span> {person.phone || 'Δεν έχει οριστεί'}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Δεν υπάρχουν στοιχεία υπεύθυνων</p>
          )}
        </div>
      )
    },
    {
      id: 'services',
      label: 'Παρεχόμενες Υπηρεσίες',
      icon: FileText,
      content: (
        <div className="p-4 border rounded-lg space-y-4">
          <h4 className="font-semibold mb-3">Παρεχόμενες Υπηρεσίες</h4>

          {(contact as any).servicesProvided && (contact as any).servicesProvided.length > 0 ? (
            <ul className="space-y-2">
              {(contact as any).servicesProvided.map((service: string, index: number) => (
                <li key={index} className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-primary rounded-full"></span>
                  <span className="text-sm">{service}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Δεν υπάρχουν καταχωρημένες υπηρεσίες</p>
          )}

          {(contact as any).operatingHours && (
            <div className="mt-4">
              <h5 className="font-medium mb-2">Ωράριο Λειτουργίας</h5>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                <div><span className="font-medium">Δευτέρα - Παρασκευή:</span> 08:00 - 16:00</div>
              </div>
            </div>
          )}
        </div>
      )
    }
  ] : [];

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

      {/* Photo View Modal */}
      <Dialog open={isPhotoModalOpen} onOpenChange={setIsPhotoModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0">
          <div className="relative">
            <button
              onClick={() => setIsPhotoModalOpen(false)}
              className="absolute top-4 right-4 z-10 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center justify-center bg-black/5 min-h-[400px]">
              <img
                src={(contact as any).photoURL}
                alt={`Φωτογραφία ${contact.firstName} ${contact.lastName}`}
                className="max-w-full max-h-[80vh] object-contain rounded-lg"
              />
            </div>
            <div className="p-4 bg-white border-t">
              <h3 className="font-semibold text-lg text-gray-900">{contact.firstName} {contact.lastName}</h3>
              <p className="text-sm text-gray-600">Φωτογραφία επαφής</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
