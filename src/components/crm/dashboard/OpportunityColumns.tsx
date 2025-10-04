'use client';

import React from 'react';
import type { Opportunity } from '@/types/crm';
import { stageDefinitions, opportunitiesByStage } from '../utils/opportunity-utils';
import { OpportunityCard } from './OpportunityCard';

interface OpportunityColumnsProps {
    opportunities: Opportunity[];
    onEdit: (opportunity: Opportunity) => void;
    onDelete: (opportunityId: string, opportunityName: string) => void;
}

export function OpportunityColumns({ opportunities, onEdit, onDelete }: OpportunityColumnsProps) {
    return (
        <div className="flex gap-4 overflow-x-auto pb-4">
            {stageDefinitions.map(stage => (
            <div key={stage.id} className="flex-1 min-w-[280px]">
                <div className="bg-background rounded-lg p-4 h-full">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="font-medium text-foreground">{stage.label}</h3>
                    <span className="text-sm text-muted-foreground">{opportunitiesByStage(opportunities, stage.id).length}</span>
                </div>
                
                <div className="space-y-2">
                    {opportunitiesByStage(opportunities, stage.id).map(opp => (
                    <OpportunityCard key={opp.id} opportunity={opp} onEdit={onEdit} onDelete={onDelete} />
                    ))}
                </div>
                </div>
            </div>
            ))}
        </div>
    );
}
