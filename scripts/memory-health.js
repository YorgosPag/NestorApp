#!/usr/bin/env node
/**
 * memory-health.js — Υγεία του auto-memory (index recall, όχι μέγεθος).
 *
 * ΓΙΑΤΙ ΥΠΑΡΧΕΙ: το `MEMORY.md` είναι ΕΥΡΕΤΗΡΙΟ. Η μόνη δουλειά του είναι να
 * οδηγεί στο σωστό αρχείο τη σωστή στιγμή. Ένα memory που δεν είναι
 * προσβάσιμο από το ευρετήριο ΔΕΝ είναι μνήμη — είναι bytes στον δίσκο που
 * κανείς δεν θα διαβάσει, και που μπαγιατεύουν σιωπηλά.
 *
 * Μετράει 4 πράγματα, όλα actionable:
 *   1. REACHABILITY — BFS από MEMORY.md μέσω [[wikilinks]] + markdown links
 *   2. SIZE         — ένα memory = ένα γεγονός. >4KB = φουσκωμένο, >10KB = αρχείο
 *   3. DEPTH        — ό,τι είναι >2 άλματα μακριά είναι de facto αόρατο
 *   4. BROKEN       — δείκτες σε ανύπαρκτα αρχεία
 *
 * Χρήση:
 *   node scripts/memory-health.js            # αναφορά για ανθρώπους
 *   node scripts/memory-health.js --json     # για εργαλεία/CI
 *   node scripts/memory-health.js --list-unreachable   # ονόματα, για αρχειοθέτηση
 */

const store = require('./lib/memory/memory-store');
const {
  DEPTH_PRACTICAL,
  normalizeId,
  extractLinks,
  buildAliasMap,
  resolveLink,
  computeReachability,
} = require('./lib/memory/memory-graph');

const { MEMORY_DIR, INDEX } = store;

/** Κατώφλια. Ένα memory = ένα γεγονός· αν θέλει 4KB δεν είναι γεγονός, είναι δοκίμιο. */
const SIZE_BLOATED = 4_000;
const SIZE_ARCHIVE = 10_000;

// ── ανάγνωση (ένας ορισμός, στο lib/memory/memory-store.js) ─────────────────

function readMemoryFiles() {
  try {
    return store.listSlugs();
  } catch (err) {
    console.error(`✖ ${err.message}`);
    process.exit(2);
  }
}

const readFile = (slug) => store.readRaw(slug);
const sizeOf = (slug) => store.sizeOf(slug);
const nameOf = (slug) => store.readField(store.readRaw(slug), 'name');

const aliasMapFor = (files) => buildAliasMap(files, nameOf);
const reachabilityFor = (files, alias) => computeReachability(store.readIndex(), alias, readFile);

/**
 * Διαχωρίζει typo από σκόπιμη πρόθεση. Η policy λέει ρητά ότι ένα `[[name]]` χωρίς
 * αρχείο είναι ΘΕΜΙΤΟ («marks something worth writing later»). Αν κοκκινίζουμε σε
 * αυτά, το εργαλείο γίνεται θόρυβος και το αγνοεί κανείς — αστοχία στον ≤10%
 * false-positive πήχη για blocking checks. Άρα: μοιάζει με υπαρκτό αρχείο → TYPO
 * (σφάλμα, διορθώσιμο). Δεν μοιάζει με τίποτα → INTENT (καταγράφεται, δεν μπλοκάρει).
 */
function classifyBroken(link, files) {
  const tokens = (s) => new Set(normalizeId(s).split('_').filter((t) => t.length > 2));
  const want = tokens(link);
  if (want.size === 0) return { kind: 'intent' };
  let best = { score: 0, slug: null };
  for (const slug of files) {
    const have = tokens(slug);
    let hit = 0;
    for (const t of want) if (have.has(t)) hit++;
    const score = hit / want.size;
    if (score > best.score) best = { score, slug };
  }
  return best.score >= 0.6 ? { kind: 'typo', suggest: best.slug } : { kind: 'intent' };
}

/** Δείκτες (από index + από κάθε memory) που δεν λύνονται σε ΚΑΝΕΝΑ αρχείο. */
function findBrokenLinks(files, alias) {
  const broken = new Map();
  const sources = [[INDEX, store.readIndex()], ...[...files].map((f) => [`${f}.md`, readFile(f)])];
  for (const [src, text] of sources) {
    for (const link of extractLinks(text)) {
      if (link.startsWith('http') || resolveLink(link, alias)) continue;
      if (!broken.has(link)) broken.set(link, []);
      broken.get(link).push(src);
    }
  }
  return broken;
}

