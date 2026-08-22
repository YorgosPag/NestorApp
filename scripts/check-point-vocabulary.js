#!/usr/bin/env node
/**
 * CHECK 3.59 — Πύλη ενικού λεξιλογίου σημείου (ADR-792)
 *
 * «Δηλώνεται κάθε όνομα του λεξιλογίου σημείου/γεωμετρίας σε **ΑΚΡΙΒΩΣ ΕΝΑ** αρχείο,
 *  και είναι κάθε ρίζα **δηλωμένη με λόγο**;»
 *
 * 🔴 Η ΑΙΤΙΑ, μετρημένη 2026-08-22: υπήρχαν **τέσσερα ζεύγη** ομώνυμων τύπων με
 * ασύμβατο συμβόλαιο — `Point3D` (216 vs 49) · `Polygon3D` (54 vs 56) · `Polyline3D`
 * (13 vs 14) · `BoundingBox3D` (45 vs 1) — και **έξι** `Point2D`. Το ένα `Polygon3D`
 * ήταν **αντικείμενο** `{vertices}`, το άλλο **σκέτος πίνακας**.
 *
 * 🔴 ΓΙΑΤΙ ΔΕΝ ΤΟ ΕΙΔΕ ΚΑΜΙΑ ΠΥΛΗ — και είναι μηχανισμός, όχι παράλειψη: το κοινό
 * όνομα **τυφλώνει το CHECK 3.30**. Το `identifierOwners` του ADR-700 κρατά δείγμα
 * `OWNER_SAMPLE = 8`· τα `Point2D`/`Point3D` εμφανίζονται σε πολύ περισσότερα ⇒
 * `overflow = true` ⇒ το `occursInLiveModule()` επιστρέφει **πάντα** `true` ⇒ το export
 * πέφτει στον κάδο `suspect`, που το ratchet **δεν μετρά**. Απόδειξη ζωντανή: το
 * `utils/precision-positioning.ts` είχε **4 από 5** exports στη baseline του 3.30 —
 * έλειπε ακριβώς το `Point2D`, ενώ το `Vector3D` δίπλα του (overflow=false) αναφερόταν
 * κανονικά. **Το διπλότυπο όνομα πληρώνει τον εαυτό του σε τυφλότητα φρουρού.**
 *
 * 🏆 ΠΟΥ ΞΕΠΕΡΝΑΜΕ ΤΟΥΣ ΜΕΓΑΛΟΥΣ (ερευνήθηκε 2026-08-22):
 *  - Ο κανόνας «το όνομα δηλώνει τι ΕΓΓΥΑΤΑΙ» είναι ομόφωνος — Rhino `Point2d`/`Point3d`,
 *    Revit `UV`/`XYZ`, ArchiCAD `API_Coord`/`API_Coord3D`, three.js `Vector2`/`Vector3`,
 *    Cinema 4D `Vector`/`Vector4d`. **Κανένας δεν τον ΕΠΙΒΑΛΛΕΙ**: C++/C# είναι
 *    ονομαστικές γλώσσες και τίποτα δεν εμποδίζει έναν δεύτερο ομώνυμο ορισμό.
 *  - Το οικοσύστημα ESLint **δεν μπορεί** να κάνει αυτή την ερώτηση: κάθε σχετικός
 *    κανόνας (`no-duplicate-imports` · `no-duplicate-type-constituents` ·
 *    `consistent-type-definitions`) είναι **ανά αρχείο**. Το «σε πόσα αρχεία δηλώνεται
 *    αυτό το όνομα;» απαιτεί καθολικό πίνακα συμβόλων, που ο linter δεν έχει.
 *
 * ΤΡΕΙΣ ΑΝΕΞΑΡΤΗΤΟΙ ΚΑΝΟΝΕΣ — ΠΟΤΕ ΕΝΑΣ ΜΕ «Ή» (μάθημα CHECK 3.41), γιατί έχουν
 * **διαφορετική θεραπεία**:
 *   Κ1 ⛔ `undeclared-owner`   — αρχείο δηλώνει όνομα του λεξιλογίου χωρίς να είναι ρίζα.
 *                                Θεραπεία: import από την υπάρχουσα ρίζα.
 *   Κ2 ⛔ `orphan-declaration` — το μητρώο δηλώνει όνομα που το αρχείο ΔΕΝ ορίζει πια.
 *                                Θεραπεία: σβήσε τη δήλωση. Χωρίς αυτό το μητρώο σαπίζει
 *                                σιωπηλά και η ερώτηση γίνεται διακοσμητική (σχήμα 3.50).
 *   Κ3 🔴 `shared-name`        — όνομα με >1 ρίζα (RATCHET). Σήμερα: `Point2D` × 3, σε
 *                                **διακριτά** υποσυστήματα. Ratchet και όχι zero-tol
 *                                επειδή και οι τρεις είναι ζωντανές και σκόπιμες: zero-tol
 *                                θα γεννιόταν μονίμως κόκκινο ⇒ `SKIP_` ⇒ διακοσμητικό
 *                                (δοκιμάστηκε και απορρίφθηκε στο CHECK 3.39).
 *
 * ⚠️ ΤΑΥΤΟΤΗΤΑ ΤΟΥ Κ3 = `<όνομα>@<ρίζα>` — ΠΟΤΕ σκέτο `<όνομα>`, ΠΟΤΕ `<όνομα>::<λίστα>`:
 *    με σκέτο όνομα μια **τέταρτη** ρίζα δεν αλλάζει το σύνολο ⇒ αόρατη· με λίστα ριζών η
 *    **αφαίρεση** μιας ρίζας γεννά νέα ταυτότητα ⇒ η πύλη θα μπλόκαρε τη **ΘΕΡΑΠΕΙΑ**
 *    (ακριβώς το σφάλμα που το `Κ2` του CHECK 3.53 υπάρχει για να μην ξανασυμβεί).
 *
 * ⚠️ ΤΑ ΣΧΟΛΙΑ ΚΟΒΟΝΤΑΙ: αυτό το ίδιο αρχείο γράφει ονόματα του λεξιλογίου μέσα σε
 *    σχόλια ως **παράδειγμα της βλάβης**. Χωρίς `stripComments` η πύλη θα κοκκίνιζε πάνω
 *    στην τεκμηρίωση της θεραπείας (σχήμα `Κ7β` του CHECK 3.50).
 *
 * ⚠️ ΜΗΝ λύσεις κόκκινο σβήνοντας όνομα από το `.point-vocabulary.json`: το όνομα βγαίνει
 *    από την **εμβέλεια** και ο δεύτερος ορισμός γίνεται αόρατος — «πράσινο επειδή κανείς
 *    δεν κοίταξε». Το `Κ2` υπάρχει ακριβώς για να μην πληρώνεται αυτό σιωπηλά.
 *
 * Layer 1 = pre-commit με σκανδάλη ΜΕΣΑ στην πύλη · Layer 2 = job στο ΥΠΑΡΧΟΝ
 * `ssot-discover.yml`, άνευ όρων — κανένα νέο workflow, το μητρώο πυλών μένει 34.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { stripComments } = require('./lib/i18n-namespace-extract');
const { runSetRatchetCli, PROJECT_ROOT } = require('./lib/ratchet-baseline');
const { collectSourceFiles } = require('./lib/module-graph/scan-config');
const { toPosix } = require('./lib/module-graph/resolve-specifier');

const REGISTRY = path.join(PROJECT_ROOT, '.point-vocabulary.json');
const BASELINE = path.join(PROJECT_ROOT, '.point-vocabulary-baseline.json');

const STATES = ['undeclared-owner', 'orphan-declaration', 'declared-owner'];
const BLOCKING = new Set(['undeclared-owner', 'orphan-declaration']);

const rel = (abs) => toPosix(path.relative(PROJECT_ROOT, abs));

/**
 * Δηλώσεις **τύπου** μόνο. Ένα `const Point2D = …` δεν είναι λεξιλόγιο τύπων.
 * Κρατάμε `interface | type | class` — ό,τι μπορεί να σταθεί ως όνομα τύπου.
 *
 * 🔴 **ΤΟ ΚΡΙΤΗΡΙΟ ΑΛΛΑΞΕ ΑΠΟ ΜΕΤΡΗΣΗ, ΟΧΙ ΑΠΟ ΠΡΟΤΙΜΗΣΗ.** Η πρώτη γραφή σταματούσε
 * στο όνομα και έδωσε **4 ευρήματα / 2 ψευδώς θετικά = 50%** (πήχης Google για
 * **μπλοκάρουσα** πύλη: **<10%**). Και τα δύο ήταν το ίδιο σχήμα: μια γραμμή
 * `  type Point2D,` **μέσα σε πολυγραμμικό `import type { … }`** μοιάζει ακριβώς με
 * δήλωση όταν την κοιτάς μόνη της (`useFloorOverlays.ts:45` · `text-engine/layout/index.ts:18`).
 *
 * Θεραπεία: **ο επόμενος χαρακτήρας είναι το κριτήριο.** Μια δήλωση συνεχίζει με
 * `=` · `{` · `<` · `extends` · `implements`· ένα στοιχείο λίστας εισαγωγής συνεχίζει με
 * `,` ή `}`. ⚠️ ΜΗΝ το «απλοποιήσεις» ξανά στο σκέτο όνομα — και ΜΗΝ προσθέσεις `}`
 * στην κλάση χαρακτήρων.
 */
