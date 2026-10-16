#!/usr/bin/env node
/**
 * ADR-744 §5 — the single code path.
 *
 * The generator and the gate MUST agree on what the slice should be, or the
 * gate is checking a fiction. So neither owns the computation: both call
 * `buildShellPlan()` and `renderArtifacts()` here. This is the same discipline
 * ADR-727 applied when `check-i18n-types-freshness.js` was made to call
 * `collectTranslationData()` instead of re-implementing the read loop.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const MG = require('../module-graph');
const { collectSourceFiles } = require('../module-graph/scan-config');
const {
  loadNamespaceBundles,
  extractNamespaces,
  extractTCalls,
  stripComments,
} = require('../i18n-namespace-extract');
const { computeShellClosure, walkSurface } = require('./shell-closure');
const { loadKeyConstants, classifyParsedCalls, extractSurface, parseSource } = require('./key-extract');
const { collectExportedTables } = require('./key-tables');
const { analysisFor, NO_ANALYSIS_MEMO } = require('./source-cache');
const { policyFor } = require('./config');
const { buildSlices, stableStringify, fingerprintShellFile } = require('./slice-build');
const { TS_PATH_ALIAS_CONFIG, computeGlobalInputs } = require('./global-inputs');
// N.7.1 — η σειριοποίηση (manifest) και η κληρονομιά namespace (§18) ζουν σε δικά τους modules·
// εδώ επανεξάγονται, ώστε οι καταναλωτές του `plan` να μην αλλάξουν.
const ManifestBuild = require('./manifest-build');
const NamespaceInheritance = require('./namespace-inheritance');
// ADR-744 §32.12 — και οι ρίζες του κελύφους (δεύτερος καταναλωτής: το ίχνος των μελών).
const { patternToRegExp, resolveRoots, rootPatternCandidates } = require('./shell-roots');
const { buildManifest } = ManifestBuild;
const { inheritNamespaces, effectiveNamespaces, needsFileNamespaces } = NamespaceInheritance;

const MANIFEST_NAME = 'shell-slice.manifest.json';

/**
 * ADR-744 §11 — η λίστα των namespaces που το slice φέρνει ΟΛΟΚΛΗΡΑ.
 *
 * Το manifest το ξέρει ήδη (`wants[ns].whole`), αλλά το manifest είναι 153 KB:
 * το να το εισαγάγει ο client για να διαβάσει εννιά ονόματα θα ακύρωνε το ίδιο
 * το κέρδος που αυτό το ADR μέτρησε. Άρα η ίδια αλήθεια εξάγεται δεύτερη φορά,
 * σε ~200 bytes, από την **ίδια** πηγή στο **ίδιο** πέρασμα — δεν είναι δεύτερη
 * λίστα, είναι δεύτερη προβολή της πρώτης.
 *
 * Χωρίς αυτό, το runtime δεν έχει τρόπο να ξεχωρίσει «κομμένο» από «πλήρες»:
 * το i18next απαντά μόνο «υπάρχει κάτι». Βλ. `src/i18n/bundle-registry.ts`.
 */
const WHOLE_NAME = 'shell-slice.whole.json';
const sliceName = language => `shell-slice.${language}.json`;

function buildModuleGraph(projectRoot) {
  const files = collectSourceFiles(projectRoot, ['src']);
  return MG.buildGraph({
    projectRoot,
    aliases: MG.readTsPathAliases(projectRoot, TS_PATH_ALIAS_CONFIG),
    files,
    readFile: file => fs.readFileSync(file, 'utf8'),
    onParseError: () => {},
  });
}

/**
 * PHASE A — the file-local surface of one shell module, and the only thing the
 * fingerprint is computed from. See `extractSurface` for why resolution results
 * must stay out of it.
 */
/** Ο δίσκος — μόνο για γράφους που δεν ξέρουν από πού ήρθαν (δοκιμές, `checkStagedShellFiles`). */
const readDiskText = abs => fs.readFileSync(abs, 'utf8');