/**
 * Ασυνέπειες ταυτότητας: το `name:` δεν ταιριάζει με το filename, ή λείπει,
 * ή είναι ελεύθερος τίτλος αντί για slug. Αυτό είναι το ρίζα-αίτιο των
 * «σπασμένων» wikilinks — ο resolver το κρύβει, ο έλεγχος το εκθέτει.
 */
function auditIdentity(files) {
  const mismatched = [];
  const missing = [];
  const notSlug = [];
  for (const slug of files) {
    const name = nameOf(slug);
    if (!name) {
      missing.push(slug);
      continue;
    }
    if (!/^[a-z0-9][a-z0-9-]*$/.test(name)) notSlug.push({ slug, name });
    else if (normalizeId(name) !== normalizeId(slug)) mismatched.push({ slug, name });
  }
  return { mismatched, missing, notSlug };
}

/**
 * ΣΧΗΜΑ ΕΥΡΕΤΗΡΙΟΥ — ο λόγος που το ευρετήριο έπαψε να μεγαλώνει (28/07).
 *
 * Το όριο των 17.510 bytes δεν παραβιάζεται από τον ΟΓΚΟ της μνήμης (3.5 MB, κανείς
 * δεν τα μετρά) αλλά από τη ΜΟΡΦΗ του ευρετηρίου: κάθε μεμονωμένο memory που παίρνει
 * δική του γραμμή κάνει το κόστος O(memories). Με hubs γίνεται O(τομείς) — σταθερό.
 * Μέτρηση 28/07: 158 δείκτες, από τους οποίους 132 μεμονωμένοι κατανάλωναν τον χώρο
 * για να καλύψουν 132· τα 26 hubs κάλυπταν 300+ σε 26 γραμμές (~12x πυκνότερα).
 *
 * Γι' αυτό ο κανόνας είναι ΣΧΗΜΑ, όχι μέγεθος: ένα μέγεθος-gate χτυπά αφού γεμίσει
 * και σε στέλνει σε άλλον έναν γύρο συμπύκνωσης· ένα σχήμα-gate δεν το αφήνει να
 * γεμίσει ποτέ. Νέο memory → μπαίνει σε hub → το ευρετήριο ΔΕΝ αλλάζει.
 *
 * Εξαιρέσεις (by design, όχι χαλάρωση):
 *  • το ίδιο το συμβόλαιο — ζει στην κεφαλίδα ως κανόνας, όχι ως γνώση τομέα
 *  • ο δείκτης WIP — μοναδικός, εξ ορισμού εκτός θεματικής ταξινόμησης
 */
const INDEX_SHAPE_EXEMPT = new Set([
  'reference_memory_health_contract',
  'project_active_handoff_state',
]);
const isHub = (slug) => slug.endsWith('_hub');

function auditIndexShape(rootSlugs) {
  return [...rootSlugs].filter((s) => !isHub(s) && !INDEX_SHAPE_EXEMPT.has(s)).sort();
}

function classifySizes(files) {
  const bloated = [];
  const archive = [];
  for (const slug of files) {
    const size = sizeOf(slug);
    if (size >= SIZE_ARCHIVE) archive.push({ slug, size });
    else if (size >= SIZE_BLOATED) bloated.push({ slug, size });
  }
  const bySize = (a, b) => b.size - a.size;
  return { bloated: bloated.sort(bySize), archive: archive.sort(bySize) };
}

/**
 * Πόσοι ΖΩΝΤΑΝΟΙ δείκτες οδηγούν σε κάθε αρχείο. inbound === 1 σημαίνει ότι μία
 * μόνο διαγραφή γραμμής το κάνει απρόσιτο — και αν είναι κόμβος αλυσίδας, παίρνει
 * μαζί του ΟΛΟΥΣ τους κατιόντες. Συνέβη: ένας δείκτης κρατούσε 6 memories.
 *
 * ⚠️ Δεν είναι μετρική ευθραυστότητας από μόνο του: δείκτης από το ευρετήριο ή από
 * hub είναι **by design** (index-rooted). Γνήσια εύθραυστο = κρέμεται από ΕΝΑ απλό memory.
 */
