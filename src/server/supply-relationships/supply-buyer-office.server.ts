import 'server-only';

/**
 * **«Για ποιο γραφείο ζητάς;»** (ADR-923 §5.12 Σ3): ο **ίδιος** κριτής με την ανάληψη υπόθεσης, για τις δύο πόρτες.
 *
 * Μία διαφορά, και ονομασμένη: στην υπόθεση ο νεογραμμένος μπαίνει προσωρινά στον προσωπικό του χώρο· εδώ όχι, γιατί το
 * BOQ ζει σε χώρο εταιρείας. Το `personal-provisional` γίνεται `office-required`, ποτέ σιωπηλή σχέση σε προσωπικό χώρο.
 * @module server/supply-relationships/supply-buyer-office.server
 */

import type { ActingWorkspaceRequest } from '@/lib/auth/acting-workspace';
import type { ActiveWorkspace } from '@/lib/auth/workspace-membership';
import { resolveActingFor, type ActingRejection } from '@/services/conveyance/conveyance-acting-workspace.server';
import type { SupplyBuyerRefusal } from '@/subapps/catalog/types/supply-invitation';

/** Ο άνθρωπος: από το token. Το αίτημα χώρου: από το σώμα, αναξιόπιστο. */
export interface SupplyBuyerActing {
  readonly uid: string;
  readonly active: ActiveWorkspace | null;
  readonly requested: ActingWorkspaceRequest | null;
}

export type SupplyBuyerOffice =
  | { readonly kind: 'office'; readonly companyId: string }
  | { readonly kind: 'refused'; readonly reason: SupplyBuyerRefusal }
  /** «Δεν μπόρεσα να ρωτήσω τα γραφεία»: ποτέ ονομασμένη άρνηση. */
  | { readonly kind: 'unknown' };

const REFUSAL_OF_REJECTION: Readonly<Record<Exclude<ActingRejection, 'acting-unknown'>, SupplyBuyerRefusal>> = {
  'acting-choice-required': 'office-choice-required',
  'acting-refused': 'office-refused',
};

export async function resolveBuyerOffice(acting: SupplyBuyerActing): Promise<SupplyBuyerOffice> {
  const resolved = await resolveActingFor({ uid: acting.uid, active: acting.active }, acting.requested);
  if (!resolved.ok) {
    return resolved.rejection === 'acting-unknown' ? { kind: 'unknown' } : { kind: 'refused', reason: REFUSAL_OF_REJECTION[resolved.rejection] };
  }
  return resolved.actingFor.kind === 'org' ? { kind: 'office', companyId: resolved.actingFor.companyId } : { kind: 'refused', reason: 'office-required' };
}
