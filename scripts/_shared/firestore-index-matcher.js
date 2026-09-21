/**
 * Firestore Index Matcher — maps query shapes to composite indexes.
 *
 * Consumed by scripts/check-firestore-index-coverage.js (pre-commit CHECK 3.15).
 * Reads firestore.indexes.json and determines whether a derived query shape
 * can be served by an existing composite index.
 *
 * Semantics (Firestore composite indexing, simplified):
 *   - A single-field query (one where OR one orderBy) does not require a
 *     composite index — Firestore auto-indexes every single field.
 *   - A multi-field query requires an index whose leading slots cover the
 *     equality (==/in) filters — in any order within the equality prefix —
 *     followed by the orderBy fields in the exact order and direction of
 *     the query. A longer index (extra trailing fields) still covers the
 *     query via prefix match.
 *   - Array-contains filters are treated as "unanalyzable" for v1 and
 *     skipped (callers should flag the call-site so a human can verify).
 *
 * This module is dependency-free (Node stdlib only) so it is safe to
 * require from any pre-commit context — no build step, no transpile.
 *
 * @module scripts/_shared/firestore-index-matcher
 */

'use strict';

const fs = require('node:fs');

/**
 * @typedef {Object} IndexField
 * @property {string} fieldPath
 * @property {'ASCENDING'|'DESCENDING'|'ARRAY_CONTAINS'} order
 */

/**
 * @typedef {Object} IndexEntry
 * @property {string} collectionGroup
 * @property {string} queryScope
 * @property {IndexField[]} fields
 */

/**
 * @typedef {{field: string, direction: 'ASCENDING'|'DESCENDING'}} OrderBySpec
 */

/**
 * @typedef {Object} QueryShape
 * @property {string}            collection          Firestore collection name (not key).
 * @property {string[]}          equalityFields      Distinct fields with equality (==) filters.
 * @property {OrderBySpec[]}     orderBy             Ordered list of orderBy clauses.
 * @property {string|null}       arrayContainsField  Optional array-contains field (v1: treated as unanalyzable).
 * @property {string[]}          [rangeFields]       Distinct fields carrying a range/inequality
 *                                                   filter (`<` `<=` `>` `>=` `!=` `not-in`).
 *                                                   Απόν ή κενό ⇒ ερώτημα χωρίς εύρος.
 * @property {'default'|'super_admin'} variant       Which tenant variant this shape represents.
 */

/**
 * Load firestore.indexes.json and index its entries by collectionGroup.
 *
 * @param {string} indexesFilePath Absolute path to firestore.indexes.json.
 * @returns {Map<string, IndexEntry[]>} Map from collection name → index entries.
 */
function loadIndexCatalog(indexesFilePath) {
  const raw = fs.readFileSync(indexesFilePath, 'utf8');
  const parsed = JSON.parse(raw);
  const indexes = Array.isArray(parsed.indexes) ? parsed.indexes : [];

  /** @type {Map<string, IndexEntry[]>} */
  const byCollection = new Map();

  for (const idx of indexes) {
    if (!idx || typeof idx.collectionGroup !== 'string') continue;
    if (!Array.isArray(idx.fields) || idx.fields.length === 0) continue;

    /** @type {IndexField[]} */
    const fields = idx.fields.map((f) => {
      if (f.arrayConfig === 'CONTAINS') {
        return { fieldPath: f.fieldPath, order: 'ARRAY_CONTAINS' };
      }
      return {
        fieldPath: f.fieldPath,
        order: f.order === 'DESCENDING' ? 'DESCENDING' : 'ASCENDING',
      };
    });

    /** @type {IndexEntry} */
    const entry = {
      collectionGroup: idx.collectionGroup,
      queryScope: idx.queryScope || 'COLLECTION',
      fields,
    };

    const list = byCollection.get(entry.collectionGroup) || [];
    list.push(entry);
    byCollection.set(entry.collectionGroup, list);
  }

  return byCollection;
}

