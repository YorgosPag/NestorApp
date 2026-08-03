/**
 * ADR-739 Φ.Ε/Φ4β — **ποια λόγια χρησιμοποιεί κάθε ρόλος** στο μενού χρώματος.
 *
 * Ένα component, δύο ρόλοι (μελάνι / γέμισμα). Ό,τι είναι **κοινό** (αποχρώσεις, ετικέτες
 * ζωνών, ονόματα δειγμάτων) ζει στο `table.colorMenu.*` και δηλώνεται **μία** φορά· εδώ ζει
 * μόνο ό,τι **διαφέρει**.
 *
 * ## 🔴 Γιατί ρητός χάρτης και ΟΧΙ `t(\`table.${role}Color.trigger\`)`
 * Ένα δυναμικό κλειδί είναι αόρατο σε **κάθε** στατικό εργαλείο του έργου (CHECK 3.8 «λείπον
 * κλειδί», 3.33 φρεσκάδα τύπων, 3.34 shell slice) — δηλαδή μια ορθογραφία που λείπει από τα
 * locales θα εμφανιζόταν ως **ωμό κλειδί στην οθόνη** με όλες τις πύλες πράσινες. Ο ρητός
 * χάρτης ελέγχεται εξαντλητικά και από τον μεταγλωττιστή: νέος ρόλος χωρίς κλειδιά δεν
 * μεταγλωττίζεται. Ίδιο μοτίβο με τον `HUE_LABEL_KEY` του πλέγματος.
 *
 * ## Γιατί χωριστό αρχείο και όχι μέσα στο component
 * Είναι **αντιστοίχιση**, όχι παρουσίαση — και η {@link automaticHintKey} είναι η μοναδική
 * απόφαση εδώ που μπορεί να είναι **λάθος** (δες την τεκμηρίωσή της), άρα αξίζει να είναι
 * καθαρή και δοκιμάσιμη χωρίς DOM. Το component ήταν επίσης στις 501 γραμμές (N.7.1):
 * **εξαγωγή, ποτέ trim.**
 *
 * @module subapps/dxf-viewer/ui/components/table-format-toolbar/table-color-menu-roles
 * @see TableAxisColorMenu.tsx — ο μοναδικός καταναλωτής
 * @see docs/centralized-systems/reference/adrs/ADR-739-canvas-table-system.md §35
 */

import type { PlotColorRole } from '../../../config/print-color-policy';
import type { TableAxisColorState } from './table-color-menu-selection';

/** Τα κλειδιά που διαφέρουν ανά ρόλο. Ρητά ονόματα πεδίων ⇒ ο μεταγλωττιστής μετρά τα κενά. */
export interface ColorMenuRoleKeys {
  readonly trigger: string;
  readonly openMenu: string;
  readonly menuLabel: string;
  readonly automatic: string;
  readonly automaticHint: string;
  readonly automaticMixedHint: string;
  readonly dialogTitle: string;
}

const ROLE_KEYS: Readonly<Record<PlotColorRole, ColorMenuRoleKeys>> = {
  ink: {
    trigger: 'table.textColor.trigger',
    openMenu: 'table.textColor.openMenu',
    menuLabel: 'table.textColor.menuLabel',
    automatic: 'table.textColor.automatic',
    automaticHint: 'table.textColor.automaticHint',
    automaticMixedHint: 'table.textColor.automaticMixedHint',
    dialogTitle: 'table.textColor.dialogTitle',
  },
  fill: {
    trigger: 'table.fillColor.trigger',
    openMenu: 'table.fillColor.openMenu',
    menuLabel: 'table.fillColor.menuLabel',
    automatic: 'table.fillColor.automatic',
    automaticHint: 'table.fillColor.automaticHint',
    automaticMixedHint: 'table.fillColor.automaticMixedHint',
    dialogTitle: 'table.fillColor.dialogTitle',
  },
};

export function colorMenuKeys(role: PlotColorRole): ColorMenuRoleKeys {
  return ROLE_KEYS[role];
}

/**
 * 🔴 Η υπόδειξη της γραμμής «Αυτόματο» — **η μόνη απόφαση εδώ που μπορεί να πει ψέματα.**
 *
 * Τρεις καταστάσεις, με τη σειρά:
 *
 * 1. **μεικτή κληρονομιά** ⇒ **μη-δήλωση** («διαφέρει ανά κελί», το `<varies>` του Revit).
 *    Πρώτη, γιατί επισκιάζει: όταν η κληρονομιά είναι δύο πράγματα, καμία δήλωση για «τι»
 *    κληρονομείς δεν είναι αληθινή.
 * 2. **κληρονομεί κενό** ⇒ «κληρονομεί «κανένα γέμισμα»». Δυνατό **μόνο** στο γέμισμα, γι'
 *    αυτό το κλειδί είναι ρητά του `fillColor` και δεν περνά από τον χάρτη ρόλων: ένα χρώμα
 *    κειμένου κληρονομεί πάντα κάτι.
 * 3. **κληρονομεί ένα χρώμα** ⇒ η γενική υπόδειξη του ρόλου.
 *
 * ── ΤΟ ΕΛΑΤΤΩΜΑ ΠΟΥ ΒΡΗΚΕ Η ΟΘΟΝΗ (ζωντανή επαλήθευση 2026-08-03) ──
 * Χωρίς την πρώτη περίπτωση, μια **κεφαλίδα** (`#EDEDED`) που περνά πάνω από στήλη με ρητό
 * γέμισμα δήλωνε «Κληρονομεί **«κανένα γέμισμα»** από το στυλ»: το `inherited.value` έβγαινε
 * `undefined` λόγω μεικτότητας και έπεφτε σε fallback. **Θετικός ισχυρισμός βγαλμένος από
 * fallback** — δεν ήταν λογικό σφάλμα, ήταν ψέμα ακριβώς στο χειριστήριο που υπάρχει για να
 * λέει την αλήθεια για την κληρονομιά.
 */
export function automaticHintKey(
  state: TableAxisColorState,
  keys: ColorMenuRoleKeys,
): string {
  if (state.inheritedMixed) return keys.automaticMixedHint;
  if (state.inheritedColor === undefined) return 'table.fillColor.automaticNoneHint';
  return keys.automaticHint;
}