function declaresType(code, name) {
  const re = new RegExp(
    String.raw`(^|[\r\n])[ \t]*(export[ \t]+)?(declare[ \t]+)?(interface|type|class)[ \t]+`
    + name
    + String.raw`[ \t]*(<|=|\{|extends\b|implements\b)`,
  );
  return re.test(code);
}

function loadRegistry(registryPath = REGISTRY) {
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
  } catch (e) {
    throw new Error(`το μητρώο δεν διαβάζεται (${rel(registryPath)}): ${e.message}`);
  }
  if (!Array.isArray(raw.owners) || raw.owners.length === 0) {
    throw new Error('το μητρώο δεν δηλώνει καμία ρίζα λεξιλογίου');
  }
  for (const o of raw.owners) {
    if (!o || typeof o.file !== 'string' || !Array.isArray(o.names) || o.names.length === 0) {
      throw new Error(`ρίζα χωρίς file/names: ${JSON.stringify(o)}`);
    }
    if (typeof o.reason !== 'string' || o.reason.trim().length < 20) {
      throw new Error(`ρίζα χωρίς ΟΥΣΙΑΣΤΙΚΟ λόγο: ${o.file}`);
    }
    for (const n of o.names) {
      if (typeof n !== 'string' || !/^[A-Za-z_$][\w$]*$/.test(n)) {
        throw new Error(`μη έγκυρο όνομα τύπου στη ρίζα ${o.file}: ${JSON.stringify(n)}`);
      }
    }
  }
  return raw;
}