/**
 * **Ο ΕΝΑΣ κριτής: ποιον δείκτη απαιτεί αυτό το σχήμα;**
 *
 * ═══ 🔴 ADR-870 — Ο ΚΑΝΟΝΑΣ ΔΙΟΡΘΩΘΗΚΕ, ΜΕΤΡΗΜΕΝΑ ΖΩΝΤΑΝΑ (2026-09-21) ═══════════════
 *
 * Η προηγούμενη εκδοχή έγραφε: «ισότητες → **πεδίο εύρους** → υπόλοιπα orderBy», και ότι
 * ρητό πρώτο `orderBy` σε **άλλο** πεδίο από το εύρος είναι **άκυρο ερώτημα που σκάει**.
 * Αυτό είναι ο **παλιός** κανόνας του Firestore — τον γράφει ακόμη η δημόσια τεκμηρίωση
 * (`order-limit-data`: «your first ordering must be on the same field»), αλλά η **μηχανή**
 * τον έχει καταργήσει από την υποστήριξη πολλαπλών ανισοτήτων.
 *
 * **Τι μετρήθηκε** (project `pagonis-87766`, μόνο ανάγνωση, ανύπαρκτες τιμές):
 *
 * | ερώτημα | απάντηση της μηχανής |
 * |---|---|
 * | `rfqs`: `companyId==` `status!=` `orderBy(createdAt desc)` | **ΤΡΕΧΕΙ** — σερβίρεται από `companyId↑, createdAt↓, status↓` |
 * | `rfqs`: `companyId==` `status!=` `orderBy(title asc)` | πρότεινε **`companyId↑, title↑, status↑`** |
 * | `rfqs`: `status!=` `orderBy(title asc, budget desc)` | πρότεινε **`title↑, budget↓, status↓`** |
 * | `sourcing_events`: `companyId==` `status!=` `orderBy(createdAt desc)` | πρότεινε **`companyId↑, createdAt↓, status↓`** |
 *
 * Το Firestore **πρότεινε δείκτη** αντί να απορρίψει το ερώτημα ⇒ το ερώτημα είναι **νόμιμο**.
 * Και στις τέσσερις μετρήσεις η διάταξη είναι η ίδια:
 *
 *   **ισότητες → ρητά `orderBy` (με τη σειρά και τη φορά τους) → τα πεδία εύρους που δεν
 *   ταξινομήθηκαν ρητά, με τη φορά του ΤΕΛΕΥΤΑΙΟΥ ρητού `orderBy`.**
 *
 * Ο παλιός κανόνας είναι η **ειδική περίπτωση** όπου το εύρος ταξινομείται ρητά πρώτο — γι'
 * αυτό οι προηγούμενες επαληθεύσεις (ADR-869 §7.1) δεν μπορούσαν να τον διαψεύσουν: **όλες**
 * είχαν `orderBy` στο ίδιο το πεδίο του εύρους, ή καθόλου `orderBy`.
 *
 * ⚠️ **ΜΟΝΟ ΙΣΟΤΗΤΕΣ ⇒ ΕΛΕΥΘΕΡΟ.** Μετρημένο: `audit_logs` με **τρεις** ισότητες σε πεδία
 * χωρίς κανέναν σύνθετο δείκτη επιστρέφει κανονικά — το Firestore **συγχωνεύει** τους
 * μονοπεδιακούς αυτόματους δείκτες. Η παλιά εκδοχή ζητούσε σύνθετο ⇒ ψευδώς θετικό.
 * (Η συγχώνευση **με** ταξινόμηση ζει στο {@link findCoveringIndexes}, όχι εδώ: εξαρτάται
 * από τον κατάλογο, όχι από το σχήμα.)
 *
 * 🔴 Γιατί υπάρχει (ADR-869 §7): μέχρι σήμερα το `QueryShape` **δεν είχε καν πεδίο εύρους**.
 * Κάθε `where(x, '>=', v)` γινόταν προειδοποίηση «composite coverage uncertain» και η πύλη
 * έκρινε μόνο την **προβολή ισοτήτων** του ερωτήματος — δηλαδή ένα ερώτημα **άλλο** από αυτό
 * που τρέχει. Μετρημένο 2026-09-20: το `files` με `cdeReadReach ==` + `isDeleted ==` +
 * `purgeAt <=` περνούσε **πράσινο** (υπάρχει `cdeReadReach↑, isDeleted↑`) ενώ ζωντανά
 * επιστρέφει `FAILED_PRECONDITION` — «πράσινο που σημαίνει ΔΕΝ ΚΟΙΤΑΞΑ».
 *
 * ⚠️ **ΙΣΤΟΡΙΚΟ — ΜΗΝ ΤΟ ΕΠΑΝΑΦΕΡΕΙΣ**: μέχρι το ADR-870 εδώ έγραφε «1. ισότητες · 2. **το
 * πεδίο εύρους** · 3. τα υπόλοιπα `orderBy`». Είναι λάθος μόλις υπάρχει ρητό `orderBy` σε
 * άλλο πεδίο — δες τον πίνακα μετρήσεων παραπάνω. Η επαλήθευση «ο δείκτης που πρότεινε το
 * Firestore ήρθε ταυτόσημος» ήταν **αληθής αλλά μη διακριτική**: το δείγμα της είχε μόνο
 * σχήματα όπου εύρος και πρώτη ταξινόμηση συμπίπτουν, όπου οι δύο κανόνες δίνουν το ίδιο.
 *
 * ⚠️ **Πολλαπλά πεδία εύρους ⇒ `undecidable`, ΕΠΙΤΗΔΕΣ.** Η σειρά τους μέσα στον δείκτη
 * κρίνεται από **επιλεκτικότητα**, που καμία στατική ανάλυση δεν ξέρει. Λέει «δεν ξέρω» και
 * σταματά — **αλλά δεν σωπαίνει**: το {@link noIndexCarriesRangeFields} απαντά χωρίς να
 * χρειάζεται σειρά («κανένας δείκτης δεν κουβαλά καν αυτά τα πεδία»). Μετρημένο ζωντανά:
 * `tasks` με `reminderDate <=` + `reminderSent !=` ⇒ `FAILED_PRECONDITION` σε cron.
 *
 * @param {QueryShape} shape
 * @returns {{status:'free'}
 *          |{status:'required', fields: IndexField[], eqCount: number, rangeDirectionFlexible: boolean}
 *          |{status:'undecidable', reason: string}}
 *
 * ⚠️ Το `invalid-query` **ΚΑΤΑΡΓΗΘΗΚΕ** (ADR-870): στήριζε τον καταργημένο κανόνα «πρώτο
 * orderBy = πεδίο εύρους». Δύο ζωντανές μετρήσεις το διέψευσαν· ένας κριτής που λέει
 * «σκάει» για ερώτημα που **τρέχει** είναι χειρότερος από καθόλου κριτής.
 */
