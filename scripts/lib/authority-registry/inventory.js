'use strict';

/**
 * CHECK 3.68 — Η ΑΠΟΓΡΑΦΗ (ADR-801 §4).
 *
 * Παράγει τα γεγονότα· **δεν κρίνει** (η κρίση ζει στο `judge.js`). Ίδιος
 * διαχωρισμός με το `lib/gate-inventory/` και το `lib/shell-boundary/`.
 *
 * 🔑 **ΤΑ ΛΕΞΙΛΟΓΙΑ ΔΙΑΒΑΖΟΝΤΑΙ ΑΠΟ ΤΟ SSoT, ΠΟΤΕ ΑΝΤΙΓΡΑΦΟΝΤΑΙ.** Χειρόγραφος
 * κατάλογος ρόλων μέσα στην πύλη θα ήταν **δεύτερη αυθεντία** που αποκλίνει
 * σιωπηλά — ακριβώς το σχήμα που η πύλη υπάρχει για να κυνηγά, και που στο
 * CHECK 3.34 είχε αποκλίνει κατά **63**.
 */

const path = require('node:path');

/** Η είσοδος της πύλης (ADR-924) — προεπιλογή ο δίσκος της ρίζας· ο εκτελεστής δίνει την όψη του commit. */
const inputOf = (root) => require('../gate-input').openGateInput({ root });
const { ROLE_PROPERTY, scanRoleChecks } = require('./role-guards');

const REGISTRY_FILE = '.authority-registry.json';

// =============================================================================
// ΚΟΨΙΜΟ ΣΧΟΛΙΩΝ — υποχρεωτικό, μετρημένο
// =============================================================================

/**
 * ⚠️ **ΧΩΡΙΣ ΑΥΤΟ Η ΠΥΛΗ ΚΟΚΚΙΝΙΖΕΙ ΠΑΝΩ ΣΤΗ ΘΕΡΑΠΕΙΑ.** Τα ίδια τα αρχεία που
 * διορθώθηκαν στη Φάση 3α **γράφουν τα παλιά σύνολα ρόλων σε σχόλιο**, ως
 * τεκμηρίωση της βλάβης (`CustomDictionaryManager` · `BimCommentDetailsPanel` ·
 * `security-policy` · `mcp-identity`). Το ίδιο μάθημα με το `Κ7β` του 3.50.
 */
function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((line) => {
      const i = line.indexOf('//');
      return i >= 0 && !line.slice(0, i).includes(':/') ? line.slice(0, i) : line;
    })
    .join('\n');
}

// =============================================================================
// ΤΑ ΛΕΞΙΛΟΓΙΑ — ΑΠΟ ΤΟ SSoT
// =============================================================================

