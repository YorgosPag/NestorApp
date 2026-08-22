#!/usr/bin/env node
/**
 * CHECK 3.58 — ΠΥΛΗ ΤΗΣ ΑΡΧΗΣ ΤΟΥ ΧΩΡΟΥ (ADR-787 §5.2)
 *
 * «Ποιος αποφασίζει ότι επιτρέπεσαι σε ΞΕΝΟ χώρο — και ρώτησε τον κριτή;»
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 Η ΜΕΤΡΗΣΗ ΑΝΕΤΡΕΨΕ ΤΗΝ ΑΦΕΤΗΡΙΑ: ΔΕΝ ΑΠΟΤΡΕΠΟΥΜΕ ΤΕΤΑΡΤΟ ΜΗΧΑΝΙΣΜΟ — ΥΠΑΡΧΟΥΝ ΗΔΗ ΤΕΣΣΕΡΙΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το σχέδιο έλεγε «η πύλη απαγορεύει **τέταρτο** μηχανισμό ενεργού χώρου». Το SSoT audit
 * της 2026-08-22 μέτρησε **τέσσερις ζωντανούς**, και ο ένας **έχει δεδομένα στη βάση**:
 * ο Telegram adapter δρομολογούσε εντολές στο `users/{uid}.activeCompanyId` — πεδίο που
 * **γράφει ο φυλλομετρητής** και που ο κανόνας `firestore.rules` επιτρέπει σε **κάθε**
 * χρήστη να γράψει **χωρίς field allowlist**. Είναι *confused deputy* με την τεχνική
 * σημασία του όρου, και η **ίδια** βλάβη που η Φάση 1 έκλεισε στην κεφαλίδα HTTP (§2.8 #3).
 *
 * 🔑 ΤΟ ΚΡΙΤΗΡΙΟ ΕΙΝΑΙ ΤΟ **ΚΑΝΑΛΙ**, ΟΧΙ ΤΟ ΟΝΟΜΑ — ΚΑΙ ΤΟ ΑΠΟΦΑΣΙΣΕ Η ΜΕΤΡΗΣΗ.
 * Το προφανές κριτήριο («σύμβολα που ονομάζονται σαν απαντητής χώρου») δοκιμάστηκε:
 * **25 ευρήματα, >15 ψευδώς θετικά = >60%**, όταν ο πήχης για **μπλοκάρουσα** πύλη είναι
 * **<10%**. Και δεν ήταν οριακά, ήταν **κατηγορίες**: `resolveWorkspaceLayout` (ο δοκός
 * του DXF viewer — άλλο «workspace»), `decideEmailDelivery`, `decideAssetPackAccess`,
 * `resolveCompanyName`. **Το όνομα δεν είναι ταυτότητα· η είσοδος που καταναλώνεις είναι.**
 *
 * Είναι το βιομηχανικό μοντέλο **taint**: πηγή (κανάλι) → sanitizer (ο κριτής) → sink
 * (ο ενεργός χώρος). ⚠️ **ΔΕΝ γράφεται μηχανή taint** — θα ήταν δεύτερη μηχανή (ADR-749).
 * Κρατιέται η γλώσσα του μοντέλου, με τον σκελετό των CHECK 3.48/3.56 που ήδη υπάρχει.
 *
 * 🏆 ΠΟΥ ΞΕΠΕΡΝΑΜΕ (ερευνήθηκε 2026-08-22). Ο **Clerk** επαληθεύει μέλος στο middleware
 * — σωστά — και μετά λέει **αυτολεξεί** ότι *«είναι ευθύνη της σελίδας»* να χειριστεί την
 * περίπτωση που ο οργανισμός δεν είναι ενεργός: **ανάθεση σε άνθρωπο που πρέπει να
 * θυμάται**, σε κάθε σελίδα — το σχήμα που εδώ έχει αποτύχει μετρημένα (3.34: **63** ·
 * 3.37: **18 vs 26** · 3.49: **60**). Η **Google/Bazel** δίνει `visibility` για το «ποιος
 * με βλέπει», δηλώνει ότι **δεν έχει** μηχανισμό για την αντίστροφη κατεύθυνση, και
 * προτείνει *«add a **linter** to your code check-in process»* — δηλαδή **αυτό εδώ**.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ΤΡΕΙΣ ΑΝΕΞΑΡΤΗΤΟΙ ΚΑΝΟΝΕΣ — ΠΟΤΕ ΕΝΑΣ ΜΕ «Ή» (μάθημα CHECK 3.41)
 * ────────────────────────────────────────────────────────────────────────────
 *
 *   Κ1 ⛔ `channel-unjudged`  — server module διαβάζει δηλωμένο κανάλι ΧΩΡΙΣ κριτή
 *   Κ2 ⛔ κλειστό σύνολο      — κάθε (κανάλι × αναγνώστης) δηλώνεται· νέος ⇒ ΜΠΛΟΚ
 *   Κ3 🔴 `duplicate-symbol`  — σύμβολο εκτός SSoT με όνομα του λεξιλογίου του απαντητή
 *
 * Ξεχωριστοί επειδή έχουν **διαφορετική θεραπεία**. Ένας κανόνας με «ή» θα έμενε πράσινος
 * στη μία κατεύθυνση ενώ σπάει η άλλη.
 *
 * ⚠️ Ο Κ2 ΦΥΛΑ ΚΑΙ ΤΗ ΣΩΣΤΗ ΠΡΑΞΗ, ΚΑΙ ΑΥΤΟ ΕΙΝΑΙ ΤΟ ΣΗΜΕΙΟ. Όποιος γράψει στη **Φάση 3**
 * τον αναγνώστη «ο χώρος από τη διεύθυνση» **σωστά** εμφανίζεται ως **νέα δήλωση** και
 * μπλοκάρει, ώστε να το δει άνθρωπος.
 *
 * ⚠️ Ο Κ1 ΔΕΝ ΜΠΑΙΝΕΙ ΠΟΤΕ ΣΕ BASELINE — το `buildPayload` **ρίχνει**. Ένα zero-tol που
 *    κλειδώνεται με ένα `--write-baseline` δεν είναι zero-tol (πρότυπο CHECK 3.44).
 *
 * ⚠️ Η ΔΙΑΚΡΙΣΗ ΔΙΑΚΟΜΙΣΤΗ/ΠΕΛΑΤΗ ΕΙΝΑΙ **ΠΑΡΑΓΟΜΕΝΗ** από δηλώσεις που ήδη υπάρχουν
 *    στον κώδικα (`import 'server-only'` · εισαγωγή `firebaseAdmin` · θέση στο
 *    `src/app/api/**`). ⛔ **ΠΟΤΕ χειρόγραφη λίστα φακέλων** (3.34/3.37). Χρειάζεται:
 *    ο πελάτης **γράφει** το `activeCompanyId` και **φιλτράρει** ερωτήματα μαζί του —
 *    νόμιμα, γιατί την άδεια τη δίνουν τα `firestore.rules`, όχι αυτός.
 *
 * ⚠️ ΤΑ ΣΧΟΛΙΑ ΚΟΒΟΝΤΑΙ. Το ίδιο το `workspace-membership.ts` γράφει τη λέξη-δείκτη
 *    μέσα σε σχόλιο, ως **παράδειγμα της βλάβης**. Πύλη χωρίς `stripComments` θα κοκκίνιζε
 *    πάνω στην τεκμηρίωση της θεραπείας — το σχήμα `Κ7β` του CHECK 3.50.
 *
 * 🔶 ΔΗΛΩΜΕΝΟ ΟΡΙΟ: η πύλη **δεν ανακαλύπτει άγνωστο κανάλι**. Εγγυάται ότι κάθε
 *    **δηλωμένο** έχει κριτή και ότι κανένας **νέος αναγνώστης** δεν προσγειώνεται
 *    σιωπηλά. Γι' αυτό ακριβώς ο Κ2 είναι κλειστό σύνολο.
 *
 * Αναφορά:  npm run workspace-authority:report
 * Baseline: npm run workspace-authority:baseline
 * Escape:   SKIP_WORKSPACE_AUTHORITY=1  ·  εξαίρεση αρχείου: `// workspace-authority-exempt: <λόγος>`
 */
