#!/usr/bin/env node
/**
 * CHECK 3.83 — Πύλη αρχής του αποστολέα (ADR-857 Φ9)
 *
 * «Ποιος αποφασίζει τη γραμμή `From:` — και το είπε η ρίζα;»
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ ΕΝΩ ΥΠΑΡΧΕΙ ΗΔΗ ΤΥΠΟΣ — ΤΟ «RESIDUE», ΤΕΚΜΗΡΙΩΜΕΝΟ
 * ─────────────────────────────────────────────────────────────────────────────
 * Το `SenderHeader` (μη εξαγόμενο `unique symbol`) κάνει το «ξέχασα να ρωτήσω τη
 * ρίζα» **μη μεταγλωττίσιμο**. Ο τύπος όμως έχει **δηλωμένα όρια** (έρευνα
 * 2026-09-14, υψηλή βεβαιότητα): παρακάμπτεται με `as unknown as`, και — το
 * σοβαρότερο — **δεν εμποδίζει παράλληλη πηγή που ΔΕΝ αγγίζει ποτέ τον τύπο**:
 * κάποιος διαβάζει `process.env` αλλού και επιστρέφει σκέτο `string`.
 *
 * 🏆 Η σύσταση «**τύπος ΚΑΙ lint μαζί**» είναι ρητή του **typescript-eslint**:
 * *«ο τύπος αφήνει residue που δομικά δεν μπορεί να πιάσει, και κάθε στοιχείο
 * αυτού του residue καταλήγει σήμερα στην παραγωγή»*. Αυτή η πύλη είναι το residue.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠️ AST, ΠΟΤΕ ΚΕΙΜΕΝΟ — ΚΑΙ ΤΟ ΑΠΟΦΑΣΙΣΕ ΜΕΤΡΗΣΗ ΤΟΥ ΙΔΙΟΥ ΤΟΥ ΕΡΓΟΥ
 * ─────────────────────────────────────────────────────────────────────────────
 * Τα αρχεία που **θεραπεύτηκαν** στη Φ9 κουβαλούν σχόλια που **ονομάζουν** ό,τι
 * αφαιρέθηκε (*«ΕΔΩ ΖΟΥΣΕ ΤΟ `getFromEmail()`»*). Σαρωτής κειμένου θα κοκκίνιζε
 * **πάνω στη θεραπεία** — σχήμα Κ7β του CHECK 3.50, Κ5 του 3.73, και ο ρητός
 * λόγος που η CHECK 3.81 είναι AST. Το `mandate-conflict` μέτρησε την ίδια
 * αστοχία: patterns που έπιαναν **12 στα 13 σχόλια**, >90% ψευδώς θετικά, πολύ
 * πάνω από το κατώφλι **<10%** που η Google θέτει για blocking checks.
 *
 * ⚠️ **Parse-only, ΠΟΤΕ `ts.Program`** (N.17): καμία μεταγλώττιση, κανένας
 * type-checker — μόνο ανάγνωση δέντρου. Ίδιο ιδίωμα με το
 * `scripts/lib/product-identity/scan.js`.
 *
 * 🔑 **ΕΝΑ ΜΗΤΡΩΟ, ΟΧΙ ΔΕΥΤΕΡΟ**: το allowlist διαβάζεται από το **υπάρχον**
 * `.ssot-registry.json` (module `sender-identity`). Δεύτερο αρχείο δηλώσεων θα
 * ήταν το «δεύτερο βιβλίο» που κατήργησε το ADR-749.
 *
 * Escape: SKIP_SENDER_AUTHORITY=1
 */
'use strict';

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const ts = require(path.join(PROJECT_ROOT, 'node_modules', 'typescript'));
const { collectSourceFiles } = require('./lib/module-graph/scan-config');
const { toPosix } = require('./lib/module-graph/resolve-specifier');

const REGISTRY_PATH = path.join(PROJECT_ROOT, '.ssot-registry.json');
const REGISTRY_MODULE = 'sender-identity';
const ROOT_FILE = 'src/services/company/sender-identity.ts';

