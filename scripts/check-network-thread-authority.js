#!/usr/bin/env node
/**
 * =============================================================================
 * CHECK 3.89 — Η ΠΥΛΗ ΤΗΣ ΑΡΧΗΣ ΤΟΥ ΝΗΜΑΤΟΣ (ADR-867 Β4)
 * =============================================================================
 *
 * «Γράφει κάποιος ΑΚΡΟΑΤΗΡΙΟ ή ΜΗΝΥΜΑ έξω από τον ΕΝΑ γραφέα — ή αλλάζει ομάδα ΧΩΡΙΣ να
 *  ξαναγράψει το ακροατήριο;»
 *
 * 🔴 ΓΙΑΤΙ: το ακροατήριο (`network_threads/{id}/network_audience/{uid}`) είναι Η ΑΠΑΝΤΗΣΗ
 * του κανόνα Firestore στο «ποιος διαβάζει;» (ADR-867 §4.2). Οι κανόνες κλείνουν τον
 * ΠΕΛΑΤΗ (`create/update/delete: if false`) — ΟΧΙ το Admin SDK: ένας δεύτερος γραφέας στον
 * διακομιστή περνά κάθε κανόνα και βάζει όποιον θέλει σε ξένη συνομιλία. Και μια αλλαγή
 * ομάδας ΧΩΡΙΣ προβολή δεν «χάνει ενημέρωση»: αφήνει νήμα που ο νέος υπεύθυνος ΔΕΝ
 * διαβάζει και ο αποχωρών ΕΞΑΚΟΛΟΥΘΕΙ να διαβάζει.
 *
 * ── ΤΑ ΚΡΙΤΗΡΙΑ (κάθε ένα δική του γραμμή) ────────────────────────────────────────────
 *  Κ1 τα ονόματα συλλογής/υποσυλλογών (`COLLECTIONS.NETWORK_THREADS`,
 *     `SUBCOLLECTIONS.NETWORK_THREAD_*`) χτίζονται ΜΟΝΟ στο `network-thread-ref.ts`
 *  Κ2 οι συναρτήσεις του ref καλούνται ΜΟΝΟ από ΔΗΛΩΜΕΝΟ καταναλωτή
 *  Κ3 γραφή πάνω σε αλυσίδα ακροατηρίου ΜΟΝΟ στον `thread-writer.ts`
 *  Κ4 γραφή πάνω σε αλυσίδα μηνυμάτων ΜΟΝΟ στον `thread-messages.ts`
 *  Κ5 κάθε δηλωμένο αρχείο ΥΠΑΡΧΕΙ (source drift)
 *  Κ6 κάθε γραφέας ΟΜΑΔΑΣ ρωτά την προβολή (`writeActThread(`) — αλλιώς «πράσινο επειδή
 *     κανείς δεν την καλεί», το μετρημένο σχήμα του CHECK 3.88 Κ4
 *  Κ7 (Β7) ο τόπος μονοπατιών του ΠΕΛΑΤΗ (`network-thread-client-ref.ts`, Web SDK) ΔΕΝ ΓΡΑΦΕΙ ΠΟΤΕ —
 *     ένας τόπος ανά SDK για το Κ1, αλλά οι κανόνες κλείνουν κάθε γραφή πελάτη και κάθε πράξη
 *     περνά από διαδρομή· μια εισαγωγή `setDoc`/`updateDoc`/… εκεί = δεύτερος γραφέας εν αναμονή
 *
 * ⚠️ AST, ΠΟΤΕ ΚΕΙΜΕΝΟ: τα αρχεία κουβαλούν σχόλια που ΟΝΟΜΑΖΟΥΝ τις κλήσεις και τις
 * συλλογές — ένα `grep` θα κατήγγειλε την ίδια την τεκμηρίωση.
 * 🔓 Εξαίρεση ΜΟΝΟ με λόγο, στη γραμμή πάνω: `// network-thread-authority-exempt: <λόγος>`.
 *
 * @see ADR-867 §4.2 · §4.3 · docs/gates/3.89.md · αδέλφια: CHECK 3.87 · 3.88
 */

