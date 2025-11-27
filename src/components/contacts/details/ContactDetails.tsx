'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Info, FileText, History, Users } from 'lucide-react';
import type { Contact } from '@/types/contacts';
import { ContactDetailsHeader } from './ContactDetailsHeader';
import { ContactInfo } from './ContactInfo';
import { AddUnitToContactDialog } from './AddUnitToContactDialog';


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

  const handleUnitAdded = useCallback(() => {
    // TODO: Refresh data when unit is added
  }, []);

  const handleRefresh = useCallback(() => {
    // TODO: Refresh contact data
  }, []);

  if (!contact) {
    return <EmptyState />;
  }

  return (
    <>
      <div className="flex-1 flex flex-col bg-card border rounded-lg min-w-0 shadow-sm">
        <ContactDetailsHeader contact={contact} onEditContact={onEditContact} onDeleteContact={onDeleteContact} />
        <ScrollArea className="flex-1">
          <div className="p-4">
              <Tabs defaultValue="info">
                  <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="info"><Info className="w-4 h-4 mr-2"/>Πληροφορίες</TabsTrigger>
                      <TabsTrigger value="files"><FileText className="w-4 h-4 mr-2"/>Σχετικά Έγγραφα</TabsTrigger>
                      <TabsTrigger value="history"><History className="w-4 h-4 mr-2"/>Ιστορικό</TabsTrigger>
                  </TabsList>
                  <TabsContent value="info" className="mt-4">
                      <ContactInfo
                        contact={contact}
                        onAddUnit={() => setIsAddUnitDialogOpen(true)}
                        onRefresh={handleRefresh}
                      />
                  </TabsContent>
                  <TabsContent value="files" className="mt-4">
                      <div className="p-4 border rounded-lg">
                          <h4 className="font-semibold mb-2">Έγγραφα</h4>
                          <p className="text-sm">Λίστα εγγράφων...</p>
                      </div>
                  </TabsContent>
                  <TabsContent value="history" className="mt-4">
                      <div className="p-4 border rounded-lg">
                          <h4 className="font-semibold mb-2">Ιστορικό</h4>
                          <p className="text-sm">Ιστορικό αλλαγών και ενεργειών...</p>
                      </div>
                  </TabsContent>
              </Tabs>
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
    </>
  );
}
