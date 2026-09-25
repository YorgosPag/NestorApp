/**
 * @fileoverview **Ο ΣΥΓΧΡΟΝΟΣ ΜΕΤΑΦΡΑΣΤΗΣ ΠΑΝΩ ΣΕ LOCALE JSON** — για κώδικα που ζει **έξω** από το i18next.
 * @related ADR-887 · services/demand/demand-name-server.ts · lib/agency/__fixtures__/el-translate.ts · CHECK 3.9
 * @module i18n/bundle-translate
 *
 * 🔑 **Γιατί υπάρχει**: ο server (cron ειδοποιήσεων) χρειάζεται να αποδώσει κείμενα που ήδη γράφει το UI —
 * π.χ. το αυτόματο όνομα ζήτησης (ADR-886) — στη γλώσσα **του παραλήπτη**, σε πέρασμα που στέλνει σε
 * **πολλούς** ανθρώπους. Η καθολική γλώσσα του i18next θα έγραφε το κείμενο του ενός στη γλώσσα του άλλου
 * (ίδιο σκεπτικό με το `holiday-question-email-texts.ts`). Ο μεταφραστής εδώ δένεται σε **ρητά** bundles.
 *
 * 🔴 **Προάχθηκε από fixture δοκιμών** (`lib/agency/__fixtures__/el-translate.ts`), που είναι πλέον λεπτός
 * καταναλωτής του — ένας κανόνας ICU, όχι δύο που αποκλίνουν (N.0.2 · N.18).
 *
 * ⚠️ **ΔΕΝ ΕΙΝΑΙ i18next.** Καλύπτει **ρητά**: `ns:key` με τελείες · παρεμβολή `{name}` · σκέλος
 * `{name, plural, one {…} other {…}}` με `#`. Τα locale μας έχουν μόνο `one`/`other` (CHECK 3.9, μονά
 * άγκιστρα). Αν κείμενο που αποδίδεται εδώ αποκτήσει `select` ή ένθετο ICU, **επεκτείνεται αυτό το αρχείο**.
 *
 * ⚠️ **Κλειδί που ΔΕΝ βρίσκεται επιστρέφει τον εαυτό του** (όπως το i18next): η απουσία γίνεται **ορατή**
 * αντί να γίνει σιωπηλό κενό.
 */

/** Μεταφραστής με την υπογραφή που ζητούν τα καθαρά lib (`PriceLabelT`). */
export type BundleTranslate = (key: string, params?: Readonly<Record<string, unknown>>) => string;

/** `namespace → περιεχόμενο locale JSON`. */
export type LocaleBundles = Readonly<Record<string, unknown>>;

const PLURAL = /\{(\w+),\s*plural,\s*one\s*\{([^}]*)\}\s*other\s*\{([^}]*)\}\s*\}/g;

/**
 * Επιλύει τα σκέλη `plural`. 🔑 Το `#` είναι μέρος του ICU: αντικαθίσταται από τον **ίδιο** τον αριθμό.
 */
function resolvePlural(text: string, params: Readonly<Record<string, unknown>>): string {
  return text.replace(PLURAL, (_match, name: string, one: string, other: string) => {
    const value = Number(params[name]);
    return (value === 1 ? one : other).replaceAll('#', String(value));
  });
}

/** Το κείμενο στη διαδρομή `a.b.c` — ή `undefined` αν δεν είναι φύλλο-κείμενο. */
function textAt(bundle: unknown, path: string): string | undefined {
  let node: unknown = bundle;
  for (const segment of path.split('.')) {
    node = typeof node === 'object' && node !== null ? (node as Record<string, unknown>)[segment] : undefined;
  }
  return typeof node === 'string' ? node : undefined;
}

/** Παρεμβολή + πληθυντικοί — ο **ένας** κανόνας απόδοσης ICU-lite. */
export function formatBundleText(text: string, params?: Readonly<Record<string, unknown>>): string {
  const safe = params ?? {};
  return Object.entries(safe).reduce(
    (result, [name, replacement]) => result.replaceAll(`{${name}}`, String(replacement)),
    resolvePlural(text, safe),
  );
}

/**
 * Φτιάχνει μεταφραστή πάνω σε bundles. Κλειδί χωρίς `ns:` διαβάζεται από το `defaultNamespace`.
 */
export function createBundleTranslate(bundles: LocaleBundles, defaultNamespace: string): BundleTranslate {
  return (key, params) => {
    const separator = key.indexOf(':');
    const namespace = separator === -1 ? defaultNamespace : key.slice(0, separator);
    const path = separator === -1 ? key : key.slice(separator + 1);
    const text = textAt(bundles[namespace], path);
    return text === undefined ? key : formatBundleText(text, params);
  };
}
