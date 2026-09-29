/**
 * CHECK 3.95 — ΤΟ ΣΥΜΒΟΛΑΙΟ ΤΗΣ ΠΥΛΗΣ ΤΩΝ ΠΗΓΩΝ ΥΠΟΒΑΘΡΟΥ (ADR-891 Φ1)
 *
 * «Δηλώνεται κάθε πηγή πλακιδίων χάρτη ΣΤΟ ΜΗΤΡΩΟ — ή τη γράφει κάποιος αλλού, χωρίς όρους χρήσης;»
 *
 * 🔑 **ΔΟΜΙΚΑ ΜΟΤΙΒΑ, ΟΧΙ ΛΙΣΤΑ ΔΙΑΚΟΜΙΣΤΩΝ.** Η πύλη **δεν** ξέρει ποιοι πάροχοι υπάρχουν: αν τους
 * ήξερε, θα ήταν **δεύτερο αντίγραφο** του μητρώου, και ο **επόμενος** πάροχος (αυτός που κανείς δεν
 * δήλωσε — ακριβώς εκείνος που ψάχνουμε) θα της ήταν αόρατος. Αναγνωρίζει το **σχήμα** μιας πηγής
 * πλακιδίων: πρότυπο `{z}/{x}/{y}`, έγγραφο στυλ `style.json`, αρχείο `.pmtiles`, σχήμα `mapbox://`,
 * διακομιστή που λέγεται `tile(s).…` / `basemap(s).…`.
 *
 * ⚠️ **AST, ΟΧΙ REGEX ΣΤΟ ΚΕΙΜΕΝΟ**: κρίνονται μόνο **κυριολεκτικές συμβολοσειρές**. Το ίδιο το μητρώο,
 * το `basemap-source.ts` του DXF και ο φύλακας εκτέλεσης γράφουν ονόματα διακομιστών σε **πρόζα** — ένα
 * regex θα κοκκίνιζε πάνω στην τεκμηρίωση της θεραπείας (μάθημα Κ7β του CHECK 3.50, 3.75).
 *
 * @module scripts/lib/basemap-sources/contract
 */

'use strict';

/** Το αρχείο του μητρώου, σχετικά με τη ρίζα (POSIX). */
const CATALOG_FILE = 'src/lib/maps/basemap-catalog.ts';

/**
 * Το κλειστό σύνολο όσων **δικαιούνται** να γράφουν πηγή πλακιδίων — με **υποχρεωτικό** λόγο.
 * Νέα γραμμή εδώ = κάποιος αποφάσισε, με όνομα, ότι το μητρώο δεν αρκεί.
 */
const SOURCE_OWNERS = Object.freeze({
  [CATALOG_FILE]:
    'ΤΟ ΙΔΙΟ ΤΟ ΜΗΤΡΩΟ. Κάθε πηγή εδώ φέρει πάροχο, διακομιστές, όρους χρήσης και απόδοση ως ' +
    'πεδία — και ο φύλακας εκτέλεσης διαβάζει τους ίδιους διακομιστές. Πύλη που το κατήγγελλε ' +
    'θα κοκκίνιζε πάνω στη ΘΕΡΑΠΕΙΑ.',
});

/**
 * Κ3 — το όνομα της **μίας** στοίβας ετικετών εφαρμογής στο μητρώο. Ό,τι άλλο στο `text-font` μιας στρώσης
 * `symbol` με κείμενο είναι εύρημα (ADR-891 §9.5).
 */
const OVERLAY_TEXT_FONT_NAME = 'BASEMAP_OVERLAY_TEXT_FONT';

/** Ελάχιστο μήκος λόγου — ίδιο κατώφλι με τα 3.66 · 3.75. */
const MIN_REASON = 40;

/**
 * Τα δομικά μοτίβα. Το `why` τυπώνεται στο εύρημα: ο αναγνώστης μαθαίνει **γιατί** αυτό είναι πηγή.
 * ⚠️ Κρίνονται **πάνω στο κείμενο της συμβολοσειράς**, ποτέ στο αρχείο.
 */