/**
 * ADR-744 §32 Β1 — το κείμενο έρχεται από **τον γράφο** (δίσκος, ευρετήριο, γονέας), ποτέ από `fs` εδώ:
 * αλλιώς ο walk θα έκρινε το ευρετήριο και η επιφάνεια τον δίσκο (ξένη WIP, μάθημα 2026-09-27).
 */
function readModuleText(graph, abs, relFile) {
  const text = (graph.readText || readDiskText)(abs);
  if (text === null || text === undefined) throw new Error(`${relFile} δεν διαβάζεται από την πηγή του γράφου.`);
  return text;
}

/** Το AST του (ήδη χωρίς σχόλια) κειμένου — ΕΝΑ για ταξινόμηση και εξαγόμενους πίνακες. */
function parsedSource(surface, memo) {
  return memo.once(surface.abs, 'ast', surface.source, () => parseSource(surface.abs, surface.source));
}

function analyseFile(projectRoot, relFile, graph, context) {
  const abs = MG.toPosix(path.join(projectRoot, relFile));
  const mod = graph.modules.get(abs);
  // ADR-744 §31 — ΟΛΗ η επιφάνεια που διαβάζει ο walk (ονόματα εισαγωγών, εξαγωγές, re-exports).
  const importSpecs = walkSurface(mod);
  const excluded = context.excludeConsumers.some(prefix => relFile.startsWith(prefix));

  if (excluded) {
    return { abs, importSpecs, namespaces: [], callTexts: [], harvest: new Map(), excluded: true };
  }

  const memo = context.analysis || NO_ANALYSIS_MEMO;
  const raw = readModuleText(graph, abs, relFile);
  const source = memo.once(abs, 'stripped', raw, () => stripComments(raw));
  // ⚠️ ADR-744 §29 — ΟΛΗ η επιφάνεια ταξιδεύει (`resolution` μαζί): μια αποδόμηση που
  // διαλέγει πεδία πέταγε σιωπηλά ό,τι πρόσθετε το `extractSurface` στο αποτύπωμα.
  const surface = memo.once(abs, 'surface', source, () => extractSurface(source, { file: abs }));
  return {
    abs,
    source,
    importSpecs,
    // ⚠️ Τα bundles είναι καθολική είσοδος (E), ίδια σε όλο το πέρασμα ⇒ κλειδί μόνο το κείμενο.
    namespaces: memo.once(abs, 'namespaces', source, () => extractNamespaces(source, context.bundles)),
    ...surface,
    excluded: false,
  };
}

/** Η τιμή της μνήμης μοιράζεται σε κλειστότητες ⇒ μετάλλαξη ρίχνει, αντί να μολύνει την επόμενη. */
function freezeClassified(sink) {
  for (const list of [sink.keys, sink.prefixes, sink.unresolved]) list.forEach(Object.freeze);
  return Object.freeze({ ...sink, keys: Object.freeze(sink.keys), prefixes: Object.freeze(sink.prefixes), unresolved: Object.freeze(sink.unresolved) });
}

/** PHASE B — resolution, which may consult literals anywhere in the shell. */
function resolveFileKeys(surface, context) {
  if (surface.excluded) return { keys: [], prefixes: [], unresolved: [] };
  const memo = context.analysis || NO_ANALYSIS_MEMO;
  // ADR-744 §32.13 — εξαρτάται από harvest + πίνακες ΤΗΣ ΚΛΕΙΣΤΟΤΗΤΑΣ ⇒ μνήμη με ίχνος αναγνώσεων:
  // ίδιο κείμενο + ίδιες απαντήσεις σε ό,τι ΡΩΤΗΣΕ ⇒ ίδια τιμή (κοινή, άρα παγωμένη).
  const lookups = { keyConstants: context.keyConstants, propertyValues: context.shellHarvest, closureConstants: context.closureConstants };
  const classified = memo.onceTraced(surface.abs, 'classified', surface.source, lookups,
    observed => freezeClassified(classifyParsedCalls(parsedSource(surface, memo), observed)));
  const tCalls = memo.once(surface.abs, 'tCalls', surface.source, () => extractTCalls(surface.source));
  const literals = tCalls.map(({ key }) => ({ ns: null, key }));
  return {
    keys: [...literals, ...classified.keys],
    prefixes: classified.prefixes,
    unresolved: classified.unresolved,
  };
}

