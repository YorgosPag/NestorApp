/**
 * @fileoverview **ΚΑΘΕ ΚΑΤΑΣΤΑΣΗ ΤΗΣ ΠΡΟΣΚΛΗΣΗΣ ΑΓΟΡΑΣΤΗ ΚΑΙ ΤΗΣ ΠΡΟΕΛΕΥΣΗΣ ΤΟΥ ΦΑΚΕΛΟΥ** — παραγόμενες, ποτέ γραμμένες στο χέρι.
 * @related ADR-916 Φ-Β2 · `HandoverInviteHarness.tsx` (η γκαλερί) · ADR-844 §11 (`first-contact-proof-scenarios.ts` — το πρότυπο)
 * @module components/handover-invite/testing/handover-invite-scenarios
 *
 * 🏆 **Γκαλερί καταστάσεων, όχι δεδομένα στην παραγωγή.** Οι μεγάλοι (Storybook/Chromatic modes · Figma playground ·
 * Polaris) **δεν** γράφουν ψεύτικες εγγραφές σε ζωντανή βάση για να «δουν» μια οθόνη· αποδίδουν **κάθε** κατάσταση
 * ντετερμινιστικά. Το κενό τους είναι ονομασμένο από τους ίδιους — *«only the states someone thought to write a story
 * for»* — και εδώ **κλείνει**: κάθε ομάδα παράγεται με `map` πάνω στο **κλειστό** σύνολο της. Νέα άρνηση, νέα αφορμή ή
 * νέα κατάσταση κύκλου ζωής εμφανίζεται στη γκαλερί **μόνη της** — και η άγκυρα μετρά τα πάνελ απέναντι στα σύνολα.
 *
 * 🔴 **Τρεις στρώσεις, γιατί η οθόνη έχει τρεις πηγές αλήθειας**:
 *   1. **`server`** — ό,τι αποφασίζει ο διακομιστής πριν φτάσει ο άνθρωπος: η όψη (`respond` × αφορμή) από τη
 *      **πραγματική** στένωση `invitationPageViewOf`, κάθε κοινή άρνηση, «δεν μπόρεσα».
 *   2. **`answer`** — ό,τι απαντά η πόρτα **μετά** το κλικ: **ωμό** σώμα + κωδικός HTTP της διαδρομής
 *      (`api/property-handover-invitations/redeem/route.ts`), που η οθόνη περνά από τον **πραγματικό** αποκωδικοποιητή.
 *   3. **`origin`** — η όψη του φακέλου μετά την αποδοχή: κάθε κατάσταση κύκλου ζωής, με και χωρίς όνομα εκδότη.
 *
 * **Layering**: leaf — καθαρά δεδομένα. Κανένα React, κανένα Firestore, κανένα κείμενο οθόνης.
 */

import type { ScriptedReply } from '@/components/testing/harness/scripted-transport';
import { invitationPageViewOf } from '@/lib/invitations/invitation-respond';
import { handoverInvitationHref } from '@/lib/property-handover/handover-routes';
import { CORE_INVITATION_REFUSALS } from '@/types/invitation-core';
import type { PropertyDossierHandoverOrigin } from '@/types/property-dossier';
import {
  PROPERTY_HANDOVER_INVITATION_OCCASIONS,
  PROPERTY_HANDOVER_LIFECYCLES,
  type PropertyHandoverInvitationOccasion,
} from '@/types/property-handover';
import {
  PROPERTY_HANDOVER_INVITATION_REFUSALS,
  type PropertyHandoverInvitationPreview,
} from '@/types/property-handover-invitation';

import type { HandoverInviteView } from '../HandoverInviteContent';

const BUYER = 'buyer@example.test';
const OTHER = 'someone.else@example.test';
/** Συνθετικά, όχι πραγματικά — η γκαλερί δεν διαβάζει ποτέ βάση. */
const ISSUER = 'Κατασκευαστική Άλφα Α.Ε.';
const PROPERTY = 'Διαμέρισμα Α1 · 2ος όροφος';
/** Σταθερή λήξη: η γκαλερί είναι **ντετερμινιστική** — ίδια εικόνα σε κάθε άνοιγμα. */
const EXPIRES_AT = '2026-11-19T10:00:00.000Z';

/** Ποιος κοιτάζει — οι τρεις κλάδοι του `invitationRespondOf` (το κλειστό σύνολο του `InvitationRespond`). */
const VIEWER_KINDS = ['sign-in', 'other-account', 'ready'] as const;
type ViewerKind = (typeof VIEWER_KINDS)[number];

const VIEWERS: Readonly<Record<ViewerKind, { readonly viewerEmail: string | null; readonly addressedToViewer: boolean | null }>> = {
  'sign-in': { viewerEmail: null, addressedToViewer: null },
  'other-account': { viewerEmail: OTHER, addressedToViewer: false },
  ready: { viewerEmail: BUYER, addressedToViewer: true },
};

