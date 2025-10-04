'use client';

import type { Opportunity } from '@/types/crm';

export const stageDefinitions: { id: Opportunity['stage']; label: string }[] = [
    { id: 'initial_contact', label: 'Αρχική Επαφή' },
    { id: 'qualification', label: 'Αξιολόγηση' },
    { id: 'viewing', label: 'Ξενάγηση' },
    { id: 'proposal', label: 'Πρόταση' },
    { id: 'negotiation', label: 'Διαπραγμάτευση' },
    { id: 'contract', label: 'Συμβόλαιο' },
    { id: 'closed_won', label: 'Κερδισμένη' },
    { id: 'closed_lost', label: 'Χαμένη' },
];

export function opportunitiesByStage(opportunities: Opportunity[], stageId: Opportunity['stage']) {
    return opportunities.filter(opp => opp.stage === stageId);
}
