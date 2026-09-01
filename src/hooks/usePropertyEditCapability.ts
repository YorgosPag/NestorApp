'use client';

/**
 * ADR-840 Α4 / Σ2 — **η ερώτηση** *«να του δείξω την επεξεργασία ακινήτου;»*.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΙ ΑΝΤΙΚΑΘΙΣΤΑ, ΚΑΙ ΓΙΑΤΙ ΗΤΑΝ ΣΦΑΛΜΑ (ADR-840 §3, μετρημένο 2026-09-01)
 *
 * Ο χώρος εργασίας είχε **δύο πόρτες στο ίδιο δωμάτιο**: το `/properties` (χωρίς
 * κουμπιά) και το `/spaces/properties` (με κουμπιά, κάδο, επεξεργάσιμη κάτοψη).
 * **Ίδια δεδομένα, ίδιος provider.** Η διαφορά ήταν **σταθερά**:
 *
 *     hooks/usePublicPropertyViewer.ts:326        isReadOnly: true,
 *
 * Δηλαδή το αν μπορείς να επεξεργαστείς **δεν εξαρτιόταν από το ποιος είσαι**,
 * αλλά από **ποιο κουμπί του μενού πάτησες** — και ο άνθρωπος δεν είχε τρόπο να
 * το ξέρει. Η ασφάλεια δεν χανόταν (φύλακας είναι ο διακομιστής)· χανόταν η
 * **προβλεψιμότητα**.
 *
 * ⚠️ Και η σταθερά **δεν ήταν μία**: ζούσε σε **πέντε** σημεία (η τιμή του hook,
 * **δύο** literal `true` στους τύπους του `publicViewer.ts`, το ξαναγράψιμό της
 * στο `buildViewerProps`, και ένα γυμνό `isReadOnly` στο `ListLayout`) — ακριβώς
 * το *«σωστό στην πρώτη σελίδα, ξεχασμένο στη δεύτερη»* που προειδοποιεί το
 * ADR-840 §6. Γι' αυτό η απάντηση **ρωτιέται**· δεν **περνιέται χέρι-χέρι**.
 * ─────────────────────────────────────────────────────────────────────────────
 * ⛔ ΔΕΝ ΕΙΝΑΙ ΚΡΙΤΗΣ. ΕΙΝΑΙ **ΟΝΟΜΑ ΕΡΩΤΗΣΗΣ** (ADR-801 §4 · CHECK 3.68)
 *
 * Ο κριτής (**PDP**) είναι **ένας**: το `lib/auth/authority.ts`. Το σημείο
 * επιβολής (**PEP**) του πελάτη είναι **ένα**: το `auth/hooks/useCapability`.
 * Αυτό εδώ **δεν αποφασίζει τίποτα** — δίνει όνομα στην ερώτηση και μεταφράζει
 * την ετυμηγορία στο λεξιλόγιο της οθόνης (`isReadOnly`). Ίδιο μοτίβο με το
 * `useCanEditText` του DXF viewer (ADR-801 Φάση 3).
 *
 * 🔴 **ΜΗΝ γράψεις εδώ σύγκριση ρόλων, λίστα permissions, ή δεύτερη μηχανή
 *    απόφασης.** Το CHECK 3.68 (*«πύλη της αρχής της εξουσιοδότησης»*) το
 *    μπλοκάρει, και σωστά: δύο κριτές = δύο απαντήσεις στο ίδιο *«επιτρέπεται;»*.
 *    Η **πρώτη** γραφή αυτού του αρχείου έκανε ακριβώς αυτό — έφτιαξε τριμερή
 *    μηχανή `granted/unknown/none` δίπλα στον PDP — και ήταν λάθος: το ερώτημα
 *    είχε **ήδη** κριτή, απλώς το handoff έδειχνε αλλού.
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔑 ΓΙΑΤΙ Ο ΥΠΑΡΧΩΝ ΚΡΙΤΗΣ ΕΙΝΑΙ **ΗΔΗ** Η ΣΩΣΤΗ ΑΠΑΝΤΗΣΗ (ADR-840 §8.2)
 *
 * Ο φόβος του Σ2 ήταν ότι ο **ρόλος έργου** (`project_manager`, που έχει
 * `properties:properties:update` στον κατάλογο) **δεν φτάνει στον browser**, άρα
 * μια οθόνη οδηγούμενη από claims θα του έκοβε κουμπιά που δικαιούται.
 * **Μετρήθηκε ότι δεν ισχύει**, ακολουθώντας τη διαδρομή γραφής:
 *
 *     PropertyDetailsContent → useGuardedPropertyMutation → updatePropertyWithPolicy
 *       → properties.service.updateProperty      (services/properties.service.ts:105)
 *       → apiClient.patch('/api/properties/[id]')
 *       → entityIdRoute({ permissions: 'properties:properties:update' })  ← ΚΑΜΙΑ projectId
 *       → runGuarded → withAuth(..., { permissions }) → checkPermission(ctx, p, {})
 *
 * και το `checkPermission` φυλάει τον ρόλο έργου πίσω από `if (options.projectId)`
 * (`lib/auth/permissions.ts`, **Έλεγχος 2**). ⇒ Ο ρόλος έργου **δεν ρωτιέται
 * ποτέ** σε καμία διαδρομή ακινήτου. Οι πηγές που όντως κρίνουν είναι bypass ·
 * ρητό claim · καθολικός ρόλος — δηλαδή **ακριβώς** τα βήματα (4)·(5)·(6) του
 * `decideCapability` του PDP. Η οθόνη και ο διακομιστής απαντούν το ίδιο.
 *
 * ⚠️ **ΑΝ Η ΔΙΑΔΡΟΜΗ ΓΙΝΕΙ ΚΑΠΟΤΕ PROJECT-SCOPED, ΑΥΤΟ ΠΑΥΕΙ ΝΑ ΙΣΧΥΕΙ** — και
 * δεν αφήνεται στη μνήμη κανενός: το φυλάει **άγκυρα που εκτελείται**
 * (`__tests__/property-edit-capability.test.ts`, ομάδα «ο φύλακας δεν ρωτά
 * έργο»), που διαβάζει το ίδιο το route και **κοκκινίζει**.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-840-one-properties-screen.md §8.1/§8.2
 * @see src/auth/hooks/useCapability.ts — ο ΕΝΑΣ PEP του πελάτη
 * @see src/lib/auth/authority.ts — ο ΕΝΑΣ κριτής (PDP)
 */

