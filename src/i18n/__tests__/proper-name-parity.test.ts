/**
 * @fileoverview **«ΛΕΕΙ ΤΟ ΙΔΙΟ ΠΡΑΓΜΑ;»** — η ερώτηση που **καμία** i18n πύλη δεν ρωτά.
 * @related i18n/locales/el · i18n/locales/en · CLAUDE.md N.11
 * @see docs/centralized-systems/reference/adrs/ADR-841-public-listing-body-and-platform-verticals.md — Α9.7
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ — ΜΕΤΡΗΜΕΝΟ ΣΤΗΝ ΟΘΟΝΗ, Φ6-Β, 2026-09-02
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το `el/contacts.json` έλεγε `esco.badge: "ESCO"`. Το `en` έλεγε **`"Badge"`**.
 * Ο Άγγλος έβλεπε τσιπάκι **«Badge»** — λέξη που περιγράφει το **widget**, όχι το
 * **περιεχόμενο**. Το badge ονομάζει την **ταξινομία ESCO**: κύριο όνομα, που
 * **δεν μεταφράζεται**.
 *
 * 🔑 **ΤΟ ΣΩΣΤΟ ΥΠΗΡΧΕ ΗΔΗ ΕΝΑ ΑΡΧΕΙΟ ΠΙΟ ΔΙΠΛΑ**: το
 * `contacts-relationships.json` λέει `esco.skills.badge: "ESCO"` **και στις δύο**
 * γλώσσες. Δεν ήταν άγνοια — ήταν **αντιγραφή που παρέσυρε**, και κανείς δεν
 * ξανακοίταξε.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΚΑΜΙΑ ΑΠΟ ΤΙΣ ΠΕΝΤΕ ΠΥΛΕΣ ΔΕΝ ΤΟ ΕΠΙΑΣΕ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * | Πύλη | Ρωτά | Εδώ απαντούσε |
 * |---|---|---|
 * | **3.8**  | *υπάρχει το κλειδί;*         | ✅ ναι |
 * | **3.13** | *φτάνει ο resolver σ' αυτό;* | ✅ ναι |
 * | **3.33** | *είναι φρέσκοι οι τύποι;*    | ✅ ναι |
 * | **3.36** | *φορτώνεται το namespace;*   | ✅ ναι |
 * | **3.71** | *είναι μοναδικό το κλειδί;*  | ✅ ναι |
 *
 * **Όλες πράσινες. Το κείμενο λάθος.** Το ερώτημα *«λέει το ίδιο πράγμα;»* δεν το
 * ρωτούσε **κανείς** — το βρήκε **μόνο** ανθρώπινο μάτι σε ζωντανή οθόνη. Είναι
 * ακριβώς το σχήμα που το `CLAUDE.md` ονομάζει τέσσερις φορές: **«το `0` σημαίνει
 * “κανείς δεν κοίταξε”, όχι “καθαρό”»**.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΓΙΑΤΙ Ο ΚΑΝΟΝΑΣ **ΠΑΡΑΓΕΤΑΙ** ΚΑΙ ΔΕΝ ΕΙΝΑΙ ΛΙΣΤΑ ΚΛΕΙΔΙΩΝ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Μια χειρόγραφη λίστα *«κλειδιά που δεν μεταφράζονται»* θα κάλυπτε το `esco.badge`
 * και **τίποτα από όσα προστεθούν αύριο** — το `CLAUDE.md` μετρά **τέσσερα**
 * περιστατικά τέτοιων λιστών που πάλιωσαν σιωπηλά.
 *
 * Ο κανόνας εδώ διαβάζει την **ίδια την ελληνική τιμή**: αν η ελληνική μετάφραση
 * κράτησε **λατινικό ακρωνύμιο κεφαλαίων** *(«ESCO», «PDF», «MFA»)*, τότε το έργο
 * έχει ήδη αποφασίσει ότι ο όρος **δεν μεταφράζεται** — και η αγγλική οφείλει να
 * λέει **το ίδιο**. Ένα νέο «ESCO» μπαίνει στον έλεγχο **χωρίς να το θυμηθεί
 * κανείς**.
 *
 * 📊 **ΜΕΤΡΗΜΕΝΟ ΠΡΙΝ ΓΡΑΦΤΕΙ** *(32.780 φύλλα, δύο γλώσσες)*: **125** τιμές
 * περνούν το κόσκινο, **4** απέκλιναν — **3 πραγματικές βλάβες** *(`Uid`, `Mfa`,
 * `Pdf`: ίδια μηχανική τιτλοποίηση ακρωνυμίου με το `esco.badge`)* και **1**
 * νόμιμη εξαίρεση. Μία δηλωμένη εξαίρεση σε 125 ελέγχους: ο κανόνας είναι στενός
 * **επίτηδες**.
 *
 * ⚠️ **ΓΙΑΤΙ ΤΟ ΚΟΣΚΙΝΟ ΑΠΟΚΛΕΙΕΙ ΤΑ ΕΛΛΗΝΙΚΑ ΑΚΡΩΝΥΜΙΑ**: το «ΤΕΕ» γίνεται
 * νόμιμα «TCG» *(Technical Chamber of Greece)* — αυτά **μεταφράζονται**. Η
 * διάκριση δεν είναι «κεφαλαία», είναι **«λατινικό ακρωνύμιο που η ελληνική
 * άφησε ως έχει»**.
 */

