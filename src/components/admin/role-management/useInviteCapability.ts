'use client';

/**
 * ADR-853 Φ6 — **η ερώτηση** *«να του δείξω το «Πρόσκληση χρήστη»;»*.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⛔ ΔΕΝ ΕΙΝΑΙ ΚΡΙΤΗΣ. ΕΙΝΑΙ **ΟΝΟΜΑ ΕΡΩΤΗΣΗΣ** (ADR-801 §4 · CHECK 3.68)
 * ─────────────────────────────────────────────────────────────────────────────
 * Ο κριτής (**PDP**) είναι **ένας**: το `lib/auth/authority.ts`. Το σημείο επιβολής
 * (**PEP**) του πελάτη είναι **ένα**: το `auth/hooks/useCapability`. Αυτό εδώ **δεν
 * αποφασίζει τίποτα** — δίνει όνομα στην ερώτηση και μεταφράζει την ετυμηγορία στο
 * λεξιλόγιο της οθόνης. Ίδιο μοτίβο με το `usePropertyEditCapability` (ADR-840) και
 * το `useCanEditText` του DXF viewer.
 *
 * 🔴 **ΜΗΝ γράψεις εδώ `globalRole === 'super_admin' || globalRole === 'company_admin'`.**
 *    Μια ωμή λίστα ρόλων που **κρίνει** είναι παράβαση **CHECK 3.68 Κ1** *(«inline σύνολο
 *    ρόλων εκτός SSoT — θεραπεία: κάλεσε τον `decideCapability`»)*, με **14 ζωντανές** σε
 *    ratchet προς το μηδέν. Και συμφωνεί με το **NIST SP 800-162 / 800-207** *(ο PEP
 *    «contains no clever logic of its own»· ο κεντρικός PDP «avoids duplication of role
 *    lists across enforcement points»)* και με το **AuthZEN Authorization API 1.0**
 *    (OpenID, 01/2026): *ο PEP **ρωτά**, δεν κρίνει*.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔑 ΓΙΑΤΙ ΔΕΝ ΚΡΕΜΙΕΤΑΙ ΑΠΟ ΤΟ `canEdit` ΤΗΣ ΣΕΛΙΔΑΣ — ΜΕΤΡΗΜΕΝΟ
 * ─────────────────────────────────────────────────────────────────────────────
 * Το `RoleManagementPageContent` υπολογίζει `canEdit = globalRole === 'super_admin'`.
 * Ένα κουμπί κρεμασμένο **εκεί** θα ήταν αόρατο στον `company_admin` — δηλαδή ακριβώς
 * στους ανθρώπους για τους οποίους γράφτηκε το ADR-853 (Α3). Η ικανότητα
 * `users:users:manage` τη δίνει ο κατάλογος **στον `company_admin`**
 * (`lib/auth/role-catalogue.ts:72`), και είναι **η ίδια** που φυλά τις πόρτες
 * `POST /api/workspace-invitations` και `…/revoke` — δηλαδή η οθόνη και ο διακομιστής
 * απαντούν στο **ίδιο** ερώτημα, όχι σε δύο παρόμοια.
 *
 * @module components/admin/role-management/useInviteCapability
 * @see src/auth/hooks/useCapability.ts — ο ΕΝΑΣ PEP του πελάτη
 * @see src/lib/auth/authority.ts — ο ΕΝΑΣ κριτής (PDP)
 * @see docs/centralized-systems/reference/adrs/ADR-853-workspace-invitations.md §8 Φ6
 */

import { useMemo } from 'react';

import { useCapability } from '@/auth/hooks/useCapability';
import type { PermissionId } from '@/lib/auth/types';
import { isGranted, type CapabilityVerdict } from '@/types/capability-authority';

/**
 * Τι αρκεί για να **δείξουμε** την πρόσκληση.
 *
 * 🔑 **Η ΙΔΙΑ σταθερά που φυλά την πόρτα**, ονομασμένη μία φορά: έκδοση και ανάκληση
 * δηλώνουν κι οι δύο `{ permissions: 'users:users:manage' }` στο `withAuth`. Δύο
 * καταναλωτές που τη γράφουν ο καθένας μόνος του είναι δύο ευκαιρίες να αποκλίνουν (N.0.2).
 */
export const WORKSPACE_INVITE_PERMISSION: PermissionId = 'users:users:manage';

export interface InviteCapability {
  /**
   * *«Να δείξω την πρόσκληση;»* — **όχι** *«επιτρέπεται;»*. Το δεύτερο το απαντά ο
   * διακομιστής, πάντα, ξανά (OWASP: ο πελάτης ποτέ αποφασίζων).
   */
  readonly canInvite: boolean;
  /** Η ετυμηγορία του PDP, ώστε η οθόνη να μπορεί να **πει τον λόγο**. */
  readonly verdict: CapabilityVerdict;
  /**
   * Η ταυτότητα δεν έχει φορτώσει ακόμη ⇒ η άρνηση **δεν είναι τελική**.
   *
   * 🔑 Χωρίς αυτό, η οθόνη δείχνει άρνηση **που δεν κρίθηκε ποτέ** και μετά αναβοσβήνει:
   * το `AuthContext.loading` ξεκινά `true` σε **κάθε** συνεδρία, άρα ο πληθυσμός είναι
   * **όλοι**.
   */
  readonly pending: boolean;
}

export function useInviteCapability(): InviteCapability {
  const gate = useCapability(WORKSPACE_INVITE_PERMISSION);

  return useMemo(
    () => ({
      // fail-closed όσο εκκρεμεί: το `pending` δίνει `denied-unauthenticated`, άρα η
      // κατεύθυνση είναι **«κλειστό → ανοιχτό»** και ποτέ το αντίστροφο — κουμπί που
      // εμφανίζεται και μετά εξαφανίζεται είναι χειρότερο από κουμπί που αργεί.
      canInvite: isGranted(gate.verdict),
      verdict: gate.verdict,
      pending: gate.pending,
    }),
    [gate],
  );
}