const SOURCE_MARKERS = Object.freeze([
  {
    id: 'tile-template',
    test: (text) => text.includes('{z}') && text.includes('{x}') && text.includes('{y}'),
    why: 'πρότυπο πλακιδίων {z}/{x}/{y}',
  },
  {
    id: 'style-document',
    test: (text) => /^https?:\/\/\S+\/style\.json(?:[?#]|$)/i.test(text),
    why: 'έγγραφο στυλ MapLibre/Mapbox (style.json) τρίτου',
  },
  {
    id: 'pmtiles-archive',
    test: (text) => /^pmtiles:\/\//i.test(text) || /\.pmtiles(?:[?#]|$)/i.test(text),
    why: 'αρχείο πλακιδίων PMTiles',
  },
  {
    id: 'mapbox-scheme',
    test: (text) => /^mapbox:\/\//i.test(text),
    why: 'σχήμα mapbox:// — θέλει πληρωμένο κλειδί Mapbox',
  },
  {
    id: 'tile-host',
    test: (text) => /^https?:\/\/(?:tiles?|basemaps?)[.-][a-z0-9.-]+/i.test(text),
    why: 'διακομιστής πλακιδίων (tile(s).… / basemap(s).…)',
  },
]);

/** Γρήγορο πρόφιλτρο στο ωμό κείμενο — **αφαιρεί, ποτέ δεν προσθέτει** (όλα τα μοτίβα το περνούν). */
const PREFILTER = ['{z}', 'style.json', 'pmtiles', 'mapbox://', '://tile', '://basemap'];

const GATE_STATES = Object.freeze({
  /** ⛔ Κ1 — πηγή πλακιδίων έξω από τους δηλωμένους ιδιοκτήτες. */
  UNDECLARED_SOURCE: 'undeclared-source',
  /** ⛔ Κ1′ — δήλωση ιδιοκτήτη για αρχείο που δεν υπάρχει πια. */
  ORPHAN_OWNER: 'orphan-owner',
  /** ⛔ Κ1′ — δήλωση χωρίς ουσιαστικό λόγο. */
  REASONLESS_OWNER: 'reasonless-owner',
  /** ⛔ Κ2 — το μητρώο δεν δηλώνει ΚΑΜΙΑ πηγή: πράσινο με μηδέν προστασία. */
  EMPTY_CATALOG: 'empty-catalog',
  /** ⛔ Κ3 — στρώση `symbol` με `text-field` χωρίς τη στοίβα του μητρώου (ADR-891 §9.5). */
  UNDECLARED_TEXT_FONT: 'undeclared-text-font',
  /** ✅ Δηλωμένος ιδιοκτήτης. */
  OWNER: 'owner',
  /** ✅ Κανένα μοτίβο πηγής. */
  CLEAN: 'clean',
});

const BLOCKING = Object.freeze([
  GATE_STATES.UNDECLARED_SOURCE,
  GATE_STATES.ORPHAN_OWNER,
  GATE_STATES.REASONLESS_OWNER,
  GATE_STATES.EMPTY_CATALOG,
  GATE_STATES.UNDECLARED_TEXT_FONT,
]);

/** Αρχεία που **δεν** κρίνονται: τα tests γράφουν URL πλακιδίων για να ΕΛΕΓΞΟΥΝ το μητρώο. */
function isTestFile(repoRelPosix) {
  return /(^|\/)__tests__\//.test(repoRelPosix) || /\.(test|spec)\.tsx?$/.test(repoRelPosix);
}

module.exports = {
  BLOCKING,
  CATALOG_FILE,
  GATE_STATES,
  MIN_REASON,
  OVERLAY_TEXT_FONT_NAME,
  PREFILTER,
  SOURCE_MARKERS,
  SOURCE_OWNERS,
  isTestFile,
};
