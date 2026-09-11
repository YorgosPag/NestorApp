/**
 * @fileoverview **ΟΙ ΕΝΕΡΓΕΙΕΣ ΤΩΝ ΣΥΝΔΕΣΜΩΝ EMAIL** — κλειστό σύνολο, ένας φρουρός, πλήρεις πίνακες.
 * @related auth/components/AuthActionContent.tsx (η οθόνη) · useAuthActionCode.ts (η λογική)
 * @module auth/components/auth-action-modes
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ — ΤΟ `as ActionMode` ΕΛΕΓΕ ΨΕΜΑΤΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η σελίδα διάβαζε `searchParams.get('mode') as ActionMode | null`: ό,τι έφτανε στη
 * διεύθυνση **ονομαζόταν** ενέργεια χωρίς να ελεγχθεί. Και η Firebase στέλνει **τέσσερα**
 * modes, όχι τρία — το `verifyAndChangeEmail` (αλλαγή email με επιβεβαίωση) **λείπει από
 * την ίδια την τεκμηρίωσή της** για custom handlers (`firebase-js-sdk#6139`).
 *
 * ⇒ **Ο πίνακας είναι η αυθεντία, ο τύπος παράγεται** (ίδιο μοτίβο με `USER_STATUSES`),
 * και κάθε κείμενο είναι **πλήρες `Record`**: πέμπτο mode **δεν μεταγλωττίζεται** χωρίς
 * τίτλο και μήνυμα επιτυχίας. Αντικατέστησε και ένα φωλιασμένο ternary τριών επιπέδων.
 *
 * **Layering**: leaf — καθαρά δεδομένα, κανένα React, καμία Firebase.
 */

/** Τα modes που στέλνει η Firebase στον χειριστή ενεργειών email. */
export const AUTH_ACTION_MODES = [
  'verifyEmail',
  'resetPassword',
  'recoverEmail',
  'verifyAndChangeEmail',
] as const;

export type AuthActionMode = (typeof AUTH_ACTION_MODES)[number];

/** **Ο φρουρός** — άγνωστο mode ⇒ `null`, ποτέ cast. */
export function parseAuthActionMode(raw: string | null): AuthActionMode | null {
  return AUTH_ACTION_MODES.find((mode) => mode === raw) ?? null;
}

/** Ο τίτλος της κάρτας ανά ενέργεια. */
export const ACTION_TITLE_KEYS: Readonly<Record<AuthActionMode, string>> = {
  verifyEmail: 'action.titles.verifyEmail',
  resetPassword: 'action.titles.resetPassword',
  recoverEmail: 'action.titles.recoverEmail',
  verifyAndChangeEmail: 'action.titles.verifyAndChangeEmail',
};

/**
 * Τι λέει η οθόνη όταν **πέτυχε**.
 *
 * ⚠️ Τα `emailRecovered` / `emailChanged` παίρνουν `{email}` — η οθόνη **ονομάζει** τη
 * διεύθυνση που ισχύει πλέον. Ένα γενικό «ανακτήθηκε» δεν λέει στον άνθρωπο **ποια**.
 */
export const ACTION_SUCCESS_KEYS: Readonly<Record<AuthActionMode, string>> = {
  verifyEmail: 'action.messages.emailVerified',
  resetPassword: 'action.messages.passwordChanged',
  recoverEmail: 'action.messages.emailRecovered',
  verifyAndChangeEmail: 'action.messages.emailChanged',
};

/** Τι λέει όσο **περιμένει** τη Firebase. */
export const ACTION_PENDING_KEYS: Readonly<Record<AuthActionMode, string>> = {
  verifyEmail: 'action.descriptions.verifying',
  resetPassword: 'action.descriptions.processing',
  recoverEmail: 'action.descriptions.processing',
  verifyAndChangeEmail: 'action.descriptions.changingEmail',
};
