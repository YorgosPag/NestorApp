import type { Opportunity } from '@/types/crm';
import { getStatusBadgeVariant, type StatusBadgeVariant } from '@/lib/design-system';

const STAGE_STATUS: Record<Opportunity['stage'], string> = {
  initial_contact: 'pending',
  qualification: 'reserved',
  viewing: 'completed',
  proposal: 'reserved',
  negotiation: 'pending',
  contract: 'pending',
  closed_won: 'active',
  closed_lost: 'error',
};

/**
 * Παραλλαγή `<Badge>` για το στάδιο ευκαιρίας — το `Badge` βάζει γέμισμα ΚΑΙ το μετρημένο μελάνι του.
 * Ως τις 2026-10-29 επέστρεφε `getStatusColor(x,'bg')` + `getStatusColor(x,'text')` ⇒ ίδιο token, αόρατη ετικέτα (ADR-770).
 */
export const getStageBadgeVariant = (stage?: Opportunity['stage']): StatusBadgeVariant =>
  getStatusBadgeVariant(STAGE_STATUS[stage ?? 'initial_contact']);
