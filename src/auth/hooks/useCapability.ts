'use client';

/**
 * =============================================================================
 * Ο PEP ΤΟΥ ΠΕΛΑΤΗ — ο ΕΝΑΣ (ADR-801 §4, Φάση 3)
 * =============================================================================
 *
 * **Το ερώτημα**: *«Να **δείξω** αυτό το κουμπί σε αυτόν τον άνθρωπο;»*
 *
 * ⚠️ **ΔΕΝ ΑΠΟΦΑΣΙΖΕΙ ΤΙΠΟΤΑ.** Ο αποφασίζων (**PDP**) είναι ο
 * `lib/auth/authority.ts`· αυτό εδώ είναι ο **PEP**: παίρνει την ταυτότητα από
 * τα **επαληθευμένα custom claims** (`AuthContext`) και **παραδίδει** την
 * ετυμηγορία στο UI. Μοντέλο **OpenID AuthZEN 1.0** (Standards Track).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 ΕΡΓΟΝΟΜΙΑ, ΟΧΙ ΑΣΦΑΛΕΙΑ — ΚΑΤΑ ΛΕΞΗ ΑΠΟ ΤΟ OWASP
 * ─────────────────────────────────────────────────────────────────────────────
 * *«Developers must **never** rely on client-side access control checks … they
 * should never be the **decisive factor**»* (Authorization Cheat Sheet). Το ίδιο
 * γράφουν Oso · Backstage · CASL: *«Permission checks on frontend are **not
 * there for security**, but only for **ergonomics**»*.
 *
 * ⇒ Κάθε πράξη που κρίνεται εδώ **οφείλει** να κρίνεται **ξανά** στον server
 *   (`withAuth` → `checkPermission`) ή στους `firestore.rules`. Αυτό εδώ
 *   αποφασίζει **τι βλέπει** ο άνθρωπος, ποτέ **τι μπορεί**.
 *
 * 🔶 **ΔΗΛΩΜΕΝΗ ΑΣΥΜΜΕΤΡΙΑ, ΜΕΤΡΗΜΕΝΗ** (ADR-801 §2.5): ο server
 * (`checkPermission`) **δεν διαβάζει καθόλου** το claim `permissions` — το
 * `AuthContext` δεν έχει καν τέτοιο πεδίο. Άρα ένα ρητά δοσμένο permission
 * παράγει εδώ `granted-by-permission` και εκεί `permission_not_in_role`. Αυτό
 * είναι το **ασφαλές** σκέλος (ο server αρνείται), αλλά **είναι** απόκλιση:
 * το UI δείχνει κουμπί που ο server θα απορρίψει. Κλείνει όταν το
 * `AuthContext` κουβαλήσει τα `permissions` — **όχι** αφαιρώντας το βήμα (5)
 * του κριτή, που είναι ο μόνος που τιμά τη ρητή παραχώρηση.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔑 ΓΙΑΤΙ ΔΕΝ ΔΙΑΒΑΖΕΙ ΤΟ `UserRoleContext`
 * ─────────────────────────────────────────────────────────────────────────────
 * Το `useUserRole().user.role` έχει τύπο `'admin' | 'authenticated' | 'public'`
 * και **παράγεται από λίστα email** (`NEXT_PUBLIC_ADMIN_EMAILS`, μέσα στο
 * bundle του φυλλομετρητή — `EnterpriseSecurityService.checkUserRole`). Ένας
 * πραγματικός `company_admin` παίρνει από εκεί `'authenticated'`, δηλαδή **η
 * ταυτότητα χάνεται πριν φτάσει σε οποιονδήποτε κριτή**.
 *
 * Εδώ η πηγή είναι το `useAuth().user`, που το `buildAuthUser` γεμίζει από
 * `getIdTokenResult()` — **επαληθευμένα** claims: `globalRole` · `permissions`
 * · `companyId`. Είναι **δομικά** το σχήμα `CapabilitySubject`.
 *
 * ⚠️ **ΜΗΝ γυρίσεις σε `boolean`.** Ένα `false` δεν λέει **γιατί**, οπότε το UI
 * δεν μπορεί ούτε να το εξηγήσει στον άνθρωπο ούτε να το ξεχωρίσει από σφάλμα.
 *
 * ⚠️ **ΜΗΝ το κάνεις να διαβάζει `useAuthOptional()`.** Εκτός παρόχου δεν
 * υπάρχει ταυτότητα, και το «σιωπηλό `denied`» θα έκρυβε **σφάλμα καλωδίωσης**
 * πίσω από μια απόλυτα εύλογη άρνηση.
 *
 * @module auth/hooks/useCapability
 * @enterprise ADR-801 — Ένας κριτής για το «επιτρέπεται;»
 * @see lib/auth/authority.ts — ο PDP
 * @see CHECK 3.66 — η πύλη που κάνει τον δεύτερο κριτή αδύνατο
 */

import { useMemo } from 'react';

import { useAuth } from './useAuth';
import { decideCapability } from '@/lib/auth/authority';
import type { PermissionId } from '@/lib/auth/types';
import type {
  CapabilityDecision,
  CapabilitySubject,
} from '@/types/capability-authority';

// =============================================================================
// ΤΟ ΣΧΗΜΑ ΤΟΥ PEP
// =============================================================================

