/**
 * @fileoverview **«ΠΟΥ ΠΑΕΙ Ο ΑΝΘΡΩΠΟΣ ΟΤΑΝ ΤΕΛΕΙΩΝΕΙ Η ΣΥΝΔΕΣΗ ΤΟΥ;»** — ο ΕΝΑΣ πίνακας (ADR-908 §3.1).
 * @related auth/identity-change/end-sign-in (ο κάτοχος που τον εκτελεί) · lib/routes/return-path (`?next=`)
 * @module auth/identity-change/end-sign-in-destinations
 *
 * 🔴 **ΓΙΑΤΙ ΠΙΝΑΚΑΣ ΚΑΙ ΟΧΙ ΑΠΟΦΑΣΗ ΤΟΥ ΚΑΛΟΥΝΤΟΣ**: οκτώ σημεία αποσύνδεαν, το καθένα με δική του πλοήγηση ή
 * καμία. Το μενού πλοηγούσε **πριν** τελειώσει η αποσύνδεση· η ανάκληση δεν πλοηγούσε καθόλου και άφηνε τους
 * φρουρούς να αποφασίσουν. Ο λόγος είναι το **μόνο** που ξέρει ο καλών· ο προορισμός είναι συνέπειά του.
 *
 * 🔑 **Πότε κρατιέται το `?next=`**: μόνο όταν επιστρέφει **ο ίδιος άνθρωπος** (ανάκληση) ή όταν ο άνθρωπος
 * **ζήτησε** αυτό το αντικείμενο (πρόσκληση). Η ρητή αποσύνδεση δεν το κρατά **ποτέ**: ο επόμενος που θα
 * συνδεθεί εδώ μπορεί να είναι άλλος, και η διεύθυνση ανήκε σε εκείνον που έφυγε.
 */

import { AUTH_ROUTES } from '@/lib/routes/authRoutes';
import { loginHrefForCurrentLocation } from '@/lib/routes/return-path';

/** Γιατί τελειώνει η σύνδεση — κλειστό σύνολο· κάθε καλών δηλώνει **ένα**. */
export type EndSignInRequest =
  /** Ο άνθρωπος πάτησε «Αποσύνδεση». */
  | { readonly reason: 'user-request' }
  /** Αποχώρησε από τον οικείο του χώρο και η συσκευή δεν πήρε νέο κλειδί (ADR-892 §13). */
  | { readonly reason: 'left-workspace' }
  /** Η σύνδεση ανακλήθηκε — από άλλη συσκευή, ή από τον ίδιο για **όλες** (ADR-894). */
  | { readonly reason: 'revoked' }
  /** «Αλλαγή λογαριασμού»: το `href` έρχεται **έτοιμο από τον διακομιστή** (`loginHref`, ADR-853 §13). */
  | { readonly reason: 'switch-account'; readonly href: string }
  /** Το email του λογαριασμού άλλαξε· η σελίδα της πράξης δείχνει το αποτέλεσμα. */
  | { readonly reason: 'credential-changed' };

export type EndSignInReason = EndSignInRequest['reason'];

export type EndSignInDestination =
  /** Το έγγραφο **τελειώνει**: πλήρης πλοήγηση, χωρίς να μείνει στο ιστορικό. */
  | { readonly kind: 'navigate'; readonly href: string }
  /**
   * Το έγγραφο **μένει**. ⚠️ Δηλωμένη εξαίρεση, μία: το `/auth/action` είναι δημόσιο και δείχνει το αποτέλεσμα
   * της αλλαγής email· νέα φόρτωση θα ξανάπαιζε **καταναλωμένο** κωδικό και θα έδειχνε σφάλμα για πράξη που πέτυχε.
   */
  | { readonly kind: 'stay' };

/**
 * Ο προορισμός για αυτόν τον λόγο.
 *
 * ⚠️ Καλείται **στην αρχή** της πράξης: το `revoked` διαβάζει το `location` της στιγμής, πριν αλλάξει οτιδήποτε.
 */
export function destinationAfterSignIn(request: EndSignInRequest): EndSignInDestination {
  switch (request.reason) {
    case 'user-request':
    case 'left-workspace':
      return { kind: 'navigate', href: AUTH_ROUTES.login };
    case 'revoked':
      return { kind: 'navigate', href: loginHrefForCurrentLocation() };
    case 'switch-account':
      return { kind: 'navigate', href: request.href };
    case 'credential-changed':
      return { kind: 'stay' };
  }
}