function countInbound(files, alias) {
  const inbound = new Map([...files].map((f) => [f, 0]));
  for (const text of [store.readIndex(), ...[...files].map(readFile)]) {
    for (const raw of extractLinks(text)) {
      const t = resolveLink(raw, alias);
      if (t) inbound.set(t, (inbound.get(t) ?? 0) + 1);
    }
  }
  return inbound;
}

/** Χωρίζει τους άλυτους δείκτες σε typo (σφάλμα) και intent (θεμιτό «γράψ' το αργότερα»). */
function splitBrokenLinks(broken, files) {
  const typos = [];
  const intents = [];
  for (const [link, srcs] of broken) {
    const c = classifyBroken(link, files);
    (c.kind === 'typo' ? typos : intents).push({ link, srcs, suggest: c.suggest });
  }
  return { typos, intents };
}

function analyze() {
  const files = readMemoryFiles();
  const alias = aliasMapFor(files);
  const { depth, rootSlugs } = reachabilityFor(files, alias);
  const unreachable = [...files].filter((f) => !depth.has(f)).sort();
  const deepOnly = [...depth.entries()]
    .filter(([, d]) => d > DEPTH_PRACTICAL)
    .map(([slug]) => slug)
    .sort();
  const inbound = countInbound(files, alias);
  const broken = findBrokenLinks(files, alias); // ΜΙΑ σάρωση — τη μοιράζονται και οι δύο πελάτες
  const indexBytes = store.indexBytes();

  return {
    memoryDir: MEMORY_DIR,
    indexBytes,
    index: store.classifyIndexSize(indexBytes),
    total: files.size,
    indexed: rootSlugs.size,
    indexNonHub: auditIndexShape(rootSlugs),
    reachable: depth.size,
    unreachable,
    deepOnly,
    depthOf: depth,
    inbound,
    fragile: [...inbound.entries()].filter(([, n]) => n === 1).map(([s]) => s).sort(),
    totalBytes: [...files].reduce((n, f) => n + sizeOf(f), 0),
    deadBytes: unreachable.reduce((n, f) => n + sizeOf(f), 0),
    broken,
    brokenKind: splitBrokenLinks(broken, files),
    identity: auditIdentity(files),
    ...classifySizes(files),
  };
}

// ── executable provenance ───────────────────────────────────────────────────

/**
 * ΓΙΑΤΙ ΥΠΑΡΧΕΙ (και γιατί ξεπερνά τα Zep/Letta/Mem0):
 * Η βιομηχανία λύνει το staleness με `last_verified` timestamps + temporal decay —
 * δηλαδή **μαντεύει** πόσο πιθανό είναι ένα fact να ισχύει ακόμα. Ένα timestamp λέει
 * «κάποιος κοίταξε τον Απρίλιο». Εμείς έχουμε κάτι που εκείνοι δεν έχουν: **τον κώδικα**.
 *
 * Ένα memory που λέει «GRIP_SIZE_DEFAULT=7» δεν χρειάζεται decay heuristic — χρειάζεται
 * ένα grep. Βάλε στο frontmatter:
 *
 *   metadata:
 *     type: reference
 *     verify: "grep -rq 'GRIP_SIZE_DEFAULT = 7' src/subapps/dxf-viewer"
 *
 * και το `--verify` το εκτελεί. FAIL = το memory είναι **αποδεδειγμένα ψευδές τώρα**,
 * όχι «πιθανώς μπαγιάτικο». Opt-in flag: εκτελεί εντολές, δεν τρέχει ποτέ by default.
 */
function runVerifications(files, repoRoot) {
  const { execSync } = require('child_process');
  const results = { passed: [], failed: [], none: 0 };
  for (const slug of [...files].sort()) {
    // Μόνο το frontmatter — αλλιώς ένα `verify:` μέσα σε ```yaml παράδειγμα
    // τεκμηρίωσης μετριέται ως πραγματικό assertion (φούσκωνε το «επιβεβαιωμένα»).
    const fm = store.splitFrontmatter(readFile(slug));
    // Greedy quotes: η εντολή περιέχει σχεδόν πάντα εσωτερικά quotes (grep -q "…").
    const m = fm && fm.frontmatter.match(/^\s*verify:\s*(?:"(.+)"|'(.+)'|(.+?))\s*$/m);
    if (!m) {
      results.none++;
      continue;
    }
    const cmd = (m[1] || m[2] || m[3]).trim();
    try {
      execSync(cmd, { cwd: repoRoot, stdio: 'ignore', timeout: 30_000, shell: 'bash' });
      results.passed.push({ slug, cmd });
    } catch {
      results.failed.push({ slug, cmd });
    }
  }
  return results;
}

