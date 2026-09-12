/**
 * Ο ΕΝΕΡΓΟΣ ΧΩΡΟΣ ΤΟΥ ΠΕΛΑΤΗ — module-level registry (ADR-354 · ADR-787 §5.3 ζ · ADR-849 Β1)
 *
 * Lightweight, zero-dep state holder so Firestore-side `requireAuthContext`
 * and the HTTP client can read the requested workspace without importing
 * React context (which would create circular deps and SSR pitfalls).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΕΧΕΙ ΔΥΟ ΕΙΣΟΔΟΥΣ — ΚΑΙ ΓΙΑΤΙ ΒΓΑΖΕΙ ΜΙΑ ΑΠΑΝΤΗΣΗ
 * ─────────────────────────────────────────────────────────────────────────────
 * Μέχρι το ADR-849 Β1 κρατούσε **μόνο** την επιλογή του επιλογέα του super-admin
 * (`localStorage`), και ο πελάτης φιλτράριζε με αυτήν **αγνοώντας τη διεύθυνση**.
 * Μετρημένο ζωντανά: σύνδεσμος email προς `/o/<ΠΑΓΩΝΗΣ>/properties/<id>` έδειξε
 * «δεν βρέθηκε», γιατί ο κατάλογος φορτώθηκε από την εταιρεία του επιλογέα.
 * Το ADR-787 §5.3 ζ είχε ήδη αποφασίσει ότι ο μεταφορέας γεμίζει **από τη
 * διεύθυνση** — έλειπε η υλοποίηση.
 *
 * | είσοδος | ποιος γράφει | πότε μετρά |
 * |---|---|---|
 * | `url` | `WorkspaceScopeBridge` — με την εμβέλεια που **ήδη έκρινε** ο φύλακας του `/o/[workspace]` | **πάντα** όταν υπάρχει |
 * | `switcher` | `SuperAdminCompanyContext` (μόνο για super-admin) | **μόνο εκτός `/o/`** (σελίδες διαχείρισης) |
 *
 * ⇒ Η απάντηση είναι **μία**: {@link requestedWorkspace}. Ο resolver του Firestore,
 * η κεφαλίδα HTTP, το `useCompanyId` και ο επιλογέας την **παράγουν** — κανείς δεν
 * κρατά δικό του αντίγραφο (ήταν ακριβώς αυτό το «σπρώξιμο αντιγράφου» που άφησε τη
 * διεύθυνση εκτός).
 *
 * ⚠️ **Αίτημα, όχι άδεια** (ADR-787 Ε-5): την άδεια τη δίνουν ο φύλακας του χώρου και
 * τα `firestore.rules`. Εδώ δεν κρίνεται τίποτα.
 *
 * 🔶 Το όνομα του αρχείου λέει ακόμα «super-admin»: η μετονομασία αγγίζει καταναλωτές
 * σε άλλους τομείς και το ADR-787 §5.2 την ονομάζει ρητά «δουλειά για πέταμα» μέχρι να
 * κλείσει ο μεταφορέας — δηλωμένο, όχι ξεχασμένο.
 */

import { registerWorkspaceScopeSource } from '@/lib/api/workspace-scope-source';
import { createExternalStore } from '@/lib/state/createExternalStore';
import { serializeRequestedWorkspace } from '@/lib/workspace/requested-workspace-wire';
import type { RequestedWorkspace, WorkspaceRef } from '@/types/workspace-membership';

/** Οι δύο είσοδοι — **ποτέ** η απάντηση. Αυτή τη δίνει το {@link requestedWorkspace}. */
export interface ClientWorkspaceScope {
  /** Ο χώρος της **διεύθυνσης**, όπως τον έκρινε ο φύλακας — `null` εκτός `/o/`. */
  readonly url: WorkspaceRef | null;
  /** Η επιλογή του επιλογέα του super-admin — `null` για κάθε άλλον. */
  readonly switcher: string | null;
}

const EMPTY_SCOPE: ClientWorkspaceScope = { url: null, switcher: null };

/** Ίδιος χώρος; Κατά **τιμή** — ο φύλακας ξαναχτίζει το αντικείμενο σε κάθε απόδοση. */
function sameWorkspace(a: WorkspaceRef | null, b: WorkspaceRef | null): boolean {
  if (a === null || b === null) return a === b;
  if (a.kind === 'org' && b.kind === 'org') return a.companyId === b.companyId;
  if (a.kind === 'personal' && b.kind === 'personal') return a.userId === b.userId;
  return false;
}

// SSoT pub/sub primitive (WAVE 3). Η ισότητα κατά τιμή κρατά τις περιττές εγγραφές
// no-op — αλλιώς κάθε απόδοση του φύλακα θα ξανάστηνε ΚΑΘΕ ακροατή Firestore.
const store = createExternalStore<ClientWorkspaceScope>(EMPTY_SCOPE, {
  equals: (a, b) => a.switcher === b.switcher && sameWorkspace(a.url, b.url),
});