/**
 * **ΤΟ ΚΛΕΙΣΤΟ ΣΥΝΟΛΟ ΤΩΝ ΜΕΤΑΒΛΗΤΩΝ ΑΠΟΣΤΟΛΕΑ — Η ΑΥΘΕΝΤΙΑ ΖΕΙ ΕΔΩ.**
 *
 * Τα ίδια ονόματα καθρεφτίζονται ως `forbiddenPatterns` στο `.ssot-registry.json`
 * (Layer 1 smoke, γρήγορο, σε σταδιοποιημένα αρχεία). ⚠️ Η συμφωνία των δύο
 * **δεν υπονοείται** — την **εκτελεί** το `Κ5` παρακάτω, γιατί δύο λίστες που
 * κανείς δεν συγκρίνει αποκλίνουν (ADR-749).
 */
const SENDER_ENV_VARS = [
  'FROM_NAME',
  'FROM_EMAIL',
  'MAILGUN_FROM_EMAIL',
  'COMPANY_EMAIL_DOMAIN',
  'EMAIL_PREFIX',
  'FALLBACK_EMAIL_DOMAIN',
];

/** Ό,τι οφείλει να εξάγει η ρίζα. Λείπει ⇒ `root-drift`, fail-closed. */
const ROOT_EXPORTS = [
  'PLATFORM_SENDER_ADDRESS',
  'resolveSenderIdentity',
  'senderHeader',
  'resolveSenderHeader',
  'adoptStoredSenderHeader',
];

/** Κάθε ρητή κατάσταση. Καμία σιωπηλή απόρριψη. */
const STATES = {
  ROOT: 'root',
  ALLOWED: 'allowed',
  CONSUMER: 'consumer',
  ENV_READ: 'undeclared-env-read',
  MANUAL_COMPOSITION: 'manual-composition',
  ROOT_DRIFT: 'root-drift',
  ORPHAN_ALLOWLIST: 'orphan-allowlist',
  MIRROR_DRIFT: 'mirror-drift',
};

/**
 * ⛔ ΠΕΝΤΕ κριτήρια, **ΠΟΤΕ ενωμένα με «ή»** (μάθημα CHECK 3.41):
 *   Κ1 `undeclared-env-read`  — μεταβλητή αποστολέα διαβάζεται εκτός ρίζας
 *   Κ2 `manual-composition`   — χειρόγραφο `${…} <${…}>` εκτός ρίζας
 *   Κ3 `root-drift`           — η ρίζα δεν εξάγει πια ό,τι υποθέτει η πύλη
 *   Κ4 `orphan-allowlist`     — δήλωση που δεν προστατεύει τίποτα υπαρκτό
 *   Κ5 `mirror-drift`         — το Layer 1 smoke δεν καλύπτει το ίδιο σύνολο
 * Τυπώνονται ΠΑΝΤΑ, ακόμα και στο μηδέν (μάθημα CHECK 3.48).
 */
const BLOCKING = [
  STATES.ENV_READ,
  STATES.MANUAL_COMPOSITION,
  STATES.ROOT_DRIFT,
  STATES.ORPHAN_ALLOWLIST,
  STATES.MIRROR_DRIFT,
];

// ============================================================================
// AST — parse-only
// ============================================================================

