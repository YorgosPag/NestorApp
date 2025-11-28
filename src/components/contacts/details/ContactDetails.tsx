'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ScrollArea } from "@/components/ui/scroll-area";
import { TabsContent } from '@/components/ui/tabs';
import { User, CreditCard, Phone, MapPin, FileText, History, Users, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import type { Contact } from '@/types/contacts';
import { ContactDetailsHeader } from './ContactDetailsHeader';
import { ContactInfo } from './ContactInfo';
import { AddUnitToContactDialog } from './AddUnitToContactDialog';
import { TabsOnlyTriggers } from '@/components/ui/navigation/TabsComponents';


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

  // Define tabs configuration for natural person
  const tabs = [
    {
      id: 'basic',
      label: 'Βασικά Στοιχεία',
      icon: User,
      content: (
        <div className="p-4 border rounded-lg">
          <h4 className="font-semibold mb-4">Βασικά Στοιχεία</h4>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Ονοματεπώνυμο</label>
                <p className="text-sm text-muted-foreground">{contact.firstName} {contact.lastName}</p>
              </div>
              <div>
                <label className="text-sm font-medium">Πατρώνυμο</label>
                <p className="text-sm text-muted-foreground">{(contact as any).fatherName || '-'}</p>
              </div>
              <div>
                <label className="text-sm font-medium">Μητρώνυμο</label>
                <p className="text-sm text-muted-foreground">{(contact as any).motherName || '-'}</p>
              </div>
              <div>
                <label className="text-sm font-medium">Ημερομηνία Γέννησης</label>
                <p className="text-sm text-muted-foreground">{(contact as any).birthDate ? new Date((contact as any).birthDate).toLocaleDateString('el-GR') : '-'}</p>
              </div>
              <div>
                <label className="text-sm font-medium">Χώρα Γέννησης</label>
                <p className="text-sm text-muted-foreground">{(contact as any).birthCountry || '-'}</p>
              </div>
              <div>
                <label className="text-sm font-medium">Φύλο</label>
                <p className="text-sm text-muted-foreground">
                  {(contact as any).gender === 'male' ? 'Άντρας' :
                   (contact as any).gender === 'female' ? 'Γυναίκα' :
                   (contact as any).gender === 'other' ? 'Άλλο' : '-'}
                </p>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">ΑΜΚΑ (προαιρετικό)</label>
              <p className="text-sm text-muted-foreground">{(contact as any).amka || '-'}</p>
            </div>
            {(contact as any).photoURL && (
              <div className="col-span-2 mt-4">
                <label className="text-sm font-medium">Φωτογραφία</label>
                <div className="mt-2 flex items-center gap-4">
                  <div
                    className="w-24 h-24 bg-muted rounded-lg overflow-hidden cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => setIsPhotoModalOpen(true)}
                  >
                    <img
                      src={(contact as any).photoURL}
                      alt={`Φωτογραφία ${contact.firstName} ${contact.lastName}`}
                      className="w-full h-full object-contain"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        const parent = target.parentElement;
                        if (parent) {
                          parent.innerHTML = '<div class="text-xs text-muted-foreground flex items-center justify-center h-full">❌ Άκυρη εικόνα</div>';
                        }
                      }}
                    />
                  </div>
                  <div className="text-sm text-muted-foreground">
                    <a
                      href={(contact as any).photoURL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline"
                    >
                      Άνοιγμα σε νέο παράθυρο
                    </a>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )
    },
    {
      id: 'identity',
      label: 'Ταυτότητα & ΑΦΜ',
      icon: CreditCard,
      content: (
        <div className="p-4 border rounded-lg">
          <h4 className="font-semibold mb-4">Ταυτότητα & ΑΦΜ</h4>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Τύπος Εγγράφου</label>
                <p className="text-sm text-muted-foreground">
                  {(contact as any).documentType === 'identity_card' ? 'Δελτίο Ταυτότητας' :
                   (contact as any).documentType === 'passport' ? 'Διαβατήριο' :
                   (contact as any).documentType === 'drivers_license' ? 'Άδεια Οδήγησης' :
                   (contact as any).documentType === 'other' ? 'Άλλο' : '-'}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium">Εκδούσα Αρχή</label>
                <p className="text-sm text-muted-foreground">{(contact as any).documentIssuer || '-'}</p>
              </div>
              <div>
                <label className="text-sm font-medium">Αριθμός Εγγράφου</label>
                <p className="text-sm text-muted-foreground">{(contact as any).documentNumber || '-'}</p>
              </div>
              <div>
                <label className="text-sm font-medium">Ημερομηνία Έκδοσης</label>
                <p className="text-sm text-muted-foreground">{(contact as any).documentIssueDate ? new Date((contact as any).documentIssueDate).toLocaleDateString('el-GR') : '-'}</p>
              </div>
              <div>
                <label className="text-sm font-medium">Ημερομηνία Λήξης</label>
                <p className="text-sm text-muted-foreground">{(contact as any).documentExpiryDate ? new Date((contact as any).documentExpiryDate).toLocaleDateString('el-GR') : '-'}</p>
              </div>
              <div>
                <label className="text-sm font-medium">ΑΦΜ</label>
                <p className="text-sm text-muted-foreground">{(contact as any)?.vatNumber || '-'}</p>
              </div>
              <div>
                <label className="text-sm font-medium">ΔΟΥ</label>
                <p className="text-sm text-muted-foreground">{(contact as any).taxOffice || '-'}</p>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'communication',
      label: 'Επικοινωνία & Socials',
      icon: Phone,
      content: (
        <div className="p-4 border rounded-lg">
          <h4 className="font-semibold mb-4">Επικοινωνία & Socials</h4>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Emails</label>
              {contact.emails?.length ? (
                <div className="space-y-1">
                  {contact.emails.map((email, index) => (
                    <p key={index} className="text-sm text-muted-foreground">{email.email} ({email.type})</p>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">-</p>
              )}
            </div>
            <div>
              <label className="text-sm font-medium">Τηλέφωνα</label>
              {contact.phones?.length ? (
                <div className="space-y-1">
                  {contact.phones.map((phone, index) => (
                    <p key={index} className="text-sm text-muted-foreground">{phone.number} ({phone.type})</p>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">-</p>
              )}
            </div>
            <div>
              <label className="text-sm font-medium">Social Media</label>
              <p className="text-sm text-muted-foreground">-</p>
            </div>
            <div>
              <label className="text-sm font-medium">Websites</label>
              <p className="text-sm text-muted-foreground">-</p>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'addresses',
      label: 'Διευθύνσεις & Επάγγελμα',
      icon: MapPin,
      content: (
        <div className="p-4 border rounded-lg">
          <h4 className="font-semibold mb-4">Διευθύνσεις & Επαγγελματικά Στοιχεία</h4>
          <div className="space-y-6">
            <div>
              <h5 className="font-medium mb-2">Διευθύνσεις</h5>
              {contact.addresses?.length ? (
                <div className="space-y-2">
                  {contact.addresses.map((address, index) => (
                    <div key={index} className="text-sm">
                      <p className="font-medium">{address.type}</p>
                      <p className="text-muted-foreground">
                        {address.street} {address.number}, {address.postalCode} {address.city}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">-</p>
              )}
            </div>
            <div>
              <h5 className="font-medium mb-2">Επαγγελματικά Στοιχεία</h5>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Επάγγελμα</label>
                  <p className="text-sm text-muted-foreground">{(contact as any)?.profession || '-'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Ειδικότητα</label>
                  <p className="text-sm text-muted-foreground">{(contact as any)?.specialty || '-'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Επιχείρηση/Εργοδότης</label>
                  <p className="text-sm text-muted-foreground">{(contact as any)?.employer || '-'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Θέση/Ρόλος</label>
                  <p className="text-sm text-muted-foreground">{(contact as any)?.position || '-'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Διεύθυνση Εργασίας</label>
                  <p className="text-sm text-muted-foreground">{(contact as any)?.workAddress || '-'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Ιστοσελίδα Επαγγελματικού Προφίλ</label>
                  <p className="text-sm text-muted-foreground">{(contact as any)?.workWebsite || '-'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'files',
      label: 'Έγγραφα',
      icon: FileText,
      content: (
        <div className="p-4 border rounded-lg">
          <h4 className="font-semibold mb-2">Σχετικά Έγγραφα</h4>
          <p className="text-sm text-muted-foreground">Λίστα εγγράφων...</p>
        </div>
      )
    },
    {
      id: 'history',
      label: 'Ιστορικό & Σημειώσεις',
      icon: History,
      content: (
        <div className="p-4 border rounded-lg">
          <h4 className="font-semibold mb-4">Ιστορικό & Σημειώσεις</h4>
          <div className="space-y-4">
            <div>
              <h5 className="font-medium mb-2">Ιστορικό Αλλαγών</h5>
              <p className="text-sm text-muted-foreground">Ιστορικό αλλαγών και ενεργειών...</p>
            </div>
            <div>
              <h5 className="font-medium mb-2">Σημειώσεις</h5>
              <p className="text-sm text-muted-foreground">Ελεύθερες σημειώσεις...</p>
            </div>
          </div>
        </div>
      )
    }
  ];

  return (
    <>
      <div className="flex-1 flex flex-col bg-card border rounded-lg min-w-0 shadow-sm">
        <ContactDetailsHeader contact={contact} onEditContact={onEditContact} onDeleteContact={onDeleteContact} />
        <ScrollArea className="flex-1">
          <div className="p-4">
            <TabsOnlyTriggers
              tabs={tabs}
              defaultTab="basic"
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
