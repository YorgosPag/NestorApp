#!/usr/bin/env node
'use strict';
/**
 * CHECK 3.34 — i18n shell-slice freshness gate (ADR-744)
 *
 * THE QUESTION NOTHING ASKED BEFORE
 * ---------------------------------
 * `src/i18n/config.ts` carried a hand-written list of synchronously-loaded
 * namespaces, and `lazy-config.ts` carried a second hand-written list of 72
 * "critical" ones. The two drifted apart by 63 entries and every CHECK stayed
 * green, because no gate compared either list against the code that actually
 * renders. This gate asks exactly that, and nothing else: **is the synchronous
 * bootstrap still what the shell needs?**
 *
 * NOT A RATCHET — deliberately, and for the same reason as CHECK 3.33
 * -------------------------------------------------------------------
 * Freshness is binary. If you ever find yourself writing
 * `.i18n-shell-slice-baseline.json`, you have taken a wrong turn: a "tolerated
 * number of stale keys" is a tolerated number of raw keys on the user's screen.
 *
 * TWO LAYERS, AND AN HONEST STATEMENT OF WHERE THE CHEAP ONE STOPS
 * ---------------------------------------------------------------
 * Layer 1 (this script, default) is what a pre-commit hook can afford. It never
 * builds the module graph — that costs ~19s for 13.877 modules — and instead
 * leans on the manifest the generator already wrote:
 *
 *   A. artifact integrity   the slice on disk is the bytes the manifest records
 *                           ⇒ catches a hand-edited generated file
 *   B. locale drift         re-prune the RECORDED key set out of the CURRENT
 *                           locale files and compare ⇒ EXACT, not an
 *                           approximation, because the key set is the
 *                           generator's own output
 *   C. shell surface drift  re-fingerprint every staged file that the manifest
 *                           lists as a shell module ⇒ catches a changed t()
 *                           call AND a changed import edge, which is the only
 *                           way a new module can enter the closure
 *   D. resolution drift     a newly added file that would satisfy a specifier
 *                           the generator recorded as unresolved
 *
 * What Layer 1 CANNOT see: a re-export chain rewritten OUTSIDE any shell module
 * (barrel B forwards X; X's declaration moves from C to D). No shell file's
 * bytes change, yet the closure does. That is real, it is rare, and it is why
 * Layer 2 exists — `--full` rebuilds the graph and regenerates from scratch,
 * run in CI on every PR (.github/workflows/i18n-governance.yml). Stating the
 * gap is the point; a gate that implies coverage it does not have is worse than
 * one that does not exist.
 *
 * CLI:
 *   node scripts/check-i18n-shell-slice.js [staged files…]   # Layer 1
 *   node scripts/check-i18n-shell-slice.js --full            # Layer 2 (CI)
 *   node scripts/check-i18n-shell-slice.js --help
 *
 * Env:
 *   SKIP_I18N_SHELL_SLICE=1   — bypass (justify to Giorgio).
 *
 * Exit: 0 fresh · 1 stale, hand-edited, missing, or unclassified dynamic key.
 */

const fs = require('node:fs');
const path = require('node:path');

const { bootstrap } = require('./lib/i18n-shell-slice/cli');
const {
  analyseFile,
  buildModuleGraph,
  buildShellPlan,
  renderArtifacts,
  hydrateWants,
  makeNamespaceReader,
  manifestPath,
} = require('./lib/i18n-shell-slice/plan');
const { buildSlices, stableStringify, sha256, fingerprintShellFile } = require('./lib/i18n-shell-slice/slice-build');
const { loadNamespaceBundles } = require('./lib/i18n-namespace-extract');
const { loadKeyConstants } = require('./lib/i18n-shell-slice/key-extract');
const { auditLedger, describeFailures, auditRouteLedger, describeRouteFailures } = require('./lib/i18n-shell-slice/ledger');
const {
  auditShellCensus,
  describeCensusFailures,
  describeCensusGrowth,
} = require('./lib/i18n-shell-slice/shell-census');
const RS = require('./lib/i18n-shell-slice/route-slices');
const { ROUTES_DIR, routeIdFor } = RS;
const { parseModule } = require('./lib/module-graph/parse-module');
const { readTsPathAliases, resolveSpecifier, toPosix } = require('./lib/module-graph/resolve-specifier');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const REGENERATE = 'npm run generate:i18n-shell-slice';
const RED = '\x1b[0;31m';
const GREEN = '\x1b[0;32m';
const DIM = '\x1b[2m';
const NC = '\x1b[0m';

