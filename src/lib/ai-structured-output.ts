/**
 * **Κείμενο από δομημένη έξοδο μοντέλου → κείμενο ή `null`** — το ΕΝΑ σύνορο για τους αναλυτές εγγράφων.
 *
 * 🔴 Μετρημένο ζωντανά 2026-10-28 (ADR-327, σάρωση πραγματικής προσφοράς): το σχήμα δηλώνει
 * `type: ['string', 'null']`, αλλά το μοντέλο επέστρεψε το **κείμενο** `"null"` σε 8 πεδία (ΑΦΜ προμηθευτή,
 * ισχύς έως, αριθμός αναφοράς, εγγύηση, και 4 του υπογράφοντα). Το `raw.x ?? null` το άφηνε να περάσει ⇒
 * αποθηκεύτηκε στο Firestore και ο έλεγχος σάρωσης έδειχνε «null» μέσα στα πεδία — και ένα «null» στο ΑΦΜ
 * θα έφτανε στο `contacts/resolve` ως ΑΦΜ.
 *
 * Το σχήμα (strict JSON schema) εγγυάται **τύπο**, όχι **νόημα**: ένα string που λέει «τίποτα» είναι έγκυρο
 * string. Γι' αυτό η απάντηση ζει στο σύνορο ανάλυσης, όχι στο UI (που θα έπρεπε να το θυμάται σε κάθε πεδίο).
 */

/** Κείμενα που σημαίνουν «δεν υπάρχει τιμή». Σύγκριση χωρίς διάκριση πεζών/κεφαλαίων, μετά από `trim`. */
const ABSENT_TEXT: ReadonlySet<string> = new Set(['', 'null', 'undefined', 'none', 'n/a', '-', '–', '—']);

/** `true` όταν το κείμενο είναι κενό ή λέξη-δείκτης απουσίας (`"null"`, `"N/A"`, `"—"` …). */
export function isAbsentText(value: string): boolean {
  return ABSENT_TEXT.has(value.trim().toLowerCase());
}

/** Τιμή κειμένου από το μοντέλο → `trim`-αρισμένο κείμενο, ή `null` όταν λείπει ή λέει «τίποτα». */
export function structuredText(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  return isAbsentText(value) ? null : value.trim();
}

/** Λίστα κειμένων από το μοντέλο → μόνο οι πραγματικές τιμές (π.χ. `["null"]` → `[]`). */
export function structuredTextList(values: readonly (string | null | undefined)[] | null | undefined): string[] {
  if (!Array.isArray(values)) return [];
  return values.map(structuredText).filter((v): v is string => v !== null);
}