function requiredIndexFor(shape) {
  const ranges = [...new Set(shape.rangeFields || [])];

  if (ranges.length > 1) {
    return {
      status: 'undecidable',
      reason: `πολλαπλά πεδία εύρους (${ranges.join(', ')}) — η σειρά τους στον δείκτη κρίνεται `
        + 'από επιλεκτικότητα, που δεν προκύπτει στατικά',
    };
  }

  const rangeField = ranges.length === 1 ? ranges[0] : null;

  // Πεδίο που έχει ΚΑΙ ισότητα ΚΑΙ εύρος μπαίνει **μία** φορά, στη θέση του εύρους.
  const equalities = new Set(shape.equalityFields.filter((f) => f !== rangeField));

  // Ταξινόμηση σε πεδίο **ισότητας** είναι άκυρη πράξη: όλες οι τιμές του είναι ίδιες. Το
  // Firestore δεν τη γράφει στον δείκτη — και ούτε εμείς, αλλιώς ζητάμε πεδίο που κανείς
  // δεν θα δηλώσει. (Παλιά αυτό ήταν χωριστός ειδικός κλάδος «ένα where + ένα orderBy στο
  // ίδιο πεδίο»· τώρα είναι ο ΓΕΝΙΚΟΣ κανόνας, άρα πιάνει και τις τρεις+ ρήτρες.)
  const orderBy = shape.orderBy.filter((o) => !equalities.has(o.field));

  // **Μόνο ισότητες** ⇒ ελεύθερο: το Firestore συγχωνεύει τους μονοπεδιακούς δείκτες
  // (μετρημένο ζωντανά με τρεις ισότητες χωρίς κανέναν σύνθετο δείκτη).
  if (rangeField === null && orderBy.length === 0) return { status: 'free' };

  const eqFields = [...equalities].sort().map((f) => ({ fieldPath: f, order: 'ASCENDING' }));
  const tail = orderBy.map((o) => ({ fieldPath: o.field, order: o.direction }));

  // Το πεδίο εύρους μπαίνει **στο τέλος**, εκτός αν ταξινομήθηκε ρητά (οπότε κρατά τη θέση
  // που του έδωσε το `orderBy`). Η φορά του ακολουθεί το **τελευταίο** ρητό `orderBy` —
  // και τα τέσσερα ζωντανά μετρημένα παραδείγματα συμφωνούν.
  const orderedExplicitly = rangeField !== null && orderBy.some((o) => o.field === rangeField);
  const implicitRange = rangeField !== null && !orderedExplicitly;
  if (implicitRange) {
    const lastDirection = orderBy.length > 0 ? orderBy[orderBy.length - 1].direction : 'ASCENDING';
    tail.push({ fieldPath: rangeField, order: lastDirection });
  }

  const fields = [...eqFields, ...tail];
  if (fields.length <= 1) return { status: 'free' };

  return {
    status: 'required',
    fields,
    eqCount: eqFields.length,
    // Χωρίς **κανένα** ρητό `orderBy` η σάρωση γίνεται και αντίστροφα ⇒ δεκτή οποιαδήποτε
    // φορά στο πεδίο εύρους. Μόλις υπάρχει ρητή ταξινόμηση, η φορά είναι δεσμευτική.
    rangeDirectionFlexible: implicitRange && orderBy.length === 0,
  };
}