/** Η εμβέλεια **ΠΑΡΑΓΕΤΑΙ** από το μητρώο — ποτέ δεύτερη χειρόγραφη λίστα ονομάτων. */
const vocabularyOf = (registry) => new Set(registry.owners.flatMap((o) => o.names));

/**
 * ⚡ Ένα **ΠΡΟΦΙΛΤΡΟ** για όλο το λεξιλόγιο μαζί: **27,1s → 6,4s** σε 15.246 αρχεία
 * (και **0,7s** όταν η σκανδάλη δεν πυροδοτεί καθόλου).
 * Χωρίς αυτό η πύλη έτρεχε `stripComments` + 13 regex σε **κάθε** αρχείο του δέντρου —
 * και μια πύλη που κοστίζει τόσο δεν είναι αυστηρότερη, είναι **ανενεργή** (μάθημα 3.52,
 * όπου τα 43s ήταν ζώνη `SKIP_`).
 *
 * ⚠️ **ΕΙΝΑΙ ΑΣΦΑΛΕΣ ΜΟΝΟ ΕΠΕΙΔΗ ΤΟ `stripComments` ΑΦΑΙΡΕΙ, ΔΕΝ ΠΡΟΣΘΕΤΕΙ**: αν το
 * **ωμό** κείμενο δεν έχει ταίριασμα, το καθαρισμένο **δεν μπορεί** να αποκτήσει. Η
 * αντίστροφη κατεύθυνση (ταίριασμα στο ωμό, όχι στο καθαρό) είναι ακριβώς η περίπτωση
 * «δήλωση μέσα σε σχόλιο» και **κρίνεται κανονικά** παρακάτω. Άγκυρα: `Κ6`.
 */
