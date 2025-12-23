'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { ContactsService } from '@/services/contacts.service';
import toast from 'react-hot-toast';
import type { Contact } from '@/types/contacts';
import { getContactDisplayName } from '@/types/contacts';
import { Loader2, Archive, Users, Building, Shield } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { CONTACT_TYPES, getContactIcon, getContactLabel, getContactColor } from '@/constants/contacts';
import { TRANSITION_PRESETS, INTERACTIVE_PATTERNS } from '@/components/ui/effects';

interface ArchiveContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact: Contact | null;
  selectedContactIds?: string[];
  onContactsArchived: () => void;
}

export function ArchiveContactDialog({
  open,
  onOpenChange,
  contact,
  selectedContactIds = [],
  onContactsArchived
}: ArchiveContactDialogProps) {
  const iconSizes = useIconSizes();
  const [loading, setLoading] = useState(false);
  const [archiveReason, setArchiveReason] = useState('');

  const isMultipleArchive = selectedContactIds.length > 1;
  const isSingleSelectedArchive = selectedContactIds.length === 1;
  const isCurrentContactArchive = contact && !isSingleSelectedArchive;

  const getContactIconComponent = (contact: Contact) => {
    const IconComponent = getContactIcon(contact.type);
    const colorClass = getContactColor(contact.type, 'primary');
    return <IconComponent className={`${iconSizes.sm} ${colorClass}`} />;
  };

  const getDialogTitle = () => {
    if (isMultipleArchive) {
      return `Αρχειοθέτηση ${selectedContactIds.length} Επαφών`;
    }
    return 'Αρχειοθέτηση Επαφής';
  };

  const getDialogDescription = () => {
    if (isMultipleArchive) {
      return `Είστε βέβαιοι ότι θέλετε να αρχειοθετήσετε ${selectedContactIds.length} επαφές; Οι επαφές θα μετακινηθούν στο αρχείο αλλά δεν θα διαγραφούν μόνιμα.`;
    }

    const contactToArchive = contact;
    if (contactToArchive) {
      return `Είστε βέβαιοι ότι θέλετε να αρχειοθετήσετε την επαφή "${getContactDisplayName(contactToArchive)}"; Η επαφή θα μετακινηθεί στο αρχείο αλλά δεν θα διαγραφεί μόνιμα.`;
    }

    return 'Είστε βέβαιοι ότι θέλετε να αρχειοθετήσετε την επαφή; Η επαφή θα μετακινηθεί στο αρχείο αλλά δεν θα διαγραφεί μόνιμα.';
  };

  const handleArchive = async () => {
    if (loading) return;
    setLoading(true);

    try {
      if (isMultipleArchive) {
        // Αρχειοθέτηση πολλών επαφών
        await ContactsService.archiveMultipleContacts(selectedContactIds, archiveReason || undefined);
        toast.success(`${selectedContactIds.length} επαφές αρχειοθετήθηκαν επιτυχώς.`);
      } else if (contact) {
        // Αρχειοθέτηση μίας επαφής
        await ContactsService.archiveContact(contact.id!, archiveReason || undefined);
        toast.success(`Η επαφή "${getContactDisplayName(contact)}" αρχειοθετήθηκε επιτυχώς.`);
      }

      onContactsArchived();
      onOpenChange(false);
      setArchiveReason(''); // Clear form
    } catch (error) {
      console.error('Archive error:', error);
      toast.error(
        isMultipleArchive
          ? 'Δεν ήταν δυνατή η αρχειοθέτηση των επαφών.'
          : 'Δεν ήταν δυνατή η αρχειοθέτηση της επαφής.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    if (!loading) {
      onOpenChange(false);
      setArchiveReason(''); // Clear form
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-orange-600">
            <Archive className={iconSizes.md} />
            {getDialogTitle()}
          </DialogTitle>
          <DialogDescription className="text-base">
            {getDialogDescription()}
          </DialogDescription>
        </DialogHeader>

        {/* Λεπτομέρειες επαφής/επαφών */}
        <div className="py-4 space-y-4">
          {isMultipleArchive ? (
            <div className="bg-muted p-3 rounded-lg">
              <p className="text-sm font-medium text-muted-foreground">
                Επιλεγμένες επαφές για αρχειοθέτηση: {selectedContactIds.length}
              </p>
            </div>
          ) : contact ? (
            <div className="bg-muted p-3 rounded-lg flex items-center gap-3">
              {getContactIconComponent(contact)}
              <div>
                <p className="font-medium">{getContactDisplayName(contact)}</p>
                <p className="text-sm text-muted-foreground">
                  {getContactLabel(contact.type, 'singular')}
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-muted p-3 rounded-lg">
              <p className="text-sm text-muted-foreground">Δεν υπάρχει επιλεγμένη επαφή.</p>
            </div>
          )}

          {/* Πεδίο για λόγο αρχειοθέτησης */}
          <div className="space-y-2">
            <Label htmlFor="archive-reason" className="text-sm font-medium">
              Λόγος αρχειοθέτησης (προαιρετικό)
            </Label>
            <Input
              id="archive-reason"
              placeholder="π.χ. Ανενεργός πελάτης, Μετακόμιση, Κλείσιμο εταιρείας..."
              value={archiveReason}
              onChange={(e) => setArchiveReason(e.target.value)}
              disabled={loading}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              Ο λόγος αρχειοθέτησης θα σας βοηθήσει να θυμηθείτε γιατί μετακινήσατε την επαφή στο αρχείο.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={handleCancel}
            disabled={loading}
          >
            Άκυρο
          </Button>
          <Button
            type="button"
            variant="default"
            onClick={handleArchive}
            disabled={loading || (!contact && selectedContactIds.length === 0)}
            className={`bg-orange-600 ${INTERACTIVE_PATTERNS.PRIMARY_HOVER} ${TRANSITION_PRESETS.STANDARD_COLORS}`}
          >
            {loading ? (
              <>
                <Loader2 className={`mr-2 ${iconSizes.sm} animate-spin`} />
                Αρχειοθέτηση...
              </>
            ) : (
              <>
                <Archive className={`mr-2 ${iconSizes.sm}`} />
                {isMultipleArchive ? `Αρχειοθέτηση ${selectedContactIds.length} Επαφών` : 'Αρχειοθέτηση Επαφής'}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}