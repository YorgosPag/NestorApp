/**
 * =============================================================================
 * «Για λογαριασμό ποιου γραφείου;» — η πλευρά του διακομιστή (ADR-901 §15 · Γ1)
 * =============================================================================
 *
 * **Ένας** δρόμος για τις δύο πόρτες της αποδοχής («Αναλαμβάνω» · σύνδεσμος email) **και** για ό,τι λέει η
 * οθόνη πριν από το πάτημα: `listOwnWorkspaces` (πού **ανήκω**) → `decideActingWorkspace` (καθαρός κριτής).
 * Η προεπισκόπηση και η πράξη ρωτούν τον **ίδιο** κριτή ⇒ η οθόνη δεν μπορεί να υποσχεθεί άλλο από ό,τι γράφεται.
 *
 * 🔑 Το **όνομα** του γραφείου διαβάζεται ζωντανά (`readWorkspaceName`) — ποτέ αντίγραφο πάνω στη συμμετοχή
 *    (θα πάλιωνε στην πρώτη μετονομασία, §15.6.7). Αποτυχία ονόματος ⇒ κενό· **δεν** ακυρώνει την αποδοχή.
 *
 * @module services/conveyance/conveyance-acting-workspace.server
 */

import 'server-only';

import {
  actingWorkspaceOf,
  decideActingWorkspace,
  type ActingWorkspaceDecision,
  type ActingWorkspaceRequest,
} from '@/lib/auth/acting-workspace';
import { listOwnWorkspaces, type ActiveWorkspace } from '@/lib/auth/workspace-membership';
import { readWorkspaceName } from '@/lib/workspace/workspace-catalog';
import type { AcceptancePreview, ActingForView, ActingOffice } from '@/types/conveyance-case';
import type { Engagement, EngagementState } from '@/types/engagement';
import type { WorkspaceRef } from '@/types/workspace-membership';

/** Ποιος ρωτά: ο άνθρωπος (από το token) και ο χώρος γραφείου όπου ενεργεί το αίτημά του. */
export interface ActingViewer {
  readonly uid: string;
  readonly active: ActiveWorkspace | null;
}

/** Η ετυμηγορία του κριτή για **αυτόν** τον άνθρωπο, **τώρα** — καμία απομνημόνευση πέρα από το αίτημα. */
async function judgeActingWorkspace(viewer: ActingViewer, requested: ActingWorkspaceRequest | null): Promise<ActingWorkspaceDecision> {
  const own = await listOwnWorkspaces(viewer.uid, viewer.active);
  return decideActingWorkspace({
    uid: viewer.uid,
    offices: own.outcome === 'ok' ? { outcome: 'ok', companyIds: own.belonging } : { outcome: 'unknown' },
    requested,
  });
}

// =============================================================================
// Η ΠΡΑΞΗ — πριν από τον γραφέα
// =============================================================================

export type ActingRejection = 'acting-choice-required' | 'acting-refused' | 'acting-unknown';

export type ActingResolution =
  | { readonly ok: true; readonly actingFor: WorkspaceRef }
  | { readonly ok: false; readonly rejection: ActingRejection };

/**
 * **Ο χώρος που θα γραφτεί στη συμμετοχή** — ή ο ονομασμένος λόγος που δεν γράφεται τίποτα.
 * Τρέχει **πριν** από τη συναλλαγή του γραφέα (δεν είναι ανάγνωση συναλλαγής) και το αποτέλεσμα μπαίνει στο αίτημα.
 */
export async function resolveActingFor(viewer: ActingViewer, requested: ActingWorkspaceRequest | null): Promise<ActingResolution> {
  const decision = await judgeActingWorkspace(viewer, requested);
  switch (decision.verdict) {
    case 'office':
    case 'personal-provisional':
      return { ok: true, actingFor: decision.workspace };
    case 'choice-required':
      return { ok: false, rejection: 'acting-choice-required' };
    case 'refused':
      return { ok: false, rejection: 'acting-refused' };
    case 'unknown':
      return { ok: false, rejection: 'acting-unknown' };
  }
}

// =============================================================================
// Η ΟΨΗ — τι θα γίνει · για ποιον ενεργεί
// =============================================================================

/** Οι καταστάσεις όπου η συμμετοχή **έχει αναληφθεί** (κάποτε έγινε `active`) — μόνο αυτές έχουν «για ποιον». */
const UNDERTAKEN_STATES: readonly EngagementState[] = ['active', 'completed', 'revoked'];

/** Οι όψεις της ιδιότητας για **ένα** αίτημα — τα γραφεία και τα ονόματά τους διαβάζονται το πολύ μία φορά. */
export interface ActingViews {
  /** Τι θα γίνει στο «Αναλαμβάνω» — για πρόταση που περιμένει απάντηση. */
  acceptance(): Promise<AcceptancePreview>;
  /** Για λογαριασμό ποιου ενεργεί αυτή η συμμετοχή — `null` αν δεν έχει αναληφθεί. */
  actingFor(engagement: Pick<Engagement, 'uid' | 'actingFor' | 'state'>): Promise<ActingForView | null>;
}

async function previewOf(viewer: ActingViewer, office: (companyId: string) => Promise<ActingOffice>): Promise<AcceptancePreview> {
  const decision = await judgeActingWorkspace(viewer, null);
  switch (decision.verdict) {
    case 'office':
      return { kind: 'office', office: await office(decision.workspace.companyId) };
    case 'personal-provisional':
      return { kind: 'personal-provisional' };
    case 'choice-required':
      return { kind: 'choice-required', offices: await Promise.all(decision.offices.map(office)) };
    // Χωρίς αίτημα ο κριτής δεν αρνείται· αν ποτέ το κάνει, η οθόνη **δεν** υπόσχεται τίποτα.
    case 'refused':
    case 'unknown':
      return { kind: 'unknown' };
  }
}

export function actingViews(viewer: ActingViewer): ActingViews {
  const offices = new Map<string, Promise<ActingOffice>>();
  const office = (companyId: string): Promise<ActingOffice> => {
    const known = offices.get(companyId);
    if (known) return known;
    const read = readWorkspaceName(companyId).catch(() => '').then((name) => ({ companyId, name: name.trim() }));
    offices.set(companyId, read);
    return read;
  };
  let preview: Promise<AcceptancePreview> | null = null;
  return {
    acceptance: () => (preview ??= previewOf(viewer, office)),
    actingFor: async (engagement) => {
      if (!UNDERTAKEN_STATES.includes(engagement.state)) return null;
      const workspace = actingWorkspaceOf(engagement);
      return workspace.kind === 'org' ? { kind: 'office', office: await office(workspace.companyId) } : { kind: 'personal' };
    },
  };
}