export interface ServerScenario {
  readonly id: string;
  readonly view: HandoverInviteView;
}

export interface AnswerScenario {
  readonly id: string;
  /** Το token της όψης **είναι** η ταυτότητα — ο μεταφορέας δρομολογεί σε αυτό (MSW: στο αίτημα). */
  readonly view: HandoverInviteView;
  readonly action: 'accept' | 'decline';
  readonly reply: ScriptedReply;
}

export interface OriginScenario {
  readonly id: string;
  readonly origin: PropertyDossierHandoverOrigin;
}

function previewOf(occasion: PropertyHandoverInvitationOccasion, named: boolean): PropertyHandoverInvitationPreview {
  return { issuerName: named ? ISSUER : null, propertyLabel: named ? PROPERTY : null, occasion, expiresAt: EXPIRES_AT };
}

/** Η όψη από την **ίδια** στένωση που χρησιμοποιεί η σελίδα — όχι χειρόγραφο σχήμα. */
function previewView(token: string, viewer: ViewerKind, preview: PropertyHandoverInvitationPreview): HandoverInviteView {
  const { viewerEmail, addressedToViewer } = VIEWERS[viewer];
  return invitationPageViewOf(
    { kind: 'preview', preview, addressedToViewer },
    { token, viewerEmail, invitationHref: handoverInvitationHref(token) },
  );
}

export const SERVER_SCENARIOS: readonly ServerScenario[] = [
  ...VIEWER_KINDS.flatMap((viewer) => PROPERTY_HANDOVER_INVITATION_OCCASIONS.map((occasion): ServerScenario => {
    const id = `view-${viewer}-${occasion}`;
    return { id, view: previewView(id, viewer, previewOf(occasion, true)) };
  })),
  // Χωρίς όνομα εταιρείας/σπιτιού (η ανάγνωση απέτυχε) ⇒ η οθόνη τα ονομάζει από τα λόγια της.
  { id: 'view-ready-unnamed', view: previewView('view-ready-unnamed', 'ready', previewOf('reservation', false)) },
  ...CORE_INVITATION_REFUSALS.map((reason): ServerScenario => ({ id: `server-${reason}`, view: { kind: 'refused', reason } })),
  { id: 'server-unavailable', view: { kind: 'unavailable' } },
];

/** Οι απαντήσεις της πόρτας — **αντίγραφο της διαδρομής**, όχι εικασία (422 · 503 · σώματα). */
function answer(id: string, action: AnswerScenario['action'], reply: ScriptedReply, occasion: PropertyHandoverInvitationOccasion = 'reservation'): AnswerScenario {
  return { id, action, reply, view: previewView(id, 'ready', previewOf(occasion, true)) };
}

export const ANSWER_SCENARIOS: readonly AnswerScenario[] = [
  ...PROPERTY_HANDOVER_INVITATION_OCCASIONS.map((occasion) =>
    answer(`answer-accepted-${occasion}`, 'accept', { status: 200, body: { status: 'accepted', dossierId: 'pdos_harness' } }, occasion)),
  answer('answer-declined', 'decline', { status: 200, body: { status: 'declined' } }),
  ...PROPERTY_HANDOVER_INVITATION_REFUSALS.map((reason) =>
    answer(`answer-${reason}`, 'accept', { status: 422, body: { error: 'LINK_REFUSED', reason } })),
  answer('answer-unavailable', 'accept', { status: 503, body: { error: 'REDEEM_UNAVAILABLE' } }),
  // ⚠️ ΑΓΝΩΣΤΟΣ κωδικός επίτηδες: ο φρουρός πρέπει να πέσει σε «δοκιμάστε ξανά», ποτέ ωμό κλειδί στην οθόνη.
  answer('answer-unknown-code', 'accept', { status: 500, body: { error: 'A_CODE_THIS_CLIENT_HAS_NEVER_HEARD_OF' } }),
];

export const ORIGIN_SCENARIOS: readonly OriginScenario[] = PROPERTY_HANDOVER_LIFECYCLES.flatMap((lifecycle) =>
  [true, false].map((named): OriginScenario => ({
    id: `origin-${lifecycle}-${named ? 'named' : 'unnamed'}`,
    origin: {
      kind: 'handover', handoverId: 'phov_harness', issuerCompanyId: 'comp_harness',
      issuerName: named ? ISSUER : null, acceptedAt: '2026-10-20T09:00:00.000Z', handoverLifecycle: lifecycle,
      fileDelivery: null, appurtenanceOf: null,
    },
  })));

const ANSWER_BY_TOKEN = new Map(ANSWER_SCENARIOS.map((scenario) => [scenario.id, scenario.reply]));

/** Η απάντηση για το token του σώματος — `undefined` ⇒ δεν είναι σενάριο της γκαλερί. */
export function scriptedAnswerFor(token: string): ScriptedReply | undefined {
  return ANSWER_BY_TOKEN.get(token);
}