// ⚠️ ΔΕΝ υπάρχει πια `requiresCompositeIndex(shape) => boolean`. Ήταν περιτύλιγμα γύρω από
// το `requiredIndexFor` και, μόλις ο καταναλωτής πέρασε στον κριτή, έμεινε **χωρίς καλούντα**.
// Ένας exporter χωρίς caller δεν είναι SSoT — είναι νεκρός κώδικας (ADR-869 §12.5).
// Ρώτα τον κριτή: `requiredIndexFor(shape).status === 'required'`.

/**
 * Check whether a given composite index covers a query shape.
 *
 * Matching algorithm:
 *   1. Take the first N index fields as the equality prefix, where N = #equalityFields.
 *      They must all be ASCENDING/DESCENDING (not ARRAY_CONTAINS) and together form
 *      exactly the same unordered set as shape.equalityFields.
 *   2. After the prefix, the next M index fields must match shape.orderBy one-for-one
 *      in both fieldPath and order/direction (M = #orderBy).
 *   3. Any trailing index fields beyond that are allowed (prefix match wins).
 *
 * Array-contains queries are skipped (returns true) to avoid false positives
 * pending a v2 implementation that understands ARRAY_CONTAINS placement.
 *
 * @param {IndexEntry} index
 * @param {QueryShape} shape
 * @returns {boolean}
 */
