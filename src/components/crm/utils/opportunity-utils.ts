'use client';

import type { Opportunity } from '@/types/crm';

export function opportunitiesByStage(opportunities: Opportunity[], stageId: Opportunity['stage']) {
    return opportunities.filter(opp => opp.stage === stageId);
}

/**
 * Μόνο όσα πεδία άλλαξε ο άνθρωπος στη φόρμα.
 *
 * Η εγγραφή στέλνει αυτή τη διαφορά, ποτέ ολόκληρη τη φόρμα: ό,τι δεν άγγιξε ο
 * χρήστης δεν ξαναγράφεται, ώστε μια μπαγιάτικη ή αλλοιωμένη τιμή ανάγνωσης να μην
 * μπορεί να γίνει μόνιμη.
 */
export function pickChangedOpportunityFields(
    original: Readonly<Partial<Opportunity>>,
    draft: Readonly<Partial<Opportunity>>,
): Partial<Opportunity> {
    const changed: Record<string, unknown> = {};
    const before: Readonly<Record<string, unknown>> = original;
    for (const [field, value] of Object.entries(draft)) {
        if (!Object.is(before[field], value)) changed[field] = value;
    }
    return changed as Partial<Opportunity>;
}