import fs from 'node:fs';
import path from 'node:path';

// Ίδιο ιδίωμα με το `bundle-completeness.test.ts`: αγκύρωση στο ΑΡΧΕΙΟ, όχι στο
// `process.cwd()` — ο κατάλογος εκτέλεσης δεν είναι εγγύηση.
const LOCALES_ROOT = path.join(__dirname, '..', 'locales');
const EL_DIR = path.join(LOCALES_ROOT, 'el');
const EN_DIR = path.join(LOCALES_ROOT, 'en');

/** Οποιοδήποτε ελληνικό γράμμα (Greek & Coptic + Extended Greek). */
const GREEK_LETTER = /[Ͱ-Ͽἀ-῿]/;
const LATIN_LETTER = /[A-Za-z]/;
const LOWERCASE_LATIN = /[a-z]/;

type Bundle = { readonly [key: string]: unknown };

/** Ισοπεδώνει ένα πακέτο locale σε `πλήρες.μονοπάτι → συμβολοσειρά`. */
function flatten(node: unknown, prefix: string, into: Map<string, string>): void {
  if (typeof node === 'string') {
    into.set(prefix, node);
    return;
  }
  if (node === null || typeof node !== 'object' || Array.isArray(node)) return;
  for (const [key, value] of Object.entries(node as Bundle)) {
    flatten(value, prefix === '' ? key : `${prefix}.${key}`, into);
  }
}

function readBundle(dir: string, file: string): Map<string, string> {
  const leaves = new Map<string, string>();
  flatten(JSON.parse(fs.readFileSync(path.join(dir, file), 'utf-8')), '', leaves);
  return leaves;
}

/**
 * *«Είναι αυτή η ελληνική τιμή **λατινικό ακρωνύμιο που δεν μεταφράστηκε**;»*
 *
 * ⚠️ Το `{` αποκλείεται γιατί μια τιμή με ICU placeholder δεν είναι **όνομα**,
 * είναι **πρόταση** — και η αγγλική της οφείλει να διαφέρει.
 */
function isUntranslatedLatinAcronym(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed === '' || trimmed.includes('{')) return false;
  if (GREEK_LETTER.test(trimmed)) return false;
  if (!LATIN_LETTER.test(trimmed) || LOWERCASE_LATIN.test(trimmed)) return false;
  return trimmed.replace(/[^A-Za-z]/g, '').length >= 2;
}

/**
 * **ΟΙ ΔΗΛΩΜΕΝΕΣ ΕΞΑΙΡΕΣΕΙΣ — με λόγο, ποτέ σιωπηλά.**
 *
 * Κλειδί: `<αρχείο>:<μονοπάτι>`. Η τιμή είναι ο **λόγος** — τεκμηρίωση για τον
 * επόμενο, όχι κείμενο οθόνης. Ίδιο σχήμα με το `why` του
 * `config/isco-registry-authority.ts`: η εξαίρεση που **δηλώνεται** μπορεί να
 * επανεξεταστεί· η εξαίρεση που **σιωπά** όχι.
 *
 * 🔑 Οι έλεγχοι **Π3** και **Κ2** απαιτούν κάθε γραμμή εδώ να αντιστοιχεί σε τιμή
 * που **όντως** περνά το κόσκινο **και όντως** αποκλίνει — ώστε ο πίνακας να
 * **μην μπορεί** να παλιώσει προς καμία από τις δύο κατευθύνσεις.
 */
const DECLARED_EXCEPTIONS: Readonly<Record<string, string>> = {
  'vendor-portal.json:page.languageToggle':
    'Ο διακόπτης γλώσσας ονομάζει την ΑΛΛΗ γλώσσα: το el δείχνει «EN», το en δείχνει «EL». Εδώ η ταυτότητα ΘΑ ΗΤΑΝ το σφάλμα.',
};

/** Ένα ζεύγος τιμών που πέρασε το κόσκινο, με τη διεύθυνσή του. */
interface SweptValue {
  readonly id: string;
  readonly el: string;
  readonly en: string;
}

const SWEPT: readonly SweptValue[] = (() => {
  const found: SweptValue[] = [];
  for (const file of fs.readdirSync(EL_DIR).sort()) {
    if (!file.endsWith('.json')) continue;
    if (!fs.existsSync(path.join(EN_DIR, file))) continue;
    const greekBundle = readBundle(EL_DIR, file);
    const englishBundle = readBundle(EN_DIR, file);
    for (const [key, greek] of greekBundle) {
      const english = englishBundle.get(key);
      if (english === undefined || !isUntranslatedLatinAcronym(greek)) continue;
      found.push({ id: `${file}:${key}`, el: greek.trim(), en: english.trim() });
    }
  }
  return found;
})();