function indexCoversShape(index, shape) {
  if (shape.arrayContainsField) {
    // v1: treat array-contains as covered to avoid false positives.
    // The coverage check at the call-site layer will emit an info line.
    return true;
  }

  // ΕΝΑΣ κριτής: η κάλυψη ελέγχεται πάντα εναντίον του ΙΔΙΟΥ απαιτούμενου δείκτη που
  // υπολογίζει το {@link requiredIndexFor} — ποτέ δεύτερος, παράλληλος υπολογισμός.
  const required = requiredIndexFor(shape);
  if (required.status === 'free') return true;
  // «Δεν αποφασίζεται» ΔΕΝ είναι «καλυμμένο»: το αναφέρει η πύλη χωριστά.
  if (required.status !== 'required') return false;

  const fields = index.fields;
  const { eqCount } = required;
  const want = required.fields;

  if (fields.length < want.length) return false;

  // Step 1 — equality prefix (unordered set match, ASCENDING expected).
  const wantEq = want.slice(0, eqCount).map((f) => f.fieldPath).sort();
  const gotEq = [];
  for (let i = 0; i < eqCount; i++) {
    const f = fields[i];
    if (f.order === 'ARRAY_CONTAINS') return false;
    gotEq.push(f.fieldPath);
  }
  gotEq.sort();
  for (let i = 0; i < eqCount; i++) {
    if (wantEq[i] !== gotEq[i]) return false;
  }

  // Step 2 — ρητά orderBy + εύρος: **ο ΙΔΙΟΣ** συγκριτής θέσης-προς-θέση με τη συγχώνευση.
  // ⚠️ Ήταν δίδυμο (μετρημένο από το CHECK 3.28: 37 γραμμές / 60 tokens). Δύο αντίγραφα του
  // «ταιριάζει η ουρά;» θα απέκλιναν σιωπηλά την πρώτη φορά που αλλάζει ο κανόνας φοράς.
  return matchesTail(fields, want, eqCount, required);
}

/**
 * Ταιριάζει ο δείκτης με την **ουρά** που ζητά το σχήμα, από τη θέση `from` και μετά;
 *
 * @param {IndexField[]} indexFields Τα πεδία του δείκτη.
 * @param {IndexField[]} want        Τα πεδία που απαιτεί ο κριτής.
 * @param {number} from              Από ποια θέση ξεκινά η ουρά (μετά το πρόθεμα ισοτήτων).
 * @param {{rangeDirectionFlexible: boolean}} required
 * @returns {boolean}
 */
function matchesTail(indexFields, want, from, required) {
  for (let i = from; i < want.length; i++) {
    const got = indexFields[i];
    if (!got) return false;
    if (got.order === 'ARRAY_CONTAINS') return false;
    if (got.fieldPath !== want[i].fieldPath) return false;
    // Η φορά του πεδίου εύρους είναι ελεύθερη ΜΟΝΟ όταν το ερώτημα δεν δήλωσε καμία ρητή
    // ταξινόμηση — και τότε το πεδίο αυτό είναι, εξ ορισμού, το **τελευταίο** της ουράς.
    const directionFree = required.rangeDirectionFlexible && i === want.length - 1;
    if (!directionFree && got.order !== want[i].order) return false;
  }
  return true;
}