/**
 * CRLF/BOM/trailing-blank differences are checkout artefacts, not staleness.
 * `core.autocrlf=true` with no `.gitattributes` means the working-tree copy of a
 * generated file carries CRLF while the generator writes LF; comparing raw bytes
 * would make this gate permanently red on every Windows machine (ADR-727 trap #2).
 */
function normalize(text) {
  return text.replace(/^﻿/, '').replace(/\r\n/g, '\n').replace(/\s*$/, '\n');
}

function readManifest(config) {
  const file = path.join(PROJECT_ROOT, manifestPath(config));
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function fail(reason, remedy = REGENERATE) {
  console.error(`${RED}❌ CHECK 3.34 FAIL — ${reason}${NC}`);
  console.error('');
  console.error('Remediation:');
  console.error(`  1) Regenerate: ${remedy}`);
  console.error('  2) Stage the result: git add src/i18n/generated/');
  console.error('  3) Never hand-edit those files — they are machine output (ADR-744).');
  console.error('');
  console.error('Emergency skip (justify to Giorgio): SKIP_I18N_SHELL_SLICE=1 git commit ...');
  process.exit(1);
}

// ─── Layer 1 ─────────────────────────────────────────────────────────────────

/**
 * A. the generated bytes are the bytes the manifest signed.
 *
 * The manifest records sha256 of the LF text the generator wrote, and
 * `stableStringify` output is already normalized, so hashing the normalized
 * working-tree copy is an apples-to-apples comparison on any platform.
 */
function checkArtifactIntegrity(manifest) {
  for (const [relPath, expected] of Object.entries(manifest.artifacts)) {
    const file = path.join(PROJECT_ROOT, relPath);
    if (!fs.existsSync(file)) return `${relPath} is missing.`;
    if (sha256(normalize(fs.readFileSync(file, 'utf8'))) !== expected) {
      return `${relPath} does not match the sha256 recorded in the manifest — it was hand-edited or half-regenerated.`;
    }
  }
  return null;
}

/** B. the recorded key set, re-pruned out of the locales that are on disk right now. */
function checkLocaleDrift(config, manifest) {
  const slices = buildSlices({
    wants: hydrateWants(manifest.wants),
    languages: manifest.languages,
    readNamespace: makeNamespaceReader(PROJECT_ROOT, config),
  });
  for (const language of manifest.languages) {
    const relPath = toPosix(path.join(config.outputDir, `shell-slice.${language}.json`));
    const expected = stableStringify(slices.resources[language] || {});
    const file = path.join(PROJECT_ROOT, relPath);
    if (!fs.existsSync(file)) return `${relPath} is missing.`;
    if (normalize(expected) !== normalize(fs.readFileSync(file, 'utf8'))) {
      return `${relPath} no longer matches the locale files — a translation the shell ships was edited without regenerating.`;
    }
  }
  return null;
}

/**
 * B2. ADR-777 §8.38 — **ΤΟ ΜΗΤΡΩΟ ΜΕΣΑ ΣΤΟΝ ΠΡΟΫΠΟΛΟΓΙΣΜΟ ΤΟΥ.**
 *
 * Διαβάζει το **δεσμευμένο** artifact (όχι τον γράφο), οπότε δουλεύει και στο Layer 1
 * χωρίς κόστος. Ο λόγος που δεν αρκεί το άθροισμα είναι μετρημένος: ένα σύνολο που
 * ξεχειλίζει **δεν λέει ποια εγγραφή** φούσκωσε — και το `search-results` φούσκωσε 30×.
 */
function checkLedgerBudget(config, manifest) {
  const [language] = manifest.languages;
  const file = path.join(PROJECT_ROOT, toPosix(path.join(config.outputDir, `shell-slice.${language}.json`)));
  if (!fs.existsSync(file)) return null;   // το checkArtifactIntegrity το λέει καλύτερα
  let resources;
  try {
    resources = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return `shell-slice.${language}.json is not valid JSON.`;
  }
  const whole = Object.entries(manifest.wants || {})
    .filter(([, want]) => want && want.whole === true)
    .map(([namespace]) => namespace);
  const audit = auditLedger(config.guaranteedNamespaces, resources, whole);
  if (audit.failures.length === 0) return null;
  return `migration ledger over budget — ${describeFailures(audit.failures)}`;
}

/**
 * B3. ADR-744 §23 — **Η ΑΠΟΓΡΑΦΗ: «ποιος μπήκε στο κέλυφος, και ποιος το αποφάσισε;»**
 *
 * 🔴 ΤΟ ΚΕΝΟ ΠΟΥ ΚΛΕΙΝΕΙ, ΜΕΤΡΗΜΕΝΟ (2026-09-04). Το `checkLedgerBudget` από πάνω
 * κρίνει **μόνο** όσα ταξιδεύουν ΟΛΟΚΛΗΡΑ (10). Τα **8** που ταξιδεύουν κομμένα στο
 * κλειδί δεν τα ρωτούσε **κανείς**: ένα `import` τα έκανε 8 → 10 και κάθε πύλη έμεινε
 * πράσινη. Πιάστηκε από **παρενέργεια** — δηλαδή από τύχη.
 *
 * ⚠️ **ΔΥΟ ΚΑΝΟΝΕΣ, ΔΥΟ ΦΩΝΕΣ, ΠΟΤΕ ΕΝΑΣ ΜΕ «Ή»** (μάθημα CHECK 3.41, και ο ίδιος λόγος
 * που το `runLayerOne` δεν αλυσιδώνει `||`): επιστρέφει **πίνακα**, ώστε μια απογραφή
 * που δεν κλείνει ΚΑΙ ένα κέλυφος που μεγάλωσε να αναφερθούν **και τα δύο** σε ένα
 * πέρασμα. Το ένα εύρημα ανά κύκλο είναι ο κύκλος που δεν τελειώνει ποτέ.
 *
 * ⛔ **ΚΑΜΙΑ ΜΕΤΡΗΣΗ BYTES** — δομικά, όχι κατά σύμβαση: το `shell-census.js` δεν
 * περιέχει καμία. Νέο κλειδί σε υπάρχον namespace είναι **θεραπεία** ωμού κλειδιού και
 * περνά ελεύθερα· νέο **namespace** είναι νέα οικογένεια κειμένου σε ~150 διαδρομές.
 */
function checkShellCensus(config, manifest) {
  const [language] = manifest.languages;
  const file = path.join(PROJECT_ROOT, toPosix(path.join(config.outputDir, `shell-slice.${language}.json`)));
  if (!fs.existsSync(file)) return [];   // το checkArtifactIntegrity το λέει καλύτερα
  let resources;
  try {
    resources = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return [];                            // ίδιο: το λέει το checkLedgerBudget
  }
  const audit = auditShellCensus(
    config.shellNamespaces,
    config.guaranteedNamespaces,
    Object.keys(resources),
    manifest.wants || {},
    config.shellNamespacesSeal,
  );
  const found = [];
  if (audit.failures.length > 0) {
    found.push(`η απογραφή του κελύφους δεν κλείνει — ${describeCensusFailures(audit.failures)}`);
  }
  if (audit.grew) found.push(describeCensusGrowth(audit));
  return found;
}

/**
 * B2. ADR-777 §8.43 — **«σελίδα, ή δεύτερο κέλυφος;»** για κάθε δηλωμένη διαδρομή.
 *
 * Διαβάζει τα **δεσμευμένα** artifacts, οπότε δουλεύει στο Layer 1 χωρίς γράφο. Δύο
 * ανεξάρτητοι κανόνες (Κ1 δομικός · Κ2 δηλωμένο ταβάνι) — ποτέ ένας με «ή».
 *
 * 🔑 ΕΔΩ — ΚΑΙ ΜΟΝΟ ΕΔΩ — ΤΟ `orphan-artifact` ΕΧΕΙ ΝΟΗΜΑ ΩΣ ΠΥΛΗ ΣΕ ΚΑΘΕ COMMIT: το
 * `writeArtifacts` δεν κλαδεύει, άρα μια σβησμένη δήλωση αφήνει πίσω αρχείο που
 * εξακολουθεί να το εισάγει στατικά κάποιο client boundary και να ταξιδεύει **παγωμένο**.
 * Το `checkArtifactIntegrity` δεν το βλέπει: διατρέχει το `manifest.artifacts`, όπου η
 * σβησμένη διαδρομή **δεν υπάρχει πια**.
 */
function checkRouteLedger(config, manifest) {
  const [language] = manifest.languages;
  const shellFile = path.join(PROJECT_ROOT, toPosix(path.join(config.outputDir, `shell-slice.${language}.json`)));
  if (!fs.existsSync(shellFile)) return null;   // το checkArtifactIntegrity το λέει καλύτερα
  const bytesOf = file => Buffer.byteLength(JSON.stringify(JSON.parse(fs.readFileSync(file, 'utf8'))), 'utf8');

  let shellBytes;
  try {
    shellBytes = bytesOf(shellFile);
  } catch {
    return `shell-slice.${language}.json is not valid JSON.`;
  }

  const suffix = `.${language}.json`;
  const dir = path.join(PROJECT_ROOT, config.outputDir, ROUTES_DIR);
  const pageById = new Map(Object.keys(config.routeSlices).map(page => [routeIdFor(page), page]));
  const observed = [];
  if (fs.existsSync(dir)) {
    for (const name of fs.readdirSync(dir)) {
      if (!name.endsWith(suffix)) continue;
      const id = name.slice(0, -suffix.length);
      try {
        observed.push({ id, page: pageById.get(id) || null, actual: bytesOf(path.join(dir, name)) });
      } catch {
        return `${ROUTES_DIR}/${name} is not valid JSON.`;
      }
    }
  }

  const audit = auditRouteLedger(config.routeSlices, observed, shellBytes);
  if (audit.failures.length === 0) return null;
  return `route ledger — ${describeRouteFailures(audit.failures, shellBytes)}`;
}

/**
 * B3. 🔴 ADR-744 §20 (Β2β) — **ΤΟ ROUTE SLICE, ΞΑΝΑΚΛΑΔΕΜΕΝΟ ΑΠΟ ΤΑ ΣΗΜΕΡΙΝΑ LOCALES.**
 *
 * ΜΕΤΡΗΜΕΝΟ ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ ΠΟΥ ΤΟ ΓΕΝΝΗΣΕ (2026-08-30): τα 20 νέα κλειδιά του ADR-832
 * ήταν **μέσα** στα `el/property-market.json`, το `routes/offers__mandate__new.el.json`
 * **δεν είχε κανένα**, και αυτή η πύλη τύπωσε **`✅ CHECK 3.34 OK`**. Το `checkLocaleDrift`
 * ρωτά μόνο για το **κέλυφος**· τα route slices κρίνονταν μόνο με sha256 έναντι του
 * manifest, δηλαδή «**συνεπές αλλά μπαγιάτικο**» ήταν καθαρό. Το commit θα έβαφε ωμά
 * κλειδιά σε δύο πεδία που ο νόμος απαιτεί, και θα το έπιανε **μόνο** το CI.
 *
 * 🔑 ΓΙΑΤΙ ΕΙΝΑΙ ΕΞΑΚΡΙΒΩΣ, ΟΧΙ ΠΡΟΣΕΓΓΙΣΗ: τα `wants` της διαδρομής είναι η **ίδια η
 * έξοδος του γεννήτορα** (manifest §20), και το `buildSlices` + `subtractShell` που
 * τρέχουν εδώ είναι **τα ίδια modules** που τρέχει ο γεννήτορας. Καμία δεύτερη
 * υλοποίηση, κανένας γράφος, μηδέν κόστος στο pre-commit.
 *
 * ⚠️ Ο παρονομαστής είναι το **κέλυφος του δίσκου** — και αυτό είναι σωστό εδώ: αν ο
 * δίσκος είναι μπαγιάτικος, το λένε ήδη τα Α/Β με καλύτερο μήνυμα, και τώρα πλέον
 * **και τα δύο** αναφέρονται στο ίδιο πέρασμα (καμία πρόωρη έξοδος).
 */
function checkRouteLocaleDrift(config, manifest) {
  const declared = manifest.routes;
  if (!declared || Object.keys(declared).length === 0) return null;

  const [language] = manifest.languages;
  const shellRel = toPosix(path.join(config.outputDir, `shell-slice.${language}.json`));
  const shellFile = path.join(PROJECT_ROOT, shellRel);
  if (!fs.existsSync(shellFile)) return null;   // το checkArtifactIntegrity το λέει καλύτερα
  let shellResources;
  try {
    shellResources = JSON.parse(fs.readFileSync(shellFile, 'utf8'));
  } catch {
    return `${shellRel} is not valid JSON.`;
  }

  const whole = Object.entries(manifest.wants || {})
    .filter(([, want]) => want && want.whole === true)
    .map(([namespace]) => namespace);
  const readNamespace = makeNamespaceReader(PROJECT_ROOT, config);

  for (const [id, entry] of Object.entries(declared)) {
    const slices = buildSlices({
      wants: hydrateWants(entry.wants),
      languages: manifest.languages,
      readNamespace,
    });
    const expected = stableStringify(
      RS.subtractShell(slices.resources[language] || {}, shellResources, whole),
    );
    const relPath = toPosix(path.join(config.outputDir, ROUTES_DIR, `${id}.${language}.json`));
    const file = path.join(PROJECT_ROOT, relPath);
    if (!fs.existsSync(file)) return `${relPath} is missing.`;
    if (normalize(expected) !== normalize(fs.readFileSync(file, 'utf8'))) {
      return `${relPath} no longer matches the locale files — a translation ${entry.page} ships was edited without regenerating.`;
    }
  }
  return null;
}

/**
 * C. a staged **input** whose i18n surface or import edges moved.
 *
 * 🔴 ADR-744 §21 — ΩΣ ΤΙΣ 2026-08-30 ΡΩΤΟΥΣΕ ΜΟΝΟ ΤΟ `shellFiles`, ΚΑΙ ΤΟ ΠΛΗΡΩΣΑΜΕ.
 * Μετρημένο ζωντανά: το `MandateCatalogContent.tsx` άλλαξε ανάμεσα στο `generate` και
 * στο `commit`, **δύο** route artifacts βγήκαν εκτός συγχρονισμού, και εδώ το `continue`
 * το προσπέρασε **σιωπηλά** — γιατί δεν είναι shell module. Το Layer 1 δεν είχε
 * **καμία** εγγραφή για τις **509** εισόδους των κλειστοτήτων διαδρομών.
 *
 * 🏆 Η ΑΡΧΗ ΤΟΥ BAZEL: παραγόμενο = **δηλωμένο σύνολο εισόδων**, κατακερματισμένο.
 * Αλλάζει είσοδος ⇒ μπαγιάτικη έξοδος, **εξ ορισμού**. Το είχαμε — για τις μισές.
 *
 * ⚠️ ΔΥΟ ΠΙΝΑΚΕΣ, ΜΙΑ ΑΠΑΝΤΗΣΗ ΑΝΑ ΑΡΧΕΙΟ: το `routeFiles` **δεν** επαναλαμβάνει όσα
 * είναι ήδη κέλυφος (220 από τα 509), γιατί το αποτύπωμα είναι **τοπικό στο αρχείο** —
 * διπλή εγγραφή θα ήταν διπλότυπο που μπορεί να **αποκλίνει**.
 */
function checkStagedShellFiles(config, manifest, stagedFiles) {
  const context = {
    bundles: loadNamespaceBundles(PROJECT_ROOT),
    keyConstants: loadKeyConstants(PROJECT_ROOT, config.keyConstants),
    excludeConsumers: config.excludeConsumers,
  };
  const graph = { modules: new Map(), projectRoot: PROJECT_ROOT };
  const routeFiles = manifest.routeFiles || {};

  for (const relFile of stagedFiles) {
    const inShell = relFile in manifest.shellFiles;
    const recorded = inShell ? manifest.shellFiles[relFile] : routeFiles[relFile];
    if (recorded === undefined) continue;
    const role = inShell ? 'shell module' : 'module a declared route slice is built from';
    const abs = toPosix(path.join(PROJECT_ROOT, relFile));
    if (!fs.existsSync(abs)) return `${relFile} is a ${role} in the manifest but no longer exists.`;
    try {
      graph.modules.set(abs, parseModule(abs, fs.readFileSync(abs, 'utf8')));
    } catch {
      return `${relFile} could not be parsed; the shell slice cannot be judged.`;
    }
    const analysis = analyseFile(PROJECT_ROOT, relFile, graph, context);
    if (fingerprintShellFile(analysis) !== recorded) {
      return `${relFile} is a ${role} and its i18n surface or its imports changed — the slice may no longer cover it.`;
    }
  }
  return null;
}

/** D. a new file that makes a previously-unresolved specifier resolve. */
function checkNewlyResolvableSpecs(manifest, stagedFiles) {
  if (manifest.unresolvedSpecs.length === 0 || stagedFiles.length === 0) return null;
  const added = new Set(stagedFiles.map(f => toPosix(path.join(PROJECT_ROOT, f))));
  const aliases = readTsPathAliases(PROJECT_ROOT);
  for (const entry of manifest.unresolvedSpecs) {
    const [fromRel, spec] = entry.split(' → ');
    if (!spec) continue;
    const resolved = resolveSpecifier(spec, toPosix(path.join(PROJECT_ROOT, fromRel)), {
      projectRoot: PROJECT_ROOT, aliases, fileSet: added,
    });
    if (resolved.kind === 'internal') {
      return `a new file now satisfies '${spec}' (from ${fromRel}), which the shell walk had recorded as unresolved — the closure may have grown.`;
    }
  }
  return null;
}

function runLayerOne(config, stagedFiles) {
  const manifest = readManifest(config);
  if (manifest === null) {
    fail(`${manifestPath(config)} is missing or unreadable — the shell slice has never been generated.`);
    return;
  }
  // 🔴 ADR-744 §20 (Β2) — ΚΑΜΙΑ ΑΛΥΣΙΔΑ `||`, ΓΙΑ ΤΟΝ ΙΔΙΟ ΛΟΓΟ ΜΕ ΤΟΝ ΓΕΝΝΗΤΟΡΑ.
  // Το `a || b || c` σημαίνει «ο πρώτος που μιλά σκοτώνει τους υπόλοιπους»: όσο ένα
  // artifact ήταν χειρόγραφα πειραγμένο, **κανείς** δεν μάθαινε ποτέ ότι ταυτόχρονα
  // μια διαδρομή ήταν εκτός ταβανιού. Ο άνθρωπος διόρθωνε, ξανάτρεχε, έβρισκε το
  // επόμενο — ένα σφάλμα ανά κύκλο. Τώρα τρέχουν ΟΛΑ και αναφέρονται ΟΛΑ.
  const reasons = [
    checkArtifactIntegrity(manifest),
    checkLedgerBudget(config, manifest),
    checkRouteLedger(config, manifest),
    ...checkShellCensus(config, manifest),
    checkLocaleDrift(config, manifest),
    checkRouteLocaleDrift(config, manifest),
    checkStagedShellFiles(config, manifest, stagedFiles),
    checkNewlyResolvableSpecs(manifest, stagedFiles),
  ].filter(reason => reason !== null && reason !== undefined);

  if (reasons.length > 0) {
    fail(reasons.length === 1 ? reasons[0] : `${reasons.length} ευρήματα:\n     · ${reasons.join('\n     · ')}`);
  }
  console.log(
    `${GREEN}  ✅ CHECK 3.34 OK — shell slice matches ${Object.keys(manifest.wants).length} namespace(s) / ` +
    `${manifest.stats.matchedKeys} keys ${DIM}(${manifest.stats.sliceBytes} bytes, ${manifest.stats.shellFiles} shell modules)${NC}`
  );
}

// ─── Layer 2 ─────────────────────────────────────────────────────────────────

function runFull(config) {
  // ⚠️ Ο γράφος ΚΡΑΤΙΕΤΑΙ. Ήταν inline και πεταγόταν, οπότε ο ελεγκτής δεν
  // μπορούσε να ρωτήσει τι παράγουν οι διαδρομές — κοστίζει ~20s και είναι
  // **ο ίδιος** που θα ξαναχτιζόταν (ADR-744 §15 Φ4).
  const graph = buildModuleGraph(PROJECT_ROOT);
  const plan = buildShellPlan(PROJECT_ROOT, config, graph);
  if (plan.violations.length > 0) {
    const first = plan.violations[0];
    fail(
      `${plan.violations.length} unresolved dynamic t() call(s) in shell modules, ` +
      `starting at ${first.file}:${first.line} — ${first.snippet}`,
      'classify them in .i18n-shell-slice.json → dynamicKeyPolicy',
    );
    return;
  }

  // 🔴 ADR-744 §15 Φ4 — Η ΑΝΑΠΑΡΑΓΩΓΗ ΠΡΕΠΕΙ ΝΑ ΕΙΝΑΙ **ΟΛΟΚΛΗΡΗ**.
  // Το `renderArtifacts` δίνει **2** artifacts· η πηγή παράγει **19**. Μέχρι τις
  // 2026-08-28 αυτός ο βρόχος συνέκρινε 2 και το manifest diff αποτύγχανε πάντα
  // (17 route entries + sliceBytes + inputsSha256) — πύλη δομικά αδύνατο να
  // περάσει, **8 ημέρες κόκκινη στο CI**. Ο ίδιος ιδιοκτήτης με τον γεννήτορα:
  // αντιγραφή εδώ θα ήταν το sibling clone του N.18 / CHECK 3.28.
  const complete = RS.renderComplete({ projectRoot: PROJECT_ROOT, config, plan, graph, rendered: renderArtifacts(PROJECT_ROOT, config, plan) });
  if (complete.refused.length > 0) {
    const first = complete.refused[0];
    fail(
      `${complete.refused.length} route slice(s) refuse to emit — unresolved dynamic t(), starting at ${first.url}`,
      'classify them in .i18n-shell-slice.json → dynamicKeyPolicy',
    );
    return;
  }
  const rendered = complete.rendered;
  for (const [relPath, text] of rendered.artifacts) {
    const file = path.join(PROJECT_ROOT, relPath);
    const actual = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
    if (actual === null) fail(`${relPath} is missing.`);
    if (normalize(actual) !== normalize(text)) {
      fail(`${relPath} is not what the generator produces from the current code.`);
    }
  }
  const manifestFile = path.join(PROJECT_ROOT, manifestPath(config));
  const actualManifest = fs.existsSync(manifestFile) ? fs.readFileSync(manifestFile, 'utf8') : null;
  if (actualManifest === null || normalize(actualManifest) !== normalize(rendered.manifestText)) {
    fail(`${manifestPath(config)} is out of date with the shell closure.`);
  }

  console.log(
    `${GREEN}✅ CHECK 3.34 OK (full) — ${rendered.manifest.stats.shellFiles} shell modules, ` +
    `${rendered.manifest.namespaces.length} namespaces, ${rendered.manifest.stats.sliceBytes} bytes${NC}`
  );
}

// ─── CLI ─────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const out = { full: false, help: false, files: [] };
  for (const arg of argv.slice(2)) {
    if (arg === '--full') out.full = true;
    else if (arg === '--help' || arg === '-h') out.help = true;
    else if (arg.startsWith('--')) throw new Error(`Unknown argument: ${arg}`);
    else out.files.push(arg.replace(/\\/g, '/'));
  }
  return out;
}

