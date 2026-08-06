'use client';

/**
 * ADR-750 Φ6β — **η μία ερώτηση** που κρίνει σε ποιον ανήκει το `Escape`.
 *
 * ── ΓΙΑΤΙ ΥΠΑΡΧΕΙ ΩΣ SSoT ──
 *
 * Κάθε modeless παλέτα που δηλώνει χειριστή `Escape` πρέπει να απαντήσει «βρίσκεται η εστίαση
 * **μέσα** μου;» — και πρέπει να απαντήσει *σωστά*, γιατί ένα `true` εκτός τόπου καταναλώνει το
 * `Escape` ολόκληρης της εφαρμογής και σκοτώνει το «ακύρωση εντολής / αποεπιλογή» του καμβά
 * (ADR-364 · ADR-723). Η υλοποίηση είναι τέσσερις γραμμές, άρα ο πειρασμός να γραφτεί ξανά σε
 * κάθε παλέτα είναι μέγιστος — και ακριβώς εκεί γεννιούνται οι σιωπηλές αποκλίσεις (ξεχασμένο
 * SSR guard, `===` αντί για `contains`, έλεγχος `document.body` που είναι πάντα `true`).
 *
 * Ζει δίπλα στο `FloatingPanel` και όχι στον `escape-bus`: η ερώτηση αφορά **τοπολογία panel**,
 * και το `id` της ρίζας το δίνει το ίδιο το `FloatingPanel` (prop `id`).
 *
 * @module components/ui/floating/floating-panel-focus
 */

/**
 * `true` όταν το `document.activeElement` βρίσκεται μέσα στο panel με το δοσμένο DOM `id`.
 *
 * SSR-safe (`false` χωρίς `document`). Επιστρέφει `false` και όταν το panel δεν υπάρχει στο DOM —
 * δηλαδή «δεν είναι δικό μου» — ποτέ `true` από παράλειψη.
 *
 * ⚠️ Το `id` πρέπει να είναι **όνομα παραγωγής**, όχι `data-testid`: απαντά σε ερώτηση
 * συμπεριφοράς, και τα testids είναι για tests.
 */
export function isFocusInsidePanel(panelDomId: string): boolean {
  if (typeof document === 'undefined') return false;
  const root = document.getElementById(panelDomId);
  const active = document.activeElement;
  if (!root || !active) return false;
  return root.contains(active);
}
