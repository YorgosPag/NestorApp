'use client';

import { useState, useCallback } from 'react';
import CommunicationsHistory from "@/components/CommunicationsHistory";
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { ContactSearchManager } from '@/components/contacts/relationships/ContactSearchManager';
import type { ContactSummary } from '@/components/ui/enterprise-contact-dropdown';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { MessageSquare, User } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';

export default function CrmCommunicationsPage() {
  const [selectedContact, setSelectedContact] = useState<ContactSummary | null>(null);
  const colors = useSemanticColors();
  const iconSizes = useIconSizes();

  // 🏢 ENTERPRISE: Handle contact selection
  const handleContactSelect = useCallback((contact: ContactSummary | null) => {
    setSelectedContact(contact);
  }, []);

  return (
    <div className="p-6 space-y-6">
      {/* Contact Selector Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className={iconSizes.lg} />
            Επιλογή Επαφής
          </CardTitle>
          <CardDescription>
            Επιλέξτε μια επαφή για να δείτε το ιστορικό επικοινωνιών της.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ContactSearchManager
            selectedContactId={selectedContact?.id ?? ''}
            onContactSelect={handleContactSelect}
            label="Αναζήτηση επαφής"
            placeholder="Πληκτρολογήστε όνομα ή email..."
            allowedContactTypes={['individual', 'company', 'service']}
          />
          {selectedContact && (
            <div className="mt-4 p-3 rounded-lg bg-accent/50 flex items-center gap-3">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <User className={`${iconSizes.md} text-primary`} />
                </div>
              </div>
              <div>
                <p className="font-medium">{selectedContact.name}</p>
                <p className="text-sm text-muted-foreground">
                  {selectedContact.email || selectedContact.phone || selectedContact.type}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Communications History Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className={iconSizes.lg} />
            Ιστορικό Επικοινωνιών
          </CardTitle>
          <CardDescription>
            {selectedContact
              ? `Όλες οι επικοινωνίες με ${selectedContact.name}`
              : 'Επιλέξτε μια επαφή για να δείτε το ιστορικό επικοινωνιών της.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {selectedContact ? (
            <CommunicationsHistory contactId={selectedContact.id} />
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <MessageSquare className="h-12 w-12 mb-4 opacity-50" />
              <p className="text-lg font-medium">Δεν έχει επιλεγεί επαφή</p>
              <p className="text-sm">Χρησιμοποιήστε την αναζήτηση παραπάνω για να επιλέξετε μια επαφή.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
