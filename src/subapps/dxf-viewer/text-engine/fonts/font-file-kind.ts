/**
 * 🔴 ADR-739 Φ.Ε/Φ2 βήμα 4 — **«SHX ή TrueType;»**, το κατηγόρημα που έλειπε.
 *
 * Το DXF group 3 ενός STYLE record είναι **όνομα αρχείου**, όχι οικογένειας, και το AutoCAD
 * θεωρεί κάθε όνομα **χωρίς επέκταση** ότι είναι `.shx`. Γι' αυτό η Φ1 πλήρωσε ζωντανά ένα
 * γυμνό `Arial`: γράφτηκε ως αίτημα για `Arial.shx`, που δεν υπάρχει, το AutoCAD
 * υποκατέστησε γραμματοσειρά και **ούτε το έντονο του XDATA 1071 μπορούσε να εφαρμοστεί**.
 * Η Φ1 το μπάλωσε **μόνο για το Arial** και άφησε ρητά το υπόλοιπο ως χρέος (ADR-739
 * §28.9.8): «θέλει κατηγόρημα SHX ή TrueType; από τον font resolver, που δεν υπάρχει».
 *
 * ## Γιατί ΕΔΩ και όχι δεύτερο μητρώο γραμματοσειρών
 * Και οι δύο πηγές γνώσης **υπάρχουν ήδη** στο έργο· αυτό το αρχείο τις **ενώνει**, δεν τις
 * αντιγράφει:
 *
 * 1. **Ο κατάλογος επεκτάσεων** (`.ttf`/`.otf`/`.woff`/`.woff2`/`.shx`) ζούσε μέσα στο
 *    `font-upload.service.ts` — αρχείο που εισάγει **Firebase**. Ένας exporter δεν μπορεί να
 *    το εισάγει χωρίς να σύρει μαζί του όλο το Firestore SDK, οπότε η επιλογή ήταν «δεύτερος
 *    κατάλογος» ή «προαγωγή σε φύλλο». Προάχθηκε: ο service εισάγει πλέον από **εδώ**.
 * 2. **Ο κατάλογος γνωστών SHX** είναι το `FONT_SUBSTITUTION_TABLE` (ADR-344 Q20) — η ίδια
 *    λίστα που ήδη απαντά «με τι αντικαθιστώ αυτό το SHX;». Το «είναι SHX;» και το «με τι
 *    το αντικαθιστώ;» είναι **η ίδια γνώση**, και μία λίστα τα απαντά και τα δύο.
 *
 * ## 🔴 Η προεπιλογή είναι TrueType — και είναι απόφαση, όχι παράλειψη
 * Ένα άγνωστο γυμνό όνομα (`Calibri`, `Segoe UI`, μια εταιρική γραμματοσειρά) κρίνεται
 * **TrueType**. Δύο λόγοι, και ο δεύτερος είναι ο βαρύς:
 *
 * - **Συχνότητα**: το AutoCAD γράφει τα SHX **με** την επέκταση (`romans.shx`) και τα
 *   ονόματα χωρίς επέκταση που φτάνουν εδώ προέρχονται από **επιλογή χρήστη** σε
 *   χειριστήριο γραμματοσειράς — δηλαδή είναι οικογένειες συστήματος, άρα TrueType.
 * - **Ασυμμετρία της ζημιάς**: αν πούμε «TrueType» για ένα SHX, τα Windows υποκαθιστούν
 *   σιωπηλά μια TrueType και **το κείμενο φαίνεται**. Αν πούμε «SHX» για μια TrueType,
 *   ζητείται ανύπαρκτο `.shx` — και αυτό ακριβώς ήταν το αρχείο της Φ1 όπου **τίποτα δεν
 *   φαινόταν**. Όταν η μαντεψιά είναι αναπόφευκτη, μαντεύουμε προς την **υποβάθμιση**, όχι
 *   προς την **εξαφάνιση**.
 *
 * @module text-engine/fonts/font-file-kind
 * @see export/core/dxf-ascii-text-writer.ts — ο καταναλωτής της εξαγωγής (`resolveExportFont`)
 */

import { FONT_SUBSTITUTION_TABLE } from './font-substitution-table';

/** Τα formats αρχείου γραμματοσειράς που δέχεται το έργο (upload + import). */
export type FontFormat = 'ttf' | 'otf' | 'woff' | 'woff2' | 'shx';

/**
 * Επέκταση αρχείου (πεζά, **με** την τελεία) → format. Ο ΕΝΑΣ κατάλογος: τον διαβάζει και ο
 * έλεγχος του upload (`detectFormat`) και το κατηγόρημα εξαγωγής παρακάτω.
 */
export const FONT_EXTENSION_FORMATS: Readonly<Record<string, FontFormat>> = {
  '.ttf': 'ttf',
  '.otf': 'otf',
  '.woff': 'woff',
  '.woff2': 'woff2',
  '.shx': 'shx',
};

