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

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const { collectSourceFiles } = require('../module-graph/scan-config');

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
 * ⚠️ Το `permissions` **δεν είναι πολυτέλεια**: χωρίς αυτό, το `admin_access`
 * (που είναι **PermissionId**, όχι ρόλος) μετριέται ως «φάντασμα ρόλου» — ήταν
 * **1 από τα 3** ευρήματα της πρώτης μέτρησης, δηλαδή **33% ψευδώς θετικά**.
 */
function readVocabularies(root) {
  const typesSrc = fs.readFileSync(path.join(root, 'src/lib/auth/types.ts'), 'utf8');
  const rolesSrc = fs.readFileSync(path.join(root, 'src/lib/auth/roles.ts'), 'utf8');

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

function loadRegistry(root) {
  const file = path.join(root, REGISTRY_FILE);
  const raw = fs.readFileSync(file, 'utf8');
  const registry = JSON.parse(raw);
  for (const key of ['ssot', 'claimRoleVocabulary', 'legacyRoleNames', 'inlineDeciders']) {
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

/** Κρίνει το σύνολο, ή απλώς το **δείχνει**; */
function isGate(cleanSource, vocabulary) {
  // (α) σύγκριση ή κλάδος **πάνω σε κυριολεκτικό ρόλο**.
  const literalTest = vocabulary.some((role) =>
    QUOTES(role).some((q) =>
      new RegExp(`(?:\\.includes\\(|\\.has\\(|===\\s*|!==\\s*|case\\s+)${escapeRe(q)}`).test(cleanSource)));

  // (β) δοκιμή **μέλους σε σύνολο**, με όρισμα που ονομάζει ρόλο.
  //     ⚠️ Χωρίς αυτό, το κυρίαρχο ιδίωμα `ADMIN_ROLES.includes(role)` περνούσε
  //     για «απλή δήλωση πολιτικής»: το `pending-registration.ts` και το
  //     `email-inbound-service.ts` έβγαιναν **αθώα ενώ κρίνουν**.
  const membershipTest = /\.(?:includes|has)\(\s*[^)]*[Rr]ole/.test(cleanSource);

  return literalTest || membershipTest;
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
function candidateFiles(root, indicator) {
  const args = indicator.flatMap((role) => ['-e', `'${role}'`, '-e', `"${role}"`]);
  try {
    const out = execFileSync(
      'git',
      ['grep', '-l', '-I', '-F', ...args, '--', 'src'],
      { cwd: root, encoding: 'utf8', maxBuffer: 64 << 20 },
    );
    const files = out.split('\n').filter(Boolean);
    if (files.length > 0) return files;
  } catch {
    /* git grep επιστρέφει 1 όταν δεν βρει τίποτα — και τότε πέφτουμε παρακάτω */
  }
  return collectSourceFiles(root, ['src']);
}

/**
 * Η απογραφή: ένα αντικείμενο ανά αρχείο **που περιέχει σύνολο ρόλων**.
 *
 * ⚠️ Η σάρωση είναι **ΠΑΝΤΑ ΠΛΗΡΗΣ** πάνω στο `src/`. Ένας νέος κριτής
 * προσγειώνεται σε **οποιοδήποτε** αρχείο, άρα λίστα φακέλων θα ήταν σωστή
 * σήμερα και θα απέκλινε σιωπηλά αύριο (3.34/3.37).
 */
function takeInventory(root, options = {}) {
  const registry = options.registry || loadRegistry(root);
  const vocabularies = options.vocabularies || readVocabularies(root);
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

  const files = (options.files || candidateFiles(root, indicator))
    .map((f) => path.relative(root, path.resolve(root, f)).split(path.sep).join('/'))
    .filter((f) => /\.tsx?$/.test(f) && !f.includes('__tests__') && !/\.(test|spec)\./.test(f));

  const entries = [];
  for (const rel of files) {
    let raw;
    try { raw = fs.readFileSync(path.join(root, rel), 'utf8'); } catch { continue; }
    if (!indicator.some((role) => raw.includes(role))) continue; // προφίλτρο κειμένου
    const clean = stripComments(raw);
    const windows = windowsOf(clean, indicator);
    if (windows.length === 0) continue;
    entries.push({ file: rel, windows, gate: isGate(clean, indicator) });
  }
  return { registry, vocabularies, entries, scanned: files.length };
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
  takeInventory,
};
