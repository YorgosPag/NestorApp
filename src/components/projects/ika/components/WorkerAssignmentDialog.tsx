/* eslint-disable design-system/prefer-design-system-imports */
'use client';

/**
 * Dialog for assigning an existing contact (worker) to a project.
 * Uses AssociationService.linkContactToEntity() — no new collection.
 * 🔒 SECURITY: Search via Admin SDK API (not client-side Firestore)
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
import { Search, UserPlus } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTypography } from '@/hooks/useTypography';
import { cn } from '@/lib/utils';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { linkContactToEntityWithPolicy } from '@/services/entity-linking/association-mutation-gateway';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { API_ROUTES } from '@/config/domain-constants';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('WorkerAssignmentDialog');

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
  const typography = useTypography();
  const spacing = useSpacingTokens();

  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [selectedContact, setSelectedContact] = useState<SearchResult | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  /** 🔒 SECURITY: Search via Admin SDK API (tenant-scoped) */
  const handleSearch = useCallback(async () => {
    if (searchTerm.trim().length < 2) return;

    try {
      setIsSearching(true);
      setResults([]);
      setSearchError(null);

      const excludeParam = excludeContactIds.length > 0
        ? `&exclude=${excludeContactIds.join(',')}`
        : '';

      // apiClient with apiSuccess() unwraps canonical { success, data } → returns data directly
      interface SearchData {
        contacts: Array<{
          id: string;
          firstName: string;
          lastName: string;
          specialty: string | null;
          amka: string | null;
        }>;
        count: number;
      }

      const data = await apiClient.get<SearchData>(
        `${API_ROUTES.CONTACTS.SEARCH_INDIVIDUALS}?q=${encodeURIComponent(searchTerm.trim())}${excludeParam}`
      );

      const mapped: SearchResult[] = (data?.contacts || []).map(c => ({
        id: c.id,
        name: `${c.firstName} ${c.lastName}`.trim() || t('ika.workersTab.noName', { defaultValue: 'Χωρίς Όνομα' }),
        specialty: c.specialty,
        amka: c.amka,
      }));

      setResults(mapped);
    } catch (err) {
      logger.error('Worker search failed', { error: err });
      setSearchError(t('ika.workersTab.searchError', { defaultValue: 'Σφάλμα κατά την αναζήτηση' }));
    } finally {
      setIsSearching(false);
    }
  }, [searchTerm, excludeContactIds]);

  const handleAssign = useCallback(async () => {
    if (!selectedContact) return;

    try {
      setIsAssigning(true);

      const result = await linkContactToEntityWithPolicy({
        input: {
          sourceWorkspaceId: 'ws_office_directory',
          sourceContactId: selectedContact.id,
          targetEntityType: 'project',
          targetEntityId: projectId,
          reason: 'IKA worker assignment',
          createdBy: 'current_user', // TODO: Get from auth context
        },
      });

      if (result.success) {
        onAssigned();
        onOpenChange(false);
        setSearchTerm('');
        setResults([]);
        setSelectedContact(null);
      }
    } catch (err) {
      logger.error('Worker assignment failed', { error: err });
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
        <div className="space-y-2">
          <div className="flex gap-2">
            <div className="flex-1">
              <Label htmlFor="worker-search" className="sr-only">
                {t('ika.workersTab.addWorker')}
              </Label>
              <Input
                id="worker-search"
                placeholder={t('ika.workersTab.searchPlaceholder', { defaultValue: 'Αναζήτηση με όνομα, ειδικότητα ή ΑΜΚΑ...' })}
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
                <Spinner size="small" color="inherit" />
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
                    <p className={typography.label.sm}>{contact.name}</p>
                    {contact.specialty && (
                      <p className={typography.special.tertiary}>{contact.specialty}</p>
                    )}
                  </div>
                  {contact.amka && (
                    <span className={typography.special.tertiary}>
                      {t('ika.workersTab.amka')} {contact.amka}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}

          {searchError && (
            <p className={cn(typography.body.sm, "text-destructive text-center py-2")}>
              {searchError}
            </p>
          )}

          {results.length === 0 && searchTerm.trim().length >= 2 && !isSearching && !searchError && (
            <p className={cn(typography.special.secondary, "text-center py-2")}>
              {t('ika.workersTab.noResults')}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('projectHeader.cancel')}
          </Button>
          <Button
            onClick={handleAssign}
            disabled={!selectedContact || isAssigning}
          >
            {isAssigning ? (
              <Spinner size="small" color="inherit" className={spacing.margin.right.sm} />
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