/** Η επέκταση ενός ονόματος αρχείου σε πεζά (με την τελεία), ή `''` όταν δεν έχει. */
function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  // `dot <= 0` ⇒ ή δεν υπάρχει τελεία, ή το όνομα ΞΕΚΙΝΑ με τελεία (κρυφό αρχείο, όχι
  // επέκταση). Και στις δύο περιπτώσεις δεν υπάρχει επέκταση να διαβαστεί.
  return dot <= 0 ? '' : fileName.slice(dot).toLowerCase();
}

/** Το format μιας ρητής επέκτασης, ή `undefined` όταν το όνομα δεν έχει (γνωστή) επέκταση. */
export function fontFormatOfFileName(fileName: string): FontFormat | undefined {
  return FONT_EXTENSION_FORMATS[extensionOf(fileName)];
}

/**
 * Όνομα αρχείου → **τυπογραφική οικογένεια** (`Arial.ttf` → `Arial`).
 *
 * Η αντίστροφη πράξη του {@link dxfFontFileFor}, και ο λόγος που ζουν στο ίδιο αρχείο: ο
 * importer τη χρησιμοποιεί για να παράγει την οικογένεια από το group 3, ο exporter για να
 * παράγει το XDATA `1000` από το ίδιο group 3. Δύο άκρα, **μία** αφαίρεση επέκτασης — αν
 * αποκλίνουν, ένα αρχείο δεν κάνει round-trip στην ίδια του την εφαρμογή.
 */
export function fontFamilyOfFileName(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  return dot > 0 ? fileName.slice(0, dot) : fileName;
}

/** Οι δύο κόσμοι γραμματοσειράς που ξεχωρίζει το DXF: διανυσματικά σχήματα vs περιγράμματα. */
export type FontKind = 'shx' | 'truetype';

/**
 * Τα γνωστά SHX ονόματα του έργου, **παραγόμενα** από το `FONT_SUBSTITUTION_TABLE` — χωρίς
 * την επέκταση και χωρίς τον catch-all `'*'`, ώστε το `romans.shx` του πίνακα να ταιριάζει
 * και σε ένα γυμνό `ROMANS` που γράφει το AutoCAD.
 */
const KNOWN_SHX_NAMES: ReadonlySet<string> = new Set(
  FONT_SUBSTITUTION_TABLE
    .filter((entry) => entry.shxName !== '*')
    .map((entry) => entry.shxName.replace(/\.shx$/i, '').toLowerCase()),
);

/**
 * «Αυτή η οικογένεια/αρχείο είναι SHX ή TrueType;» — δες την επικεφαλίδα του module για το
 * γιατί η προεπιλογή είναι `truetype`.
 *
 * Σειρά απόφασης: **ρητή επέκταση** (η μόνη βεβαιότητα) → **γνωστό SHX όνομα** → προεπιλογή.
 */
export function fontKindOf(family: string): FontKind {
  const name = family.trim();
  if (!name) return 'truetype';
  const format = fontFormatOfFileName(name);
  if (format) return format === 'shx' ? 'shx' : 'truetype';
  return KNOWN_SHX_NAMES.has(name.toLowerCase()) ? 'shx' : 'truetype';
}

/**
 * Το όνομα **αρχείου** για το DXF group 3.
 *
 * - **SHX**: αυτούσιο. Το AutoCAD προσθέτει μόνο του το `.shx`, και ένα γυμνό `romans` είναι
 *   ό,τι γράφει και το ίδιο — καμία μεταβολή byte για ό,τι εισήχθη.
 * - **TrueType χωρίς επέκταση**: **+ `.ttf`**. Η επέκταση είναι η δήλωση «μη ψάξεις για
 *   `.shx`», και είναι όλο το νόημα αυτού του module.
 *
 * ⚠️ **Το `<οικογένεια>.ttf` είναι εικασία για το ΟΝΟΜΑ ΑΡΧΕΙΟΥ, και το ξέρουμε**: το
 * πραγματικό αρχείο του `Times New Roman` στα Windows είναι `times.ttf`, του `Courier New`
 * `cour.ttf`. Γι' αυτό η εξαγωγή γράφει **πάντα** και το XDATA `1000 <οικογένεια>` για κάθε
 * TrueType style (δες `collectTextStyles`): εκεί το όνομα είναι **τυπογραφικό**, όχι
 * αρχείου, και είναι το σημείο όπου το AutoCAD βρίσκει τη σωστή όψη όταν το αρχείο αστοχεί.
 * Χωρίς το XDATA, μια σωστή εικασία επέκτασης πάνω σε λάθος όνομα αρχείου θα ήταν απλώς μια
 * πιο κομψή αποτυχία.
 */
export function dxfFontFileFor(family: string): string {
  const name = family.trim();
  if (!name) return name;
  if (fontKindOf(name) === 'shx') return name;
  return fontFormatOfFileName(name) ? name : `${name}.ttf`;
}
