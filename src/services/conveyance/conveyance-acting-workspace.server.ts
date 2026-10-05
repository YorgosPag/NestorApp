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
  placementOf,
  type ActingWorkspaceDecision,
  type ActingWorkspaceRequest,
  type BelongingOffices,
  type CasePlacement,
} from '@/lib/auth/acting-workspace';
import { listOwnWorkspaces, type ActiveWorkspace } from '@/lib/auth/workspace-membership';
import type { CaseHome } from '@/lib/conveyance/conveyance-routes';
import { readWorkspaceName } from '@/lib/workspace/workspace-catalog';
import type { AcceptancePreview, ActingForView, ActingOffice } from '@/types/conveyance-case';
import type { Engagement, EngagementState } from '@/types/engagement';
import { orgWorkspace, personalWorkspace, type WorkspaceRef } from '@/types/workspace-membership';

/** Ποιος ρωτά: ο άνθρωπος (από το token) και ο χώρος γραφείου όπου ενεργεί το αίτημά του. */
export interface ActingViewer {
  readonly uid: string;
  readonly active: ActiveWorkspace | null;
}

/**
 * **Ο χώρος της ΣΕΛΙΔΑΣ που ρωτά** (ADR-901 §15 Γ2) — το φίλτρο της λίστας και η θέση μιας υπόθεσης κρίνονται
 * απέναντι σε αυτόν. `null` ⇒ η σελίδα δηλώνει γραφείο αλλά το αίτημα **δεν ενεργεί** σε κανένα: καμία απάντηση.
 *
 * 🔴 **ΓΙΑΤΙ ΔΕΝ ΑΡΚΕΙ ΤΟ `active`** (μετρημένο στον κώδικα, 2026-10-05): το κέλυφος `(me)` **δεν δηλώνει χώρο**,
 *    οπότε για μέλος γραφείου το αίτημα της **προσωπικής** σελίδας λύνεται στο γραφείο του claim (`home`). Με μόνο
 *    το `active`, η προσωπική λίστα της κας Γεωργίου θα έδειχνε τις υποθέσεις του γραφείου της — και μια παλιά
 *    συμμετοχή χωρίς `actingFor` δεν θα φαινόταν **πουθενά**.
 * 🔑 Άρα το **είδος** το δηλώνει το κέλυφος (`CaseHome`), και την **ταυτότητα** του γραφείου τη δίνει **μόνο** ο
 *    κριμένος χώρος του αιτήματος (`active`, CHECK 3.58) — ο πελάτης **δεν ονομάζει** ποτέ εταιρεία εδώ.
 * ⛔ **Στενεύει, δεν ανοίγει**: ό,τι κι αν δηλωθεί, η λίστα είναι ήδη μόνο οι συμμετοχές **του ίδιου** (`uid`).
 */
export function viewedWorkspace(viewer: ActingViewer, home: CaseHome): WorkspaceRef | null {
  if (home === 'personal') return personalWorkspace(viewer.uid);
  return viewer.active === null ? null : orgWorkspace(viewer.active.companyId);
}

/**
 * **Τα γραφεία όπου ΑΝΗΚΕΙ, τώρα** — η ΜΙΑ ανάγνωση πίσω από την αποδοχή («για ποιον αναλαμβάνω;») **και** από το
 * σπίτι μιας συμμετοχής («ανήκω ακόμη εκεί;», §15.15). ⚠️ `belonging`, όχι `reachable`.
 */
async function belongingOffices(viewer: ActingViewer): Promise<BelongingOffices> {
  const own = await listOwnWorkspaces(viewer.uid, viewer.active);
  return own.outcome === 'ok' ? { outcome: 'ok', companyIds: own.belonging } : { outcome: 'unknown' };
}

/** Η ετυμηγορία του κριτή για **αυτόν** τον άνθρωπο, **τώρα** — καμία απομνημόνευση πέρα από το αίτημα. */
async function judgeActingWorkspace(
  viewer: ActingViewer,
  requested: ActingWorkspaceRequest | null,
  offices: Promise<BelongingOffices> = belongingOffices(viewer),
): Promise<ActingWorkspaceDecision> {
  return decideActingWorkspace({ uid: viewer.uid, offices: await offices, requested });
}

type Placeable = Pick<Engagement, 'uid' | 'actingFor'>;

/**
 * Το σπίτι με **τεμπέλικη** ανάγνωση: το βιβλίο μελών ρωτιέται **μόνο** όταν η συμμετοχή ενεργεί για γραφείο —
 * ο ιδιώτης (και κάθε συμμετοχή χωρίς `actingFor`) δεν πληρώνει ανάγνωση.
 */
async function placeWith(engagement: Placeable, offices: () => Promise<BelongingOffices>): Promise<CasePlacement> {
  const withoutBook = placementOf(engagement, { outcome: 'unknown' });
  return withoutBook.outcome === 'placed' ? withoutBook : placementOf(engagement, await offices());
}

/**
 * **Το σπίτι μιας συμμετοχής, τώρα** (ADR-901 §15.15 · Γ2.1) — για όποιον **δεν** κρατά {@link ActingViews}
 * (ειδοποίηση: κανένα αίτημα, άρα κανένας χώρος αιτήματος — απαντά μόνο το βιβλίο μελών).
 */
export function placeEngagement(engagement: Placeable): Promise<CasePlacement> {
  return placeWith(engagement, () => belongingOffices({ uid: engagement.uid, active: null }));
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
  /** Σε ποιο σπίτι ανοίγει **τώρα** (§15.15) — το γραφείο όπου ανήκει ακόμη, αλλιώς ο προσωπικός του. */
  placement(engagement: Placeable): Promise<CasePlacement>;
}

type OfficeReader = (companyId: string) => Promise<ActingOffice>;

async function previewOf(viewer: ActingViewer, offices: Promise<BelongingOffices>, office: OfficeReader): Promise<AcceptancePreview> {
  const decision = await judgeActingWorkspace(viewer, null, offices);
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
  // Το βιβλίο μελών το πολύ ΜΙΑ φορά ανά αίτημα — και μόνο αν κάποιος το ρωτήσει (προεπισκόπηση · σπίτι γραφείου).
  let belonging: Promise<BelongingOffices> | null = null;
  const ownOffices = (): Promise<BelongingOffices> => (belonging ??= belongingOffices(viewer));
  const placement = (engagement: Placeable): Promise<CasePlacement> => placeWith(engagement, ownOffices);
  return {
    acceptance: () => (preview ??= previewOf(viewer, ownOffices(), office)),
    actingFor: async (engagement) => {
      if (!UNDERTAKEN_STATES.includes(engagement.state)) return null;
      return actingForViewOf(engagement, await placement(engagement), office);
    },
    placement,
  };
}

/**
 * Η γραμμή «για ποιον ενεργώ», από το **σπίτι** της συμμετοχής. «Δεν μπόρεσα να ρωτήσω» ⇒ το **γεγονός**
 * (`office`): η κάρτα δεν ισχυρίζεται αποχώρηση που δεν επαλήθευσε — τη λίστα την έχει ήδη κόψει ο καλών.
 */
async function actingForViewOf(engagement: Placeable, placed: CasePlacement, office: OfficeReader): Promise<ActingForView> {
  if (placed.outcome === 'placed' && placed.departedFrom !== null) {
    return { kind: 'departed', office: await office(placed.departedFrom.companyId) };
  }
  const acting = placed.outcome === 'placed' ? placed.home : actingWorkspaceOf(engagement);
  return acting.kind === 'org' ? { kind: 'office', office: await office(acting.companyId) } : { kind: 'personal' };
}
