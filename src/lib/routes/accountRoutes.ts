/**
 * =============================================================================
 * ACCOUNT ROUTES - CENTRALIZED ROUTE DEFINITIONS
 * =============================================================================
 *
 * Enterprise Pattern: Single source of truth for account-related routes
 * Routes ONLY - no navigation config (that belongs in the layout)
 *
 * @module lib/routes/accountRoutes
 * @enterprise ADR-024 - Account Hub Centralization
 */

/**
 * Account route paths - immutable route definitions
 * Use these constants instead of hardcoded strings
 *
 * @example
 * import { ACCOUNT_ROUTES } from '@/lib/routes';
 * router.push(ACCOUNT_ROUTES.profile);
 */
export const ACCOUNT_ROUTES = {
  /** Root account page (redirects to profile) */
  root: '/account',
  /** Personal information management */
  profile: '/account/profile',
  /** UI preferences (language, theme) */
  preferences: '/account/preferences',
  /** Notification settings */
  notifications: '/account/notifications',
  /** Security settings (password, 2FA) */
  security: '/account/security',
  /** Privacy controls */
  privacy: '/account/privacy',
} as const;

/**
 * **Η ΣΕΛΙΔΑ ΠΡΟΦΙΛ ΤΟΥ ΙΔΙΩΤΗ** — route group `(me)`, **εκτός** προθέματος χώρου.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΞΕΧΩΡΙΣΤΗ ΣΤΑΘΕΡΑ ΚΑΙ ΟΧΙ ΓΡΑΜΜΗ ΜΕΣΑ ΣΤΟ `ACCOUNT_ROUTES`
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Κάθε τιμή του {@link ACCOUNT_ROUTES} είναι **`InWorkspacePath`** — ουρά κάτω από το
 * `/o/<ψευδώνυμο>`, που ο `Link` του συνόρου προθεματοποιεί. Αυτή **δεν** είναι: ο
 * ιδιώτης **δεν έχει χώρο** (`personal-scope-middleware.ts` → `actorWorkspace()`
 * επιστρέφει `null`), άρα δεν υπάρχει ψευδώνυμο να μπει. Μια γραμμή μέσα στο ίδιο
 * αντικείμενο θα έλεγε ότι οι δύο είναι **ομοειδείς**, και θα προθεματοποιούνταν μαζί.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ `/profile` ΚΑΙ ΟΧΙ `/account/profile` — ΜΕΤΡΗΜΕΝΟ, ΟΧΙ ΓΟΥΣΤΟ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο κριτής `isInsideWorkspace` κρίνει από το **ΠΡΩΤΟ ΤΜΗΜΑ** της διαδρομής
 * (`OUTSIDE_WORKSPACE` είναι `Record<τμήμα, γιατί>`). Το `account` **δεν** δηλώνεται
 * εκεί ⇒ προεπιλογή «μπαίνει σε χώρο», που είναι **σωστό** για τις πέντε οθόνες του
 * γραφείου. Μια σελίδα του ιδιώτη στο `/account/*` θα απαιτούσε να δηλωθεί το `account`
 * **εκτός** — και θα **αφαιρούσε το πρόθεμα και από τις πέντε**, σπάζοντας τον κόμβο
 * λογαριασμού του οργανισμού. **Ένα τμήμα, μία απάντηση.**
 *
 * ⛔ **ΚΑΙ ΟΧΙ `/o/me/account/profile`**, παρότι το `PERSONAL_WORKSPACE_ALIAS` υπάρχει
 * και το `o/[workspace]/layout.tsx` δέχεται προσωπικό χώρο με `companyId: ''`: θα
 * έβαζε τον ιδιώτη μέσα στο `(app)` — 10 βαρείς providers + πλαϊνή μπάρα έργων,
 * λογιστικής και DXF, με μετρημένο κόστος **−41% έως −59%** SSR bytes
 * (`.shell-boundary.json`). Το `workspace-home.ts` καταγράφει ήδη το `/o/me/*` ως
 * *«διεύθυνση χωρίς σελίδα»*.
 *
 * ⚠️ **Νέο τμήμα ⇒ ΥΠΟΧΡΕΩΤΙΚΗ δήλωση** στο `OUTSIDE_WORKSPACE`
 * (`lib/workspace/workspace-scope.ts`, **CHECK 3.60**). Χωρίς αυτήν ο κριτής το κρίνει
 * «εντός» και κάθε σύνδεσμος από **μέσα** σε χώρο θα παρήγαγε `/o/<ψευδώνυμο>/profile`
 * — διεύθυνση **χωρίς σελίδα**. Ταυτόσημο σχήμα με τα περιστατικά `/unauthorized`,
 * `/workspace/new` και `/home`.
 */
export const PRIVATE_PROFILE_ROUTE = '/profile' as const;

/** Type for account route keys */
export type AccountRouteKey = keyof typeof ACCOUNT_ROUTES;

/** Type for account route values */
export type AccountRoute = (typeof ACCOUNT_ROUTES)[AccountRouteKey];