function sourceFileOf(absPath, text) {
  return ts.createSourceFile(
    absPath, text, ts.ScriptTarget.Latest, true,
    /\.tsx$/.test(absPath) ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
}

function lineOf(sf, node) {
  return sf.getLineAndCharacterOfPosition(node.getStart()).line + 1;
}

/**
 * **Κ1 — `process.env.X` όπου X ανήκει στο κλειστό σύνολο.**
 *
 * 🔑 AST, άρα ένα σχόλιο που **ονομάζει** τη μεταβλητή για να εξηγήσει τη
 * θεραπεία δεν είναι εύρημα. Αυτό ακριβώς ζητά η Φ9: τα εννέα θεραπευμένα
 * αρχεία κουβαλούν τέτοια σχόλια **επίτηδες**.
 */
function envReadsIn(sf) {
  const hits = [];
  const visit = (node) => {
    if (
      ts.isPropertyAccessExpression(node)
      && ts.isPropertyAccessExpression(node.expression)
      && ts.isIdentifier(node.expression.expression)
      && node.expression.expression.text === 'process'
      && ts.isIdentifier(node.expression.name)
      && node.expression.name.text === 'env'
      && ts.isIdentifier(node.name)
      && SENDER_ENV_VARS.includes(node.name.text)
    ) {
      hits.push({ variable: node.name.text, line: lineOf(sf, node) });
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(sf, visit);
  return hits;
}

/**
 * **Κ2 — χειρόγραφη σύνθεση `${όνομα} <${διεύθυνση}>`.**
 *
 * Το σχήμα στο AST είναι ακριβές και **δεν χρειάζεται κανονική έκφραση**: ένα
 * `TemplateSpan` του οποίου το literal είναι `TemplateMiddle` που **τελειώνει σε
 * `<`**, ακολουθούμενο από span με `TemplateTail` που **αρχίζει με `>`**.
 *
 * ⚠️ Καμία `RegExp` χτισμένη από συμβολοσειρά — το CHECK 3.73 γεννήθηκε σπασμένο
 * ακριβώς έτσι (`\b` μέσα σε template literal είναι BACKSPACE, U+0008).
 */
function manualCompositionsIn(sf) {
  const hits = [];
  const visit = (node) => {
    if (ts.isTemplateExpression(node)) {
      const spans = node.templateSpans;
      for (let i = 0; i < spans.length - 1; i += 1) {
        const middle = spans[i].literal;
        const next = spans[i + 1].literal;
        // 🔴 ΨΕΥΔΩΣ ΘΕΤΙΚΟ ΠΟΥ ΒΡΗΚΕ Η **ΠΡΩΤΗ ΕΚΤΕΛΕΣΗ**, ΟΧΙ Ο ΣΥΓΓΡΑΦΕΑΣ.
        //    Η πρώτη γραφή ρωτούσε «**τελειώνει** το ενδιάμεσο σε `<`;» — που ισχύει και
        //    για κάθε μήνυμα σφάλματος με δύο ετικέτες:
        //      `Root element is not <${expected}> (found <${actual}>).`  (`lib/xml/xml-dom.ts:38`)
        //    Δηλαδή ο AST κανόνας ήταν **ΧΑΛΑΡΟΤΕΡΟΣ από το regex του Layer 1**, που
        //    απαιτούσε `}` → κενά → `<${`. Το αντίστροφο από την υπόσχεση της πύλης.
        // 🔑 Η σωστή ερώτηση: το κενό ανάμεσα στις δύο παρεμβολές είναι **μόνο κενά και
        //    ένα `<`**; Ισχύει στον φάκελο (`" <"`), δεν ισχύει στο XML (`"> (found <"`).
        const gap = ts.isTemplateMiddle(middle) ? middle.text : null;
        const isEnvelopeGap = gap !== null && gap.endsWith('<') && gap.slice(0, -1).trim() === '';
        if (
          isEnvelopeGap
          && (ts.isTemplateTail(next) || ts.isTemplateMiddle(next))
          && next.text.startsWith('>')
        ) {
          hits.push({ line: lineOf(sf, node), excerpt: node.getText().slice(0, 70) });
          break;
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(sf, visit);
  return hits;
}

/** Εισάγει αυτό το αρχείο τη ρίζα; — ο **παρονομαστής** του Κ4. */
function importsRoot(sf) {
  let found = false;
  const visit = (node) => {
    if (
      ts.isImportDeclaration(node)
      && ts.isStringLiteral(node.moduleSpecifier)
      && node.moduleSpecifier.text.includes('services/company/sender-identity')
    ) {
      found = true;
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(sf, visit);
  return found;
}

/** **Κ3** — τα εξαγόμενα ονόματα της ρίζας, διαβασμένα από τον ΚΩΔΙΚΑ. */
function rootExportNames(sf) {
  const names = new Set();
  const visit = (node) => {
    const mods = ts.canHaveModifiers(node) ? (ts.getModifiers(node) ?? []) : [];
    const exported = mods.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
    if (exported) {
      if (ts.isFunctionDeclaration(node) && node.name) names.add(node.name.text);
      if (ts.isVariableStatement(node)) {
        for (const d of node.declarationList.declarations) {
          if (ts.isIdentifier(d.name)) names.add(d.name.text);
        }
      }
      if ((ts.isTypeAliasDeclaration(node) || ts.isInterfaceDeclaration(node)) && node.name) {
        names.add(node.name.text);
      }
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(sf, visit);
  return names;
}

// ============================================================================
// Η ΜΕΤΡΗΣΗ
// ============================================================================

function loadAllowlist(registryPath = REGISTRY_PATH) {
  const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
  const mod = registry.modules?.[REGISTRY_MODULE];
  if (!mod) {
    throw new Error(`.ssot-registry.json: λείπει το module «${REGISTRY_MODULE}» — η πύλη δεν έχει δηλώσεις`);
  }
  return { allowlist: mod.allowlist ?? [], patterns: mod.forbiddenPatterns ?? [] };
}

function measure(opts = {}) {
  const root = opts.root || PROJECT_ROOT;
  const { allowlist, patterns } = opts.registry || loadAllowlist(opts.registryPath);
  const allowed = new Set(allowlist);

  const tally = Object.fromEntries(Object.values(STATES).map((s) => [s, 0]));
  const findings = [];

  // ── Κ3: η ρίζα ───────────────────────────────────────────────────────────
  const rootAbs = path.join(root, ROOT_FILE);
  if (!fs.existsSync(rootAbs)) {
    tally[STATES.ROOT_DRIFT] += 1;
    findings.push({ state: STATES.ROOT_DRIFT, file: ROOT_FILE, detail: 'η ρίζα δεν υπάρχει' });
    return { findings, tally, examined: 0 };
  }
  const rootSf = sourceFileOf(rootAbs, fs.readFileSync(rootAbs, 'utf8'));
  const exported = rootExportNames(rootSf);
  const missing = ROOT_EXPORTS.filter((name) => !exported.has(name));
  if (missing.length > 0) {
    tally[STATES.ROOT_DRIFT] += 1;
    findings.push({
      state: STATES.ROOT_DRIFT, file: ROOT_FILE,
      detail: `η ρίζα δεν εξάγει πια: ${missing.join(' · ')} — κάθε ετυμηγορία θα κρινόταν έναντι άγνωστου συνόλου`,
    });
  } else {
    tally[STATES.ROOT] += 1;
  }

  // ── Κ1 + Κ2 + παρονομαστής ───────────────────────────────────────────────
  const files = opts.codeFiles || collectSourceFiles(root, ['src']);
  if (!opts.codeFiles && files.length < 1000) {
    throw new Error(`ΦΡΟΥΡΟΣ: μόνο ${files.length} αρχεία σαρώθηκαν — η σάρωση δεν κοίταξε`);
  }

  for (const abs of files) {
    const rel = toPosix(path.relative(root, abs));
    if (rel === ROOT_FILE) continue;                       // η ρίζα ΟΡΙΖΕΙ την απάντηση
    let text;
    try { text = fs.readFileSync(abs, 'utf8'); } catch { continue; }
    // Προφίλτρο **ασφαλές δομικά**: ό,τι δεν περιέχει καν το κείμενο δεν μπορεί να έχει κόμβο.
    if (!text.includes('process.env.') && !text.includes('<${')) {
      if (text.includes('sender-identity')) {
        let sf; try { sf = sourceFileOf(abs, text); } catch { continue; }
        if (importsRoot(sf)) tally[STATES.CONSUMER] += 1;
      }
      continue;
    }

    let sf;
    try { sf = sourceFileOf(abs, text); } catch { continue; }
    if (importsRoot(sf)) tally[STATES.CONSUMER] += 1;

    const isAllowed = allowed.has(rel);
    for (const hit of envReadsIn(sf)) {
      if (isAllowed) { tally[STATES.ALLOWED] += 1; continue; }
      tally[STATES.ENV_READ] += 1;
      findings.push({
        state: STATES.ENV_READ, file: rel, line: hit.line,
        detail: `διαβάζει «process.env.${hit.variable}» — η ταυτότητα αποστολέα ζει στη ρίζα`,
      });
    }
    for (const hit of manualCompositionsIn(sf)) {
      if (isAllowed) { tally[STATES.ALLOWED] += 1; continue; }
      tally[STATES.MANUAL_COMPOSITION] += 1;
      findings.push({
        state: STATES.MANUAL_COMPOSITION, file: rel, line: hit.line,
        detail: `συνθέτει χειρόγραφα «Όνομα <διεύθυνση>» — παρακάμπτει καθαρισμό CRLF + RFC 5322: ${hit.excerpt}`,
      });
    }
  }

  // ── Κ4: ο παρονομαστής — δήλωση που δεν προστατεύει τίποτα ────────────────
  for (const rel of allowlist) {
    if (!fs.existsSync(path.join(root, rel))) {
      tally[STATES.ORPHAN_ALLOWLIST] += 1;
      findings.push({
        state: STATES.ORPHAN_ALLOWLIST, file: rel,
        detail: 'δηλωμένο αρχείο που ΔΕΝ ΥΠΑΡΧΕΙ — η δήλωση προστατεύει το τίποτα',
      });
    }
  }
  // 🔑 Μηδέν καταναλωτές ⇒ η ρίζα δεν φυλάει τίποτα. Αν ο σαρωτής σπάσει, **ουρλιάζει**
  //    αντί να σιωπήσει — το ίδιο ιδίωμα με τον παρονομαστή της CHECK 3.81.
  if (tally[STATES.CONSUMER] === 0) {
    tally[STATES.ORPHAN_ALLOWLIST] += 1;
    findings.push({
      state: STATES.ORPHAN_ALLOWLIST, file: ROOT_FILE,
      detail: 'ΚΑΝΕΝΑΣ καταναλωτής δεν εισάγει τη ρίζα — ή η Φ9 αναιρέθηκε, ή ο σαρωτής έσπασε',
    });
  }

  // ── Κ5: το Layer 1 smoke καλύπτει ΤΟ ΙΔΙΟ σύνολο; ────────────────────────
  const mirrored = patterns.join('\n');
  const uncovered = SENDER_ENV_VARS.filter((name) => !mirrored.includes(name));
  if (uncovered.length > 0) {
    tally[STATES.MIRROR_DRIFT] += 1;
    findings.push({
      state: STATES.MIRROR_DRIFT, file: '.ssot-registry.json',
      detail: `το Layer 1 smoke δεν καλύπτει: ${uncovered.join(' · ')} — δύο λίστες που κανείς δεν συγκρίνει αποκλίνουν`,
    });
  }

  return { findings, tally, examined: files.length };
}

function report(result, log = console.log) {
  const { tally, findings } = result;
  log('');
  log('✉️  CHECK 3.83 — Πύλη αρχής του αποστολέα (ADR-857 Φ9)');
  log('');
  log(`   αρχεία που εξετάστηκαν: ${result.examined}`);
  log(`   μεταβλητές του κλειστού συνόλου: ${SENDER_ENV_VARS.length} — ${SENDER_ENV_VARS.join(' · ')}`);
  log('');
  for (const s of BLOCKING) log(`   ⛔ ${s.padEnd(24)} ${tally[s]}`);
  log('');
  for (const s of [STATES.ROOT, STATES.ALLOWED, STATES.CONSUMER]) {
    log(`   ✅ ${s.padEnd(24)} ${tally[s]}`);
  }

  const blocking = findings.filter((f) => BLOCKING.includes(f.state));
  if (blocking.length) {
    log('');
    log('   ── ΕΥΡΗΜΑΤΑ ──');
    for (const f of blocking) {
      log(`   ⛔ ${f.state}  ${f.file}${f.line ? ':' + f.line : ''}`);
      log(`        ${f.detail}`);
    }
    log('');
    log('   ΘΕΡΑΠΕΙΑ — σχεδόν πάντα η πρώτη:');
    log("     (1) ΡΩΤΑ ΤΗ ΡΙΖΑ:  import { resolveSenderHeader } from '@/services/company/sender-identity'");
    log('     (2) Αν η τιμή έρχεται από ΒΑΣΗ: `adoptStoredSenderHeader(...)` — ρητή υιοθεσία που ξανακαθαρίζει.');
    log('     ⚠️ ΜΗΝ λύσεις κόκκινο προσθέτοντας αρχείο στο allowlist «επειδή βολεύει»:');
    log('        το allowlist σημαίνει «ΕΔΩ ζει η απάντηση», όχι «εδώ επιτρέπεται εξαίρεση».');
  }
  return blocking.length;
}

function main() {
  if (process.env.SKIP_SENDER_AUTHORITY === '1') {
    console.log('⏭️  CHECK 3.83 παραλείφθηκε (SKIP_SENDER_AUTHORITY=1)');
    return 0;
  }
  const result = measure();
  const blocking = report(result);
  if (blocking > 0) {
    console.log('');
    console.log(`❌ CHECK 3.83 ΑΠΕΤΥΧΕ — ${blocking} μπλοκάρουσα(ες) παραβίαση(εις)`);
    console.log('');
    return 1;
  }
  console.log('');
  console.log('✅ CHECK 3.83 — ο αποστολέας αποφασίζεται ΜΟΝΟ στη ρίζα');
  console.log('');
  return 0;
}

if (require.main === module) process.exit(main());
module.exports = {
  measure, report, main, loadAllowlist,
  envReadsIn, manualCompositionsIn, importsRoot, rootExportNames, sourceFileOf,
  STATES, BLOCKING, SENDER_ENV_VARS, ROOT_EXPORTS, ROOT_FILE,
};
