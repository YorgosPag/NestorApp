'use client';

import React, { useState, useCallback } from 'react';
import { Filter, Plus, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TooltipProvider } from '@/components/ui/tooltip';
import { INTERACTIVE_PATTERNS } from '@/components/ui/effects';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
// 🏢 ENTERPRISE: Import from canonical location
import { Spinner as AnimatedSpinner } from '@/components/ui/spinner';
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
  const { getStatusBorder } = useBorderTokens();
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
    <TooltipProvider>
      <div className={`${colors.bg.primary} rounded-lg shadow`}>
        <div className="p-6 border-b">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">{t('pipeline.title')}</h2>
            <div className="flex items-center gap-3">
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

        <div className="p-6">
          {loading ? (
              <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                      <AnimatedSpinner size="large" className="mx-auto mb-2" />
                      <p className={colors.text.secondary}>{t('pipeline.loading')}</p>
                  </div>
              </div>
          ) : error ? (
              <div className={`${colors.bg.error} ${getStatusBorder('error')} rounded-lg p-4`}>
                  <p className="text-red-600">{error}</p>
                  <button
                  onClick={fetchOpportunities}
                  className={`mt-2 px-3 py-1 bg-red-600 text-white rounded text-sm ${INTERACTIVE_PATTERNS.DESTRUCTIVE_HOVER}`}
                  >
                  {t('pipeline.retry')}
                  </button>
              </div>
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
    </TooltipProvider>
  );
}
