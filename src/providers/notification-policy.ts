/**
 * @fileoverview **Πόσο ζει ένα toast και με ποιο θέμα** — οι δύο αποφάσεις του `NotificationProvider`, καθαρές.
 * @related ADR-866 §2.10 (Β2 · Β3) · `providers/NotificationProvider.tsx`
 * @module providers/notification-policy
 *
 * 🔴 **Β2 (ζωντανή επαλήθευση 2026-09-19)**: το toast «Ο φάκελος αρχειοθετήθηκε · **Αναίρεση**» ζούσε 4″ — η ίδια
 * προεπιλογή με ένα απλό «αποθηκεύτηκε». Material Design 3: *snackbar με ενέργεια μένει μέχρι ο χρήστης να ενεργήσει
 * ή να το κλείσει*· Angular Material: *μη δίνετε διάρκεια σε snackbar με ενέργεια* — ο χρήστης αναγνώστη οθόνης
 * πρέπει να προλάβει να φτάσει σε αυτό (WCAG 2.2.1). Εδώ: ενέργεια ⇒ **μένει**, εκτός αν ο καλών ζητήσει ρητά διάρκεια.
 *
 * 🔴 **Β3**: το `<Toaster>` δεν έπαιρνε `theme` ⇒ το sonner αποδίδει **φωτεινό** toast (μετρήθηκε `rgb(255,255,255)`)
 * μέσα στο σκοτεινό θέμα της εφαρμογής. Το θέμα έρχεται από το `next-themes`, την **ίδια** πηγή με όλη την εφαρμογή.
 */

/** Η τιμή του sonner για «μένει μέχρι να κλείσει». */
export const PERSISTENT_TOAST = Number.POSITIVE_INFINITY;

/**
 * **Πόσο ζει ένα toast** (ms, ή `PERSISTENT_TOAST`).
 * · ρητό `0` ⇒ μόνιμο (ιστορικό συμβόλαιο του provider)
 * · ρητή διάρκεια ⇒ αυτή — ο καλών έχει τον τελευταίο λόγο
 * · χωρίς διάρκεια **και με ενέργεια** ⇒ μόνιμο (Material 3)
 * · αλλιώς ⇒ η προεπιλογή του provider
 */
export function resolveToastDuration(
  requested: number | undefined,
  hasAction: boolean,
  defaultDuration: number,
): number {
  if (requested === 0) return PERSISTENT_TOAST;
  if (requested !== undefined) return requested;
  return hasAction ? PERSISTENT_TOAST : defaultDuration;
}

/** Το θέμα του sonner από το επιλυμένο θέμα της εφαρμογής· άγνωστο (πριν τη hydration) ⇒ `system`. */
export function toasterThemeOf(resolvedTheme: string | undefined): 'light' | 'dark' | 'system' {
  if (resolvedTheme === 'dark' || resolvedTheme === 'light') return resolvedTheme;
  return 'system';
}
