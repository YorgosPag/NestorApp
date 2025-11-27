'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
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
import { Loader2, AlertTriangle, Users, Building, Shield } from 'lucide-react';

interface DeleteContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact: Contact | null;
  selectedContactIds?: string[];
  onContactsDeleted: () => void;
}

export function DeleteContactDialog({
  open,
  onOpenChange,
  contact,
  selectedContactIds = [],
  onContactsDeleted
}: DeleteContactDialogProps) {
  const [loading, setLoading] = useState(false);

  const isMultipleDelete = selectedContactIds.length > 1;
  const isSingleSelectedDelete = selectedContactIds.length === 1;
  const isCurrentContactDelete = contact && !isSingleSelectedDelete;

  const getContactIcon = (contact: Contact) => {
    switch (contact.type) {
      case 'individual': return <Users className="h-4 w-4 text-blue-500" />;
      case 'company': return <Building className="h-4 w-4 text-purple-500" />;
      case 'service': return <Shield className="h-4 w-4 text-green-500" />;
      default: return <Users className="h-4 w-4 text-gray-500" />;
    }
  };

  const getDialogTitle = () => {
    if (isMultipleDelete) {
      return `Διαγραφή ${selectedContactIds.length} Επαφών`;
    }
    return 'Διαγραφή Επαφής';
  };

  const getDialogDescription = () => {
    if (isMultipleDelete) {
      return `Είστε βέβαιοι ότι θέλετε να διαγράψετε ${selectedContactIds.length} επαφές; Αυτή η ενέργεια δεν μπορεί να αναιρεθεί.`;
    }

    const contactToDelete = contact;
    if (contactToDelete) {
      return `Είστε βέβαιοι ότι θέλετε να διαγράψετε την επαφή "${getContactDisplayName(contactToDelete)}"; Αυτή η ενέργεια δεν μπορεί να αναιρεθεί.`;
    }

    return 'Είστε βέβαιοι ότι θέλετε να διαγράψετε την επαφή; Αυτή η ενέργεια δεν μπορεί να αναιρεθεί.';
  };

  const handleDelete = async () => {
    if (loading) return;
    setLoading(true);

    try {
      if (isMultipleDelete) {
        // Διαγραφή πολλών επαφών
        await ContactsService.deleteMultipleContacts(selectedContactIds);
        toast.success(`${selectedContactIds.length} επαφές διαγράφηκαν επιτυχώς.`);
      } else if (contact) {
        // Διαγραφή μίας επαφής
        await ContactsService.deleteContact(contact.id!);
        toast.success(`Η επαφή "${getContactDisplayName(contact)}" διαγράφηκε επιτυχώς.`);
      }

      onContactsDeleted();
      onOpenChange(false);
    } catch (error) {
      console.error('Delete error:', error);
      toast.error(
        isMultipleDelete
          ? 'Δεν ήταν δυνατή η διαγραφή των επαφών.'
          : 'Δεν ήταν δυνατή η διαγραφή της επαφής.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    if (!loading) {
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            {getDialogTitle()}
          </DialogTitle>
          <DialogDescription className="text-base">
            {getDialogDescription()}
          </DialogDescription>
        </DialogHeader>

        {/* Λεπτομέρειες επαφής/επαφών */}
        <div className="py-4">
          {isMultipleDelete ? (
            <div className="bg-muted p-3 rounded-lg">
              <p className="text-sm font-medium text-muted-foreground">
                Επιλεγμένες επαφές για διαγραφή: {selectedContactIds.length}
              </p>
            </div>
          ) : contact ? (
            <div className="bg-muted p-3 rounded-lg flex items-center gap-3">
              {getContactIcon(contact)}
              <div>
                <p className="font-medium">{getContactDisplayName(contact)}</p>
                <p className="text-sm text-muted-foreground">
                  {contact.type === 'individual' && 'Φυσικό Πρόσωπο'}
                  {contact.type === 'company' && 'Εταιρεία'}
                  {contact.type === 'service' && 'Δημόσια Υπηρεσία'}
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-muted p-3 rounded-lg">
              <p className="text-sm text-muted-foreground">Δεν υπάρχει επιλεγμένη επαφή.</p>
            </div>
          )}
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
            variant="destructive"
            onClick={handleDelete}
            disabled={loading || (!contact && selectedContactIds.length === 0)}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Διαγραφή...
              </>
            ) : (
              <>
                <AlertTriangle className="mr-2 h-4 w-4" />
                {isMultipleDelete ? `Διαγραφή ${selectedContactIds.length} Επαφών` : 'Διαγραφή Επαφής'}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}