/** Union of every module-level literal property in the shell, keyed by property name. */
function mergeHarvest(target, harvest) {
  for (const [name, values] of harvest) {
    if (!target.has(name)) target.set(name, new Set());
    const bucket = target.get(name);
    values.forEach(value => bucket.add(value));
  }
  return target;
}

/**
 * 🔴 ADR-744 §23 — ΤΟ `from` ΔΕΝ ΕΙΝΑΙ ΔΙΑΓΝΩΣΤΙΚΟ, ΕΙΝΑΙ Η ΑΙΤΙΑ.
 *
 * Μέχρι σήμερα το σχέδιο κατέγραφε **τι** θέλει το κέλυφος και ποτέ **ποιος** το
 * ζητά. Μετρημένο 2026-09-04: ένα `import { criterionLabel }` μέσα στο `ListingCard`
 * έσυρε δύο ολόκληρα namespaces σε ~150 διαδρομές, και η μόνη ένδειξη ήταν
 * **παρενέργεια** — 8 άσχετες διαδρομές έχασαν ταυτόχρονα ένα prefix. Με το `from`
 * γραμμένο, η ίδια αλλαγή ονομάζει **το αρχείο** που την προκάλεσε.
 *
 * 🏆 ΠΟΥ ΞΕΠΕΡΝΑΜΕ ΤΗΝ ΠΡΑΚΤΙΚΗ: το webpack `--stats-reasons` ξέρει «ποιος εισήγαγε
 * αυτό το module» και το εμφανίζει ως **αναφορά** που τη διαβάζει άνθρωπος όταν ήδη
 * υποψιάζεται. Εδώ η ίδια πληροφορία γίνεται **συμβόλαιο**: η δήλωση στο μητρώο
 * ονομάζει τον υπαίτιο, και η πύλη επαληθεύει ότι **εξακολουθεί** να τον σέρνει.
 */
function wantFor(wants, namespace) {
  let want = wants.get(namespace);
  if (!want) {
    want = { keys: new Set(), prefixes: new Set(), whole: false, from: new Set() };
    wants.set(namespace, want);
  }
  return want;
}

/** Καταγράφει ότι **αυτό** το αρχείο του κελύφους ζητά **αυτό** το namespace. */
function attribute(wants, namespace, file) {
  if (file === null) return;
  wantFor(wants, namespace).from.add(file);
}

/**
 * A key with no explicit namespace goes into EVERY namespace the file declares —
 * which is what i18next does at runtime (it tries the list in order). Slicing it
 * from a namespace that does not define it costs nothing: `pruneNamespace` finds
 * no value and drops it.
 */
function addEntry(wants, namespaces, entry, bucket, file = null) {
  const targets = entry.ns !== null ? [entry.ns] : namespaces;
  for (const namespace of targets) {
    wantFor(wants, namespace)[bucket].add(entry.key ?? entry.prefix);
    attribute(wants, namespace, file);
  }
}

function applyPolicy(wants, policy, namespaces, file = null) {
  for (const namespace of policy.wholeNamespaces) {
    wantFor(wants, namespace).whole = true;
    attribute(wants, namespace, file);
  }
  for (const entry of policy.prefixes) addEntry(wants, namespaces, entry, 'prefixes', file);
  for (const entry of policy.keys) addEntry(wants, namespaces, entry, 'keys', file);
}

