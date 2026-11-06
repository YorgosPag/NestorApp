'use client';

import React, { useState, useCallback } from 'react';
import { Filter, GitBranch, Plus, User } from 'lucide-react';
import { Button } from '@/components/ui/button';

import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
// 🏢 ENTERPRISE: Centralized page states (ADR-229)
import { PageLoadingState, PageErrorState } from '@/core/states';
// Removed: useToast import (migrated to useNotifications)
import type { Opportunity } from '@/types/crm';

import { useOpportunities } from '../hooks/useOpportunities';
import { useRealtimeOpportunities } from '@/services/realtime/hooks/useRealtimeOpportunities';
import { useOpportunityAccess } from '../stage-move/useOpportunityAccess';
import { useOptimisticStages } from '../stage-move/useOptimisticStages';
import { useStageTransitionCommand } from '../stage-move/useStageTransitionCommand';
import { StageMoveDialogs } from '../stage-move/StageMoveDialogs';
import { AddOpportunityDialog } from './dialogs/AddOpportunityDialog';
import { EditOpportunityModal } from './EditOpportunityModal';
import { OpportunityColumns } from './OpportunityColumns';
import LeadsList from '@/components/leads/LeadsList';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';
import '@/lib/design-system';


/**
 * ADR-930 — ζωντανός πίνακας: τα δεδομένα από τη συνδρομή, η αισιόδοξη εικόνα πάνω τους, η ΜΙΑ εντολή μετακίνησης, και
 * ο ΙΔΙΟΣ κριτής κατόχου με τον server (ανά κάρτα — όχι ένα «μπορεί να σέρνει» για όλο τον πίνακα).
 */
function useLivePipeline() {
  const { opportunities, loading, error, refetch } = useRealtimeOpportunities();
  const { displayed, onOptimistic, onRevert } = useOptimisticStages(opportunities);
  const command = useStageTransitionCommand({ onOptimistic, onRevert });
  const access = useOpportunityAccess();
  return { opportunities: displayed, loading, error, refetch, command, access };
}

export function PipelineTab() {
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  // 🏢 ENTERPRISE: i18n support
  const { t } = useTranslation('crm');
  const { addOpportunity, deleteOpportunity: removeOpportunity } = useOpportunities();
  const { opportunities, loading, error, refetch: fetchOpportunities, command, access } = useLivePipeline();

  const [openAddDialog, setOpenAddDialog] = useState(false);
  const [editingOpportunity, setEditingOpportunity] = useState<Opportunity | null>(null);
  const [refreshCounter, setRefreshCounter] = useState(0);

  const handleEdit = (opportunity: Opportunity) => {
    setEditingOpportunity(opportunity);
  };

  const _handleRefresh = useCallback(async () => {
    await fetchOpportunities();
    setRefreshCounter(prev => prev + 1);
  }, [fetchOpportunities]);

  const [viewMode, setViewMode] = useState<'pipeline' | 'list'>('pipeline');

  return (
    // ADR-930 §3.11: στήλη flex σε όλο το ύψος της καρτέλας, ώστε ο πίνακας (`layout="fill"`) να πάρει ό,τι περισσεύει.
    <div className={`${colors.bg.primary} flex h-full flex-col`}>
        <nav className="flex shrink-0 items-center justify-end gap-2 px-2 py-1" aria-label={t('pipeline.title')}>
          <Button variant="outline" size="sm" onClick={() => setViewMode(viewMode === 'pipeline' ? 'list' : 'pipeline')}>
            {viewMode === 'pipeline' ? t('pipeline.viewList') : t('pipeline.viewPipeline')}
          </Button>
          <Button variant="outline" size="sm" onClick={fetchOpportunities}>
            <Filter className={`${iconSizes.sm} inline mr-1`} />
            {t('pipeline.refresh')}
          </Button>
          <Button size="sm" onClick={() => setOpenAddDialog(true)}>
            <Plus className={`${iconSizes.sm} mr-2`} />
            {t('pipeline.newLead')}
          </Button>
        </nav>

        <div className="flex min-h-0 flex-1 flex-col">
          {loading ? (
              <PageLoadingState icon={GitBranch} message={t('pipeline.loading')} layout="contained" />
          ) : error ? (
              <PageErrorState
                title={t(error, { defaultValue: error })}
                onRetry={fetchOpportunities}
                retryLabel={t('pipeline.retry')}
                layout="contained"
              />
          ) : opportunities.length === 0 ? (
              <div className="text-center py-12">
                  <User className={`${iconSizes.xl2} ${colors.text.muted} mx-auto mb-4`} />
                  <h3 className={`text-lg font-medium ${colors.text.primary} mb-2`}>{t('pipeline.empty.title')}</h3>
                  <p className={colors.text.secondary}>{t('pipeline.empty.subtitle')}</p>
              </div>
          ) : (
            viewMode === 'pipeline' ? (
              <OpportunityColumns
                opportunities={opportunities}
                onEdit={handleEdit}
                onDelete={removeOpportunity}
                onMove={command.requestMove}
                access={access}
                isMoving={command.isMoving}
              />
            ) : (
              <LeadsList refreshTrigger={refreshCounter} />
            )
          )}
        </div>

        <AddOpportunityDialog
          open={openAddDialog}
          onOpenChange={setOpenAddDialog}
          onSubmit={addOpportunity}
        />

        <StageMoveDialogs dialogs={command.dialogs} />

        {editingOpportunity && (
          <EditOpportunityModal
            opportunity={editingOpportunity}
            isOpen={!!editingOpportunity}
            onClose={() => setEditingOpportunity(null)}
            onLeadUpdated={fetchOpportunities}
          />
        )}
      </div>
  );
}
