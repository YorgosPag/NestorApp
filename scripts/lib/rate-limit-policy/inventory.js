#!/usr/bin/env node
/**
 * CHECK 3.78 — Η ΑΠΟΓΡΑΦΗ ΤΩΝ ΠΟΛΙΤΙΚΩΝ ΡΥΘΜΟΥ (ADR-855 Α5). Η **παραγωγή**, χωρίς κρίση.
 *
 * Δύο ερωτήματα, μετρημένα ανά διαδρομή:
 *   1. **ΔΗΛΩΝΕΙ** αυτή η διαδρομή βαθμίδα ορίου;
 *   2. Αν δηλώνει, **ΣΥΜΦΩΝΕΙ** με ό,τι θα επιβληθεί στην πράξη;
 *
 * Η κρίση ζει στο `judge.js`· εδώ μόνο «τι λέει το δέντρο». Καθαρό: η σουίτα το οδηγεί με
 * συνθετικές εισόδους.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΑΦΕΛΕΣ ΚΡΙΤΗΡΙΟ ΜΕΤΡΗΘΗΚΕ ΚΑΙ ΑΠΟΡΡΙΦΘΗΚΕ — 49% ΨΕΥΔΩΣ ΘΕΤΙΚΑ
 * ─────────────────────────────────────────────────────────────────────────────
 * Η πρώτη γραφή ρώτησε *«έχει αυτό το αρχείο wrapper;»* και έδωσε **152 αδήλωτες**. Λάθος
 * ερώτηση: **75** διαδρομές δηλώνουν βαθμίδα **έμμεσα**, μέσα από εργοστάσιο που τυλίγει
 * το ίδιο (`defineRoute` 40 · `createScanCronRoute` 14 · `createPublicTokenRouteExport` 6 ·
 * `createShowcaseEmailRoute` 5 · `createMigrationRoute` 4 · `createMetaWebhookRoute` 3 ·
 * `createQueueCronRoute` 2 · `adminDirectOperationWrite` 1).
 *
 * ⇒ Ο πραγματικός πληθυσμός είναι **77**, όχι 152. Με το αφελές κριτήριο η πύλη θα
 * γεννιόταν με **49%** ψευδώς θετικά — πενταπλάσια του πήχη <10% που αυτό το δέντρο
 * απαιτεί για μπλοκάρουσα πύλη (3.61 · 3.68 · 3.76).
 *
 * ⚠️ **ΚΑΘΕ ΟΝΟΜΑ ΕΡΓΟΣΤΑΣΙΟΥ ΕΠΑΛΗΘΕΥΤΗΚΕ ΕΚΤΕΛΩΝΤΑΣ grep ΣΤΗΝ ΠΗΓΗ ΤΟΥ**, ποτέ
 *    μαντεμένο: το κλειστό σύνολο είναι το σημείο όπου μια λάθος υπόθεση γίνεται σιωπηλή
 *    κάλυψη. Νέο εργοστάσιο ⇒ γραμμή εδώ, αλλιώς οι διαδρομές του μετρώνται σιωπηλές.
 *
 * @module scripts/lib/rate-limit-policy/inventory
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

/** Ο φάκελος των διαδρομών — η μόνη πηγή του πληθυσμού. */
const ROUTES_DIR = 'src/app/api';
/** Η αυθεντία των βαθμίδων και του πίνακα προθεμάτων. */
const CONFIG_FILE = 'src/lib/middleware/rate-limit-config.ts';

/**
 * Τα επτά περιτυλίγματα + η ωμή μορφή. **Άμεση** δήλωση.
 *
 * ⚠️ Η σειρά έχει σημασία: το `withRateLimit` είναι **πρόθεμα** των άλλων επτά, οπότε
 * ελέγχεται **τελευταίο** — αλλιώς κάθε `withHeavyRateLimit(` θα μετρούσε ως ωμό.
 */
