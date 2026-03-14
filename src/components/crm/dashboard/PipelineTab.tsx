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
import { AddOpportunityDialog } from './dialogs/AddOpportunityDialog';
import { EditOpportunityModal } from './EditOpportunityModal';
import { OpportunityColumns } from './OpportunityColumns';
import LeadsList from '@/components/leads/LeadsList';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';


export function PipelineTab() {
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  // 🏢 ENTERPRISE: i18n support
  const { t } = useTranslation('crm');
  const {
    opportunities,
    loading,
    error,
    fetchOpportunities,
    addOpportunity,
    deleteOpportunity: removeOpportunity
  } = useOpportunities();
  
  const [openAddDialog, setOpenAddDialog] = useState(false);
  const [editingOpportunity, setEditingOpportunity] = useState<Opportunity | null>(null);
  const [refreshCounter, setRefreshCounter] = useState(0);

  const handleEdit = (opportunity: Opportunity) => {
    setEditingOpportunity(opportunity);
  };

  const handleRefresh = useCallback(async () => {
    await fetchOpportunities();
    setRefreshCounter(prev => prev + 1);
  }, [fetchOpportunities]);

  const [viewMode, setViewMode] = useState<'pipeline' | 'list'>('pipeline');

  return (
    <div className={colors.bg.primary}>
        <div>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">{t('pipeline.title')}</h2>
            <div className="flex items-center gap-2">
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
            </div>
          </div>
        </div>

        <div className="flex-1">
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