function printHelp() {
  console.log(`CHECK 3.34 — i18n shell-slice freshness gate (ADR-744)

Usage:
  node scripts/check-i18n-shell-slice.js [staged files…]   Layer 1 (pre-commit, no module graph)
  node scripts/check-i18n-shell-slice.js --full            Layer 2 (CI, rebuilds and regenerates)

Zero tolerance, no baseline file. Fix a failure with: ${REGENERATE}
Skip (justify to Giorgio): SKIP_I18N_SHELL_SLICE=1
`);
}

function main() {
  if (process.env.SKIP_I18N_SHELL_SLICE === '1') {
    console.log(`${DIM}  ⏭  CHECK 3.34 skipped (SKIP_I18N_SHELL_SLICE=1)${NC}`);
    process.exit(0);
    return;
  }
  const started = bootstrap({
    argv: process.argv,
    parseArgs,
    printHelp,
    projectRoot: PROJECT_ROOT,
    reportError: (message, phase) => {
      if (phase === 'config') fail(message, 'fix .i18n-shell-slice.json');
      else console.error(`${RED}❌ CHECK 3.34 — ${message}${NC}`);
    },
    exit: code => process.exit(code),
  });
  if (started === null) return;
  const { args, config } = started;

  if (args.full) runFull(config);
  else runLayerOne(config, args.files);
  process.exit(0);
}

module.exports = {
  normalize,
  readManifest,
  checkArtifactIntegrity,
  checkLedgerBudget,
  checkRouteLedger,
  checkShellCensus,
  checkLocaleDrift,
  checkRouteLocaleDrift,
  checkStagedShellFiles,
  checkNewlyResolvableSpecs,
  runLayerOne,
  runFull,
  parseArgs,
  printHelp,
  main,
  PROJECT_ROOT,
};

if (require.main === module) main();