function vocabularyProbe(registry) {
  const names = [...vocabularyOf(registry)].join('|');
  return new RegExp(
    String.raw`(^|[\r\n])[ \t]*(export[ \t]+)?(declare[ \t]+)?(interface|type|class)[ \t]+(`
    + names
    + String.raw`)[ \t]*(<|=|\{|extends\b|implements\b)`,
  );
}

function scanDeclarations(registry, opts = {}) {
  const vocabulary = [...vocabularyOf(registry)];
  const probe = vocabularyProbe(registry);
  const files = opts.files || collectSourceFiles(opts.root || PROJECT_ROOT);
  const readFile = opts.readFile || ((f) => fs.readFileSync(f, 'utf8'));
  const root = opts.root || PROJECT_ROOT;
  const found = [];
  for (const abs of files) {
    let raw;
    try {
      raw = readFile(abs);
    } catch {
      continue;
    }
    if (!probe.test(raw)) continue; // ⚡ το 99% του δέντρου σταματά εδώ
    const code = stripComments(raw);
    for (const name of vocabulary) {
      if (declaresType(code, name)) found.push({ file: toPosix(path.relative(root, abs)), name });
    }
  }
  return found;
}

function classify(found, registry) {
  const declared = new Set();
  const ownersOfName = new Map();
  for (const o of registry.owners) {
    for (const n of o.names) {
      declared.add(`${toPosix(o.file)} ${n}`);
      if (!ownersOfName.has(n)) ownersOfName.set(n, []);
      ownersOfName.get(n).push(toPosix(o.file));
    }
  }

  const entries = [];
  const seen = new Set();
  for (const f of found) {
    const key = `${f.file} ${f.name}`;
    seen.add(key);
    entries.push({ ...f, state: declared.has(key) ? 'declared-owner' : 'undeclared-owner' });
  }
  for (const key of declared) {
    if (seen.has(key)) continue;
    const i = key.lastIndexOf(' ');
    entries.push({ file: key.slice(0, i), name: key.slice(i + 1), state: 'orphan-declaration' });
  }

  const shared = [];
  for (const [name, owners] of ownersOfName) {
    if (owners.length < 2) continue;
    for (const owner of [...owners].sort()) shared.push(`${name}@${owner}`);
  }
  return { entries, shared: shared.sort() };
}

/** Κλειστή λογιστική, fail-closed: άγνωστη κατάσταση ⇒ `throw` **ΜΕ ΟΝΟΜΑ**. */
function tally(entries) {
  const ledger = Object.fromEntries(STATES.map((s) => [s, 0]));
  for (const e of entries) {
    if (!(e.state in ledger)) throw new Error(`άγνωστη κατάσταση: ${e.state}`);
    ledger[e.state] += 1;
  }
  const counted = Object.values(ledger).reduce((a, b) => a + b, 0);
  if (counted !== entries.length) {
    throw new Error(`η λογιστική δεν κλείνει: ${counted} ≠ ${entries.length}`);
  }
  return ledger;
}

