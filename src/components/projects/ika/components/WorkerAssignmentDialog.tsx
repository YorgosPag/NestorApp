'use client';

/**
 * Dialog for assigning an existing contact (worker) to a project.
 * Uses AssociationService.linkContactToEntity() — no new collection.
 */

import React, { useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Search, UserPlus, Loader2 } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { cn } from '@/lib/utils';
import { AssociationService } from '@/services/association.service';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import type { IndividualContact } from '@/types/contacts/contracts';

interface WorkerAssignmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  /** Contact IDs already assigned (to exclude from search) */
  excludeContactIds: string[];
  /** Called after successful assignment */
  onAssigned: () => void;
}

interface SearchResult {
  id: string;
  name: string;
  specialty: string | null;
  amka: string | null;
}

export function WorkerAssignmentDialog({
  open,
  onOpenChange,
  projectId,
  excludeContactIds,
  onAssigned,
}: WorkerAssignmentDialogProps) {
  const { t } = useTranslation('projects');
  const iconSizes = useIconSizes();
  const spacing = useSpacingTokens();

  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [selectedContact, setSelectedContact] = useState<SearchResult | null>(null);

  const handleSearch = useCallback(async () => {
    if (searchTerm.trim().length < 2) return;

    try {
      setIsSearching(true);
      setResults([]);

      // Search individual contacts
      const contactsRef = collection(db, COLLECTIONS.CONTACTS);
      const q = query(contactsRef, where('type', '==', 'individual'));
      const snapshot = await getDocs(q);

      const term = searchTerm.toLowerCase();
      const filtered: SearchResult[] = [];

      snapshot.docs.forEach((docSnap) => {
        const data = docSnap.data() as IndividualContact;

        // Skip already assigned
        if (excludeContactIds.includes(docSnap.id)) return;

        const firstName = (data.firstName ?? '').toLowerCase();
        const lastName = (data.lastName ?? '').toLowerCase();
        const fullName = `${firstName} ${lastName}`;
        const specialty = (data.specialty ?? '').toLowerCase();
        const amka = data.amka ?? '';

        if (fullName.includes(term) || specialty.includes(term) || amka.includes(term)) {
          filtered.push({
            id: docSnap.id,
            name: `${data.firstName ?? ''} ${data.lastName ?? ''}`.trim() || 'Χωρίς Όνομα',
            specialty: data.specialty ?? null,
            amka: data.amka ?? null,
          });
        }
      });

      setResults(filtered);
    } catch (err) {
      console.error('[WorkerAssignmentDialog] Search error:', err);
    } finally {
      setIsSearching(false);
    }
  }, [searchTerm, excludeContactIds]);

  const handleAssign = useCallback(async () => {
    if (!selectedContact) return;

    try {
      setIsAssigning(true);

      const result = await AssociationService.linkContactToEntity({
        sourceWorkspaceId: 'ws_office_directory',
        sourceContactId: selectedContact.id,
        targetEntityType: 'project',
        targetEntityId: projectId,
        reason: 'IKA worker assignment',
        createdBy: 'current_user', // TODO: Get from auth context
      });

      if (result.success) {
        onAssigned();
        onOpenChange(false);
        setSearchTerm('');
        setResults([]);
        setSelectedContact(null);
      }
    } catch (err) {
      console.error('[WorkerAssignmentDialog] Assignment error:', err);
    } finally {
      setIsAssigning(false);
    }
  }, [selectedContact, projectId, onAssigned, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            <UserPlus className={cn(iconSizes.md, 'inline-block mr-2')} />
            {t('ika.workersTab.addWorker')}
          </DialogTitle>
          <DialogDescription>
            {t('ika.workersTab.description')}
          </DialogDescription>
        </DialogHeader>

        {/* Search field */}
        <div className="space-y-4">
          <div className="flex gap-2">
            <div className="flex-1">
              <Label htmlFor="worker-search" className="sr-only">
                {t('ika.workersTab.addWorker')}
              </Label>
              <Input
                id="worker-search"
                placeholder="Αναζήτηση με όνομα, ειδικότητα ή ΑΜΚΑ..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
            <Button
              variant="secondary"
              onClick={handleSearch}
              disabled={isSearching || searchTerm.trim().length < 2}
            >
              {isSearching ? (
                <Loader2 className={cn(iconSizes.sm, 'animate-spin')} />
              ) : (
                <Search className={iconSizes.sm} />
              )}
            </Button>
          </div>

          {/* Results */}
          {results.length > 0 && (
            <ul className="max-h-[200px] overflow-y-auto space-y-1 border rounded-lg p-2" role="listbox">
              {results.map((contact) => (
                <li
                  key={contact.id}
                  role="option"
                  aria-selected={selectedContact?.id === contact.id}
                  className={cn(
                    'flex items-center justify-between p-2 rounded cursor-pointer transition-colors',
                    selectedContact?.id === contact.id
                      ? 'bg-primary/10 border border-primary/30'
                      : 'hover:bg-accent/50'
                  )}
                  onClick={() => setSelectedContact(contact)}
                  onKeyDown={(e) => e.key === 'Enter' && setSelectedContact(contact)}
                  tabIndex={0}
                >
                  <div>
                    <p className="text-sm font-medium">{contact.name}</p>
                    {contact.specialty && (
                      <p className="text-xs text-muted-foreground">{contact.specialty}</p>
                    )}
                  </div>
                  {contact.amka && (
                    <span className="text-xs text-muted-foreground">
                      ΑΜΚΑ: {contact.amka}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}

          {results.length === 0 && searchTerm.trim().length >= 2 && !isSearching && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Δεν βρέθηκαν αποτελέσματα
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Ακύρωση
          </Button>
          <Button
            onClick={handleAssign}
            disabled={!selectedContact || isAssigning}
          >
            {isAssigning ? (
              <Loader2 className={cn(iconSizes.sm, spacing.margin.right.sm, 'animate-spin')} />
            ) : (
              <UserPlus className={cn(iconSizes.sm, spacing.margin.right.sm)} />
            )}
            {t('ika.workersTab.addWorker')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