// ── αναφορά ─────────────────────────────────────────────────────────────────

const pct = (n, d) => (d === 0 ? 0 : Math.round((100 * n) / d));
const kb = (n) => `${(n / 1024).toFixed(1)} KB`;

function verdict(r) {
  const dead = pct(r.unreachable.length, r.total);
  // Το ευρετήριο πάνω από το όριο υπερισχύει κάθε άλλης μετρικής: αν αποκοπεί,
  // το 100% προσβασιμότητας δεν σημαίνει τίποτα — κανείς δεν θα το διαβάσει.
  if (r.index.blocking || r.indexNonHub.length > 0) return ['🔴', 'ΝΟΣΕΙ'];
  if (dead <= 10 && r.brokenKind.typos.length === 0) return ['✅', 'ΥΓΙΕΣ'];
  if (dead <= 25) return ['⚠️', 'ΟΡΙΑΚΟ'];
  return ['🔴', 'ΝΟΣΕΙ'];
}

/** Η μία γραμμή που έλειπε: πόσο περιθώριο έμεινε πριν κοπεί σιωπηλά το ευρετήριο. */
function reportIndex(idx) {
  const { INDEX_SOFT_LIMIT: soft, INDEX_HARD_LIMIT: hard } = store;
  const of = `${idx.bytes} / ${soft} bytes`;
  console.log('\nΕΥΡΕΤΗΡΙΟ — φορτώνεται σε ΚΑΘΕ session');
  if (idx.level === 'critical') {
    console.log(`  🔴 ${of} — ΠΑΝΩ ΚΑΙ ΑΠΟ ΤΟ HARD ΟΡΙΟ (${hard}): ΑΠΟΚΟΠΤΕΤΑΙ ΤΩΡΑ.`);
    console.log('     Ό,τι είναι κάτω από το σημείο κοπής ΔΕΝ φορτώνεται. Καμία προειδοποίηση.');
  } else if (idx.level === 'over') {
    console.log(`  🔴 ${of} — ΥΠΕΡΒΑΣΗ κατά ${-idx.margin} bytes.`);
    console.log(`     Hard όριο (σιωπηλή αποκοπή): ${hard} bytes.`);
  } else if (idx.level === 'warn') {
    console.log(`  ⚠️  ${of} — περιθώριο ${idx.margin} bytes (<${pct(1 - store.INDEX_WARN_RATIO, 1)}%).`);
  } else {
    console.log(`  ✅ ${of} — περιθώριο ${idx.margin} bytes.`);
  }
}

/** Το σχήμα είναι ο λόγος που το μέγεθος μένει σταθερό — γι' αυτό αναφέρεται δίπλα του. */
function reportIndexShape(nonHub) {
  if (nonHub.length === 0) {
    console.log('  ✅ σχήμα: μόνο hubs — το ευρετήριο δεν μεγαλώνει με νέα memories.');
    return;
  }
  console.log(`  🔴 σχήμα: ${nonHub.length} μεμονωμένα memories στη ρίζα — στέγασέ τα σε hub:`);
  for (const slug of nonHub.slice(0, 12)) console.log(`       ${slug}`);
  if (nonHub.length > 12) console.log(`       … +${nonHub.length - 12}`);
}

function reportRecall(r) {
  console.log('ΑΝΑΚΛΗΣΗ (το μόνο που μετράει)');
  console.log(`  Σύνολο memories        : ${r.total}`);
  console.log(`  Στο ευρετήριο (depth 1): ${r.indexed}  (${pct(r.indexed, r.total)}%)`);
  console.log(`  Προσβάσιμα (BFS)       : ${r.reachable}  (${pct(r.reachable, r.total)}%)`);
  console.log(
    `  🔴 ΑΠΡΟΣΙΤΑ            : ${r.unreachable.length}  (${pct(r.unreachable.length, r.total)}%)` +
      `  — ${kb(r.deadBytes)} / ${kb(r.totalBytes)} = ${pct(r.deadBytes, r.totalBytes)}% νεκρός όγκος`,
  );
  if (r.deepOnly.length) {
    console.log(`  ⚠️  Βάθος >${DEPTH_PRACTICAL} (de facto αόρατα): ${r.deepOnly.length}`);
  }
}