/**
 * **Ποιος δείκτης — ή ποιοι — σερβίρουν αυτό το σχήμα;**
 *
 * 🔑 ADR-870 — ΣΥΓΧΩΝΕΥΣΗ ΔΕΙΚΤΩΝ (index merging). Το `findMatchingIndex` ρωτά «υπάρχει
 * **ΕΝΑΣ** δείκτης;». Το Firestore όμως μπορεί να **συνενώσει** δείκτες που μοιράζονται την
 * ίδια **ουρά ταξινόμησης**, έναν ανά πεδίο ισότητας. Αυτό δεν είναι θεωρία:
 *
 * | ερώτημα στο `audit_logs` | απάντηση της μηχανής |
 * |---|---|
 * | `action==` `actorId==` `orderBy(timestamp desc)` | **ΤΡΕΧΕΙ** — υπάρχουν `action↑,timestamp↓` **και** `actorId↑,timestamp↓` |
 * | `action==` `actorId==` `targetId==` `orderBy(timestamp desc)` | **ΤΡΕΧΕΙ** — τρεις δείκτες, τρεις ισότητες |
 * | `action==` `actorType==` `orderBy(timestamp desc)` | **ΣΚΑΕΙ** — το `actorType` δεν έχει δικό του δείκτη |
 *
 * Χωρίς αυτόν τον κανόνα η πύλη θα κατήγγειλε **12 κλάδους** του `role-management/audit-log`
 * ως ακάλυπτους ενώ **τρέχουν** — δηλαδή θα γεννιόταν με 25% ψευδώς θετικά, πολύ πάνω από
 * τον πήχη ≤10% (Tricorder) που απαιτεί ένα blocking gate.
 *
 * 🔑 ΚΑΙ ΕΙΝΑΙ ΚΑΙ Η ΦΘΗΝΟΤΕΡΗ ΘΕΡΑΠΕΙΑ: μια διαδρομή με `n` προαιρετικά φίλτρα γεννά `2^n`
 * σχήματα. Με συγχώνευση καλύπτονται **όλα** από `n` δείκτες μορφής `(πεδίο, ουρά)` — αντί
 * για `2^n` σύνθετους.
 *
 * @param {Map<string, IndexEntry[]>} catalog
 * @param {QueryShape} shape
 * @returns {{mode:'single'|'merge', indexes: IndexEntry[]}|null}
 */
function findCoveringIndexes(catalog, shape) {
  const single = findMatchingIndex(catalog, shape);
  if (single) return { mode: 'single', indexes: [single] };

  if (shape.arrayContainsField) return null;
  const required = requiredIndexFor(shape);
  if (required.status !== 'required') return null;
  // Με ≤1 ισότητα η «συγχώνευση» είναι ο ίδιος ένας δείκτης — που μόλις απέτυχε.
  if (required.eqCount < 2) return null;

  const suffix = required.fields.slice(required.eqCount);
  if (suffix.length === 0) return null;   // μόνο ισότητες: το κρίνει ήδη ο κριτής ως `free`

  const list = catalog.get(shape.collection) || [];
  const picked = [];
  for (let i = 0; i < required.eqCount; i++) {
    const want = [required.fields[i], ...suffix];
    const hit = list.find((idx) => indexStartsWithFields(idx, want, required));
    if (!hit) return null;
    picked.push(hit);
  }
  return {
    mode: 'merge',
    indexes: picked,
    // ⏳ ΤΙΜΙΟ ΟΡΙΟ: η συγχώνευση μετρήθηκε ζωντανά με **δύο** και **τρεις** δείκτες. Πάνω
    // από εκεί είναι **προέκταση, όχι μέτρηση** — η πύλη το λέει αντί να το κρύψει, ώστε
    // ένα «καλυμμένο» που στηρίζεται σε αμέτρητη συμπεριφορά να μη μοιάζει με απόδειξη.
    beyondMeasuredEnvelope: picked.length > 3,
  };
}

/**
 * Αρχίζει ο δείκτης **ακριβώς** με αυτά τα πεδία (και τις φορές τους); Επιπλέον πεδία στο
 * τέλος επιτρέπονται — ταίριασμα προθέματος, όπως παντού στο Firestore.
 *
 * @param {IndexEntry} index
 * @param {IndexField[]} want
 * @param {{rangeDirectionFlexible: boolean}} required
 * @returns {boolean}
 */
function indexStartsWithFields(index, want, required) {
  if (index.fields.length < want.length) return false;
  return matchesTail(index.fields, want, 0, required);
}

