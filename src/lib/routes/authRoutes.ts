/**
 * =============================================================================
 * AUTH ROUTES - CENTRALIZED AUTHENTICATION ROUTE DEFINITIONS
 * =============================================================================
 *
 * Enterprise Pattern: Single source of truth for authentication routes
 * Prevents hardcoded '/login' strings scattered across the codebase
 *
 * @module lib/routes/authRoutes
 * @enterprise ADR-022 - Centralized Route Management
 */

/**
 * Authentication route paths - immutable route definitions
 * Use these constants instead of hardcoded strings
 *
 * @example
 * import { AUTH_ROUTES } from '@/lib/routes';
 * router.push(AUTH_ROUTES.login);
 *
 * @example
 * <Link href={AUTH_ROUTES.login}>Login</Link>
 */
export const AUTH_ROUTES = {
  /** Login page - main authentication entry point */
  login: '/login',
  /**
   * **Η αρχική του ΣΥΝΔΕΔΕΜΕΝΟΥ** — ο χώρος εργασίας, όχι το `/`.
   *
   * 🔴 **Άλλαξε 2026-08-11 (ADR-777 §8.13).** Το `/` σέρβιρε το ταμπλό και έκανε
   * `router.replace('/login')` σε κάθε ανώνυμο ⇒ ο επισκέπτης του
   * **nestorconstruct.gr προσγειωνόταν σε φόρμα σύνδεσης**. Δεν έλειπε αρχική —
   * υπήρχε **κλειδαριά**. Πλέον το `/` είναι η **δημόσια** οθόνη αναζήτησης και ο
   * χώρος εργασίας ζει εδώ.
   *
   * 🔑 **Μία γραμμή, γιατί το SSoT υπήρχε ήδη.** Κάθε «γύρνα στην αρχική» που
   * περνούσε από εδώ μετακόμισε **χωρίς να το αγγίξει κανείς**· τα **τέσσερα** ωμά
   * `'/'` που το παρέκαμπταν (onboarding · pending-approval · auth/action ·
   * breadcrumb) διορθώθηκαν την ίδια στιγμή — αλλιώς θα ήταν **τέσσερις σιωπηλές
   * ανακατευθύνσεις στη δημόσια σελίδα** για συνδεδεμένο χρήστη.
   */
  home: '/dashboard',
  /**
   * **Η οθόνη «ζήτησες να μπεις σε γραφείο»** — ΟΧΙ «δεν υπάρχεις».
   *
   * 🔴 **Ονομάστηκε 2026-08-23 (ADR-660).** Ήταν **ωμή συμβολοσειρά** στο
   * `dashboard/page.tsx` — το **μοναδικό** σημείο πλοήγησης προς εδώ, και εκτός
   * SSoT. Μια διεύθυνση χωρίς όνομα δεν μπορεί να φυλαχθεί: ο φρουρός που ρωτά
   * *«ποιος στέλνει άνθρωπο σε ουρά ανθρώπινης έγκρισης;»* χρειάζεται **σταθερά**
   * για να κρίνει πλοήγηση αντί για κείμενο — αλλιώς μετράει και τις **10**
   * εμφανίσεις του άσχετου `pendingApprovalPoCount` του procurement.
   *
   * ⚠️ **Δεν είναι η προσγείωση κανενός.** Ποιος καταλήγει εδώ το αποφασίζει
   * **αποκλειστικά** ο {@link resolvePostLoginRoute} (`lib/routes/landing.ts`).
   */
  pendingApproval: '/pending-approval',
} as const;

/** Type for auth route keys */
export type AuthRouteKey = keyof typeof AUTH_ROUTES;

/** Type for auth route values */
export type AuthRoute = (typeof AUTH_ROUTES)[AuthRouteKey];