const WRAPPERS = Object.freeze([
  ['withAssetRateLimit', 'ASSET'],
  ['withHighRateLimit', 'HIGH'],
  ['withStandardRateLimit', 'STANDARD'],
  ['withSensitiveRateLimit', 'SENSITIVE'],
  ['withHeavyRateLimit', 'HEAVY'],
  ['withWebhookRateLimit', 'WEBHOOK'],
  ['withTelegramRateLimit', 'TELEGRAM'],
]);

/**
 * Εργοστάσια που τυλίγουν **μόνα τους** σε όριο ρυθμού — η δήλωση ζει εκεί, όχι στη
 * διαδρομή. **ΚΛΕΙΣΤΟ ΣΥΝΟΛΟ, με επαληθευμένα ονόματα.**
 */
const FACTORIES = Object.freeze([
  // showcase-core (ADR-698)
  'createPublicTokenRouteExport',
  'createUnifiedPublicShowcasePdfRoute',
  'createUnifiedPublicShowcasePayloadRoute',
  'createShowcasePdfRoute',
  'createShowcaseEmailRoute',
  // lib/api (ADR-245)
  'defineRoute',
  'runGuarded',
  'entityIdRoute',
  'segmentIdRoute',
  'buildingScopedRoute',
  'createSpaceEntityRoutes',
  'trashListRoute',
  'migrationEndpoint',
  // lib/api (ADR-801 §2.11)
  'adminDirectOperationWrite',
  'adminDirectOperationRead',
  // lib/cron · lib/communications · lib/admin-migration-runner
  'createScanCronRoute',
  'createQueueCronRoute',
  'createMetaWebhookRoute',
  'createMigrationRoute',
  // dxf (ADR-663)
  'makeDxfRouteRunner',
]);

// =============================================================================
// Ο ΠΙΝΑΚΑΣ ΠΡΟΘΕΜΑΤΩΝ — ΔΙΑΒΑΖΕΤΑΙ, ΠΟΤΕ ΑΝΤΙΓΡΑΦΕΤΑΙ
// =============================================================================

/**
 * Οι σταθερές που ο πίνακας χρησιμοποιεί ως **υπολογισμένα κλειδιά**
 * (`[API_ROUTES.SEARCH]: 'HIGH'`), και πού ζει η τιμή τους.
 *
 * 🔴 **ΓΙΑΤΙ ΕΠΙΛΥΟΝΤΑΙ ΚΑΙ ΔΕΝ ΔΗΛΩΝΟΝΤΑΙ ΩΣ «ΔΕΝ ΞΕΡΩ» — ΜΕΤΡΗΜΕΝΟ**: η πρώτη γραφή τα
 * άφηνε ανεπίλυτα, και η πύλη κατήγγελλε **τρεις** διαδρομές που είναι **εντάξει**
 * (`/api/search` · `/api/projects/list` · `/api/notifications/email/subscription`) — 3
 * ψευδώς θετικά σε 80, δηλαδή 3,75%. Κάτω από τον πήχη του <10%, **και παρ' όλα αυτά
 * λάθος**: μια πύλη που καταγγέλλει σωστό κώδικα εκπαιδεύει τον αναγνώστη να τη σβήνει,
 * και ο επόμενος που θα δει «/api/search: απόκλιση» θα ψάξει σφάλμα που δεν υπάρχει.
 *
 * ⚠️ **ΚΛΕΙΣΤΟ ΣΥΝΟΛΟ ΜΕ ΕΠΑΛΗΘΕΥΜΕΝΗ ΠΗΓΗ**: κάθε εγγραφή δείχνει σε αρχείο που
 *    **διαβάζεται**. Νέο υπολογισμένο κλειδί που δεν είναι εδώ μένει `unresolved` και
 *    **δηλώνεται** — ποτέ δεν μαντεύεται (N.12).
 */
const COMPUTED_KEY_SOURCES = Object.freeze({
  'API_ROUTES.SEARCH': {
    file: 'src/config/domain-constants.ts',
    name: 'SEARCH',
    expect: '/api/search',
  },
  'API_ROUTES.PROJECTS.LIST': {
    file: 'src/config/domain-constants.ts',
    name: 'LIST',
    expect: '/api/projects/list',
  },
  EMAIL_SUBSCRIPTION_API: {
    file: 'src/lib/notifications/email-subscription-routes.ts',
    name: 'EMAIL_SUBSCRIPTION_API',
    expect: '/api/notifications/email/subscription',
  },
});