/** Ο χώρος της διεύθυνσης — τον γράφει **μόνο** το `WorkspaceScopeBridge`. */
export function setUrlWorkspaceScope(url: WorkspaceRef | null): void {
  store.set({ ...store.get(), url });
}

/** Η επιλογή του επιλογέα — τη γράφει **μόνο** το `SuperAdminCompanyContext`. */
export function setSuperAdminActiveCompanyId(id: string | null): void {
  store.set({ ...store.get(), switcher: id });
}

/**
 * Οι είσοδοι, ως **σταθερό** στιγμιότυπο (ίδια αναφορά μέχρι να αλλάξουν) — ασφαλές
 * ως `getSnapshot` του `useSyncExternalStore`.
 */
export function getClientWorkspaceScope(): ClientWorkspaceScope {
  return store.get();
}

/**
 * **Ποιον χώρο ζητά ο πελάτης** — η ΜΙΑ απάντηση.
 *
 * 🔑 **Η διεύθυνση νικά, πάντα.** Ο επιλογέας μετρά μόνο όταν η διεύθυνση **δεν**
 * ονομάζει χώρο (σελίδες εκτός `/o/`) — αλλιώς δύο καρτέλες σε δύο εταιρείες θα
 * έδειχναν δεδομένα της **ίδιας**, και ένας σύνδεσμος θα άνοιγε κάτι άλλο από αυτό που
 * λέει (Linear · Vercel · Slack: ο οργανισμός ζει στη διεύθυνση).
 *
 * ⚠️ Επιστρέφει **νέο** αντικείμενο — **μην** το δώσεις ως `getSnapshot`· δώσε το
 * {@link getClientWorkspaceScope} και παράγαγε με αυτή τη συνάρτηση.
 */
export function requestedWorkspace(
  scope: ClientWorkspaceScope = store.get(),
): RequestedWorkspace {
  if (scope.url !== null) {
    return scope.url.kind === 'org'
      ? { kind: 'org', companyId: scope.url.companyId }
      : { kind: 'personal' };
  }
  return scope.switcher !== null
    ? { kind: 'org', companyId: scope.switcher }
    : { kind: 'default' };
}

/**
 * Το ζητούμενο ως **πρωτογενές κλειδί** (`org:<id>` · `personal` · `default`) — σταθερό
 * `getSnapshot` για ακροατές που πρέπει να **ξαναστηθούν** όταν αλλάζει ο χώρος.
 *
 * 🔑 **Ο σειριοποιητής είναι ο ΙΔΙΟΣ με αυτόν του σύρματος** (2026-09-12): το κλειδί του
 * ακροατή και η τιμή της κεφαλίδας απαντούν την **ίδια** ερώτηση *(«ποιον χώρο ζητάω;»)*.
 * Δύο γραφές της ίδιας μορφής θα αποκλίνουν την πρώτη φορά που αλλάξει η μία — και η
 * απόκλιση θα ήταν **αόρατη**, γιατί και οι δύο «δουλεύουν».
 */
export function requestedWorkspaceKey(scope: ClientWorkspaceScope = store.get()): string {
  return serializeRequestedWorkspace(requestedWorkspace(scope));
}

/** Η εταιρεία που **ζητείται ρητά** — `null` όταν δεν ζητείται καμία (ιδιωτικός ή τίποτα). */
export function requestedCompanyId(scope: ClientWorkspaceScope = store.get()): string | null {
  const requested = requestedWorkspace(scope);
  return requested.kind === 'org' ? requested.companyId : null;
}

/**
 * Subscribe to ANY change of the requested workspace (URL or switcher). Used by
 * `firestoreQueryService.subscribe` to rebuild live queries with the new filter
 * (ADR-354) — και πλέον πυροδοτείται **και** όταν αλλάζει ο χώρος της διεύθυνσης.
 */
export function onSuperAdminActiveCompanyChange(listener: () => void): () => void {
  return store.subscribe(listener);
}

// 🔑 Το σύρμα προς το API ΡΩΤΑ αυτό το store — δεν του «σπρώχνει» αντίγραφο κανένα effect.
//    Εγγραφή στο import: αυτό το module το φορτώνουν το root layout (μέσω του
//    `SuperAdminCompanyContext`) και ο φύλακας του χώρου, **πριν** από κάθε αίτημα.
//
// 🔴 **ΟΛΟΚΛΗΡΗ Η ΑΠΑΝΤΗΣΗ, ΟΧΙ ΜΟΝΟ Η ΕΤΑΙΡΕΙΑ** (2026-09-12, ADR-787 §5.3 ζ όριο 1):
//    μέχρι σήμερα εδώ περνούσε `requestedCompanyId()`, δηλαδή `null` **και** για τον
//    ιδιωτικό χώρο **και** για το «δεν ονομάζει χώρο η διεύθυνση». Ο διακομιστής δεν
//    μπορούσε να τα ξεχωρίσει και έδινε καθολική όψη στον super-admin μέσα στο `/o/me`.
registerWorkspaceScopeSource(() => requestedWorkspace());
