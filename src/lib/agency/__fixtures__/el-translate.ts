/**
 * @fileoverview SSoT δοκιμών — **Ο `t` ΠΟΥ ΔΙΑΒΑΖΕΙ ΤΑ ΠΡΑΓΜΑΤΙΚΑ ΕΛΛΗΝΙΚΑ ΚΕΙΜΕΝΑ.**
 * @related components/mandate/__tests__/* · src/i18n/locales/el/property-market.json
 * @module lib/agency/__fixtures__/el-translate
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ — **ΗΤΑΝ ΕΤΟΙΜΟ ΝΑ ΓΙΝΕΙ ΤΡΙΤΟ ΑΝΤΙΓΡΑΦΟ** *(N.18)*
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Η ίδια δεκαεξάγραμμη συνάρτηση ζούσε ήδη μέσα στο `agency-directory-area-pending`, και
 * το §9 #12 χρειάστηκε **δύο ακόμη** *(`where-control-truth` · `directory-query-state`)*.
 * Τρία αντίγραφα ενός mock δεν σπάνε ποτέ μαζί: το ένα μαθαίνει ICU, τα άλλα δύο όχι, και
 * η **ίδια** άγκυρα γράφεται διαφορετικά ανάλογα με ποιο αρχείο την κληρονόμησε.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔑 ΓΙΑΤΙ ΟΧΙ `t = (key) => key` — Η ΕΝΣΤΑΣΗ ΠΟΥ ΑΞΙΖΕΙ ΑΠΑΝΤΗΣΗ
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Το `key => key` είναι φθηνότερο και **απομονώνει** την άγκυρα από τα κείμενα. Είναι
 * όμως **τυφλό** σε ακριβώς τρία πράγματα που έχουν ήδη χτυπήσει σε αυτό το έργο:
 *
 * | Τι δεν βλέπει | Τι γίνεται στην οθόνη |
 * |---|---|
 * | κλειδί **χωρίς κείμενο** στο locale | ωμό `property-market:mandate.…` σε δημόσια σελίδα *(CHECK 3.51)* |
 * | **λάθος όνομα παραμέτρου** *(`count` αντί για `shown`)* | ωμό `{shown}` δίπλα σε σωστό αριθμό |
 * | **δύο κλειδιά με το ίδιο κείμενο** | ο τύπος τα εγκρίνει· ο άνθρωπος δεν τα ξεχωρίζει |
 *
 * ⇒ Ο `t` εδώ **επιλύει αληθινά**, και η άγκυρα μετρά ό,τι θα διαβάσει άνθρωπος.
 *
 * ⚠️ **ΔΕΝ ΕΙΝΑΙ i18next.** Καλύπτει **ό,τι χρησιμοποιεί ο κατάλογος** — απλή παρεμβολή
 * `{name}` και **ένα** σκέλος `plural`. Αν μια οθόνη αποκτήσει `select` ή ένθετο ICU, το
 * σωστό είναι να **επεκταθεί εδώ**, όχι να γεννηθεί τέταρτο αντίγραφο δίπλα της.
 */

import bundle from '@/i18n/locales/el/property-market.json';

/** Το υποδέντρο κειμένων του **δημόσιου καταλόγου** — για άγκυρες που συγκρίνουν προτάσεις. */
export const EL_DIRECTORY: Record<string, string> = (
  bundle as unknown as { mandate: { directory: Record<string, string> } }
).mandate.directory;

/**
 * Επιλύει `{name, plural, one {…} other {…}}` — **μονά** άγκιστρα *(CHECK 3.9)*.
 *
 * 🔑 **Το `#` είναι μέρος του ICU, όχι διακοσμητικό**: αντικαθίσταται από τον **ίδιο** τον
 * αριθμό. Ένα mock που το αφήνει ανέπαφο θα ζωγράφιζε `# επαγγελματίες`, δηλαδή θα
 * **περνούσε** μια άγκυρα που ψάχνει τη λέξη και θα έχανε τον αριθμό.
 *
 * ⚠️ **Κανόνας μιας γλώσσας**: τα ελληνικά έχουν `one`/`other`, και **μόνο** αυτά
 * υπάρχουν στα locale μας. Δεν μιμούμαστε `few`/`many` που κανένα κλειδί δεν δηλώνει.
 */
function resolvePlural(text: string, params: Readonly<Record<string, unknown>>): string {
  return text.replace(
    /\{(\w+),\s*plural,\s*one\s*\{([^}]*)\}\s*other\s*\{([^}]*)\}\s*\}/g,
    (_match, name: string, one: string, other: string) => {
      const value = Number(params[name]);
      return (value === 1 ? one : other).replaceAll('#', String(value));
    },
  );
}

/**
 * **Ο `t` της άγκυρας** — διαβάζει το πραγματικό `el/property-market.json`.
 *
 * ⚠️ **Κλειδί που ΔΕΝ βρίσκεται επιστρέφει τον εαυτό του**, όπως το i18next. Έτσι η
 * απουσία κειμένου γίνεται **ορατή στην οθόνη της άγκυρας** *(λατινικά με `:` στο
 * namespace)* αντί να πετάξει και να μοιάζει με σφάλμα υποδομής.
 */
export function elTranslate(key: string, params?: Readonly<Record<string, unknown>>): string {
  let node: unknown = bundle as unknown as Record<string, unknown>;
  for (const segment of key.replace(/^property-market:/, '').split('.')) {
    node = (node as Record<string, unknown> | undefined)?.[segment];
  }
  if (typeof node !== 'string') return key;

  const safe = params ?? {};
  return Object.entries(safe).reduce(
    (text, [name, replacement]) => text.replaceAll(`{${name}}`, String(replacement)),
    resolvePlural(node, safe),
  );
}