const fs = require('node:fs');
const path = require('node:path');
const { stripComments } = require('./lib/i18n-namespace-extract');
const { runSetRatchetCli, PROJECT_ROOT } = require('./lib/ratchet-baseline');

const REGISTRY = path.join(PROJECT_ROOT, '.workspace-authority.json');
const BASELINE = path.join(PROJECT_ROOT, '.workspace-authority-baseline.json');

/**
 * `// workspace-authority-exempt: <λόγος>` — ο λόγος **ΥΠΟΧΡΕΩΤΙΚΟΣ**.
 *
 * ⚠️ `[ \t]` και **ΟΧΙ** `\s`: το `\s` περιλαμβάνει τη νέα γραμμή, οπότε ένα κενό
 * `exempt:` θα δανειζόταν την πρώτη λέξη της **επόμενης** γραμμής και θα περνούσε —
 * δηλαδή ο «υποχρεωτικός λόγος» θα ήταν στην πράξη προαιρετικός (μάθημα CHECK 3.56 `Κ8`).
 */
const EXEMPT = /workspace-authority-exempt:[ \t]*\S+/;

/**
 * Η ΣΚΑΝΔΑΛΗ ΖΕΙ **ΜΕΣΑ** ΣΤΗΝ ΠΥΛΗ, ΚΑΙ Η ΕΚΤΕΛΕΣΗ ΕΙΝΑΙ ΠΑΝΤΑ **ΠΛΗΡΗΣ**.
 *
 * ⚠️ Λίστα μονοπατιών στο `run-checks-parallel.js` θα ήταν **δεύτερη αυθεντία** που
 * αποκλίνει σιωπηλά (σχήμα CHECK 3.34/3.37/3.44). Και η σάρωση **δεν** περιορίζεται στα
 * staged: νέος αναγνώστης καναλιού προσγειώνεται σε **οποιοδήποτε** αρχείο, και μια
 * αλλαγή στο μητρώο ξανα-ταξινομεί αρχεία **που κανείς δεν έστειλε** — μερική ανάλυση
 * εδώ θα ήταν αναληθής (μάθημα CHECK 3.38 `scope:'staged'`).
 *
 * Πυροδοτεί: κάθε `.ts/.tsx` του `src/` *(εκεί προσγειώνεται ο αναγνώστης)* · το μητρώο
 * και η baseline · **η ίδια η πύλη** *(αλλιώς αλλαγή στο κριτήριο περνά χωρίς να ασκηθεί
 * το κριτήριο)*.
 */
