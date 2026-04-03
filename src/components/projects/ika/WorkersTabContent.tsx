/* eslint-disable design-system/prefer-design-system-imports */
'use client';

/**
 * =============================================================================
 * WorkersTabContent — IKA Workers Management Tab
 * =============================================================================
 *
 * Lists workers (individual contacts) linked to a project.
 * Inline contact search (no modal) using ContactSearchManager.
 * Uses existing contacts/relationships system — NO new collections.
 *
 * @enterprise ADR-090 — IKA/EFKA Labor Compliance System
 */

import React, { useState, useCallback, useMemo } from 'react';
import { Users, UserPlus, AlertCircle, HardHat, X } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/hooks/useSemanticColors';
import { useTypography } from '@/hooks/useTypography';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { cn } from '@/lib/utils';
import { useProjectWorkers } from './hooks/useProjectWorkers';
import { WorkerCard } from './components/WorkerCard';
import { ContactSearchManager } from '@/components/contacts/relationships/ContactSearchManager';
import type { ContactSummary } from '@/components/ui/enterprise-contact-dropdown';
import {
  linkContactToEntityWithPolicy,
  unlinkContactWithPolicy,
} from '@/services/entity-linking/association-mutation-gateway';
import type { ProjectWorker } from './contracts';
import { createModuleLogger } from '@/lib/telemetry';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useLinkRemovalGuard } from '@/hooks/useLinkRemovalGuard';

const logger = createModuleLogger('WorkersTabContent');

interface WorkersTabContentProps {
  projectId?: string;
}

export function WorkersTabContent({ projectId }: WorkersTabContentProps) {
  const { t } = useTranslation('projects');
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const typography = useTypography();
  const spacing = useSpacingTokens();

  const { workers, isLoading, error, refetch } = useProjectWorkers(projectId);
  const { confirm, dialogProps } = useConfirmDialog();
  const { checkBeforeRemove, BlockedDialog: LinkRemovalBlockedDialog } = useLinkRemovalGuard();
  const [showSearch, setShowSearch] = useState(false);
  const [selectedContact, setSelectedContact] = useState<ContactSummary | null>(null);
  const [isAssigning, setIsAssigning] = useState(false);
  const [isRemoving, setIsRemoving] = useState<string | null>(null);

  const excludeContactIds = useMemo(
    () => workers.map((w) => w.contactId),
    [workers]
  );

  const handleContactSelect = useCallback((contact: ContactSummary | null) => {
    setSelectedContact(contact);
  }, []);

  const handleAssign = useCallback(async () => {
    if (!selectedContact || !projectId) return;

    try {
      setIsAssigning(true);

      const result = await linkContactToEntityWithPolicy({
        input: {
          sourceWorkspaceId: 'ws_office_directory',
          sourceContactId: selectedContact.id,
          targetEntityType: 'project',
          targetEntityId: projectId,
          reason: 'IKA worker assignment',
          createdBy: 'current_user',
        },
      });

      if (result.success) {
        setShowSearch(false);
        setSelectedContact(null);
        refetch();
      }
    } catch (err) {
      logger.error('Worker assignment failed', { error: err });
    } finally {
      setIsAssigning(false);
    }
  }, [selectedContact, projectId, refetch]);

  const handleRemoveWorker = useCallback(async (worker: ProjectWorker) => {
    const confirmed = await confirm({
      title: t('ika.workersTab.removeWorker'),
      description: t('ika.workersTab.confirmRemove'),
      variant: 'destructive',
    });
    if (!confirmed) return;

    const allowed = await checkBeforeRemove(worker.linkId);
    if (!allowed) return;

    try {
      setIsRemoving(worker.contactId);
      const result = await unlinkContactWithPolicy({
        linkId: worker.linkId,
        updatedBy: 'current_user',
      });
      if (!result.success) {
        throw new Error(result.error);
      }
      refetch();
    } catch (err) {
      logger.error('Failed to remove worker', { error: err });
    } finally {
      setIsRemoving(null);
    }
  }, [checkBeforeRemove, confirm, t, refetch]);

  const handleCancelSearch = useCallback(() => {
    setShowSearch(false);
    setSelectedContact(null);
  }, []);

  // Loading state
  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Spinner size="large" />
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center gap-2 py-12">
          <AlertCircle className={cn(iconSizes.md, colors.text.error)} />
          <p className={typography.special.secondary}>{error}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <section className="space-y-2">
      {/* Header card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <hgroup>
              <CardTitle className={typography.card.titleCompact}>
                <HardHat className={cn(iconSizes.md, spacing.margin.right.sm, 'inline-block')} />
                {t('ika.workersTab.title')}
              </CardTitle>
              <CardDescription>
                {t('ika.workersTab.description')}
              </CardDescription>
            </hgroup>
            <div className="flex items-center gap-2">
              <span className={typography.special.secondary}>
                {t('ika.workersTab.totalWorkers')}: {workers.length}
              </span>
              {projectId && !showSearch && (
                <Button onClick={() => setShowSearch(true)}>
                  <UserPlus className={cn(iconSizes.sm, spacing.margin.right.sm)} />
                  {t('ika.workersTab.addWorker')}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-2">
          {/* Inline search section */}
          {showSearch && (
            <aside className={cn(
              'rounded-lg border p-2 space-y-2',
              'bg-muted/30'
            )}>
              <div className="flex items-center justify-between">
                <h3 className={cn(typography.label.md, 'font-semibold')}>
                  <UserPlus className={cn(iconSizes.sm, 'inline-block mr-1')} />
                  {t('ika.workersTab.addWorker')}
                </h3>
                <Button variant="ghost" size="sm" onClick={handleCancelSearch}>
                  <X className={iconSizes.sm} />
                </Button>
              </div>

              <ContactSearchManager
                selectedContactId={selectedContact?.id ?? ''}
                onContactSelect={handleContactSelect}
                excludeContactIds={excludeContactIds}
                allowedContactTypes={['individual']}
                placeholder="Αναζήτηση επαφής με όνομα, ειδικότητα ή ΑΜΚΑ..."
                searchConfig={{ autoLoadContacts: true, maxResults: 20 }}
              />

              {selectedContact && (
                <div className="flex items-center justify-between pt-2">
                  <p className={typography.body.sm}>
                    {t('ika.workersTab.selected')} <strong>{selectedContact.name}</strong>
                  </p>
                  <Button
                    onClick={handleAssign}
                    disabled={isAssigning}
                    size="sm"
                  >
                    {isAssigning ? (
                      <Spinner size="small" color="inherit" className={spacing.margin.right.sm} />
                    ) : (
                      <UserPlus className={cn(iconSizes.sm, spacing.margin.right.sm)} />
                    )}
                    {t('ika.workersTab.addWorker')}
                  </Button>
                </div>
              )}
            </aside>
          )}

          {/* Workers list or empty state */}
          {workers.length === 0 && !showSearch ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Users className={cn(iconSizes.xl, colors.text.muted, 'mb-2')} />
              <p className={cn(typography.label.sm, colors.text.muted)}>
                {t('ika.workersTab.noWorkers')}
              </p>
              <p className={cn(typography.special.tertiary, 'mt-1')}>
                {t('ika.workersTab.noWorkersHint')}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {workers.map((worker) => (
                <WorkerCard
                  key={worker.contactId}
                  worker={worker}
                  onRemove={
                    isRemoving === worker.contactId
                      ? undefined
                      : handleRemoveWorker
                  }
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      <ConfirmDialog {...dialogProps} />
      {LinkRemovalBlockedDialog}
    </section>
  );
}