function foldFileIntoWants(wants, namespaces, resolved, policy, file = null) {
  for (const entry of resolved.keys) addEntry(wants, namespaces, entry, 'keys', file);
  for (const entry of resolved.prefixes) {
    addEntry(wants, namespaces, { ns: entry.ns, key: entry.prefix }, 'prefixes', file);
  }
  if (policy) applyPolicy(wants, policy, namespaces, file);
}

/**
 * @returns {{closure, perFile: Map, wants: Map, violations: Array, unusedPolicy: string[]}}
 *   `violations` = a shell module with a dynamic `t()` the ladder could not
 *   resolve and no reviewed policy. Fatal for the generator (ADR-744 §4).
 *   `unusedPolicy` = a policy entry whose file no longer has any unresolved call
 *   — dead configuration, reported so the escape hatch cannot quietly rot.
 */
/**
 * PHASE A over the whole closure. Two passes exist because a generic renderer's
 * keys live in the module that CONFIGURES it (`RouteTabs` reads `tab.labelKey`;
 * the literals are in the layout that passes the tabs), and that module may be
 * walked after the renderer. Harvesting everything first removes the ordering
 * dependency entirely.
 */
/**
 * 🔴 ADR-777 §8.39 — ΤΟ ΕΥΡΕΤΗΡΙΟ ΠΙΝΑΚΩΝ ΤΗΣ ΚΛΕΙΣΤΟΤΗΤΑΣ.
 *
 * Μια κλήση `t(CATALOG_KEYS.empty)` δεν λύνεται από το δικό της αρχείο: ο πίνακας ζει
 * αλλού. Μετρημένο: **37** ανεπίλυτες σε μία σελίδα, άρα **άρνηση** route slice.
 *
 * ⚠️ **ΣΥΓΚΡΟΥΣΗ ΟΝΟΜΑΤΟΣ ⇒ ΤΟ ΟΝΟΜΑ ΠΕΤΑΓΕΤΑΙ, fail-closed.** Δύο modules που
 * εξάγουν `KEYS` με **διαφορετικό** περιεχόμενο δεν επιτρέπεται να απαντήσουν «κατά
 * τύχη»: η κλήση μένει **ανεπίλυτη** (θορυβώδης άρνηση) αντί να πάρει τα κλειδιά
 * του άλλου — το «μισή τιμή είναι μαντεψιά» του §8.36, σε επίπεδο module.
 */
function collectClosureTables(surfaces, memo = NO_ANALYSIS_MEMO) {
  const tables = new Map();
  const conflicted = new Set();
  for (const surface of surfaces.values()) {
    if (surface.excluded || surface.source === undefined) continue;
    const exported = memo.once(surface.abs, 'tables', surface.source, () => collectExportedTables(parsedSource(surface, memo)));
    for (const [name, table] of exported) {
      if (conflicted.has(name)) continue;
      const seen = tables.get(name);
      if (seen === undefined) { tables.set(name, table); continue; }
      const same = seen.size === table.size
        && [...seen].every(([key, value]) => table.get(key) === value);
      if (!same) { tables.delete(name); conflicted.add(name); }
    }
  }
  return tables;
}

function collectSurfaces(projectRoot, closure, graph, context) {
  const surfaces = new Map();
  const shellHarvest = new Map();
  for (const relFile of closure.files) {
    const surface = analyseFile(projectRoot, relFile, graph, context);
    surfaces.set(relFile, surface);
    mergeHarvest(shellHarvest, surface.harvest);
  }
  context.shellHarvest = shellHarvest;
  context.closureConstants = collectClosureTables(surfaces, context.analysis);
  return surfaces;
}

/**
 * Οι καθολικές είσοδοι ενός σχεδίου. ADR-744 §32 Β1 — φορτώνονται ΜΙΑ φορά ανά γράφο (κέλυφος + 67
 * διαδρομές = 68 αναγνώσεις του ίδιου αρχείου ως τώρα)· το κλειδί είναι ό,τι τις ορίζει.
 */