const TRIGGER_RE = [
  /^src\/.*\.tsx?$/,
  /^\.workspace-authority(-baseline)?\.json$/,
  /^scripts\/check-workspace-authority\.js$/,
];
const triggers = (files) => files.some((f) => TRIGGER_RE.some((re) => re.test(f)));

/** Ορισμός συμβόλου — `export function X` · `export const X` · `function X` · `const X =`. */
function definesSymbol(code, name) {
  const re = new RegExp(
    '(?:^|\\n)\\s*(?:export\\s+)?(?:async\\s+)?(?:function|const|class)\\s+' + name + '\\b',
  );
  return re.test(code);
}

/**
 * Είναι αρχείο **διακομιστή**;
 *
 * 🔑 ΠΑΡΑΓΟΜΕΝΟ ΑΠΟ ΤΟΝ ΚΩΔΙΚΑ, ΟΧΙ ΑΠΟ ΛΙΣΤΑ. Τρεις ανεξάρτητες δηλώσεις που **ήδη**
 * υπάρχουν: η οδηγία `server-only` του Next.js, η εισαγωγή του Admin SDK (που **δεν
 * μπορεί** να τρέξει στον φυλλομετρητή), και η θέση σε `src/app/api/**`. Μία αρκεί.
 */
function isServerFile(rel, code) {
  if (rel.startsWith('src/app/api/')) return true;
  if (/import\s+['"]server-only['"]/.test(code)) return true;
  if (/from\s+['"]@\/lib\/firebaseAdmin['"]|from\s+['"]firebase-admin\//.test(code)) return true;
  return false;
}

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', '.next', 'dist'].includes(entry.name)) continue;
      walk(full, out);
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

function loadRegistry(registryPath = REGISTRY) {
  const raw = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
  // fail-closed: μητρώο χωρίς κανάλια θα έκανε την πύλη μονίμως πράσινη.
  if (!Array.isArray(raw.channels) || raw.channels.length === 0) {
    throw new Error('CHECK 3.58 — το μητρώο δεν δηλώνει κανένα κανάλι');
  }
  for (const ch of raw.channels) {
    if (!ch.id || !ch.marker || !ch.why || !String(ch.why).trim()) {
      throw new Error(`CHECK 3.58 — κανάλι χωρίς id/marker/λόγο: ${JSON.stringify(ch)}`);
    }
  }
  for (const r of raw.readers || []) {
    if (!r.id || !r.why || !String(r.why).trim()) {
      throw new Error(`CHECK 3.58 — δηλωμένος αναγνώστης χωρίς λόγο: ${JSON.stringify(r)}`);
    }
  }
  return raw;
}

/**
 * Το θέμα «χώρος»: **μόνο** ονόματα που μιλούν γι' αυτόν είναι δεσμευμένα.
 *
 * 🔴 ΤΟ ΦΙΛΤΡΟ ΓΕΝΝΗΘΗΚΕ ΑΠΟ ΜΕΤΡΗΣΗ, ΟΧΙ ΑΠΟ ΠΡΟΤΙΜΗΣΗ. Χωρίς αυτό, «όλες οι εξαγωγές
 * του SSoT» έδιναν **5 ευρήματα με 3 ψευδώς θετικά = 60%**, όταν ο πήχης για μπλοκάρουσα
 * πύλη είναι **<10%**: το `isAllowed` είναι όνομα τόσο κοινό που ζει ήδη **δύο φορές** σε
 * άσχετα σημεία (`PropertyStatusSelector.tsx` για κατάσταση ακινήτου · `path-sanitizer.ts`
 * για διαδρομές αρχείων). Ένα δεσμευμένο όνομα που πιάνει σωστό κώδικα είναι ο δρόμος
 * προς το `SKIP_` (μάθημα CHECK 3.50 `Σ7β`).
 */
const WORKSPACE_TOPIC = /workspace|membership|companyid/i;

/**
 * Τα δεσμευμένα ονόματα: **παράγονται** από τις εξαγωγές του SSoT.
 *
 * ⛔ ΠΟΤΕ χειρόγραφη λίστα — θα απέκλινε από το SSoT σιωπηλά, το σχήμα των δύο λιστών
 * namespace του CHECK 3.34 (απόκλιση **63**). Τα `extraReservedNames` του μητρώου είναι
 * τα **ιστορικά** ονόματα που έχουν ήδη διπλότυπο και δεν εξάγονται από τον απαντητή.
 */
function reservedNamesOf(registry, readFile) {
  const names = new Set(registry.extraReservedNames || []);
  for (const file of [registry.ssot.answerer, registry.ssot.vocabulary]) {
    const code = readFile(file);
    if (code === null) continue;
    const re = /^export\s+(?:async\s+)?(?:function|const)\s+([A-Za-z_$][\w$]*)/gm;
    let m;
    while ((m = re.exec(code)) !== null) {
      if (WORKSPACE_TOPIC.test(m[1])) names.add(m[1]);
    }
  }
  return names;
}

/**
 * Η ΤΑΞΙΝΟΜΗΣΗ — ΜΙΑ κατάσταση ανά αρχείο, ΠΟΤΕ σιωπηλή απόρριψη.
 *
 * ⚠️ Η ΣΕΙΡΑ ΕΙΝΑΙ ΣΥΜΒΟΛΑΙΟ: τα αρχεία του SSoT κρίνονται **πρώτα** (είναι η αυθεντία,
 * όχι παράβαση), μετά τα test, μετά η εξαίρεση, και **τελευταία** η παράβαση — ώστε ένα
 * αρχείο να μη μετρηθεί σε δύο κάδους και το άθροισμα να κλείνει.
 */
function classify(rel, raw, ctx) {
  // 🔑 «SSoT» ΕΙΝΑΙ ΚΑΙ ΟΙ ΔΗΛΩΜΕΝΟΙ ΑΝΑΓΝΩΣΤΕΣ, ΚΑΙ ΕΙΝΑΙ ΜΗΧΑΝΙΚΟ, ΟΧΙ ΔΕΥΤΕΡΗ ΛΙΣΤΑ.
  //    Ένα αρχείο που το μητρώο έχει ήδη εγκρίνει ως αναγνώστη καναλιού **είναι** νόμιμη
  //    αρχή του χώρου — άρα επιτρέπεται να ορίζει το λεξιλόγιό του. Χωρίς αυτό, ο ίδιος ο
  //    κανονικός `resolveEffectiveCompanyId` του `lib/auth/auth-context.ts` κατηγγέλλετο
  //    ως «ομώνυμος» — δηλαδή η πύλη κοκκίνιζε πάνω στη ΘΕΡΑΠΕΙΑ (μετρημένο, 3/5 FP).
  const isSsot = rel === ctx.registry.ssot.answerer || rel === ctx.registry.ssot.vocabulary;
  /** Ποιος επιτρέπεται να **ορίζει** το λεξιλόγιο: το SSoT + οι εγκεκριμένοι αναγνώστες. */
  const ownsVocabulary = isSsot || ctx.declaredReaderFiles.has(rel);
  const isTest = /\.(test|spec)\.tsx?$/.test(rel) || rel.includes('__tests__/');

  // ⚡ Προφίλτρο κειμένου: αρχείο που δεν αναφέρει ούτε δείκτη καναλιού ούτε δεσμευμένο
  //    όνομα δεν μπορεί να αποκτήσει τέτοιο αφού κοπούν τα σχόλια (το `stripComments`
  //    **αφαιρεί**, δεν προσθέτει). Χωρίς αυτό η πύλη σάρωνε ~14.000 αρχεία με AST-κόστος.
  const touchesChannel = ctx.registry.channels.some((c) => raw.includes(c.marker));
  const touchesName = [...ctx.reserved].some((n) => raw.includes(n));
  if (!touchesChannel && !touchesName) return [{ state: 'unrelated' }];

  const code = stripComments(raw);

  const states = [];

  // ── Κ3: ομωνυμία με το λεξιλόγιο του απαντητή ──────────────────────────────
  if (!ownsVocabulary && !isTest) {
    for (const name of ctx.reserved) {
      if (definesSymbol(code, name)) {
        states.push({ state: 'duplicate-symbol', detail: name });
      }
    }
  }

  // ── Κ1/Κ2: αναγνώστης καναλιού ────────────────────────────────────────────
  for (const ch of ctx.registry.channels) {
    if (!code.includes(ch.marker)) continue;
    if (isSsot) { states.push({ state: 'ssot', detail: ch.id }); continue; }
    if (isTest) { states.push({ state: 'fixture', detail: ch.id }); continue; }
    // 🔑 Ο ΠΕΛΑΤΗΣ ΔΕΝ ΕΙΝΑΙ ΑΡΧΗ. Γράφει το κανάλι και φιλτράρει ερωτήματα μαζί του —
    //    την άδεια τη δίνουν τα `firestore.rules`. Πύλη πάνω του θα μετρούσε ~25
    //    «παραβιάσεις» που δεν είναι παραβιάσεις ασφαλείας (ADR-787 §5.2 η #2).
    if (!isServerFile(rel, code)) { states.push({ state: 'client-side', detail: ch.id }); continue; }
    if (EXEMPT.test(raw)) { states.push({ state: 'exempt', detail: ch.id }); continue; }
    const judged = ctx.registry.ssot.judges.some((j) => new RegExp('\\b' + j + '\\s*\\(').test(code));
    states.push({ state: judged ? 'channel-judged' : 'channel-unjudged', detail: ch.id });
  }

  return states.length ? states : [{ state: 'unrelated' }];
}

/**
 * ΤΟ ΚΑΤΑΣΤΙΧΟ — κάθε εύρημα σε ΕΝΑΝ κάδο, και το άθροισμα ΠΡΕΠΕΙ να κλείνει.
 *
 * ⚠️ ΟΙ ΔΥΟ ΦΡΟΥΡΟΙ ΕΙΝΑΙ BELT-AND-SUSPENDERS ΚΑΙ ΑΛΛΗΛΟΚΑΛΥΠΤΟΝΤΑΙ ΕΠΙΤΗΔΕΣ: σβήνοντας
 * μόνο το «άγνωστη κατάσταση», το άθροισμα δεν κλείνει και πυροδοτεί ο δεύτερος·
 * σβήνοντας μόνο το άθροισμα, πυροδοτεί ο πρώτος. Η άγκυρα μεταλλάσσει **και τους δύο
 * μαζί** — μια μετάλλαξη που την πιάνει ο εφεδρικός δεν αποδεικνύει τίποτα για τον κύριο.
 *
 * @param {Array<{rel: string, raw: string}>} entries
 * @param {object} ctx
 * @param {Function} [classifyFn] ραφή δοκιμής
 */
function tally(entries, ctx, classifyFn = classify) {
  const ledger = {
    'channel-unjudged': [], 'duplicate-symbol': [],
    'channel-judged': [], ssot: [], 'client-side': [], exempt: [], fixture: [], unrelated: [],
  };
  let emitted = 0;
  for (const { rel, raw } of entries) {
    const states = classifyFn(rel, raw, ctx);
    // 🔴 ΤΟ `emitted` ΜΕΤΡΙΕΤΑΙ **ΠΡΙΝ** ΤΟ push, ΚΑΙ ΕΙΝΑΙ ΟΛΟΣ Ο ΛΟΓΟΣ ΥΠΑΡΞΗΣ ΤΟΥ.
    //    Η πρώτη γραφή το αύξανε **μέσα** στον βρόχο, δίπλα στο `push` — δηλαδή τα δύο
    //    μεγέθη κινούνταν πάντα μαζί και το `counted !== emitted` ήταν **αδύνατο**:
    //    φρουρός που δεν μπορεί να πυροδοτήσει, ακριβώς οι 606 του ADR-749 §5, γραμμένος
    //    **μέσα στο όργανο που τους κυνηγά**. Το έπιασε η άγκυρα `Κ1β`, όχι η ανάγνωση.
    //    Τώρα μια σιωπηλή απόρριψη (`continue` σε κάποια κατάσταση) **δεν κλείνει**.
    emitted += states.length;
    for (const { state, detail } of states) {
      if (!(state in ledger)) throw new Error(`CHECK 3.58 — άγνωστη κατάσταση: ${state}`);
      ledger[state].push({ file: rel, detail: detail || '', state });
    }
  }
  const counted = Object.values(ledger).reduce((n, list) => n + list.length, 0);
  if (counted !== emitted) {
    throw new Error(`CHECK 3.58 — η λογιστική δεν κλείνει: ${counted} ≠ ${emitted}`);
  }
  return ledger;
}

/**
 * @param {{root?: string, registryPath?: string}} [opts]
 *
 * 🔑 ΠΑΡΑΜΕΤΡΙΚΗ ΡΙΖΑ ΓΙΑ ΝΑ ΜΕΤΑΛΛΑΣΣΟΝΤΑΙ ΟΙ **ΕΙΣΟΔΟΙ**, ΟΧΙ Η ΠΥΛΗ. Οι άγκυρες
 * χτίζουν μίνι-repo από **πραγματικά** αρχεία και αλλάζουν **μία** γραμμή· μετάλλαξη
 * στην ίδια την πύλη αποδεικνύει μόνο ότι η πύλη εκτελείται (μάθημα CHECK 3.44/3.47).
 */
function measure(opts = {}) {
  const root = opts.root || PROJECT_ROOT;
  const registry = loadRegistry(opts.registryPath || path.join(root, '.workspace-authority.json'));
  const readFile = (rel) => {
    const abs = path.join(root, rel);
    return fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : null;
  };
  const reserved = reservedNamesOf(registry, readFile);
  // Τα αρχεία που το ΜΗΤΡΩΟ έχει ήδη εγκρίνει ως αναγνώστες — παράγονται από το
  // `readers[].id` (μορφή `<κανάλι>@<αρχείο>`), ΠΟΤΕ ως δεύτερη χειρόγραφη λίστα.
  const declaredReaderFiles = new Set((registry.readers || []).map((r) => r.id.split('@')[1]));
  const ctx = { registry, reserved, declaredReaderFiles };

  const srcDir = path.join(root, 'src');
  const entries = walk(srcDir).map((file) => ({
    rel: path.relative(root, file).split(path.sep).join('/'),
    raw: fs.readFileSync(file, 'utf8'),
  }));

  const ledger = tally(entries, ctx);

  // Κ2 — ΤΟ ΚΛΕΙΣΤΟ ΣΥΝΟΛΟ: κάθε (κανάλι × αναγνώστης) που ΠΕΡΝΑ είναι δήλωση.
  const declarations = ledger['channel-judged'].map((f) => `${f.detail}@${f.file}`).sort();
  // Κ3 — οι ομώνυμες, ΚΑΤΑ ΤΑΥΤΟΤΗΤΑ (όνομα@αρχείο), ποτέ κατά πλήθος: μια νόμιμη
  //      μείωση θα φαινόταν «νέα παραβίαση» και η πύλη θα μπλόκαρε τη ΘΕΡΑΠΕΙΑ (3.49 Κ2).
  const violations = ledger['duplicate-symbol'].map((f) => ({ ...f, line: 0 }));
  const violationIds = violations.map((f) => `${f.detail}@${f.file}`).sort();

  return { ledger, declarations, violations, violationIds, unjudged: ledger['channel-unjudged'], registry };
}

function ledgerLine(m) {
  const L = m.ledger;
  return `  CHECK 3.58 — αρχή χώρου: ${L['channel-unjudged'].length} κανάλι χωρίς κριτή · `
    + `${L['duplicate-symbol'].length} ομώνυμα · ${L['channel-judged'].length} κριμένοι αναγνώστες · `
    + `${L.ssot.length} SSoT · ${L['client-side'].length} πελάτης · ${L.exempt.length} εξαιρέσεις · `
    + `${L.fixture.length} fixture`;
}

/**
 * ⛔ Ο Κ1 ΔΕΝ ΓΡΑΦΕΤΑΙ ΠΟΤΕ ΣΕ BASELINE (πρότυπο CHECK 3.44): ένα zero-tolerance που
 * κλειδώνεται με ένα `--write-baseline` δεν είναι zero-tolerance.
 */
function buildPayload(m) {
  if (m.unjudged.length > 0) {
    throw new Error(
      'CHECK 3.58 — άρνηση εγγραφής baseline: υπάρχουν '
      + `${m.unjudged.length} κανάλι(α) χωρίς κριτή (zero-tolerance):\n`
      + m.unjudged.map((f) => `   ${f.file}  [${f.detail}]`).join('\n'),
    );
  }
  return {
    _doc: 'CHECK 3.58 — ADR-787 §5.2. violations = ομωνυμία (Κ3) · declarations = κλειστό σύνολο αναγνωστών (Κ2).',
    _warning: 'Ο Κ1 (κανάλι χωρίς κριτή) είναι ZERO-TOLERANCE και ΔΕΝ μπαίνει ΠΟΤΕ εδώ.',
    generatedAt: new Date().toISOString().slice(0, 10),
    violations: m.violationIds,
    declarations: m.declarations,
  };
}

function printReport(m) {
  console.log(ledgerLine(m));
  console.log('');
  for (const f of m.unjudged) console.log(`  ⛔ ${f.file}  [${f.detail}] — διαβάζει κανάλι ΧΩΡΙΣ κριτή`);
  for (const id of m.violationIds) console.log(`  🔴 ${id} — ομώνυμο με το λεξιλόγιο του απαντητή`);
  console.log('');
  console.log('  Δηλωμένοι αναγνώστες (κλειστό σύνολο):');
  for (const d of m.declarations) console.log(`     ${d}`);
}

const DESCRIPTOR = {
  adr: 'ADR-787 §5.2 (CHECK 3.58)',
  skipEnv: 'SKIP_WORKSPACE_AUTHORITY',
  baselineFile: BASELINE,
  measure,
  buildPayload,
  printReport,
  violationId: (f) => `${f.detail}@${f.file}`,
  labels: { violations: 'ομώνυμα', declarations: 'αναγνώστες καναλιού' },
  commands: {
    report: 'npm run workspace-authority:report',
    baseline: 'npm run workspace-authority:baseline',
    seed: 'npm run workspace-authority:baseline',
  },
  messages: {
    worse: 'η αρχή του ενεργού χώρου διασπάστηκε',
    newDeclLabel: 'ΝΕΟΣ ΑΝΑΓΝΩΣΤΗΣ ΚΑΝΑΛΙΟΥ',
    newDeclAdvice: [
      'Μπλοκάρει ΑΚΟΜΑ ΚΙ ΑΝ καλεί σωστά τον κριτή — και αυτό είναι το σημείο:',
      'ένας δεύτερος σωστός αναγνώστης είναι αρχιτεκτονικό γεγονός που πρέπει να δει άνθρωπος,',
      'αλλιώς ο τρίτος προσγειώνεται σιωπηλά (ADR-787 §5.2 δ).',
      'Αν είναι σκόπιμος: δήλωσέ τον στο `.workspace-authority.json` → `readers[]`, ΜΕ ΛΟΓΟ.',
    ],
  },
};

/**
 * Το zero-tolerance σκέλος τρέχει **πριν** το ratchet: ο Κ1 δεν έχει baseline, άρα δεν
 * υπάρχει τίποτα να συγκριθεί — υπάρχει μόνο «ναι» ή «όχι».
 */
async function main() {
  if (process.env.SKIP_WORKSPACE_AUTHORITY === '1') {
    console.log('  ⏭ CHECK 3.58 παραλείφθηκε (SKIP_WORKSPACE_AUTHORITY=1)');
    return process.exit(0);
  }
  const args = process.argv.slice(2);
  const explicit = args.includes('--report') || args.includes('--write-baseline') || args.includes('--all');
  const staged = args.filter((a) => !a.startsWith('-'));
  // ⚡ ~0,05s όταν δεν αφορά · ~6,5s όταν πυροδοτεί — και τότε **πλήρης**.
  if (!explicit && staged.length > 0 && !triggers(staged)) return process.exit(0);

  if (!args.includes('--report') && !args.includes('--write-baseline')) {
    const m = measure();
    // ⚠️ Τυπώνεται ΚΑΙ ΣΤΟ ΜΗΔΕΝ: ένα «0» που δεν φαίνεται διαβάζεται ως «δεν κοίταξα»
    //    (μάθημα CHECK 3.56 — η πύλη εκείνη γεννήθηκε μονίμως πράσινη και το έπιασε η λογιστική).
    console.log(ledgerLine(m));
    if (m.unjudged.length > 0) {
      console.error(`\n❌ CHECK 3.58 — ${m.unjudged.length} κανάλι(α) ενεργού χώρου διαβάζονται ΧΩΡΙΣ κριτή:\n`);
      for (const f of m.unjudged) {
        console.error(`   🚫 ${f.file}   [κανάλι: ${f.detail}]`);
      }
      console.error('\n   Θεραπεία: κάλεσε τον απαντητή ΣΤΟ ΙΔΙΟ ΑΡΧΕΙΟ —');
      console.error('     decideMembership({ uid, claimCompanyId, globalRole, requested: orgWorkspace(id) })');
      console.error('   ⛔ ΜΗΝ βάλεις τον έλεγχο στον καλούντα: θα ήταν κανόνας που ο επόμενος');
      console.error('      καλών πρέπει να θυμάται (ADR-787 §5.2 στ).');
      console.error('   Αν είναι σκόπιμο: `// workspace-authority-exempt: <λόγος>` — ο λόγος ΥΠΟΧΡΕΩΤΙΚΟΣ.');
      return process.exit(1);
    }
  }
  return runSetRatchetCli(DESCRIPTOR, process.argv);
}

if (require.main === module) {
  main().catch((e) => { console.error(`❌ CHECK 3.58 — ${e.message}`); process.exit(1); });
}

module.exports = {
  classify, tally, measure, buildPayload, loadRegistry, reservedNamesOf,
  isServerFile, definesSymbol, ledgerLine, triggers, main,
  REGISTRY, BASELINE, EXEMPT, WORKSPACE_TOPIC,
};
