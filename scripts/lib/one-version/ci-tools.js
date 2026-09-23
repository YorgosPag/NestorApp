/**
 * CHECK 3.65 — ΣΤ · ΕΡΓΑΛΕΙΑ CI: «μία έκδοση» και για ό,τι ΔΕΝ ζει στο lockfile (ADR-800 · ADR-875 §12)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΤΙ ΜΕΤΡΗΘΗΚΕ (2026-09-23)
 * ─────────────────────────────────────────────────────────────────────────────
 * Το `firebase-tools` δεν είναι εξάρτηση του έργου· εγκαθίσταται **ολικά** στο CI. Άρα
 * τα κατάστιχα Α-Ε, που διαβάζουν manifests + lockfile, ήταν **δομικά τυφλά** σε αυτό.
 * Βρέθηκαν **τρεις** εκδόσεις του ίδιου εργαλείου:
 *   - ο deployer της παραγωγής: `15.13.0` (`FIREBASE_TOOLS_VERSION`, με τη σημασιολογία
 *     δεικτών του να αντιγράφεται αυτούσια από το `drift.js`, ADR-865 §10.2)·
 *   - ο χρησμός 3.51: `15.30.2`, χωρίς καταγεγραμμένο λόγο·
 *   - τέσσερις ροές: **χωρίς** έκδοση, δηλαδή «ό,τι βγήκε σήμερα».
 * Οι κανόνες ελέγχονταν σε emulator που **δεν** ήταν η έκδοση που τους αναπτύσσει, και μια
 * νέα έκδοση στο npm μπορούσε να αλλάξει ετυμηγορία πύλης **χωρίς κανένα commit**.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔑 ΤΡΕΙΣ ΡΟΛΟΙ, ΚΑΝΕΝΑΣ ΔΕΝ ΦΟΡΑΕΙ ΤΗ ΣΤΟΛΗ ΤΟΥ ΑΛΛΟΥ
 * ─────────────────────────────────────────────────────────────────────────────
 * | ρόλος | ποιος | τι επιτρέπεται |
 * |---|---|---|
 * | **αυθεντία** | ένα αρχείο κώδικα | **γράφει** την έκδοση, μία φορά |
 * | **ιδιοκτήτης** | ένα composite action | **εγκαθιστά**, διαβάζοντας την αυθεντία |
 * | **καταναλωτής** | κάθε workflow | **ζητά** τον ιδιοκτήτη (`uses:`) |
 *
 * ⚠️ **Η αυθεντία διαβάζεται ως ΚΕΙΜΕΝΟ, όχι με `require`**: η πύλη δεν εκτελεί κώδικα της
 * γραμμής παραγωγής, και το regex πρέπει να ταιριάζει **ακριβώς μία** φορά — αλλιώς
 * ⛔ `ci-tool-owner-broken`, ποτέ σιωπηλό «δεν βρήκα, άρα εντάξει».
 *
 * @module scripts/lib/one-version/ci-tools
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { GATE_STATES: S, MIN_REASON_LENGTH } = require('./contract.js');

/**
 * **Τα εργαλεία CI με μία έκδοση** — κλειστό σύνολο, με υποχρεωτικό λόγο.
 *
 * ⚠️ Το `tsx` του χρησμού ΔΕΝ είναι εδώ: η αυθεντία του είναι το **lockfile** (κατάστιχο Α),
 * και η inline καρφωμένη του έκδοση είναι γνωστό, δηλωμένο κενό (ADR-875 §12.5).
 */
const CI_TOOLS = Object.freeze({
  'firebase-tools': Object.freeze({
    authority: 'scripts/lib/firestore-deploy/model.js',
    exportName: 'FIREBASE_TOOLS_VERSION',
    owner: '.github/actions/setup-firebase-emulators/action.yml',
    reason:
      'Ο deployer της παραγωγής αναπτύσσει με αυτή την έκδοση και το drift.js αντιγράφει τη ' +
      'σημασιολογία της· emulator άλλης έκδοσης κρίνει κανόνες που ΔΕΝ είναι αυτοί που φεύγουν.',
  }),
});

const CI_ROOTS = ['.github/workflows', '.github/actions'];
const EXACT_VERSION = /^\d+\.\d+\.\d+$/;
const INSTALLER = /\b(?:npm\s+(?:i|install|add)\b|npx\b|pnpm\s+(?:add|dlx)\b|yarn\s+(?:global\s+)?add\b|bunx?\b)/;

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Κάθε `.yml`/`.yaml` κάτω από τις δύο ρίζες του CI — ο **παρονομαστής**. */
function ciFiles(repoRoot) {
  const found = [];
  const walk = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.ya?ml$/.test(entry.name)) found.push(path.relative(repoRoot, full).split(path.sep).join('/'));
    }
  };
  for (const root of CI_ROOTS) walk(path.join(repoRoot, root));
  return found.sort();
}