function planContext(projectRoot, config, graph) {
  const analysis = analysisFor(graph);
  const constantsSpec = JSON.stringify(config.keyConstants || null);
  return {
    analysis,
    bundles: analysis.once(projectRoot, 'bundles', projectRoot, () => loadNamespaceBundles(projectRoot)),
    keyConstants: analysis.once(projectRoot, `keyConstants ${constantsSpec}`, projectRoot, () => loadKeyConstants(projectRoot, config.keyConstants)),
    excludeConsumers: config.excludeConsumers,
  };
}

function buildShellPlan(projectRoot, config, graph) {
  const roots = resolveRoots(projectRoot, config, graph);
  const closure = computeShellClosure(graph, roots);
  const context = planContext(projectRoot, config, graph);
  const surfaces = collectSurfaces(projectRoot, closure, graph, context);
  // ADR-744 §18 — ποιο namespace παίρνει ένα αρχείο που δεν δηλώνει κανένα.
  const inherited = inheritNamespaces(projectRoot, surfaces, graph);

  // Phase B: resolve, fold, and demand a reviewed answer for anything left.
  const perFile = new Map();
  const wants = new Map();
  const violations = [];
  const usedPolicy = new Set();

  for (const [relFile, surface] of surfaces) {
    const resolved = resolveFileKeys(surface, context);
    const policy = policyFor(config, relFile);
    if (resolved.unresolved.length > 0) {
      if (policy) usedPolicy.add(relFile);
      else resolved.unresolved.forEach(u => violations.push({ file: relFile, ...u }));
    }
    const namespaces = effectiveNamespaces(relFile, surface, inherited);
    // 🔴 ADR-744 §18 — Η ΔΕΥΤΕΡΗ ΑΡΝΗΣΗ, ΔΙΠΛΑ ΣΕ ΕΚΕΙΝΗ ΤΗΣ ΔΥΝΑΜΙΚΗΣ t().
    // «Ξέρω το κλειδί, δεν ξέρω το namespace» καταλήγει στο ΙΔΙΟ αποτέλεσμα με το
    // «δεν ξέρω το κλειδί»: κλειδί εκτός slice, ωμό στην οθόνη. Η μόνη διαφορά
    // ήταν ότι αυτό εδώ ήταν **σιωπηλό**.
    if (namespaces.length === 0 && needsFileNamespaces(resolved)) {
      // ⚠️ Ο ΜΗΧΑΝΙΣΜΟΣ ΔΙΑΦΥΓΗΣ ΕΙΝΑΙ Ο ΙΔΙΟΣ ΜΕ ΤΗΝ ΑΔΕΛΦΗ ΑΡΝΗΣΗ, ΚΑΙ ΟΧΙ ΔΕΥΤΕΡΟΣ. Μια
      // εγγραφή `dynamicKeyPolicy` ΕΙΝΑΙ ακριβώς «άνθρωπος απάντησε το ερώτημα
      // κλειδί→namespace γι' αυτό το αρχείο, με λόγο» — το ίδιο ερώτημα που θέτει και
      // η δυναμική `t()`. Δεύτερος μηχανισμός θα ήταν δεύτερη αλήθεια (ADR-749).
      // ⚠️ Το `usedPolicy` ΓΡΑΦΕΤΑΙ ΕΔΩ ΕΠΙΤΗΔΕΣ: χωρίς αυτό, μια εγγραφή που
      // υπηρετεί ΜΟΝΟ αυτή την άρνηση θα αναφερόταν «νεκρή» — και μια ψεύτικη
      // προειδοποίηση νεκρού φρουρού οδηγεί στη ΔΙΑΓΡΑΦΗ φρουρού που δουλεύει
      // (το ίδιο μάθημα με το `unusedPolicy` των route slices, §15).
      if (policy) {
        usedPolicy.add(relFile);
      } else {
        // ⚠️ ΞΕΧΩΡΙΣΤΑ, ΟΧΙ ΕΜΦΑΝΙΣΕΙΣ: το `resolveFileKeys` επιστρέφει το ίδιο κλειδί
        // ΚΑΙ από τα literals ΚΑΙ από τον ταξινομητή, οπότε ένα ωμό `.length` θα
        // ανέφερε «2 κλειδιά» για ένα. Αριθμός που διπλομετρά είναι αριθμός που λέει
        // ψέματα — και εδώ είναι το ΜΟΝΟ πράγμα που θα διαβάσει ο άνθρωπος.
        const sample = [...new Set([...resolved.keys, ...resolved.prefixes]
          .filter(entry => entry.ns === null)
          .map(entry => entry.key ?? entry.prefix))];
        violations.push({
          file: relFile,
          line: 1,
          kind: 'unattributed-namespace',
          snippet: `${sample.length} κλειδιά χωρίς namespace — π.χ. ${sample.slice(0, 3).join(' · ')}`,
        });
      }
    }
    foldFileIntoWants(wants, namespaces, resolved, policy, relFile);
    perFile.set(relFile, { fingerprint: fingerprintShellFile(surface) });
  }

  for (const namespace of Object.keys(config.guaranteedNamespaces)) wantFor(wants, namespace).whole = true;

  const unusedPolicy = Object.keys(config.dynamicKeyPolicy).filter(file => !usedPolicy.has(file));
  const rootsRel = roots.map(file => MG.toPosix(path.relative(projectRoot, file)));
  // ADR-744 §31 — τα barrels που ΔΙΑΒΑΣΕ ο walk χωρίς να γίνουν μέλη: ίδιο αποτύπωμα, ίδιος ελεγκτής.
  const consulted = new Map(closure.consulted.map(relFile => [
    relFile, { fingerprint: fingerprintShellFile(analyseFile(projectRoot, relFile, graph, context)) },
  ]));
  return { closure, roots, rootsRel, perFile, consulted, wants, violations, unusedPolicy };
}

