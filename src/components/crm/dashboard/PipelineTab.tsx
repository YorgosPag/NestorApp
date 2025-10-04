'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Filter, Plus, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/useToast';
import type { Opportunity } from '@/types/crm';

import { useOpportunities } from '../hooks/useOpportunities';
import { AddOpportunityDialog } from './dialogs/AddOpportunityDialog';
import { EditOpportunityModal } from './EditOpportunityModal';
import { OpportunityColumns } from './OpportunityColumns';
import LeadsList from '@/components/leads/LeadsList';


export function PipelineTab() {
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

  const handleEdit = (opportunity: Opportunity) => {
    setEditingOpportunity(opportunity);
  };

  const [viewMode, setViewMode] = useState<'pipeline' | 'list'>('pipeline');

  return (
    <TooltipProvider>
      <div className="bg-white dark:bg-card rounded-lg shadow">
        <div className="p-6 border-b">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Sales Pipeline</h2>
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={() => setViewMode(viewMode === 'pipeline' ? 'list' : 'pipeline')}>
                {viewMode === 'pipeline' ? 'Προβολή Λίστας' : 'Προβολή Pipeline'}
              </Button>
              <Button variant="outline" size="sm" onClick={fetchOpportunities}>
                <Filter className="w-4 h-4 inline mr-1" />
                Ανανέωση
              </Button>
              <Button size="sm" onClick={() => setOpenAddDialog(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Νέο Lead
              </Button>
            </div>
          </div>
        </div>

        <div className="p-6">
          {loading ? (
              <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                      <p className="text-gray-600">Φόρτωση pipeline...</p>
                  </div>
              </div>
          ) : error ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-red-600">{error}</p>
                  <button 
                  onClick={fetchOpportunities}
                  className="mt-2 px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
                  >
                  Δοκιμή ξανά
                  </button>
              </div>
          ) : opportunities.length === 0 ? (
              <div className="text-center py-12">
                  <User className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Δεν υπάρχουν ευκαιρίες</h3>
                  <p className="text-gray-600">Προσθέστε την πρώτη σας ευκαιρία για να ξεκινήσετε!</p>
              </div>
          ) : (
            viewMode === 'pipeline' ? (
              <OpportunityColumns 
                opportunities={opportunities}
                onEdit={handleEdit}
                onDelete={removeOpportunity}
              />
            ) : (
              <LeadsList refreshTrigger={fetchOpportunities} />
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