/**
 * Η τιμή μιας υπολογισμένης σταθεράς — **επαληθευμένη στην πηγή**, ή `null`.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ «ΔΗΛΩΜΕΝΗ ΠΡΟΣΔΟΚΙΑ» ΚΑΙ ΟΧΙ ΑΝΑΖΗΤΗΣΗ ΟΝΟΜΑΤΟΣ — ΤΟ ΠΛΗΡΩΣΑ ΑΜΕΣΩΣ
 * ─────────────────────────────────────────────────────────────────────────────
 * Η πρώτη γραφή έψαχνε `\bLIST\s*[:=]\s*'(/api/…)'` και έπαιρνε το **πρώτο** ταίριασμα.
 * Μετρημένο: το `LIST:` εμφανίζεται **πέντε** φορές στο `domain-constants.ts`
 * (`BACKUP` · `COMPANIES` · `PROJECTS` · `PROCUREMENT` · `BUILDINGS`) ⇒ το
 * `API_ROUTES.PROJECTS.LIST` επιλύθηκε σε **`/api/admin/backup/list`**.
 *
 * Και το λάθος **κρύφτηκε**: το πρόθεμα `/api/admin` προηγείται στο `startsWith`, οπότε
 * το λανθασμένο πρόθεμα δεν άλλαξε καμία ετυμηγορία — ενώ το `/api/projects/list` έμενε
 * ψευδώς θετικό. Ένα σφάλμα που **δεν φαίνεται στους αριθμούς** είναι ακριβώς το σχήμα
 * που αυτή η πύλη υπάρχει για να κλείσει.
 *
 * ⇒ Η ταυτότητα δεν είναι το όνομα, είναι το **ζεύγος ονόματος και τιμής**: δηλώνουμε τι
 *   περιμένουμε, και η πηγή το **βεβαιώνει**. Αν δεν το βεβαιώνει, το κλειδί μένει
 *   `unresolved` και **δηλώνεται** — ποτέ δεν μπαίνει λάθος πρόθεμα στον πίνακα (N.12:
 *   «άγνωστο ≠ κενό», και εδώ «άγνωστο ≠ μαντεμένο»).
 *
 * ⚠️ Το `expect` **δεν** είναι αντίγραφο της αυθεντίας: είναι **ισχυρισμός** που ελέγχεται.
 *    Αν κάποιος αλλάξει τη σταθερά, η επίλυση αποτυγχάνει **θορυβωδώς** αντί να σιωπήσει.
 */
function resolveComputedKey(root, expression) {
  const source = COMPUTED_KEY_SOURCES[expression.trim()];
  if (!source) return null;

  const text = fs.readFileSync(path.join(root, source.file), 'utf8');
  // Το ζεύγος **μαζί**: `<name>: '<expect>'`. Ένα από τα δύο μόνο δεν αρκεί.
  const escaped = source.expect.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`\\b${source.name}\\s*[:=]\\s*'${escaped}'`);
  return re.test(text) ? source.expect : null;
}

/**
 * Διαβάζει το `ENDPOINT_CATEGORY_MAPPINGS` από την **πηγή**.
 *
 * 🔴 **ΓΙΑΤΙ ΟΧΙ ΑΝΤΙΓΡΑΦΟ ΕΔΩ**: ένας δεύτερος πίνακας θα συμφωνούσε την πρώτη μέρα και
 * θα απέκλινε την πρώτη φορά που κάποιος πρόσθετε πρόθεμα — και τότε η πύλη θα έκρινε με
 * **δικό της** φανταστικό πίνακα, δηλαδή θα επικύρωνε τον εαυτό της. Είναι **ακριβώς** το
 * σχήμα που το ADR-855 ήρθε να λύσει: τέσσερα έγγραφα που περιέγραφαν όρια τα οποία ο
 * κώδικας δεν επέβαλλε.
 *
 * ⚠️ Κλειδί σε αγκύλες (`[API_ROUTES.SEARCH]: 'HIGH'`) **δεν** λύνεται στατικά — και δεν
 *    μαντεύεται: καταγράφεται ρητά ως `unresolved`, ώστε το «δεν ξέρω» να μη γίνεται ποτέ
 *    «δεν υπάρχει» (N.12).
 */