/**
 * 🔑 «Νεκρή» είναι η εγγραφή που δεν τη χρησιμοποιεί **ΟΥΤΕ** το κέλυφος **ΟΥΤΕ**
 * καμία διαδρομή — δηλαδή **ΤΟΜΗ**, ποτέ «άχρηστη στο κέλυφος».
 *
 * ⚠️ Χωρίς την τομή, κάθε policy που υπηρετεί **σελίδα** θα καταγγελλόταν ως νεκρή:
 * το `ListingPriceBlock.tsx` ΔΕΝ είναι στην κλειστότητα του κελύφους (route
 * boundary) και **ήταν** ζωντανό στο `/listing/[id]` για έντεκα μέρες. Μια ψεύτικη
 * προειδοποίηση «νεκρού φρουρού» οδηγεί στη **διαγραφή φρουρού που δουλεύει** —
 * ακριβώς το σφάλμα που το ADR-744 §15 πλήρωσε μία φορά.
 *
 * @param {string[]} shellUnused           όσα δεν χρησιμοποίησε το κέλυφος
 * @param {string[][]} routeUnusedSets     ένα σύνολο ανά διαδρομή
 * @returns {string[]}                     οι πράγματι νεκρές
 */
function deadPolicyEntries(shellUnused, routeUnusedSets) {
  return shellUnused.filter(file => routeUnusedSets.every(set => set.includes(file)));
}