function reportSizeAndIdentity(r) {
  console.log('\nΜΕΓΕΘΟΣ (ένα memory = ένα γεγονός)');
  console.log(`  >${SIZE_ARCHIVE / 1000}KB  αρχείο, όχι memory : ${r.archive.length}`);
  console.log(`  >${SIZE_BLOATED / 1000}KB   φουσκωμένο         : ${r.bloated.length}`);
  for (const { slug, size } of r.archive.slice(0, 5)) {
    console.log(`     ${kb(size).padStart(9)}  ${slug}`);
  }

  const id = r.identity;
  console.log('\nΤΑΥΤΟΤΗΤΑ (ρίζα-αίτιο· χωρίς σταθερά ids ο γράφος είναι τύχη)');
  console.log(`  name: ≠ filename        : ${id.mismatched.length}`);
  console.log(`  name: ελεύθερος τίτλος  : ${id.notSlug.length}`);
  console.log(`  name: λείπει            : ${id.missing.length}`);
  if (id.mismatched.length + id.missing.length + id.notSlug.length === 0) {
    console.log('  ✅ κάθε αρχείο έχει ΕΝΑ προβλέψιμο αναγνωριστικό');
  }
}

function reportBrokenLinks({ typos, intents }) {
  if (typos.length) {
    console.log(`\n🔴 TYPO ΔΕΙΚΤΕΣ (μοιάζουν με υπαρκτό αρχείο → διόρθωσε): ${typos.length}`);
    for (const { link, srcs, suggest } of typos.slice(0, 10)) {
      console.log(`     [[${link}]] → μήπως [[${suggest}]] ?  ← ${srcs.slice(0, 2).join(', ')}`);
    }
  }
  if (intents.length) {
    console.log(`\n📝 ΑΓΡΑΦΑ (θεμιτά — «worth writing later», δεν μπλοκάρουν): ${intents.length}`);
    for (const { link } of intents.slice(0, 8)) console.log(`     [[${link}]]`);
  }
}

function report(r) {
  const [icon, label] = verdict(r);
  console.log(`\n📊 ΥΓΕΙΑ AUTO-MEMORY — ${icon} ${label}`);
  console.log(`   ${r.memoryDir}\n`);
  reportRecall(r);
  reportIndex(r.index);
  reportIndexShape(r.indexNonHub);
  reportSizeAndIdentity(r);
  reportBrokenLinks(r.brokenKind);

  console.log('\nΤΙ ΝΑ ΚΑΝΕΙΣ');
  if (r.index.blocking) {
    console.log('  • 🔴 ΕΥΡΕΤΗΡΙΟ ΠΑΝΩ ΑΠΟ ΤΟ ΟΡΙΟ → ανάκτησε περιθώριο ΤΩΡΑ:');
    console.log('    πρόζα WIP → memory ή HANDOFFS/ (το ευρετήριο δείχνει, δεν αφηγείται)·');
    console.log('    τομέας >6 γραμμών → hub με ΕΝΑ link (κανόνας κλιμάκωσης του συμβολαίου).');
  }
  if (r.unreachable.length > 0) {
    console.log(`  • ${r.unreachable.length} απρόσιτα → αρχειοθέτησε ή σύνδεσε από το ευρετήριο.`);
    console.log('    Λίστα: node scripts/memory-health.js --list-unreachable');
  }
  if (r.archive.length > 0) {
    console.log(`  • ${r.archive.length} >10KB → implementation log· ανήκει σε ADR + git, όχι εδώ.`);
  }
  if (r.brokenKind.typos.length > 0) console.log('  • Typo δείκτες → διόρθωσε στο όνομα που προτείνεται.');
  if (!r.unreachable.length && !r.brokenKind.typos.length && !r.archive.length && !r.index.blocking) {
    console.log('  • Τίποτα. Το ευρετήριο οδηγεί σε όλα, όλα είναι γεγονότα. 🎯');
  }
  console.log();
}

// ── gate ────────────────────────────────────────────────────────────────────

