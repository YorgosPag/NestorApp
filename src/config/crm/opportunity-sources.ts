/**
 * @fileoverview **Πηγές ευκαιρίας — κλειστός κατάλογος** (ADR-930 §3.10).
 * @module config/crm/opportunity-sources
 *
 * 🔑 Η ΜΙΑ ρίζα του `Opportunity['source']`: τη διαβάζουν ο τύπος (`types/crm.ts`) και το σχήμα της πόρτας
 *    (`services/crm/opportunity-fields-schema.ts`), ώστε ο server να δέχεται **ακριβώς** ό,τι ξέρει ο τύπος.
 */

export const OPPORTUNITY_SOURCES = ['website', 'referral', 'agent', 'social', 'phone', 'walkin'] as const;

export type OpportunitySource = (typeof OPPORTUNITY_SOURCES)[number];