function measure(opts = {}) {
  const registry = opts.registry || loadRegistry(opts.registryPath);
  const found = scanDeclarations(registry, opts);
  const { entries, shared } = classify(found, registry);
  const ledger = tally(entries);
  return {
    ledger,
    entries,
    blocking: entries.filter((e) => BLOCKING.has(e.state)),
    vocabularySize: vocabularyOf(registry).size,
    violationIds: shared,
    declarations: registry.owners
      .flatMap((o) => o.names.map((n) => `${toPosix(o.file)}#${n}`))
      .sort(),
  };
}

function ledgerLine(m) {
  const L = m.ledger;
  return `  CHECK 3.59 λεξιλόγιο σημείου: ${m.vocabularySize} ονόματα · `
    + `✅ ${L['declared-owner']} ρίζες · ⛔ ${L['undeclared-owner']} αδήλωτες · `
    + `⛔ ${L['orphan-declaration']} ορφανές · 🔴 ${m.violationIds.length} κοινά ονόματα`;
}

function buildPayload(m) {
  if (m.blocking.length > 0) {
    throw new Error(
      'ΑΡΝΗΣΗ baseline: υπάρχουν zero-tolerance παραβιάσεις. Ένα zero-tol που κλειδώνεται '
      + 'με ένα --write-baseline δεν είναι zero-tol (πρότυπο CHECK 3.44).',
    );
  }
  return {
    generated: new Date().toISOString().slice(0, 10),
    adr: 'ADR-792 (CHECK 3.59)',
    note: 'Κοινά ονόματα λεξιλογίου. Τα zero-tolerance ΔΕΝ μπαίνουν ΠΟΤΕ εδώ.',
    violations: m.violationIds,
    declarations: m.declarations,
  };
}

function printReport(m) {
  console.log(ledgerLine(m));
  console.log('');
  for (const e of m.blocking) console.log(`  ⛔ ${e.state}: ${e.file} → ${e.name}`);
  for (const id of m.violationIds) console.log(`  🔴 κοινό όνομα: ${id}`);
  console.log('');
  console.log('  Δηλωμένες ρίζες (κλειστό σύνολο):');
  for (const d of m.declarations) console.log(`     ${d}`);
}

const TRIGGER_RE = [
  /^\.point-vocabulary\.json$/,
  /^scripts\/check-point-vocabulary\.js$/,
  /^scripts\/lib\/module-graph\//,
];

/**
 * Σκανδάλη **ΜΕΣΑ** στην πύλη. Πυροδοτεί όταν (α) αλλάζει το ίδιο το κριτήριο/μητρώο,
 * (β) αγγίζεται δηλωμένη ρίζα — ώστε να πιαστεί και η **μετονομασία** ορισμού, που
 * αλλιώς θα άφηνε ορφανή δήλωση αόρατη — ή (γ) σταδιοποιημένο αρχείο δηλώνει όνομα του
 * λεξιλογίου. Η λίστα ριζών **παράγεται** από το μητρώο, ποτέ γραμμένη με το χέρι.
 */
function triggers(files, registry) {
  const owners = new Set(registry.owners.map((o) => toPosix(o.file)));
  const vocabulary = [...vocabularyOf(registry)];
  return files.some((f) => {
    const p = toPosix(f);
    if (TRIGGER_RE.some((re) => re.test(p))) return true;
    if (owners.has(p)) return true;
    if (!/\.tsx?$/.test(p)) return false;
    let code;
    try {
      code = stripComments(fs.readFileSync(path.join(PROJECT_ROOT, p), 'utf8'));
    } catch {
      return false;
    }
    return vocabulary.some((n) => declaresType(code, n));
  });
}