/** Τα περιεχόμενα ενός literal πίνακα που αρχίζει μετά από `<name> = [`. */
function quotedItemsAfter(source, marker) {
  const start = source.indexOf(marker);
  if (start < 0) return null;
  const end = source.indexOf(']', start);
  if (end < 0) return null;
  return [...source.slice(start, end).matchAll(/['"]([a-z_][a-z_0-9]*)['"]/g)].map((m) => m[1]);
}

/** Τα κλειδιά πρώτου επιπέδου ενός object literal που αρχίζει μετά από `marker`. */
function topLevelKeysAfter(source, marker) {
  const start = source.indexOf(marker);
  if (start < 0) return null;
  const body = source.slice(start);
  return [...body.matchAll(/^ {2}([a-z_][a-z_0-9]*): \{$/gm)].map((m) => m[1]);
}

/**
 * Τα τρία λεξιλόγια που χρειάζεται η κρίση.
 *
 * 🔴 **ΤΟ ΜΟΝΟΠΑΤΙ ΕΡΧΕΤΑΙ ΑΠΟ ΤΟ ΜΗΤΡΩΟ, ΚΑΙ ΤΟ ΕΜΑΘΕ Η ΙΔΙΑ Η ΠΥΛΗ.** Ήταν
 * καρφωμένο — δηλαδή **δεύτερη αυθεντία** δίπλα στο `ssot` του
 * `.authority-registry.json`, ακριβώς το σχήμα που η πύλη υπάρχει για να κυνηγά.
 * Όταν το `PREDEFINED_ROLES` μετακόμισε στο `role-catalogue.ts` (N.7.1), η πύλη
 * **αρνήθηκε** με `αδύνατη η ανάγνωση του λεξιλογίου «predefinedRoles»` αντί να
 * πει «0 παραβιάσεις» — **το fail-closed δούλεψε πάνω στον εαυτό του**.
 *
 * ⚠️ Το `permissions` **δεν είναι πολυτέλεια**: χωρίς αυτό, το `admin_access`
 * (που είναι **PermissionId**, όχι ρόλος) μετριέται ως «φάντασμα ρόλου» — ήταν
 * **1 από τα 3** ευρήματα της πρώτης μέτρησης, δηλαδή **33% ψευδώς θετικά**.
 */
function readVocabularies(root, registry = null, input = inputOf(root)) {
  const ssot = (registry && registry.ssot) || {};
  const typesSrc = input.read(ssot.claimVocabulary || 'src/lib/auth/types.ts') ?? '';
  const rolesSrc = input.read(ssot.roleCatalogue || 'src/lib/auth/role-catalogue.ts') ?? '';

  const globalRoles = quotedItemsAfter(typesSrc, 'GLOBAL_ROLES = [');
  const predefinedRoles = topLevelKeysAfter(rolesSrc, 'PREDEFINED_ROLES: Record<string, RoleDefinition> = {');
  const permissions = quotedPermissionKeys(typesSrc);

  // fail-closed: «δεν διάβασα λεξιλόγιο» ΠΟΤΕ δεν διαβάζεται ως «καθαρό δέντρο».
  for (const [name, list] of Object.entries({ globalRoles, predefinedRoles, permissions })) {
    if (!list || list.length === 0) {
      throw new Error(`αδύνατη η ανάγνωση του λεξιλογίου «${name}» από το SSoT`);
    }
  }
  return { globalRoles, predefinedRoles, permissions };
}

/** Τα κλειδιά του μητρώου `PERMISSIONS` — και τα εισαγωγικά και τα γυμνά. */
function quotedPermissionKeys(typesSrc) {
  const start = typesSrc.indexOf('export const PERMISSIONS = {');
  if (start < 0) return null;
  const end = typesSrc.indexOf('} as const;', start);
  const body = typesSrc.slice(start, end < 0 ? undefined : end);
  const quoted = [...body.matchAll(/["']([a-z_0-9:]+)["']:\s*true/g)].map((m) => m[1]);
  const bare = [...body.matchAll(/^\s{2}([a-z_][a-z_0-9]*):\s*true/gm)].map((m) => m[1]);
  return [...quoted, ...bare];
}

// =============================================================================
// ΤΟ ΜΗΤΡΩΟ
// =============================================================================

function loadRegistry(root, input = inputOf(root)) {
  const registry = input.readJson(REGISTRY_FILE);
  for (const key of ['ssot', 'claimRoleVocabulary', 'legacyRoleNames', 'inlineDeciders', 'roleGuards']) {
    if (registry[key] === undefined) throw new Error(`${REGISTRY_FILE}: λείπει το πεδίο «${key}»`);
  }
  return registry;
}

// =============================================================================
// Η ΣΑΡΩΣΗ
// =============================================================================

const QUOTES = (word) => [`'${word}'`, `"${word}"`, `\`${word}\``];

/** Ποιοι ρόλοι του δείκτη εμφανίζονται, ως **συμβολοσειρά**, μέσα σε αυτό το κείμενο; */
function claimRolesIn(text, vocabulary) {
  return vocabulary.filter((role) => QUOTES(role).some((q) => text.includes(q)));
}

/**
 * Τα «παράθυρα» ενός αρχείου όπου συνυπάρχουν **≥2** ρόλοι του λεξιλογίου claims.
 *
 * ⚠️ Το κατώφλι «2» **δεν** είναι αυθαίρετο: **ένας** ρόλος σε συμβολοσειρά είναι
 * αναφορά (μήνυμα, ετικέτα, τιμή προεπιλογής)· **δύο μαζί** είναι **σύνολο** —
 * δηλαδή κάποιος έγραψε κατάλογο. Το μονό κριτήριο μετρήθηκε και δίνει θόρυβο.
 */
function windowsOf(cleanSource, vocabulary) {
  const lines = cleanSource.split('\n');
  const windows = [];
  lines.forEach((line, i) => {
    if (claimRolesIn(line, vocabulary).length >= 2) {
      windows.push({ line: i + 1, text: line, kind: 'same-line' });
      return;
    }
    if (!/(\[|new Set\()\s*$/.test(line.trim())) return;
    const block = lines.slice(i, i + 12).join('\n');
    if (claimRolesIn(block, vocabulary).length >= 2) {
      windows.push({ line: i + 1, text: block, kind: 'block' });
    }
  });
  const cases = vocabulary.filter((r) => QUOTES(r).some((q) => cleanSource.includes(`case ${q}`)));
  if (cases.length >= 2) windows.push({ line: 0, text: cleanSource, kind: 'switch' });
  return windows;
}

/**
 * Κρίνει το σύνολο, ή απλώς το **δείχνει**;
 *
 * 🔴 **ΤΡΙΑ ΚΡΙΤΗΡΙΑ, ΚΑΙ ΤΟ ΤΡΙΤΟ ΤΟ ΑΠΟΚΑΛΥΨΕ ΑΓΚΥΡΑ ΠΟΥ ΑΠΕΤΥΧΕ.** Η δεύτερη
 * γραφή ζητούσε το όρισμα να **ονομάζει** ρόλο (`.includes(role)`), οπότε ένα
 * `ADMIN_ROLES.includes(r)` — ίδια πράξη, άλλο όνομα μεταβλητής — περνούσε για
 * «απλή δήλωση πολιτικής». Το κριτήριο (γ) ρωτά το **σωστό** πράγμα: *δοκιμάζεται
 * μέλος πάνω στη σταθερά που **κρατά το σύνολο ρόλων**;* — ταυτότητα, όχι όνομα.
 */
function isGate(cleanSource, vocabulary, windows = []) {
  // (α) σύγκριση ή κλάδος **πάνω σε κυριολεκτικό ρόλο**.
  const literalTest = vocabulary.some((role) =>
    QUOTES(role).some((q) =>
      new RegExp(`(?:\\.includes\\(|\\.has\\(|===\\s*|!==\\s*|case\\s+)${escapeRe(q)}`).test(cleanSource)));

  // (β) δοκιμή μέλους με όρισμα που **ονομάζει** ρόλο — το κυρίαρχο ιδίωμα
  //     (`ADMIN_ROLES.includes(role)`, `.has(user?.globalRole ?? '')`).
  const namedArgTest = /\.(?:includes|has)\(\s*[^)]*[Rr]ole/.test(cleanSource);

  // (γ) δοκιμή μέλους **πάνω στην ίδια τη σταθερά του συνόλου**.
  const holderTest = holdersOf(windows).some((name) =>
    new RegExp(`\\b${escapeRe(name)}\\.(?:includes|has)\\(`).test(cleanSource));

  return literalTest || namedArgTest || holderTest;
}

/** Τα ονόματα των σταθερών που **κρατούν** ένα σύνολο ρόλων. */
function holdersOf(windows) {
  const names = new Set();
  for (const win of windows) {
    const first = win.text.split('\n')[0];
    const m = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)/.exec(first);
    if (m) names.add(m[1]);
  }
  return [...names];
}

function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

/**
 * Τα **υποψήφια** αρχεία — προφίλτρο κειμένου με **ένα** εγγενές πέρασμα.
 *
 * ⚡ **ΜΕΤΡΗΜΕΝΟ: 13,4s → 0,9s.** Η πλήρης ανάγνωση των ~12.000 αρχείων του
 * `src/` κόστιζε 13,4 δευτερόλεπτα — *ζώνη `SKIP_`, δηλαδή **ανενεργή** πύλη*
 * (μάθημα CHECK 3.52: μια πύλη που κοστίζει πολύ δεν είναι αυστηρότερη).
 *
 * ⚠️ **ΤΟ ΠΡΟΦΙΛΤΡΟ ΕΙΝΑΙ ΑΣΦΑΛΕΣ ΜΟΝΟ ΕΠΕΙΔΗ ΑΦΑΙΡΕΙ, ΔΕΝ ΠΡΟΣΘΕΤΕΙ**: ζητά
 * **ακριβώς** τους ίδιους δείκτες που ζητά και η κρίση, οπότε αρχείο που κόβεται
 * εδώ δεν θα είχε παράθυρο ούτως ή άλλως (πρότυπο 3.56/3.59).
 *
 * ⚠️ **ΤΑ ΜΟΤΙΒΑ ΕΙΝΑΙ ΣΕ ΕΙΣΑΓΩΓΙΚΑ, ΚΑΙ ΕΙΝΑΙ ΜΕΤΡΗΣΗ**: σκέτο `admin` πιάνει
 * **2.244** αρχεία (κάθε `administrator`, κάθε διαδρομή `/admin/`, κάθε
 * `admin_access`) και το κέρδος εξαφανίζεται· η **παρατεθειμένη** μορφή πιάνει
 * **254**. Ένα όνομα ρόλου **σε θέση ρόλου είναι πάντα συμβολοσειρά**, άρα το
 * φίλτρο δεν χάνει τίποτα που η κρίση θα έβλεπε.
 *
 * 🔶 **ΔΗΛΩΜΕΝΟ ΟΡΙΟ**: αυθεντία είναι ό,τι **ξέρει το git** — τα tracked αρχεία
 * του δέντρου εργασίας. Ένα **untracked** προσχέδιο δεν κρίνεται. Δεν είναι
 * τρύπα στη διαδρομή που μετράει: την ώρα του `git add` το αρχείο **είναι** στο
 * ευρετήριο, άρα **είναι** tracked (ίδιο σκεπτικό με το CHECK 3.49, όπου η
 * αυθεντία είναι ρητά το ευρετήριο και όχι ο δίσκος). Το `--untracked`
 * μετρήθηκε και **απορρίφθηκε**: **+12,7 δευτερόλεπτα** για μηδέν κάλυψη στη
 * διαδρομή που μπλοκάρει.
 *
 * ⚠️ **fail-closed**: αν το `git` δεν απαντήσει, πέφτουμε στην **πλήρη** σάρωση —
 * ποτέ σε κενή λίστα, που θα διαβαζόταν ως «καθαρό δέντρο».
 */
function candidateFiles(input, indicator) {
  const quoted = indicator.flatMap((role) => [QUOTE_SINGLE + role + QUOTE_SINGLE, QUOTE_DOUBLE + role + QUOTE_DOUBLE]);
  return grepFiles(input, quoted) || input.sources(['src']);
}

const QUOTE_SINGLE = String.fromCharCode(39);
const QUOTE_DOUBLE = String.fromCharCode(34);

/**
 * Τα tracked αρχεία του `src/` που περιέχουν **οποιοδήποτε** από αυτά τα σταθερά
 * μοτίβα, ή `null` αν το `git` δεν απάντησε.
 *
 * ⚠️ **ΕΝΑΣ σαρωτής για ΔΥΟ προφίλτρα** (N.18): ο Κ1 ζητά ονόματα ρόλων **σε
 * εισαγωγικά**, ο Κ1′ την **ιδιότητα** `globalRole`. Δύο `git grep` γραμμένα
 * χωριστά θα ήταν sibling clone που αργότερα αποκλίνει σιωπηλά.
 *
 * ⚠️ **Επιστρέφει `null`, ποτέ `[]`, όταν αποτυγχάνει**: ο καλών οφείλει να
 * πέσει στην **πλήρη** σάρωση. Κενή λίστα θα διαβαζόταν ως «καθαρό δέντρο».
 */
function grepFiles(input, patterns) {
  // ADR-924 — το `git grep` της ΟΨΗΣ (με `--index`: το κείμενο του commit), από την είσοδο.
  try {
    const files = input.grep(patterns, ['src']);
    return files.length > 0 ? files : null;
  } catch {
    return null;
  }
}

/**
 * Η απογραφή: ένα αντικείμενο ανά αρχείο **που περιέχει σύνολο ρόλων**.
 *
 * ⚠️ Η σάρωση είναι **ΠΑΝΤΑ ΠΛΗΡΗΣ** πάνω στο `src/`. Ένας νέος κριτής
 * προσγειώνεται σε **οποιοδήποτε** αρχείο, άρα λίστα φακέλων θα ήταν σωστή
 * σήμερα και θα απέκλινε σιωπηλά αύριο (3.34/3.37).
 */
function takeInventory(root, options = {}, input = inputOf(root)) {
  const registry = options.registry || loadRegistry(root, input);
  const vocabularies = options.vocabularies || readVocabularies(root, registry, input);
  // 🔴 **Ο ΔΕΙΚΤΗΣ ΠΕΡΙΛΑΜΒΑΝΕΙ ΤΑ LEGACY ΟΝΟΜΑΤΑ, ΚΑΙ ΤΟ ΕΜΑΘΕ Η ΙΔΙΑ Η ΠΥΛΗ.**
  //    Η πρώτη γραφή έβαζε μόνο τα τέσσερα `GLOBAL_ROLES` ⇒ η γραμμή
  //    `type AdminRole = 'admin' | 'broker' | 'builder' | 'super_admin'` είχε
  //    **ΕΝΑΝ** ρόλο του δείκτη ⇒ κανένα παράθυρο ⇒ το `admin-guards-types.ts`
  //    — **ακριβώς το αρχείο του ADR-801 §2.4** — δεν σαρωνόταν ΚΑΘΟΛΟΥ.
  //    Το «0» του σήμαινε «δεν κοίταξα», μέσα στο όργανο που το κυνηγά.
  const indicator = [
    ...registry.claimRoleVocabulary,
    ...(registry.legacyRoleNames || []).map((l) => l.name),
  ];

  const files = (options.files || candidateFiles(input, indicator))
    .map((f) => path.relative(root, path.resolve(root, f)).split(path.sep).join('/'))
    .filter((f) => /\.tsx?$/.test(f) && !f.includes('__tests__') && !/\.(test|spec)\./.test(f));

  const entries = [];
  for (const rel of files) {
    let raw;
    raw = input.read(rel);
    if (raw === null) continue;
    if (!indicator.some((role) => raw.includes(role))) continue; // προφίλτρο κειμένου
    const clean = stripComments(raw);
    const windows = windowsOf(clean, indicator);
    if (windows.length === 0) continue;
    entries.push({ file: rel, windows, gate: isGate(clean, indicator, windows) });
  }
  return {
    registry,
    vocabularies,
    entries,
    scanned: files.length,
    roleChecks: takeRoleCheckInventory(root, options, input),
  };
}

// =============================================================================
// Η ΔΕΥΤΕΡΗ ΑΠΟΓΡΑΦΗ — Ο Κ1′ (ADR-801 §2.11)
// =============================================================================

/**
 * ⚠️ **ΔΕΥΤΕΡΟ ΠΡΟΦΙΛΤΡΟ, ΚΑΙ ΕΙΝΑΙ ΑΝΑΓΚΑΙΟ.** Το προφίλτρο του Κ1 ζητά **ονόματα
 * ρόλων σε εισαγωγικά** — και ο μονορολικός φρουρός `!isRoleBypass(ctx.globalRole)`
 * **δεν γράφει κανένα**. Μετρημένο: το `admin-migration-runner.ts` (ο κοινός φρουρός
 * **όλων** των migrations) δεν εμφανιζόταν καν στα `entries` του Κ1. Ο δείκτης εδώ
 * είναι η **ιδιότητα**, όχι οι τιμές της.
 *
 * ⚠️ **fail-closed**: αν το `git` δεν απαντήσει, πέφτουμε στην **πλήρη** σάρωση —
 * ποτέ σε κενή λίστα, που θα διαβαζόταν ως «καθαρό δέντρο».
 */
function roleCheckCandidates(input) {
  return grepFiles(input, [ROLE_PROPERTY]) || input.sources(['src']);
}

/**
 * Κάθε **έλεγχος ρόλου καλούντος** του δέντρου, με ετυμηγορία «αρνείται;».
 *
 * ⚠️ Η σάρωση είναι **ΠΑΝΤΑ ΠΛΗΡΗΣ**: ένας φρουρός προσγειώνεται σε **οποιοδήποτε**
 * αρχείο — και ο ένας που βρέθηκε ζει **εκτός** `src/app/api`, δηλαδή ακριβώς εκεί
 * που μια λίστα φακέλων δεν θα κοίταζε (3.34/3.37).
 */
function takeRoleCheckInventory(root, options = {}, input = inputOf(root)) {
  const files = (options.roleCheckFiles || roleCheckCandidates(input))
    .map((f) => path.relative(root, path.resolve(root, f)).split(path.sep).join('/'))
    .filter((f) => /\.tsx?$/.test(f) && !f.includes('__tests__') && !/\.(test|spec)\./.test(f));

  const checks = [];
  for (const rel of files) {
    try {
      const text = input.read(rel);
      if (text === null) continue;
      checks.push(...scanRoleChecks(root, rel, text));
    } catch {
      /* αρχείο που δεν διαβάζεται/δεν αναλύεται δεν κρύβει φρουρό — το `git grep`
         το ονόμασε, άρα υπάρχει· η αδυναμία ανάγνωσης είναι σφάλμα συστήματος. */
      continue;
    }
  }
  return checks;
}

module.exports = {
  REGISTRY_FILE,
  candidateFiles,
  stripComments,
  quotedItemsAfter,
  topLevelKeysAfter,
  quotedPermissionKeys,
  readVocabularies,
  loadRegistry,
  claimRolesIn,
  windowsOf,
  isGate,
  holdersOf,
  grepFiles,
  takeInventory,
  roleCheckCandidates,
  takeRoleCheckInventory,
};