/**
 * Η ετυμηγορία του PDP **συν** ό,τι ξέρει μόνο ο PEP.
 *
 * 🔑 **ΓΙΑΤΙ ΤΟ `pending` ΔΕΝ ΕΙΝΑΙ ΟΓΔΟΗ ΕΤΥΜΗΓΟΡΙΑ.** *«Δεν έχω ακόμη την
 * ταυτότητα»* δεν είναι απάντηση για τον **άνθρωπο** — είναι κατάσταση της
 * **μεταφοράς**. Ο PDP κρίνει υποκείμενα· το «δεν έφτασε υποκείμενο» είναι
 * πρόβλημα του σημείου επιβολής. Ετυμηγορία εκεί θα ήταν λεξιλόγιο που
 * περιγράφει τον **αγωγό**, όχι την **άδεια** — και θα υποχρέωνε κάθε άλλον
 * καταναλωτή του `CapabilityVerdict` να τη χειριστεί χωρίς να τον αφορά.
 *
 * ⚠️ Ο πληθυσμός του είναι **μετρημένος, όχι υποθετικός**: το
 * `AuthContext.loading` ξεκινά `true` και **κάθε** συνεδρία περνά από εκεί.
 * Χωρίς αυτό, κάθε πρώτη απόδοση δείχνει *«δεν επιτρέπεται»* και μετά
 * αναβοσβήνει — άρνηση που **δεν κρίθηκε ποτέ**.
 *
 * ⚠️ **fail-closed όσο εκκρεμεί**: το `verdict` είναι `denied-unauthenticated`,
 * ώστε ένας καλών που **αγνοεί** το `pending` να μη δείξει ποτέ κάτι παραπάνω.
 * Ο `reason` όμως είναι `null` — *δεν υπάρχει «γιατί» για κάτι που δεν κρίθηκε*.
 */
export interface CapabilityGate extends CapabilityDecision {
  /** Η ταυτότητα **δεν έχει φορτώσει ακόμη** — η άρνηση δεν είναι τελική. */
  readonly pending: boolean;
}

/**
 * Διαχωριστής κλειδιού μνήμης.
 *
 * ⚠️ Το κενό διάστημα είναι ασφαλές **επειδή μετρήθηκε**: κάθε κλειδί του
 * `PERMISSIONS` ακολουθεί το σχήμα `domain:resource:action` (ή το legacy
 * `admin_access`) — **κανένα δεν περιέχει κενό**.
 */
const KEY_SEPARATOR = ' ';

// =============================================================================
// ΤΑ ΑΓΚΙΣΤΡΑ
// =============================================================================

/**
 * **Πολλές** ικανότητες σε **μία** ανάγνωση ταυτότητας.
 *
 * @param actions Οι ικανότητες — **σταθερές του `PERMISSIONS`**, ποτέ ελεύθερο
 *                κείμενο. Άγνωστη τιμή ⇒ `denied-unknown-action`, ποτέ σιωπή.
 * @returns Χάρτης `ικανότητα → ετυμηγορία`, **παγωμένος**.
 *
 * @example
 * const caps = useCapabilities(['dxf:text:edit', 'dxf:text:delete']);
 * if (isGranted(caps['dxf:text:edit'].verdict)) enableEditor();
 */
export function useCapabilities<A extends PermissionId>(
  actions: readonly A[],
): Readonly<Record<A, CapabilityGate>> {
  const { user, loading } = useAuth();

  // ⚠️ Το κλειδί είναι το **ΠΕΡΙΕΧΟΜΕΝΟ**, όχι η ταυτότητα του πίνακα: ένας
  //    καλών που γράφει `useCapabilities(['a'])` inline φτιάχνει νέο πίνακα σε
  //    κάθε απόδοση, άρα μνήμη με βάση την ταυτότητα δεν θα έπιανε **ποτέ** —
  //    δηλαδή θα ήταν `useMemo` που δεν θυμάται τίποτα. Ο βρόχος διαβάζει το
  //    `key`, οπότε οι εξαρτήσεις είναι πλήρεις ακριβώς όπως δηλώνονται.
  const key = actions.join(KEY_SEPARATOR);

  return useMemo(() => {
    const gates = {} as Record<A, CapabilityGate>;
    if (key.length > 0) {
      for (const action of key.split(KEY_SEPARATOR) as A[]) {
        gates[action] = gateFor(user, action, loading);
      }
    }
    return Object.freeze(gates);
  }, [user, loading, key]);
}

/**
 * **Μία** ικανότητα.
 *
 * @example
 * const gate = useCapability('dxf:dictionary:manage');
 * <Button disabled={!isGranted(gate.verdict)} />
 */
export function useCapability(action: PermissionId): CapabilityGate {
  const { user, loading } = useAuth();
  return useMemo(() => gateFor(user, action, loading), [user, action, loading]);
}

// =============================================================================
// Η ΜΕΤΑΦΡΑΣΗ PDP → PEP — **ΕΝΑ** σημείο, ώστε το `pending` να μη ξεχνιέται
// =============================================================================

/**
 * Η ετυμηγορία του PDP, τυλιγμένη με ό,τι ξέρει ο PEP.
 *
 * ⚠️ **Όσο εκκρεμεί η ταυτότητα ο κριτής ΔΕΝ καλείται καν**: ένα `null` subject
 * θα του έδινε `denied-unauthenticated`, που είναι σωστή τιμή αλλά **λάθος
 * ιστορία** — θα έλεγε ότι *κρίθηκε ανώνυμος*, ενώ απλώς δεν είχε φτάσει
 * ακόμη το token.
 */
function gateFor(
  subject: CapabilitySubject | null,
  action: PermissionId,
  loading: boolean,
): CapabilityGate {
  if (loading) {
    return { verdict: 'denied-unauthenticated', action, reason: null, pending: true };
  }
  return { ...decideCapability({ subject, action }), pending: false };
}