function readPrefixTable(root) {
  const text = fs.readFileSync(path.join(root, CONFIG_FILE), 'utf8');
  const open = text.indexOf('ENDPOINT_CATEGORY_MAPPINGS');
  if (open < 0) throw new Error(`${CONFIG_FILE}: δεν βρέθηκε το ENDPOINT_CATEGORY_MAPPINGS.`);
  const body = text.slice(open, text.indexOf('\n};', open));

  const prefixes = [];
  const unresolved = [];
  for (const line of body.split(/\r?\n/)) {
    if (/^\s*\/\//.test(line)) continue;
    const quoted = line.match(/^\s*'([^']+)'\s*:\s*'([A-Z]+)'/);
    if (quoted) { prefixes.push({ prefix: quoted[1], category: quoted[2] }); continue; }

    const computed = line.match(/^\s*\[([^\]]+)\]\s*:\s*'([A-Z]+)'/);
    if (!computed) continue;

    // Το υπολογισμένο κλειδί **επιλύεται από την πηγή του**· αν δεν γίνεται, δηλώνεται.
    const resolved = resolveComputedKey(root, computed[1]);
    if (resolved) {
      prefixes.push({ prefix: resolved, category: computed[2], from: computed[1].trim() });
    } else {
      unresolved.push({ expression: computed[1].trim(), category: computed[2] });
    }
  }
  if (prefixes.length === 0) throw new Error(`${CONFIG_FILE}: ο πίνακας διαβάστηκε κενός.`);
  return { prefixes, unresolved };
}

/** Η προεπιλογή, διαβασμένη από την πηγή — ποτέ καρφωμένο `'STANDARD'`. */
function readDefaultCategory(root) {
  const text = fs.readFileSync(path.join(root, CONFIG_FILE), 'utf8');
  const m = text.match(/DEFAULT_RATE_LIMIT_CATEGORY\s*:\s*RateLimitCategory\s*=\s*'([A-Z]+)'/);
  if (!m) throw new Error(`${CONFIG_FILE}: δεν βρέθηκε το DEFAULT_RATE_LIMIT_CATEGORY.`);
  return m[1];
}

/**
 * Τι επιβάλλει ο πίνακας για αυτή τη διεύθυνση.
 *
 * ⚠️ **`startsWith` και σειρά εισαγωγής** — ακριβώς όπως ο `getEndpointCategory` της
 *    παραγωγής. Μια «βελτιωμένη» αντιστοίχιση εδώ (π.χ. πιο μακρύ πρόθεμα πρώτα) θα
 *    έκρινε πολιτική **που δεν ισχύει**.
 */
function enforcedCategory(url, table, fallback) {
  for (const { prefix, category } of table.prefixes) {
    if (url.startsWith(prefix)) return category;
  }
  return fallback;
}

// =============================================================================
// Ο ΠΛΗΘΥΣΜΟΣ
// =============================================================================

function walkRoutes(dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkRoutes(full, out);
    else if (entry.name === 'route.ts') out.push(full);
  }
  return out;
}

/** `src/app/api/foo/[id]/route.ts` → `/api/foo/[id]` */
function urlOf(file, root) {
  const rel = path
    .relative(path.join(root, ROUTES_DIR), file)
    .split(path.sep)
    .join('/')
    .replace(/\/?route\.ts$/, '');
  return '/api' + (rel ? '/' + rel : '');
}

/**
 * Πώς δηλώνει αυτό το αρχείο — και **τι** δηλώνει.
 *
 * ⚠️ Το ρητό `category: 'X'` ελέγχεται **πρώτο**: μια διαδρομή που γράφει
 *    `withRateLimit(h, { category: 'HEAVY' })` δηλώνει HEAVY, όχι «ωμό».
 */
