/**
 * @fileoverview **ΤΟ ΧΡΩΜΑ ΤΗΣ ΒΑΘΜΙΔΑΣ ΠΛΗΡΟΤΗΤΑΣ** — μία απάντηση, δύο οθόνες.
 * @related ADR-287 (η μηχανή) · ADR-842 §7 (Φ5) · constants/property-completion
 * @module components/completion/completion-bucket-classes
 *
 * 🔑 **ΕΞΑΓΩΓΗ, ΟΧΙ ΑΝΤΙΓΡΑΦΗ (N.0.2).** Οι δύο επιλυτές ζούσαν **ιδιωτικοί** μέσα στο
 * `PropertyCompletionMeter.tsx`. Η Φ5 έφερε **δεύτερη** οθόνη που ρωτά το ίδιο πράγμα
 * (*«τι χρώμα έχει αυτή η βαθμίδα;»*) — και η προφανής κίνηση, να αντιγραφούν οκτώ
 * γραμμές, θα ήταν **δίδυμος κλώνος μέσα στο ίδιο commit**: ακριβώς ό,τι το
 * `jscpd:diff` (N.18) υπάρχει για να πιάσει, και ακριβώς το περιστατικό που γέννησε
 * τον κανόνα N.0.2 *(το `if (options.grips)` αντιγραμμένο σε 7 renderers)*.
 *
 * ⚠️ **Καμία αλλαγή συμπεριφοράς**: οι κλάσεις είναι **ταυτόσημες** με αυτές που
 * έγραφε το `PropertyCompletionMeter` — μετακόμισαν, δεν ξαναγράφτηκαν.
 *
 * ⛔ **ΟΧΙ inline styles (N.3)**: μόνο κλάσεις πάνω σε **σημασιολογικά** tokens του
 * design system (`--status-success/warning/error`), ποτέ ωμό χρώμα.
 */

import type { CompletionBucket } from '@/constants/property-completion';

/**
 * Η βαθμίδα → κλάση **κειμένου**, από τα σημασιολογικά χρώματα του adapter.
 *
 * @param colors — το αποτέλεσμα του `useSemanticColors()`. Περνιέται από τον καλούντα
 *   ώστε αυτό το module να μένει **καθαρό** (κανένα hook), δηλαδή δοκιμάσιμο χωρίς React.
 */
export function completionBucketTextClass(
  bucket: CompletionBucket,
  colors: { readonly text: { readonly success: string; readonly warning: string; readonly error: string } },
): string {
  switch (bucket) {
    case 'green':
      return colors.text.success;
    case 'amber':
      return colors.text.warning;
    case 'red':
    default:
      return colors.text.error;
  }
}

/**
 * Η βαθμίδα → κλάση **γεμίσματος** της μπάρας.
 *
 * Περνιέται στο `indicatorClassName` του `<Progress>` (επέκταση shadcn). Ο διάδρομος
 * παίρνει επιπλέον `bg-transparent`, ώστε να μη φαίνεται το προεπιλεγμένο `bg-primary`
 * κάτω από το χρωματισμένο γέμισμα — χωρίς μάχη ειδικότητας με child selectors.
 */
export function completionBucketIndicatorClass(bucket: CompletionBucket): string {
  switch (bucket) {
    case 'green':
      return 'bg-[hsl(var(--status-success))]';
    case 'amber':
      return 'bg-[hsl(var(--status-warning))]';
    case 'red':
    default:
      return 'bg-[hsl(var(--status-error))]';
  }
}