'use strict';

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const ts = require(path.join(PROJECT_ROOT, 'node_modules', 'typescript'));
const { collectSourceFiles } = require('./lib/module-graph/scan-config');
const { toPosix } = require('./lib/module-graph/resolve-specifier');

const REF_FILE = 'src/services/network-messaging/network-thread-ref.ts';
/**
 * ADR-867 Β7 — ο ΕΝΑΣ τόπος μονοπατιών για το **Web SDK** (η ζωντανή οθόνη). Ο Κ1 ζητά «ένα σημείο»· με
 * δύο SDK με διαφορετικούς τύπους, «ένα σημείο» = **ένα ανά SDK**, ρητά δηλωμένο — και **μόνο ανάγνωση** (Κ7).
 */
const CLIENT_REF_FILE = 'src/lib/network-messaging/network-thread-client-ref.ts';
/** Όπου επιτρέπεται να εμφανίζονται τα ονόματα συλλογής του νήματος (Κ1). */
const PATH_HOMES = new Set([REF_FILE, CLIENT_REF_FILE]);
/** Οι συναρτήσεις γραφής του Web SDK — καμία δεν επιτρέπεται στον τόπο του πελάτη (Κ7). */
const CLIENT_WRITE_CALLS = /\b(setDoc|updateDoc|addDoc|deleteDoc|writeBatch|runTransaction)\b/;
const AUDIENCE_WRITER = 'src/services/network-messaging/thread-writer.ts';
const MESSAGE_WRITER = 'src/services/network-messaging/thread-messages.ts';
/** Το αρχείο όπου ζουν τα ονόματα — εκεί ΠΡΕΠΕΙ να εμφανίζονται. */
const COLLECTION_HOME = 'src/config/firestore-collections.ts';

/** Οι ΔΗΛΩΜΕΝΟΙ καταναλωτές του μονοπατιού — κλειστό σύνολο, με λόγο ο καθένας. */
const CONSUMERS = {
  [AUDIENCE_WRITER]: 'ο ΕΝΑΣ γραφέας νήματος + ακροατηρίου',
  [MESSAGE_WRITER]: 'η αποστολή μηνύματος (υποσυλλογή μηνυμάτων)',
  'src/services/network-messaging/thread-directory.ts':
    'ο κατάλογος νημάτων (ADR-867 Β5): collection group ΑΝΑΓΝΩΣΗ του ακροατηρίου — καμία γραφή',
  'src/services/network-messaging/thread-reader.ts':
    'ο αναγνώστης του ακροατηρίου (ADR-867 Β5 παρουσία · Β7 ονόματα): ΑΝΑΓΝΩΣΗ «διαβάζει ο καλών; ποιοι είναι όλοι;» — καμία γραφή',
  'src/services/network-messaging/network-unread-email.ts':
    'η πύλη του email «αδιάβαστο» (ADR-867 Β6): ΑΝΑΓΝΩΣΗ νήματος + γραμμής του παραλήπτη τη στιγμή της αποστολής — καμία γραφή',
};

/**
 * Όποιος γράφει ΟΜΑΔΑ πράξης οφείλει να ρωτά την προβολή ακροατηρίου.
 * ⚠️ Δεν είναι «καλή πρακτική»: ομάδα που αλλάζει χωρίς προβολή ΕΙΝΑΙ το ορφανό νήμα.
 */
const PROJECTION_CONSUMERS = [
  'src/services/network-messaging/act-team-writer.ts',
  'src/services/mandate/mandate-acceptance.service.ts',
];
/**
 * Οι κλήσεις που **είναι** προβολή. Το `writeActBirth(` (Β9) ζει στον `act-team-writer.ts` και καλεί το
 * `writeActThread(` εσωτερικά — η αποδοχή το ζητά αντί να ξαναγράφει τη γέννηση ομάδας+νήματος μόνη της.
 * ⚠️ Κρίνεται ο **κώδικας**, όχι τα σχόλια: ένα σχόλιο που ονομάζει την κλήση δεν είναι προβολή.
 */