describe('🔑 Π — ο ΠΑΡΟΝΟΜΑΣΤΗΣ: το κόσκινο όντως κοσκινίζει', () => {
  // Χωρίς αυτό, ένα σπασμένο μονοπάτι ή ένα αλλαγμένο κόσκινο θα άδειαζε το
  // `SWEPT`, και ο Κ1 θα περνούσε **χωρίς να δει τίποτα** — «πράσινο που σημαίνει
  // δεν κοίταξα» (Α6.6: 546 πράσινα suites δίπλα σε σελίδα 500).
  it('Π1 — το κόσκινο βρίσκει τιμές (κενή σάρωση = σπασμένη άγκυρα, όχι καθαρό δέντρο)', () => {
    expect(SWEPT.length).toBeGreaterThanOrEqual(100);
  });

  it('Π2 — το ίδιο το περιστατικό της Φ6-Β βρίσκεται ΜΕΣΑ στο κοσκινισμένο σύνολο', () => {
    // Αν αυτό πέσει, η άγκυρα έπαψε να καλύπτει τη βλάβη που τη γέννησε.
    expect(SWEPT.map((value) => value.id)).toContain('contacts.json:esco.badge');
  });

  it('Π3 — καμία εξαίρεση-φάντασμα: κάθε δηλωμένη γραμμή αντιστοιχεί σε υπαρκτή τιμή', () => {
    const sweptIds = new Set(SWEPT.map((value) => value.id));
    const ghosts = Object.keys(DECLARED_EXCEPTIONS).filter((id) => !sweptIds.has(id));
    expect(ghosts).toEqual([]);
  });

  it('Π4 — κάθε εξαίρεση φέρει λόγο, όχι κενό', () => {
    const silent = Object.entries(DECLARED_EXCEPTIONS)
      .filter(([, why]) => why.trim().length < 20)
      .map(([id]) => id);
    expect(silent).toEqual([]);
  });
});

describe('🔴 Κ — τα κύρια ονόματα λένε ΤΟ ΙΔΙΟ ΠΡΑΓΜΑ και στις δύο γλώσσες', () => {
  it('Κ1 — ό,τι η ελληνική άφησε αμετάφραστο, η αγγλική το λέει αυτούσιο', () => {
    // ⚠️ Λίστα αποκλίσεων, όχι `expect` ανά τιμή: το `expect` του jest δεν παίρνει
    // μήνυμα, οπότε η αποτυχία οφείλει να ονομάζει **ποιες** απέκλιναν.
    const drifted = SWEPT.filter(
      (value) => value.en !== value.el && DECLARED_EXCEPTIONS[value.id] === undefined,
    ).map((value) => `${value.id} → el=${value.el} · en=${value.en}`);

    expect(drifted).toEqual([]);
  });

  it('Κ2 — η δηλωμένη εξαίρεση όντως αποκλίνει (αλλιώς η γραμμή είναι σκουπίδι)', () => {
    // Διπλή κατεύθυνση: αν μια εξαίρεση πάψει να αποκλίνει, ο πίνακας **πάλιωσε**
    // και οφείλει να μικρύνει. Ratchet, όπως κάθε baseline του έργου.
    const pointless = SWEPT.filter(
      (value) => DECLARED_EXCEPTIONS[value.id] !== undefined && value.en === value.el,
    ).map((value) => value.id);

    expect(pointless).toEqual([]);
  });
});

describe('🔴 Μ — το κόσκινο ξεχωρίζει τις περιπτώσεις που πρέπει', () => {
  it('Μ1 — λατινικό ακρωνύμιο κεφαλαίων περνά', () => {
    expect(isUntranslatedLatinAcronym('ESCO')).toBe(true);
    expect(isUntranslatedLatinAcronym('ISCO-08')).toBe(true);
  });

  it('Μ2 — ΕΛΛΗΝΙΚΟ ακρωνύμιο ΔΕΝ περνά (το «ΤΕΕ» γίνεται νόμιμα «TCG»)', () => {
    expect(isUntranslatedLatinAcronym('ΤΕΕ')).toBe(false);
    expect(isUntranslatedLatinAcronym('Κωδικός ISCO')).toBe(false);
  });

  it('Μ3 — πρόταση, πεζά, ένα γράμμα ή ICU placeholder ΔΕΝ περνούν', () => {
    expect(isUntranslatedLatinAcronym('PDF Report')).toBe(false);
    expect(isUntranslatedLatinAcronym('Parking')).toBe(false);
    expect(isUntranslatedLatinAcronym('3D')).toBe(false);
    expect(isUntranslatedLatinAcronym('{count} ESCO')).toBe(false);
    expect(isUntranslatedLatinAcronym('')).toBe(false);
  });
});