/**
 * `--gate` — presubmit mode. ΚΛΙΜΑΚΩΤΟ ΚΟΣΤΟΣ, by design:
 *
 *   φθηνό (πάντα)   ένα statSync στο ευρετήριο, ~0ms. Αυτό είναι που σαπίζει
 *                   ΚΑΘΗΜΕΡΙΝΑ — κάθε εγγραφή memory το μεγαλώνει, από οποιονδήποτε
 *                   agent, σε οποιοδήποτε task. Δύο φορές ήδη ξεπεράστηκε σιωπηλά.
 *   `--full` (σπάνιο) BFS σε 458 αρχεία, ~1.1s. Ο γράφος χαλάει μόνο όταν αλλάζει
 *                   ο κώδικας που τον γράφει → τρέχει όταν αγγίζονται τα memory tools.
 *
 * ΓΙΑΤΙ ΟΧΙ «μόνο όταν αγγίζεις scripts/memory-*»: η αιτία της σαπίλας είναι η
 * **εγγραφή στη μνήμη**, όχι η αλλαγή στα scripts. Στη Φ2 ο άλλος agent ξεπέρασε
 * το όριο ενώ δούλευε σε DXF — κανένα memory script δεν είχε σταλεί. Ένα trigger
 * που δεν συσχετίζεται με την αιτία δεν είναι gate, είναι διακόσμηση.
 *
 * ΠΟΤΕ `--verify` εδώ: εκτελεί 96 εντολές του χρήστη. Presubmit δεν εκτελεί εντολές.
 */
function runGate() {
  if (!store.memoryDirExists()) {
    console.log(`⏭️  memory gate: skip — δεν υπάρχει ${MEMORY_DIR}`);
    process.exit(0);
  }
  const idx = store.classifyIndexSize(store.indexBytes());
  if (idx.blocking) {
    console.error(`\n🚫 ΕΥΡΕΤΗΡΙΟ ΜΝΗΜΗΣ: ${idx.bytes} bytes > όριο ${store.INDEX_SOFT_LIMIT}`);
    console.error(
      idx.level === 'critical'
        ? '   ΑΠΟΚΟΠΤΕΤΑΙ ΗΔΗ ΣΙΩΠΗΛΑ — το κάτω μισό δεν φορτώνεται σε καμία session.'
        : `   Υπέρβαση κατά ${-idx.margin} bytes· hard όριο (σιωπηλή αποκοπή): ${store.INDEX_HARD_LIMIT}.`,
    );
    console.error('   Θεραπεία: πρόζα WIP → memory ή HANDOFFS/· τομέας >6 γραμμών → hub.');
    console.error('   ΠΟΤΕ διαγραφή εγγραφής για να χωρέσει.\n');
    process.exit(1);
  }
  // ΣΧΗΜΑ — φθηνό όσο και το statSync (ένα readFile + regex, χωρίς BFS) και είναι η
  // ΑΙΤΙΑ που το μέγεθος ξεφεύγει. Ελέγχεται εδώ, όχι μόνο στην πλήρη αναφορά: ένας
  // κανόνας που τρέχει μόνο όταν κάποιος θυμηθεί να τον τρέξει δεν είναι gate.
  const rootSlugs = [...extractLinks(store.readIndex())].filter((l) => /^[a-z0-9_]+$/.test(l));
  const nonHub = auditIndexShape(new Set(rootSlugs));
  if (nonHub.length > 0) {
    console.error(`\n🚫 ΣΧΗΜΑ ΕΥΡΕΤΗΡΙΟΥ: ${nonHub.length} μεμονωμένα memories στη ρίζα.`);
    console.error('   Το ευρετήριο δείχνει ΜΟΝΟ σε hubs — αλλιώς μεγαλώνει O(memories).');
    for (const slug of nonHub.slice(0, 12)) console.error(`     ${slug}`);
    if (nonHub.length > 12) console.error(`     … +${nonHub.length - 12}`);
    console.error('   Θεραπεία: στέγασέ τα σε hub (bullet στο hub) ΚΑΙ σβήσε τη γραμμή εδώ.\n');
    process.exit(1);
  }
  const warn = idx.level === 'warn' ? `  ⚠️ περιθώριο ${idx.margin} bytes` : '';
  if (!process.argv.includes('--full')) {
    console.log(`✅ memory gate: ευρετήριο ${idx.bytes}/${store.INDEX_SOFT_LIMIT} bytes${warn}`);
    process.exit(0);
  }
  const r = analyze();
  const dead = pct(r.unreachable.length, r.total);
  if (dead > 25 || r.brokenKind.typos.length > 0) {
    console.error(`\n🚫 ΓΡΑΦΟΣ ΜΝΗΜΗΣ: απρόσιτα ${dead}% · typo δείκτες ${r.brokenKind.typos.length}`);
    console.error('   Τρέξε: npm run memory:health\n');
    process.exit(1);
  }
  console.log(`✅ memory gate (full): ${r.reachable}/${r.total} προσβάσιμα${warn}`);
  process.exit(0);
}