const PROJECTION_CALLS = ['writeActThread(', 'writeActBirth('];

const COLLECTION_NAMES = [
  'COLLECTIONS.NETWORK_THREADS',
  'COLLECTIONS.NETWORK_MESSAGE_RETRACTIONS',
  'COLLECTIONS.NETWORK_MESSAGE_REVISIONS',
  'SUBCOLLECTIONS.NETWORK_THREAD_MESSAGES',
  'SUBCOLLECTIONS.NETWORK_THREAD_AUDIENCE',
];
const REF_CALLS = new Set([
  'networkThreadRef',
  'networkThreadAudience',
  'networkAudienceRef',
  'networkThreadMessages',
  'networkRetractionRef',
  'networkRevisionRef',
  'networkAudienceGroup',
]);
const AUDIENCE_CALLS = new Set(['networkThreadAudience', 'networkAudienceRef']);
/**
 * 🔑 **ΤΟ ΒΙΒΛΙΟ ΑΝΑΚΛΗΣΕΩΝ ΜΠΑΙΝΕΙ ΕΔΩ, ΜΕ ΤΑ ΜΗΝΥΜΑΤΑ** (Κ4): είναι το **δεύτερο
 * αντίγραφο** του ίδιου γεγονότος και γράφεται στην **ίδια** συναλλαγή. Χωριστό κριτήριο
 * θα επέτρεπε «ταφόπλακα εδώ, αντίγραφο αλλού» — δηλαδή ακριβώς τη μισή ανάκληση που η
 * ατομικότητα υπάρχει για να αποκλείσει.
 *
 * ✏️ **Και οι ΑΝΑΘΕΩΡΗΣΕΙΣ (ADR-867 Β7), για τον ΙΔΙΟ λόγο**: η προηγούμενη μορφή και το νέο σώμα
 * γράφονται στην ίδια συναλλαγή — μια επεξεργασία χωρίς αντίγραφο είναι ξαναγραμμένη ιστορία.
 */
const MESSAGE_CALLS = new Set(['networkThreadMessages', 'networkRetractionRef', 'networkRevisionRef']);

const WRITE_METHODS = new Set(['set', 'update', 'create', 'delete', 'add']);
const EXEMPT = /network-thread-authority-exempt:\s*(\S.*)?$/;

const STATES = {
  REF: 'ref-file',
  CONSUMER: 'declared-consumer',
  EXEMPT: 'exempt-with-reason',
  PATH_OUTSIDE_REF: 'thread-path-outside-ref',
  UNDECLARED_CONSUMER: 'undeclared-thread-consumer',
  SECOND_AUDIENCE_WRITER: 'second-audience-writer',
  SECOND_MESSAGE_WRITER: 'second-message-writer',
  PROJECTION_UNASKED: 'audience-projection-unasked',
  EXEMPT_NO_REASON: 'exempt-without-reason',
  SOURCE_DRIFT: 'source-drift',
  CLIENT_REF_WRITES: 'client-ref-writes',
};
const BLOCKING = [
  STATES.PATH_OUTSIDE_REF,
  STATES.UNDECLARED_CONSUMER,
  STATES.SECOND_AUDIENCE_WRITER,
  STATES.SECOND_MESSAGE_WRITER,
  STATES.PROJECTION_UNASKED,
  STATES.EXEMPT_NO_REASON,
  STATES.SOURCE_DRIFT,
  STATES.CLIENT_REF_WRITES,
];