function makeNamespaceReader(projectRoot, config) {
  const cache = new Map();
  return (language, namespace) => {
    const key = `${language}:${namespace}`;
    if (cache.has(key)) return cache.get(key);
    const file = path.join(projectRoot, config.localesDir, language, `${namespace}.json`);
    let value = null;
    if (fs.existsSync(file)) {
      try { value = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { value = null; }
    }
    cache.set(key, value);
    return value;
  };
}

/**
 * Τα namespaces που ΟΝΤΩΣ ταξιδεύουν ολόκληρα στο slice της πρωτεύουσας γλώσσας.
 *
 * ⚠️ Η αυθεντία είναι το `wants[ns].whole`, **ΟΧΙ** το `config.guaranteedNamespaces`.
 * Σήμερα ταυτίζονται, αλλά το `whole` τίθεται από **δύο** μονοπάτια: τον
 * migration ledger (plan.js, `guaranteedNamespaces`) **και** το
 * `dynamicKeyPolicy[file].wholeNamespaces` (μια ανεπίλυτη δυναμική `t()` που
 * κρίθηκε ότι απαιτεί όλο το namespace). Διαβάζοντας τον ledger θα χάναμε το
 * δεύτερο — και θα δηλώναμε «κομμένο» κάτι που είναι πλήρες, δηλαδή θα
 * ξαναφορτώναμε δεδομένα που ήδη έχουμε.
 *
 * Το φιλτράρισμα με `shipped` δεν είναι διακοσμητικό: το `buildSlices` πετάει
 * namespace του οποίου το slice βγήκε άδειο, οπότε ένα όνομα μπορεί να είναι
 * `whole` στο σχέδιο και να μην υπάρχει καθόλου στο αρχείο.
 */
function wholeNamespaces(plan, slices, language) {
  const shipped = Object.keys(slices.resources[language] || {});
  return shipped.filter(namespace => plan.wants.get(namespace)?.whole === true).sort();
}

/**
 * Τα slices ενός σχεδίου, ΧΩΡΙΣ manifest. ADR-744 §32.13 — η διαδρομή χρειάζεται ΜΟΝΟ αυτά: το
 * `renderArtifacts` ανά διαδρομή ξαναϋπολόγιζε το digest των καθολικών εισόδων (toolchain κ.λπ.) 68 φορές
 * ανά πέρασμα για να το πετάξει — 9,4 s γεννήτορα, 7–9 s G. Οι είσοδοι είναι του ΠΕΡΑΣΜΑΤΟΣ, όχι της διαδρομής.
 * @returns {{artifacts: Map<string, string>, slices: object}}
 */
function renderSlices(projectRoot, config, plan) {
  const slices = buildSlices({
    wants: plan.wants,
    languages: config.languages,
    readNamespace: makeNamespaceReader(projectRoot, config),
  });

  const artifacts = new Map();
  for (const language of config.languages) {
    const relPath = MG.toPosix(path.join(config.outputDir, sliceName(language)));
    artifacts.set(relPath, stableStringify(slices.resources[language] || {}));
  }

  const [primaryLanguage] = config.languages;
  artifacts.set(
    MG.toPosix(path.join(config.outputDir, WHOLE_NAME)),
    stableStringify(wholeNamespaces(plan, slices, primaryLanguage)),
  );
  return { artifacts, slices };
}

/** @returns {{artifacts: Map<string, string>, manifest: object, manifestText: string}} */
function renderArtifacts(projectRoot, config, plan) {
  const { artifacts, slices } = renderSlices(projectRoot, config, plan);
  const globalInputs = computeGlobalInputs(projectRoot, config);
  const manifest = buildManifest({ config, plan, artifacts, slices, globalInputs });
  return { artifacts, manifest, manifestText: stableStringify(manifest), slices };
}

function manifestPath(config) {
  return MG.toPosix(path.join(config.outputDir, MANIFEST_NAME));
}

module.exports = {
  MANIFEST_NAME,
  WHOLE_NAME,
  sliceName,
  wholeNamespaces,
  manifestPath,
  buildModuleGraph,
  patternToRegExp,
  resolveRoots,
  rootPatternCandidates,
  analyseFile,
  planContext,
  resolveFileKeys,
  mergeHarvest,
  collectSurfaces,
  addEntry,
  foldFileIntoWants,
  buildShellPlan,
  deadPolicyEntries,
  makeNamespaceReader,
  renderSlices,
  renderArtifacts,
  ...ManifestBuild,
  ...NamespaceInheritance,
};