// ── main ────────────────────────────────────────────────────────────────────

if (process.argv.includes('--gate')) runGate();

const result = analyze();

if (process.argv.includes('--verify')) {
  const v = runVerifications(readMemoryFiles(), process.cwd());
  const total = v.passed.length + v.failed.length;
  console.log(`\n🔬 EXECUTABLE PROVENANCE — ${total} memories με \`verify:\` (${v.none} χωρίς)\n`);
  for (const { slug, cmd } of v.failed) {
    console.log(`  ❌ ${slug}\n       ${cmd}`);
  }
  for (const { slug } of v.passed) console.log(`  ✅ ${slug}`);
  if (total === 0) {
    console.log('  Κανένα memory δεν έχει `verify:`. Πρόσθεσε σε ό,τι είναι grep-άρισιμο —');
    console.log('  ένα επαληθεύσιμο memory δεν μπαγιατεύει σιωπηλά.');
  } else {
    console.log(
      `\n  ${v.failed.length} ΑΠΟΔΕΔΕΙΓΜΕΝΑ ΨΕΥΔΗ / ${v.passed.length} επιβεβαιωμένα.`,
    );
  }
  console.log();
  process.exit(v.failed.length ? 1 : 0);
}

if (process.argv.includes('--list-deep')) {
  // Βάθος + εισερχόμενοι δείκτες + μέγεθος: αρκετά για να κριθεί «ανέβασέ το ή άσ' το».
  console.log('βάθος  inbound  μέγεθος  slug');
  for (const slug of result.deepOnly) {
    console.log(
      `${String(result.depthOf.get(slug)).padStart(5)}  ${String(result.inbound.get(slug)).padStart(7)}  ` +
        `${kb(sizeOf(slug)).padStart(7)}  ${slug}`,
    );
  }
  console.log(`\nΕΥΘΡΑΥΣΤΑ (inbound === 1, μία διαγραφή τα εξαφανίζει): ${result.fragile.length}`);
} else if (process.argv.includes('--list-unreachable')) {
  console.log(result.unreachable.join('\n'));
} else if (process.argv.includes('--json')) {
  console.log(
    JSON.stringify(
      { ...result, broken: Object.fromEntries(result.broken) },
      null,
      2,
    ),
  );
} else {
  report(result);
}

/**
 * Exit 1 όταν νοσεί → μπορεί να μπει σε gate όποτε το αποφασίσει ο Giorgio.
 * Ο λόγος τυπώνεται ΠΑΝΤΑ σε stderr: τα modes `--json` / `--list-*` δεν βγάζουν
 * αναφορά, και ένα σκέτο exit 1 χωρίς αιτία είναι ακριβώς η σιωπηλή αστοχία
 * που πολεμά αυτό το εργαλείο.
 */
const dead = pct(result.unreachable.length, result.total);
const failures = [];
if (dead > 25) failures.push(`απρόσιτα ${dead}% > 25%`);
if (result.brokenKind.typos.length > 0) failures.push(`${result.brokenKind.typos.length} typo δείκτες`);
if (result.indexNonHub.length > 0) {
  failures.push(`${result.indexNonHub.length} μεμονωμένα memories στο ευρετήριο (μόνο hubs)`);
}
if (result.index.blocking) {
  failures.push(
    `ευρετήριο ${result.index.bytes} bytes > όριο ${store.INDEX_SOFT_LIMIT}` +
      (result.index.level === 'critical' ? ' (ΑΠΟΚΟΠΤΕΤΑΙ ΗΔΗ)' : ''),
  );
}
if (failures.length) console.error(`✖ ΜΠΛΟΚ: ${failures.join(' · ')}\n`);
process.exit(failures.length ? 1 : 0);