/**
 * **Σίγουρα ακάλυπτο, ακόμη κι όταν ο κριτής λέει «δεν αποφασίζεται».**
 *
 * Για σχήμα με **πολλαπλά** πεδία εύρους ο κριτής αρνείται να μαντέψει σειρά — σωστά. Αλλά
 * υπάρχει μια απάντηση που **δεν** χρειάζεται σειρά: αν **κανένας** δείκτης της συλλογής δεν
 * περιέχει καν όλα τα πεδία του εύρους, τότε **καμία** διάταξη δεν θα τον βρει. Το «δεν
 * ξέρω ΠΟΙΟΝ δείκτη θέλεις» δεν είναι λόγος να μη λες «πάντως **κανέναν** δεν έχεις».
 *
 * Μετρημένο: `tasks` με `reminderDate <=` + `reminderSent !=` ⇒ `FAILED_PRECONDITION`
 * ζωντανά, ενώ η πύλη το έλεγε «δεν αποφασίζεται» και προχωρούσε.
 *
 * @param {Map<string, IndexEntry[]>} catalog
 * @param {QueryShape} shape
 * @returns {boolean}
 */
function noIndexCarriesRangeFields(catalog, shape) {
  const ranges = [...new Set(shape.rangeFields || [])];
  if (ranges.length === 0) return false;
  const list = catalog.get(shape.collection) || [];
  return !list.some((idx) => {
    const paths = new Set(idx.fields.map((f) => f.fieldPath));
    return ranges.every((r) => paths.has(r));
  });
}

/**
 * Find an index in the catalog that covers the shape, or null if none exists.
 *
 * @param {Map<string, IndexEntry[]>} catalog
 * @param {QueryShape} shape
 * @returns {IndexEntry|null}
 */
function findMatchingIndex(catalog, shape) {
  const list = catalog.get(shape.collection) || [];
  for (const idx of list) {
    if (indexCoversShape(idx, shape)) return idx;
  }
  return null;
}

/**
 * Emit a ready-to-paste firestore.indexes.json snippet for a missing shape.
 *
 * @param {QueryShape} shape
 * @returns {object}
 */
function suggestIndexJson(shape) {
  const required = requiredIndexFor(shape);
  // Η πρόταση είναι ο ΙΔΙΟΣ απαιτούμενος δείκτης — αλλιώς η πύλη θα πρότεινε κάτι που η ίδια
  // δεν δέχεται (μετρημένη παγίδα: το `suggest` έγραφε το σχήμα ΧΩΡΙΣ το πεδίο εύρους).
  // ⚠️ Και στο «δεν αποφασίζεται» η πρόταση πρέπει να ΠΕΡΙΕΧΕΙ τα πεδία εύρους. Η πρώτη
  // εκδοχή τα παρέλειπε και τύπωνε `[]` για το `tasks` (δύο εύρη, καμία ισότητα) — δηλαδή
  // «λείπει δείκτης» χωρίς να λέει **ποιος**. Η σειρά τους είναι η σειρά του ερωτήματος,
  // όπως ακριβώς την πρότεινε ζωντανά το Firestore (`reminderDate↑, reminderSent↑`), με
  // ρητή σημείωση ότι η βέλτιστη σειρά κρίνεται από επιλεκτικότητα.
  const fields = required.status === 'required'
    ? required.fields.map((f) => ({ ...f }))
    : [
      ...[...shape.equalityFields].sort().map((f) => ({ fieldPath: f, order: 'ASCENDING' })),
      ...shape.orderBy.map((ob) => ({ fieldPath: ob.field, order: ob.direction })),
      ...(shape.rangeFields || [])
        .filter((f) => !shape.equalityFields.includes(f) && !shape.orderBy.some((ob) => ob.field === f))
        .map((f) => ({ fieldPath: f, order: 'ASCENDING' })),
    ];

  if (shape.arrayContainsField) {
    fields.splice(required.status === 'required' ? required.eqCount : fields.length, 0, {
      fieldPath: shape.arrayContainsField,
      arrayConfig: 'CONTAINS',
    });
  }
  return {
    collectionGroup: shape.collection,
    queryScope: 'COLLECTION',
    fields,
  };
}

module.exports = {
  loadIndexCatalog,
  requiredIndexFor,
  indexCoversShape,
  findMatchingIndex,
  findCoveringIndexes,
  noIndexCarriesRangeFields,
  suggestIndexJson,
};