function sourceFileOf(absPath, text) {
  return ts.createSourceFile(absPath, text, ts.ScriptTarget.Latest, true,
    /\.tsx$/.test(absPath) ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
}

const lineOf = (sf, node) => sf.getLineAndCharacterOfPosition(node.getStart()).line + 1;

/** Η εξαίρεση της γραμμής από πάνω: `null` αν δεν υπάρχει, αλλιώς ο λόγος (μπορεί κενός). */
function exemptionAbove(sf, node) {
  const above = sf.text.split(/\r?\n/)[lineOf(sf, node) - 2] || '';
  const match = above.match(EXEMPT);
  return match ? (match[1] || '').trim() : null;
}

/** Ο αριστερός κρίκος μιας αλυσίδας κλήσεων/προσβάσεων — κάθε κόμβος, από έξω προς τα μέσα. */
function chainNodes(node) {
  const nodes = [];
  for (let current = node; current; ) {
    nodes.push(current);
    if (ts.isCallExpression(current) || ts.isPropertyAccessExpression(current)) current = current.expression;
    else break;
  }
  return nodes;
}

const callName = (node) =>
  ts.isCallExpression(node) && ts.isIdentifier(node.expression) ? node.expression.text : null;

/**
 * Γράφει αυτή η κλήση πάνω σε αλυσίδα που ξεκινά από μία από τις `names`;
 * Δύο μορφές: `ref.set(data)` **και** `tx|batch.set(ref, data)`.
 */
function writesThrough(call, names, aliases) {
  if (!ts.isPropertyAccessExpression(call.expression)) return false;
  if (!WRITE_METHODS.has(call.expression.name.text)) return false;

  // ⚠️ Ο έλεγχος τρέχει σε **ΚΑΘΕ κρίκο** της αλυσίδας, όχι μόνο στην κορυφή: η μορφή
  //    `slot.audienceRef.doc(uid)` κρύβει το ψευδώνυμο **δύο** κρίκους μέσα, και μια
  //    πύλη που κοιτά μόνο την κορυφή είναι πράσινη ακριβώς στη μορφή που γράφεται.
  const rootsFrom = (node) =>
    chainNodes(node).some((n) =>
      names.has(callName(n))
      || (ts.isIdentifier(n) && aliases.has(n.text))
      || (ts.isPropertyAccessExpression(n) && aliases.has(n.name.text)));

  if (rootsFrom(call.expression.expression)) return true;
  return call.arguments.length >= 2 && rootsFrom(call.arguments[0]);
}

/**
 * 🔑 **ΤΑ ΨΕΥΔΩΝΥΜΑ, ΚΑΙ ΓΙΑΤΙ ΧΩΡΙΣ ΑΥΤΑ Η ΠΥΛΗ ΕΙΝΑΙ ΔΙΑΚΟΣΜΗΤΙΚΗ**: κανείς δεν γράφει
 * `networkThreadAudience(db, id).doc(uid).set(...)` σε μια συναλλαγή — κρατά την αναφορά σε
 * μεταβλητή (`const audienceRef = …`) και γράφει μέσω αυτής, ίσως σε άλλη συνάρτηση
 * (`slot.audienceRef`). Ο έλεγχος μαζεύει και τα δύο ονόματα.
 */
function refAliases(sf, names) {
  const aliases = new Set();
  const visit = (node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer
      && chainNodes(node.initializer).some((n) => names.has(callName(n)))) {
      aliases.add(node.name.text);
    }
    if (ts.isPropertyAssignment(node) && node.name && ts.isIdentifier(node.name)
      && chainNodes(node.initializer).some((n) => names.has(callName(n)))) {
      aliases.add(node.name.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return aliases;
}

function classifyByExemption(sf, node, rel, blockingState, detail) {
  const reason = exemptionAbove(sf, node);
  if (reason === null) return { state: blockingState, file: rel, line: lineOf(sf, node), detail };
  return reason.length > 0
    ? { state: STATES.EXEMPT, file: rel }
    : { state: STATES.EXEMPT_NO_REASON, file: rel, line: lineOf(sf, node), detail: 'εξαίρεση ΧΩΡΙΣ λόγο' };
}

/** Κ1 + Κ2 + Κ3 + Κ4 για ένα αρχείο. */
function findingsIn(sf, rel) {
  const findings = [];
  const audienceAliases = refAliases(sf, AUDIENCE_CALLS);
  const messageAliases = refAliases(sf, MESSAGE_CALLS);
  // Το `slot.audienceRef` ταξιδεύει ανάμεσα σε συναρτήσεις — το όνομα του πεδίου ΕΙΝΑΙ το ψευδώνυμο.
  audienceAliases.add('audienceRef');

  const visit = (node) => {
    if (ts.isPropertyAccessExpression(node) && COLLECTION_NAMES.includes(node.getText())
      && !PATH_HOMES.has(rel) && rel !== COLLECTION_HOME) {
      findings.push(classifyByExemption(sf, node, rel, STATES.PATH_OUTSIDE_REF,
        `χτίζει το μονοπάτι του νήματος — ζήτα το από το \`${REF_FILE}\``));
    }

    if (ts.isCallExpression(node) && REF_CALLS.has(callName(node))) {
      findings.push(...consumerFinding(sf, node, rel));
    }

    if (ts.isCallExpression(node) && rel !== AUDIENCE_WRITER
      && writesThrough(node, AUDIENCE_CALLS, audienceAliases)) {
      findings.push(classifyByExemption(sf, node, rel, STATES.SECOND_AUDIENCE_WRITER,
        `γράφει ΑΚΡΟΑΤΗΡΙΟ — η προβολή ζει ΜΟΝΟ στον ${AUDIENCE_WRITER}`));
    }

    if (ts.isCallExpression(node) && rel !== MESSAGE_WRITER
      && writesThrough(node, MESSAGE_CALLS, messageAliases)) {
      findings.push(classifyByExemption(sf, node, rel, STATES.SECOND_MESSAGE_WRITER,
        `γράφει ΜΗΝΥΜΑ — η αποστολή ζει ΜΟΝΟ στον ${MESSAGE_WRITER}`));
    }

    ts.forEachChild(node, visit);
  };
  visit(sf);
  return findings;
}

function consumerFinding(sf, node, rel) {
  if (rel === REF_FILE) return [{ state: STATES.REF, file: rel }];
  if (CONSUMERS[rel]) return [{ state: STATES.CONSUMER, file: rel }];
  return [classifyByExemption(sf, node, rel, STATES.UNDECLARED_CONSUMER,
    'αδήλωτος καταναλωτής του μονοπατιού νήματος — δήλωσέ τον στο CONSUMERS με λόγο, ή ζήτα από τον γραφέα')];
}

/** Κ5 + Κ6. */
function wiringFindings(root) {
  const findings = [];
  for (const declared of [REF_FILE, CLIENT_REF_FILE, AUDIENCE_WRITER, MESSAGE_WRITER, ...PROJECTION_CONSUMERS]) {
    if (!fs.existsSync(path.join(root, declared))) {
      findings.push({ state: STATES.SOURCE_DRIFT, file: declared, detail: 'δηλωμένο αρχείο που ΔΕΝ ΥΠΑΡΧΕΙ' });
    }
  }
  // Κ7 — ο τόπος του πελάτη διαβάζει μόνο.
  const clientRef = path.join(root, CLIENT_REF_FILE);
  if (fs.existsSync(clientRef) && CLIENT_WRITE_CALLS.test(stripComments(fs.readFileSync(clientRef, 'utf8')))) {
    findings.push({ state: STATES.CLIENT_REF_WRITES, file: CLIENT_REF_FILE,
      detail: 'ο τόπος μονοπατιών του ΠΕΛΑΤΗ εισάγει/καλεί γραφή — κάθε πράξη περνά από διαδρομή (`network-thread.client.ts`)' });
  }
  for (const consumer of PROJECTION_CONSUMERS) {
    const abs = path.join(root, consumer);
    if (!fs.existsSync(abs)) continue;
    const code = stripComments(fs.readFileSync(abs, 'utf8'));
    if (!PROJECTION_CALLS.some((call) => code.includes(call))) {
      findings.push({ state: STATES.PROJECTION_UNASKED, file: consumer,
        detail: `δεν καλεί ${PROJECTION_CALLS.map((c) => `\`${c}\``).join(' / ')} — η ομάδα αλλάζει και το ακροατήριο μένει να λέει ψέματα` });
    }
  }
  return findings;
}

// ⚠️ ADR-867 Β5: το `networkAudienceGroup` ΠΡΕΠΕΙ να είναι εδώ — αλλιώς αρχείο που καλεί ΜΟΝΟ
//    αυτό δεν σαρώνεται καν, και ο Κ2 είναι πράσινος επειδή δεν κοίταξε.
const RELEVANT = /NETWORK_THREAD|networkThread|networkAudienceRef|networkAudienceGroup|writeActThread/;

/** Κ7: τα σχόλια ΟΝΟΜΑΖΟΥΝ τις απαγορευμένες κλήσεις («ένα `setDoc` εδώ…») — κρίνεται μόνο ο κώδικας. */
function stripComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function measure(opts = {}) {
  const root = opts.root || PROJECT_ROOT;
  const files = (opts.codeFiles || collectSourceFiles(root, ['src'])).filter((f) => !/__tests__|\.test\.|\.spec\./.test(f));
  if (!opts.codeFiles && files.length < 1000) throw new Error(`ΦΡΟΥΡΟΣ: μόνο ${files.length} αρχεία — η σάρωση δεν κοίταξε`);
  const findings = [];
  for (const abs of files) {
    let text;
    try { text = fs.readFileSync(abs, 'utf8'); } catch { continue; }
    if (!RELEVANT.test(text)) continue;
    findings.push(...findingsIn(sourceFileOf(abs, text), toPosix(path.relative(root, abs))));
  }
  findings.push(...(opts.skipWiring ? [] : wiringFindings(root)));
  const tally = Object.fromEntries(Object.values(STATES).map((s) => [s, findings.filter((f) => f.state === s).length]));
  return { findings, tally, examined: files.length };
}

function report(result, log = console.log) {
  const { tally, findings } = result;
  log('');
  log('💬 CHECK 3.89 — Πύλη της αρχής του νήματος (ADR-867 Β4)');
  log(`   αρχεία που εξετάστηκαν: ${result.examined}`);
  log('');
  for (const s of BLOCKING) log(`   ⛔ ${s.padEnd(30)} ${tally[s]}`);
  for (const s of [STATES.REF, STATES.CONSUMER, STATES.EXEMPT]) log(`   ✅ ${s.padEnd(30)} ${tally[s]}`);
  const blocking = findings.filter((f) => BLOCKING.includes(f.state));
  for (const f of blocking) log(`   ⛔ ${f.state}  ${f.file}${f.line ? ':' + f.line : ''}\n        ${f.detail}`);
  if (blocking.length) {
    log('\n   ΘΕΡΑΠΕΙΑ: ακροατήριο → `writeActThread` / `touchOwnAudience`· μήνυμα →');
    log('   `sendNetworkMessage`. ⚠️ ΜΗΝ προσθέσεις καταναλωτή «επειδή βολεύει».');
  }
  return blocking.length;
}

function main() {
  if (process.env.SKIP_NETWORK_THREAD_AUTHORITY === '1') {
    console.log('⏭️  CHECK 3.89 παραλείφθηκε (SKIP_NETWORK_THREAD_AUTHORITY=1)');
    return 0;
  }
  const blocking = report(measure());
  console.log(blocking > 0
    ? `\n❌ CHECK 3.89 ΑΠΕΤΥΧΕ — ${blocking} μπλοκάρουσα(ες) παραβίαση(εις)\n`
    : '\n✅ CHECK 3.89 — ακροατήριο και μηνύματα γράφονται ΜΟΝΟ από τον έναν γραφέα\n');
  return blocking > 0 ? 1 : 0;
}

if (require.main === module) process.exit(main());

module.exports = {
  measure, report, main, findingsIn, wiringFindings, sourceFileOf,
  STATES, BLOCKING, REF_FILE, CLIENT_REF_FILE, AUDIENCE_WRITER, MESSAGE_WRITER, CONSUMERS, PROJECTION_CONSUMERS,
};