/** Οι γραμμές που **εκτελούνται** — ολόκληρες γραμμές σχολίου δεν είναι εντολές. */
function codeLines(text) {
  return text
    .split(/\r?\n/)
    .map((line, i) => ({ line, n: i + 1 }))
    .filter(({ line }) => !line.trim().startsWith('#'));
}

/** Η έκδοση όπως τη γράφει η αυθεντία — ή `null` αν δεν διαβάζεται **ακριβώς μία** φορά. */
function readAuthorityVersion(repoRoot, spec) {
  const file = path.join(repoRoot, spec.authority);
  if (!fs.existsSync(file)) return null;
  const re = new RegExp(`^const ${spec.exportName} = '([^']+)';`, 'gm');
  const hits = [...fs.readFileSync(file, 'utf8').matchAll(re)];
  if (hits.length !== 1 || !EXACT_VERSION.test(hits[0][1])) return null;
  return hits[0][1];
}

/** Διαβάζει ο ιδιοκτήτης την αυθεντία — ή κρατά δική του αλήθεια; */
function ownerReadsAuthority(repoRoot, spec) {
  const file = path.join(repoRoot, spec.owner);
  if (!fs.existsSync(file)) return false;
  const text = fs.readFileSync(file, 'utf8');
  return text.includes(spec.authority) && text.includes(spec.exportName);
}

/** Κρίνει **ένα** αρχείο CI για **ένα** εργαλείο. */
function judgeFile(rel, text, tool, spec, push) {
  const mention = new RegExp(`(^|[\\s"'=])${escapeRe(tool)}(?=@|\\s|"|'|$)`);
  const literal = new RegExp(`${escapeRe(tool)}@\\d`);
  const ownerDir = path.posix.dirname(spec.owner);
  let consumes = false;

  for (const { line, n } of codeLines(text)) {
    if (literal.test(line)) {
      push(S.CI_TOOL_VERSION_LITERAL, `${rel}:${n}`, `γραμμένη έκδοση του ${tool} — η αυθεντία είναι το ${spec.authority}`);
    }
    if (rel !== spec.owner && INSTALLER.test(line) && mention.test(line)) {
      push(S.CI_TOOL_BYPASS, `${rel}:${n}`, `εγκατάσταση του ${tool} έξω από το ${spec.owner}`);
    }
    if (new RegExp(`uses:\\s*\\./${escapeRe(ownerDir)}\\s*$`).test(line)) consumes = true;
  }
  if (rel === spec.owner) push(S.CI_TOOL_OWNER, rel, spec.reason);
  else if (consumes) push(S.CI_TOOL_VIA_OWNER, rel, `ζητά το ${ownerDir}`);
}

/**
 * ΣΤ · ΕΡΓΑΛΕΙΑ CI — ο κύκλος κρίσης. Πληθυσμός: τα αρχεία CI που **αφορούν** το εργαλείο
 * (το αναφέρουν ή ζητούν τον ιδιοκτήτη) + η δήλωση του ίδιου του εργαλείου.
 */
function judgeCiTools(repoRoot, push, tools = CI_TOOLS) {
  const files = ciFiles(repoRoot);
  for (const [tool, spec] of Object.entries(tools)) {
    if (typeof spec.reason !== 'string' || spec.reason.trim().length < MIN_REASON_LENGTH) {
      push(S.CI_TOOL_OWNER_BROKEN, tool, `δήλωση χωρίς λόγο (>=${MIN_REASON_LENGTH} χαρακτήρες)`);
      continue;
    }
    if (readAuthorityVersion(repoRoot, spec) === null) {
      push(S.CI_TOOL_OWNER_BROKEN, tool, `η αυθεντία ${spec.authority} δεν δίνει ΜΙΑ ακριβή ${spec.exportName}`);
    } else if (!ownerReadsAuthority(repoRoot, spec)) {
      push(S.CI_TOOL_OWNER_BROKEN, tool, `ο ιδιοκτήτης ${spec.owner} λείπει ή δεν διαβάζει την αυθεντία`);
    }
    const ownerDir = path.posix.dirname(spec.owner);
    for (const rel of files) {
      const text = fs.readFileSync(path.join(repoRoot, rel), 'utf8');
      if (rel === spec.owner || text.includes(tool) || text.includes(ownerDir)) {
        judgeFile(rel, text, tool, spec, push);
      }
    }
  }
}

module.exports = { CI_TOOLS, ciFiles, judgeCiTools, readAuthorityVersion };