/**
 * Καλείται αυτό το όνομα εδώ — **με ή χωρίς παράμετρο τύπου**;
 *
 * 🔴 **ΓΙΑΤΙ ΟΧΙ `source.includes(name + '(')`, ΚΑΙ ΓΙΑΤΙ ΤΟ ΞΕΡΟΥΜΕ ΜΕΤΡΗΜΕΝΑ**: η πρώτη
 * εκδοχή αυτής της μηχανής ρωτούσε ακριβώς έτσι, και **η ίδια της η πύλη την έπιασε την
 * πρώτη μέρα**. Το `withSensitiveRateLimit<Segment>(` της
 * `workspace-invitations/[invitationId]/revoke` **δηλώνει κανονικά** — απλώς δηλώνει με
 * generic, οπότε ανάμεσα στο όνομα και την παρένθεση δεν υπάρχει μόνο κενό. Η διαδρομή
 * καταγγέλθηκε ως `undeclared` ενώ ήταν **σωστή**.
 *
 * ⚠️ **ΚΑΙ ΔΕΝ ΗΤΑΝ ΜΟΝΗ ΤΗΣ**: grep στο δέντρο βρίσκει **δύο** μορφές με παράμετρο τύπου
 * (`withSensitiveRateLimit<Segment>` · `withHeavyRateLimit<RouteContext>`) ⇒ ένα ψευδώς
 * θετικό που θα έστελνε τον επόμενο να «διορθώσει» κώδικα που ήταν ήδη σωστός — και,
 * χειρότερα, θα είχε **φουσκώσει τη baseline** με διαδρομές που δηλώνουν κανονικά.
 *
 * `[^()]*` και όχι `[^>]*`: δέχεται φωλιασμένο `<Foo<Bar>>`, σταματά στην παρένθεση.
 */
function invokes(source, name) {
  return new RegExp(`\\b${name}\\s*(?:<[^()]*>)?\\s*\\(`).test(source);
}

function classifyDeclaration(source) {
  const explicit = source.match(/category:\s*'([A-Z]+)'/);
  if (explicit) return { kind: 'direct', declared: explicit[1] };

  for (const [name, category] of WRAPPERS) {
    if (invokes(source, name)) return { kind: 'direct', declared: category };
  }
  if (invokes(source, 'withRateLimit')) return { kind: 'direct', declared: null };

  const factory = FACTORIES.find((f) => invokes(source, f));
  if (factory) return { kind: 'factory', declared: null, factory };

  return { kind: 'silent', declared: null };
}

/**
 * Η απογραφή: κάθε διαδρομή, τι δηλώνει, τι επιβάλλεται.
 *
 * @param {string} root
 * @param {{files?: Array<{file:string, source:string}>, table?: object, fallback?: string}} [override]
 *        — μόνο για τη σουίτα· η παραγωγή διαβάζει πάντα από τον δίσκο.
 */
function takeInventory(root, override = {}) {
  const table = override.table ?? readPrefixTable(root);
  const fallback = override.fallback ?? readDefaultCategory(root);

  const files = override.files
    ?? walkRoutes(path.join(root, ROUTES_DIR), []).map((file) => ({
      file: path.relative(root, file).split(path.sep).join('/'),
      url: urlOf(file, root),
      source: fs.readFileSync(file, 'utf8'),
    }));

  const routes = files.map((entry) => {
    const url = entry.url ?? entry.file;
    const declaration = classifyDeclaration(entry.source);
    return {
      url,
      file: entry.file,
      ...declaration,
      enforced: enforcedCategory(url, table, fallback),
    };
  });

  return { routes, table, fallback };
}

module.exports = {
  ROUTES_DIR,
  CONFIG_FILE,
  WRAPPERS,
  FACTORIES,
  COMPUTED_KEY_SOURCES,
  resolveComputedKey,
  readPrefixTable,
  readDefaultCategory,
  enforcedCategory,
  classifyDeclaration,
  urlOf,
  takeInventory,
};
