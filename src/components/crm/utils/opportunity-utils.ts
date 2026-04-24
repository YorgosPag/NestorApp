'use client';

import type { Opportunity } from '@/types/crm';

// 🏢 ENTERPRISE: Stage IDs for iteration - labels come from i18n
export const STAGE_IDS: Opportunity['stage'][] = [
    'initial_contact',
    'qualification',
    'viewing',
    'proposal',
    'negotiation',
    'contract',
    'closed_won',
    'closed_lost',
];


export function opportunitiesByStage(opportunities: Opportunity[], stageId: Opportunity['stage']) {
    return opportunities.filter(opp => opp.stage === stageId);
}
