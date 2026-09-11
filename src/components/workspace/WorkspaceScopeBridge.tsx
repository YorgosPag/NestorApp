'use client';

/**
 * @fileoverview **Η ΓΕΦΥΡΑ: ο χώρος που έκρινε ο φύλακας φτάνει στον πελάτη** (ADR-849 Β1).
 * @related ADR-787 §5.3 ζ · `app/(app)/o/[workspace]/layout.tsx` · `services/firestore/super-admin-active-company`
 * @module components/workspace/WorkspaceScopeBridge
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ — ΜΕΤΡΗΜΕΝΟ ΖΩΝΤΑΝΑ
 * ────────────────────────────────────────────────────────────────────────────
 * Ο φύλακας του `/o/[workspace]` κρίνει τον χώρο στον διακομιστή — και **κανείς στον
 * πελάτη δεν μάθαινε την απάντηση**. Τα ερωτήματα φιλτράρονταν με τον επιλογέα του
 * super-admin (`localStorage`) ή με το claim: σύνδεσμος email προς
 * `/o/<ΠΑΓΩΝΗΣ>/properties/<id>` έδειξε «δεν βρέθηκε» για ακίνητο που υπάρχει, και ο
 * απλός χρήστης στο `/o/me` έβλεπε σιωπηλά δεδομένα της **εταιρείας** του.
 *
 * 🔑 **Κανένας νέος αναγνώστης της διεύθυνσης** (CHECK 3.58 Κ2): η εμβέλεια έρχεται
 * από τον φύλακα, που **ήδη** ρώτησε τον κριτή. Εδώ μόνο **μεταφέρεται**.
 *
 * ⚠️ **`useLayoutEffect`, ΕΠΙΤΗΔΕΣ.** Όλα τα layout effects ενός commit τρέχουν **πριν**
 * από κάθε `useEffect` — άρα κανένας ακροατής του δέντρου δεν ξεκινά με λάθος εταιρεία
 * (N.7.2 #2: η κύρια διαδρομή πριν από κάθε εξαρτώμενη). Και οι μεταφορείς διαβάζουν το
 * store **μετά από αναμονή** (`waitForAuthReady` · `getIdToken`), δηλαδή μετά το commit.
 *
 * ⚠️ **Δύο effects, όχι ένα με cleanup.** Ένα cleanup σε κάθε αλλαγή χώρου θα έγραφε
 * `null` ανάμεσα σε `/o/A` και `/o/B` — ενδιάμεση κατάσταση που ξαναστήνει κάθε ακροατή
 * με τον επιλογέα. Ο καθαρισμός γίνεται **μόνο** στην έξοδο από τον χώρο.
 */

import { useLayoutEffect, type ReactNode } from 'react';

import { setUrlWorkspaceScope } from '@/services/firestore/super-admin-active-company';
import {
  orgWorkspace,
  personalWorkspace,
  type WorkspaceRef,
} from '@/types/workspace-membership';

interface WorkspaceScopeBridgeProps {
  /** Ο χώρος **όπως τον έκρινε ο φύλακας** — ποτέ ανάγνωση της διεύθυνσης εδώ. */
  readonly scope: WorkspaceRef;
  readonly children: ReactNode;
}

export function WorkspaceScopeBridge({ scope, children }: WorkspaceScopeBridgeProps) {
  // Πρωτογενείς τιμές ως εξαρτήσεις: ο φύλακας ξαναχτίζει το αντικείμενο σε κάθε απόδοση.
  const kind = scope.kind;
  const id = scope.kind === 'org' ? scope.companyId : scope.userId;

  useLayoutEffect(() => {
    setUrlWorkspaceScope(kind === 'org' ? orgWorkspace(id) : personalWorkspace(id));
  }, [kind, id]);

  useLayoutEffect(() => () => setUrlWorkspaceScope(null), []);

  return <>{children}</>;
}
