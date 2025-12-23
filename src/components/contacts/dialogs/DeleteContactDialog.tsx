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
import { CONTACT_TYPES, getContactIcon, getContactLabel, getContactColor } from '@/constants/contacts';
import { useIconSizes } from '@/hooks/useIconSizes';

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
  const iconSizes = useIconSizes();
  const [loading, setLoading] = useState(false);

  const isMultipleDelete = selectedContactIds.length > 1;
  const isSingleSelectedDelete = selectedContactIds.length === 1;
  const isCurrentContactDelete = contact && !isSingleSelectedDelete;

  const getContactIconComponent = (contact: Contact) => {
    const IconComponent = getContactIcon(contact.type);
    const colorClass = getContactColor(contact.type, 'primary');
    return <IconComponent className={`${iconSizes.sm} ${colorClass}`} />;
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
        // 🏢 ENTERPRISE CLEANUP: Delete Firebase Storage files for multiple contacts
        console.log('🧹 ENTERPRISE CLEANUP: Starting bulk photo cleanup for multiple contact deletion...');

        try {
          // Fetch all contacts to get their photo URLs
          const contactsPromises = selectedContactIds.map(id => ContactsService.getContact(id));
          const contactsResults = await Promise.allSettled(contactsPromises);

          // Collect all photo URLs from all contacts
          const allPhotoUrls: string[] = [];
          let successfullyFetched = 0;

          contactsResults.forEach((result, index) => {
            if (result.status === 'fulfilled' && result.value) {
              const contact = result.value;
              if (contact.photoURL) allPhotoUrls.push(contact.photoURL);
              if (contact.multiplePhotoURLs) allPhotoUrls.push(...contact.multiplePhotoURLs);
              successfullyFetched++;
            } else {
              console.warn(`⚠️ ENTERPRISE CLEANUP: Failed to fetch contact ${selectedContactIds[index]} for photo cleanup`);
            }
          });

          console.log('🧹 ENTERPRISE CLEANUP: Bulk cleanup stats:', {
            requestedContacts: selectedContactIds.length,
            successfullyFetched,
            totalPhotos: allPhotoUrls.length,
            photoSamples: allPhotoUrls.slice(0, 3).map(url => url.substring(0, 50) + '...')
          });

          // Cleanup Firebase Storage files
          if (allPhotoUrls.length > 0) {
            const { PhotoUploadService } = await import('@/services/photo-upload.service');
            const cleanupPromises = allPhotoUrls.map(async (url) => {
              try {
                await PhotoUploadService.deletePhotoByURL(url);
                console.log('✅ ENTERPRISE CLEANUP: Deleted bulk photo file:', url.substring(0, 50) + '...');
              } catch (error) {
                console.warn('⚠️ ENTERPRISE CLEANUP: Failed to delete bulk photo file:', url.substring(0, 50) + '...', error);
                // Non-blocking - continue with other files
              }
            });

            await Promise.allSettled(cleanupPromises);
            console.log('✅ ENTERPRISE CLEANUP: Completed bulk cleanup of', allPhotoUrls.length, 'photo files from', successfullyFetched, 'contacts');
          } else {
            console.log('✅ ENTERPRISE CLEANUP: No photos to clean for these contacts');
          }
        } catch (cleanupError) {
          console.warn('⚠️ ENTERPRISE CLEANUP: Bulk photo cleanup failed, but continuing with contact deletion:', cleanupError);
          // Non-blocking - contact deletion continues
        }

        // Διαγραφή πολλών επαφών
        await ContactsService.deleteMultipleContacts(selectedContactIds);
        toast.success(`${selectedContactIds.length} επαφές διαγράφηκαν επιτυχώς.`);
      } else if (contact) {
        // 🏢 ENTERPRISE CLEANUP: Delete Firebase Storage files before contact deletion
        console.log('🧹 ENTERPRISE CLEANUP: Starting photo cleanup for contact deletion...');

        try {
          // Collect all photo URLs from the contact
          const photoUrls: string[] = [];
          if (contact.photoURL) photoUrls.push(contact.photoURL);
          if (contact.multiplePhotoURLs) photoUrls.push(...contact.multiplePhotoURLs);

          console.log('🧹 ENTERPRISE CLEANUP: Found photos to cleanup:', {
            contactName: getContactDisplayName(contact),
            photoCount: photoUrls.length,
            photos: photoUrls.map(url => url.substring(0, 50) + '...')
          });

          // Cleanup Firebase Storage files
          if (photoUrls.length > 0) {
            const { PhotoUploadService } = await import('@/services/photo-upload.service');
            const cleanupPromises = photoUrls.map(async (url) => {
              try {
                await PhotoUploadService.deletePhotoByURL(url);
                console.log('✅ ENTERPRISE CLEANUP: Deleted photo file:', url.substring(0, 50) + '...');
              } catch (error) {
                console.warn('⚠️ ENTERPRISE CLEANUP: Failed to delete photo file:', url.substring(0, 50) + '...', error);
                // Non-blocking - continue with other files
              }
            });

            await Promise.allSettled(cleanupPromises);
            console.log('✅ ENTERPRISE CLEANUP: Completed cleanup of', photoUrls.length, 'photo files');
          } else {
            console.log('✅ ENTERPRISE CLEANUP: No photos to clean for this contact');
          }
        } catch (cleanupError) {
          console.warn('⚠️ ENTERPRISE CLEANUP: Photo cleanup failed, but continuing with contact deletion:', cleanupError);
          // Non-blocking - contact deletion continues
        }

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
            <AlertTriangle className={iconSizes.md} />
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
                <Loader2 className={`mr-2 ${iconSizes.sm} animate-spin`} />
                Διαγραφή...
              </>
            ) : (
              <>
                <AlertTriangle className={`mr-2 ${iconSizes.sm}`} />
                {isMultipleDelete ? `Διαγραφή ${selectedContactIds.length} Επαφών` : 'Διαγραφή Επαφής'}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}