import { useMemo } from 'react';

import { useCapability } from '@/auth/hooks/useCapability';
import { isGranted, type CapabilityVerdict } from '@/types/capability-authority';
import type { PermissionId } from '@/lib/auth/types';

/**
 * Τι αρκεί για να **δείξουμε** επεξεργασία ακινήτου. Ονομάζεται μία φορά: τρεις
 * καταναλωτές που το γράφουν ο καθένας μόνος του είναι τρεις ευκαιρίες να
 * αποκλίνουν (N.0.2).
 *
 * ⚠️ Η **δημιουργία** και η **διαγραφή** έχουν δικά τους permissions
 * (`:create` / `:delete`) και **δεν** συμπεριλαμβάνονται. Σήμερα ο κατάλογος τα
 * δίνει στους ίδιους ρόλους, αλλά αυτό είναι **σύμπτωση δεδομένων**, όχι
 * κανόνας — και ο κάδος του `/spaces/properties` είναι δηλωμένα δικό του
 * ερώτημα (ADR-840 §7, Σ3).
 */
export const PROPERTY_EDIT_PERMISSION: PermissionId = 'properties:properties:update';

export interface PropertyEditCapability {
  /**
   * *«Να δείξω την επεξεργασία;»* — **όχι** *«επιτρέπεται;»*. Το δεύτερο το
   * απαντά ο διακομιστής, πάντα, ξανά (OWASP: ο πελάτης ποτέ αποφασίζων).
   */
  readonly canEdit: boolean;
  /** Η ετυμηγορία του PDP, ώστε η οθόνη να μπορεί να **πει τον λόγο** (Σ3). */
  readonly verdict: CapabilityVerdict;
  /**
   * Η ταυτότητα δεν έχει φορτώσει ακόμη ⇒ η άρνηση **δεν είναι τελική**.
   *
   * 🔑 Χωρίς αυτό, η οθόνη θα έλεγε *«δεν δικαιούσαι»* σε άρνηση **που δεν
   * κρίθηκε ποτέ** — και το `AuthContext.loading` ξεκινά `true` σε **κάθε**
   * συνεδρία, άρα ο πληθυσμός είναι **όλοι**.
   */
  readonly pending: boolean;
}

export function usePropertyEditCapability(): PropertyEditCapability {
  const gate = useCapability(PROPERTY_EDIT_PERMISSION);

  return useMemo(
    () => ({
      // fail-closed όσο εκκρεμεί: το `pending` δίνει `denied-unauthenticated`,
      // άρα η κατεύθυνση είναι «κλειστό → ανοιχτό» και ποτέ το αντίστροφο —
      // κουμπί που εμφανίζεται και μετά εξαφανίζεται είναι χειρότερο από κουμπί
      // που αργεί.
      canEdit: isGranted(gate.verdict),
      verdict: gate.verdict,
      pending: gate.pending,
    }),
    [gate],
  );
}
