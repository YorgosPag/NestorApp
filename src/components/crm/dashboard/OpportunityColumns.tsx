'use client';

import React from 'react';
import type { Opportunity } from '@/types/crm';
import { STAGE_IDS, opportunitiesByStage } from '../utils/opportunity-utils';
import { OpportunityCard } from './OpportunityCard';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';

interface OpportunityColumnsProps {
    opportunities: Opportunity[];
    onEdit: (opportunity: Opportunity) => void;
    onDelete: (opportunityId: string, opportunityName: string) => void;
}

export function OpportunityColumns({ opportunities, onEdit, onDelete }: OpportunityColumnsProps) {
    const colors = useSemanticColors();
    // 🏢 ENTERPRISE: i18n support
    const { t } = useTranslation('crm');

    return (
        <div className="flex gap-4 overflow-x-auto pb-4">
            {STAGE_IDS.map(stageId => (
            <div key={stageId} className="flex-1 min-w-[280px]">
                <div className={`${colors.bg.primary} rounded-lg p-4 h-full`}>
                <div className="flex items-center justify-between mb-3">
                    <h3 className="font-medium text-foreground">{t(`opportunities.stages.${stageId}`)}</h3>
                    <span className="text-sm text-muted-foreground">{opportunitiesByStage(opportunities, stageId).length}</span>
                </div>

                <div className="space-y-2">
                    {opportunitiesByStage(opportunities, stageId).map(opp => (
                    <OpportunityCard key={opp.id} opportunity={opp} onEdit={onEdit} onDelete={onDelete} />
                    ))}
                </div>
                </div>
            </div>
            ))}
        </div>
    );
}