const DESCRIPTOR = {
  adr: 'ADR-792 (CHECK 3.59)',
  skipEnv: 'SKIP_POINT_VOCABULARY',
  baselineFile: BASELINE,
  measure: () => measure(),
  buildPayload,
  printReport,
  violationId: (x) => x,
  labels: { violations: 'κοινά ονόματα', declarations: 'δηλώσεις ρίζας' },
  commands: {
    report: 'npm run point-vocabulary:report',
    baseline: 'npm run point-vocabulary:baseline',
    seed: 'npm run point-vocabulary:baseline',
  },
  messages: {
    worse: 'το λεξιλόγιο σημείου διασπάστηκε ξανά',
    newDeclLabel: 'ΝΕΑ ΡΙΖΑ ΛΕΞΙΛΟΓΙΟΥ',
    newDeclAdvice: [
      'Μπλοκάρει ΑΚΟΜΑ ΚΙ ΑΝ είναι σωστή — και αυτό είναι το σημείο: μια δεύτερη ρίζα είναι',
      'αρχιτεκτονικό γεγονός που πρέπει να δει άνθρωπος, αλλιώς η τρίτη προσγειώνεται σιωπηλά',
      '(έτσι έγιναν έξι τα `Point2D`).',
      'Αν είναι σκόπιμη: δήλωσέ την στο `.point-vocabulary.json` → `owners[]`, ΜΕ ΛΟΓΟ.',
    ],
  },
};

async function main() {
  if (process.env.SKIP_POINT_VOCABULARY === '1') {
    console.log('  ⏭ CHECK 3.59 παραλείφθηκε (SKIP_POINT_VOCABULARY=1)');
    return process.exit(0);
  }
  const args = process.argv.slice(2);
  const explicit = args.includes('--report') || args.includes('--write-baseline') || args.includes('--all');
  const staged = args.filter((a) => !a.startsWith('-'));
  const registry = loadRegistry();
  if (!explicit && staged.length > 0 && !triggers(staged, registry)) return process.exit(0);

  if (!args.includes('--report') && !args.includes('--write-baseline')) {
    const m = measure();
    // ⚠️ Τυπώνεται ΚΑΙ ΣΤΟ ΜΗΔΕΝ: ένα «0» που δεν φαίνεται διαβάζεται ως «δεν κοίταξα».
    console.log(ledgerLine(m));
    if (m.blocking.length > 0) {
      console.error(`\n❌ CHECK 3.59 — ${m.blocking.length} παραβίαση(εις) λεξιλογίου σημείου:\n`);
      for (const e of m.blocking) {
        if (e.state === 'undeclared-owner') {
          console.error(`   🚫 ${e.file} ορίζει «${e.name}» χωρίς να είναι δηλωμένη ρίζα.`);
        } else {
          console.error(`   🚫 ${e.file} ΔΕΝ ορίζει πια «${e.name}», αλλά το μητρώο το δηλώνει.`);
        }
      }
      console.error('\n   Θεραπεία (αδήλωτη ρίζα): κάνε import από την υπάρχουσα ρίζα — μην ορίσεις δεύτερη.');
      console.error('   Θεραπεία (ορφανή δήλωση): σβήσε τη γραμμή από το `.point-vocabulary.json`.');
      console.error('   ⛔ ΜΗΝ σβήσεις όνομα από το μητρώο για να «περάσει»: το όνομα βγαίνει από την');
      console.error('      εμβέλεια και ο δεύτερος ορισμός γίνεται ΑΟΡΑΤΟΣ (ADR-792 §6).');
      return process.exit(1);
    }
  }
  return runSetRatchetCli(DESCRIPTOR, process.argv);
}

if (require.main === module) {
  main().catch((e) => { console.error(`❌ CHECK 3.59 — ${e.message}`); process.exit(1); });
}

module.exports = {
  declaresType, loadRegistry, vocabularyOf, scanDeclarations, classify, tally,
  measure, buildPayload, ledgerLine, printReport, triggers, main, vocabularyProbe,
  DESCRIPTOR, REGISTRY, BASELINE, STATES, BLOCKING,
};
