'use client';

/**
 * =============================================================================
 * WorkersTabContent — IKA Workers Management Tab
 * =============================================================================
 *
 * Lists workers (individual contacts) linked to a project.
 * Uses existing contacts/relationships system — NO new collections.
 *
 * @enterprise ADR-090 — IKA/EFKA Labor Compliance System
 */

import React, { useState, useCallback, useMemo } from 'react';
import { Users, UserPlus, Loader2, AlertCircle, HardHat } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/hooks/useSemanticColors';
import { useTypography } from '@/hooks/useTypography';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { cn } from '@/lib/utils';
import { useProjectWorkers } from './hooks/useProjectWorkers';
import { WorkerCard } from './components/WorkerCard';
import { WorkerAssignmentDialog } from './components/WorkerAssignmentDialog';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import type { ProjectWorker } from './contracts';
import { createModuleLogger } from '@/lib/telemetry';

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
  const { quick } = useBorderTokens();

  const { workers, isLoading, error, refetch } = useProjectWorkers(projectId);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isRemoving, setIsRemoving] = useState<string | null>(null);

  const excludeContactIds = useMemo(
    () => workers.map((w) => w.contactId),
    [workers]
  );

  const handleRemoveWorker = useCallback(async (worker: ProjectWorker) => {
    if (!confirm(t('ika.workersTab.confirmRemove'))) return;

    try {
      setIsRemoving(worker.contactId);
      // Deactivate the contact link by setting status to 'inactive'
      const linkRef = doc(db, COLLECTIONS.CONTACT_LINKS, worker.linkId);
      await updateDoc(linkRef, { status: 'inactive' });
      refetch();
    } catch (err) {
      logger.error('Failed to remove worker', { error: err });
    } finally {
      setIsRemoving(null);
    }
  }, [t, refetch]);

  // Loading state
  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className={cn(iconSizes.lg, 'animate-spin text-muted-foreground')} />
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center gap-3 py-12">
          <AlertCircle className={cn(iconSizes.md, colors.text.error)} />
          <p className="text-sm text-muted-foreground">{error}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <TooltipProvider>
      <section className="space-y-6">
        {/* Header card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className={typography.card.titleCompact}>
                  <HardHat className={cn(iconSizes.md, spacing.margin.right.sm, 'inline-block')} />
                  {t('ika.workersTab.title')}
                </CardTitle>
                <CardDescription>
                  {t('ika.workersTab.description')}
                </CardDescription>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">
                  {t('ika.workersTab.totalWorkers')}: {workers.length}
                </span>
                {projectId && (
                  <Button onClick={() => setIsDialogOpen(true)}>
                    <UserPlus className={cn(iconSizes.sm, spacing.margin.right.sm)} />
                    {t('ika.workersTab.addWorker')}
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent>
            {workers.length === 0 ? (
              /* Empty state */
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Users className={cn(iconSizes.xl, 'text-muted-foreground mb-4')} />
                <p className="text-sm font-medium text-muted-foreground">
                  {t('ika.workersTab.noWorkers')}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('ika.workersTab.noWorkersHint')}
                </p>
              </div>
            ) : (
              /* Workers list */
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

        {/* Assignment dialog */}
        {projectId && (
          <WorkerAssignmentDialog
            open={isDialogOpen}
            onOpenChange={setIsDialogOpen}
            projectId={projectId}
            excludeContactIds={excludeContactIds}
            onAssigned={refetch}
          />
        )}
      </section>
    </TooltipProvider>
  );
}
