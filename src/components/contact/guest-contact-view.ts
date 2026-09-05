/**
 * @fileoverview **ΤΟ ΣΥΝΟΡΟ ΔΙΑΚΟΜΙΣΤΗ→ΟΘΟΝΗΣ ΤΗΣ ΣΕΛΙΔΑΣ ΤΟΥ ΣΥΝΔΕΣΜΟΥ** — τι ζωγραφίζεται.
 * @related app/(auth)/contact/[token]/page.tsx · components/contact/GuestContactContent.tsx
 * @module components/contact/guest-contact-view
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΞΕΧΩΡΙΣΤΟ ΑΡΧΕΙΟ ΑΠΟ ΤΑ ΔΥΟ ΠΟΥ ΤΟ ΧΡΗΣΙΜΟΠΟΙΟΥΝ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η σελίδα είναι **Server Component**, η οθόνη είναι **Client Component**. Ένας τύπος
 * που ζει στο ένα από τα δύο θα ανάγκαζε το άλλο να **εισάγει από αυτό** — δηλαδή θα
 * τραβούσε είτε `server-only` κώδικα σε πελατικό γράφο *(σφάλμα χτισίματος)*, είτε
 * `'use client'` μέσα στη σελίδα *(κάνοντας πελατικό ό,τι δεν χρειάζεται)*.
 *
 * **Layering**: leaf — καθαροί τύποι πάνω σε **υπάρχοντα** λεξιλόγια. Καμία εξάρτηση
 * από Firestore, React ή ρολόι.
 *
 * ⛔ **ΚΑΝΕΝΑ ΝΕΟ ΛΕΞΙΛΟΓΙΟ ΕΔΩ.** Και οι τρεις κωδικοί έρχονται από τις κλειστές ενώσεις
 * που **ήδη** κρίνουν στον διακομιστή. Ένα τέταρτο, «οθόνης», θα ήταν δεύτερη απάντηση
 * στο *«τι πήγε στραβά;»* — και θα απέκλινε στην πρώτη προσθήκη.
 */

import type { FirstContactRejection } from '@/services/contact/first-contact-vocabulary';
import type { FirstContactInvariant } from '@/types/first-contact';
import type { FirstContactInvitationRefusal } from '@/types/first-contact-invitation';

/**
 * **Ό,τι ΑΚΡΙΒΩΣ ζωγραφίζεται** — και τίποτα άλλο δεν φεύγει από τον διακομιστή.
 *
 * 🔴 **ΤΟ `contact` ΕΙΝΑΙ ΡΗΤΑ ΑΠΟΝ.** Η υπηρεσία επιστρέφει ολόκληρο το
 * `FirstContactForSeeker` — **όνομα, email, τηλέφωνο, στόχο**. Τίποτα από αυτά δεν
 * ζωγραφίζεται εδώ *(ο άνθρωπος τα μόλις έγραψε ο ίδιος)*, και ό,τι περνά σε client
 * component **γράφεται μέσα στο HTML**. Η οθόνη χρειάζεται **ένα** πράγμα: `created`.
 */
export type GuestContactLinkView =
  | {
      readonly kind: 'done';
      /** `false` = *«το είχες ήδη κάνει»* — **επιτυχία**, όχι προειδοποίηση. */
      readonly created: boolean;
      /**
       * ⚠️ **Διαπιστευτήριο μέσα σε HTML, και είναι ζυγισμένο.** Ζει **μία ώρα**
       * (όριο Firebase), εξαργυρώνεται **μία φορά**, και ταξιδεύει στην **ίδια**
       * απάντηση με τον σύνδεσμο που το γέννησε — σε σελίδα `noindex`, `force-dynamic`,
       * που **κανένα** ενδιάμεσο δεν επιτρέπεται να αποθηκεύσει.
       *
       * ⇒ Ο κάτοχος αυτού του HTML **είναι ήδη** ο κάτοχος του συνδέσμου. Δεν του
       * δίνουμε τίποτα που δεν είχε ήδη.
       */
      readonly customToken: string;
    }
  | { readonly kind: 'link-refused'; readonly reason: FirstContactInvitationRefusal }
  | { readonly kind: 'contact-refused'; readonly reason: FirstContactRejection }
  | { readonly kind: 'invalid'; readonly violations: readonly FirstContactInvariant[] }
  /** ⚠️ **Χωρίς λόγο, επίτηδες** — οι λόγοι μιλούν για εμάς (απαρίθμηση λογαριασμών). */
  | { readonly kind: 'identity-refused' }
  | { readonly kind: 'unavailable' };
