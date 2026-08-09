#!/usr/bin/env node
'use strict';

/**
 * 🔴 ADR-775 §15 — ΔΙΑΛΟΓΗ GOLDEN: η έγκριση είναι **ανθρώπινη πράξη**, μία εικόνα τη φορά.
 *
 * `--sheet`  φτιάχνει τοπικό φύλλο διαλογής (HTML) με τα υποψήφια δίπλα στις τρέχουσες βάσεις.
 * `--apply`  αντιγράφει στις βάσεις **μόνο** όσα ο άνθρωπος σημείωσε `yes`.
 *
 * ⚠️ ΓΙΑΤΙ ΥΠΑΡΧΕΙ: το `--update-snapshots` σε όλη τη σουίτα είναι η **αιτία** των 39 άκυρων
 * golden (`cd5f6198`) — μια εντολή που δέχεται ό,τι έτυχε να ζωγραφιστεί, χωρίς να το δει
 * κανείς. Αυτό το εργαλείο κάνει την αποδοχή **αδύνατη χωρίς όνομα και απόφαση**: το `--apply`
 * αγγίζει αποκλειστικά αρχεία που κατονομάζονται στο JSON αποφάσεων.
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const { analyzePng } = require('./lib/golden-triage/png-stats');
const { readCandidates } = require('./lib/golden-triage/candidates');
const { comparePngs } = require('./lib/golden-triage/compare');
const { renderSheet } = require('./lib/golden-triage/sheet-html');

const ROOT = process.cwd();
const REPORT_DIR = path.join(ROOT, 'reports');
/**
 * ⚠️ **ΠΟΛΛΕΣ αναφορές, όχι μία**: η σουίτα παράγεται σε **παρτίδες ανά φάση**. Μια εκτέλεση
 * 43 tests × ~40s κρατά ~40′ και ο JSON reporter γράφει **μόνο στο τέλος** — μια διακοπή στο
 * 26ο test έσβησε ολόκληρη την αντιστοίχιση, ενώ οι εικόνες ήταν ήδη στον δίσκο (μετρημένο).
 * Παρτίδες ⇒ κάθε φάση αυτοτελής, και η επανάληψη κοστίζει λεπτά αντί για ώρα.
 */
const REPORT_GLOB = /^visual-candidates.*\.json$/;
const OUT_DIR = path.join(ROOT, 'reports', 'golden-triage');
const IMG_DIR = path.join(OUT_DIR, 'img');
const PREV_DIR = path.join(OUT_DIR, 'prev');

/** Το ίδιο `maxDiffPixelRatio` με το `SCREENSHOT_OPTIONS` της σουίτας. */
const STABILITY_TOLERANCE = 0.001;
const SNAPSHOT_DIR = path.join(
  ROOT, 'src', 'subapps', 'dxf-viewer', 'e2e', '__snapshots__',
  'subapps', 'dxf-viewer', 'e2e', 'dxf-visual-regression.spec.ts'
);

const C = {
  bold: (s) => `[1m${s}[0m`,
  dim: (s) => `[2m${s}[0m`,
  red: (s) => `[31m${s}[0m`,
  green: (s) => `[32m${s}[0m`,
  yellow: (s) => `[33m${s}[0m`,
};

const sha = (file) =>
  crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex').slice(0, 12);

const nameOf = (arg) => (arg || '').replace(/\.png$/, '');

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function copyInto(src, destDir, destName) {
  const dest = path.join(destDir, destName);
  fs.copyFileSync(src, dest);
  return dest;
}

function shortFacts(stats) {
  const { r, g, b } = stats.dominant;
  return `${stats.width}×${stats.height} · μελάνι ${stats.ink.count.toLocaleString('el-GR')}px`
    + ` · φόντο rgb(${r},${g},${b})`;
}

function factsHtml(cand, gold) {
  const rows = [
    `χρώματα <code>${cand.distinctColors}${cand.distinctColorsCapped ? '+' : ''}</code>`,
    `μελάνι <code>${cand.ink.ratio.toFixed(4)}</code> της επιφάνειας`,
    cand.ink.bbox
      ? `πλαίσιο μελανιού <code>x ${cand.ink.bbox.x0}..${cand.ink.bbox.x1} ·`
        + ` y ${cand.ink.bbox.y0}..${cand.ink.bbox.y1}</code>`
      : 'πλαίσιο μελανιού <code>—</code>',
    `μέγεθος <code>${Math.round(cand.bytes / 1024)} KB</code>`,
  ];
  if (gold) rows.push(`παλιά βάση <code>${Math.round(gold.bytes / 1024)} KB</code>`);
  return rows.map((r) => `<span>${r}</span>`).join('');
}

/**
 * Το προηγούμενο πέρασμα φυλάσσεται **πριν** γραφτεί το νέο, ώστε η επόμενη διαλογή να μπορεί
 * να ρωτήσει «βγαίνει το ίδιο;». Χωρίς αυτό η σταθερότητα θα ήταν εικασία.
 */
function rotatePrevious() {
  if (!fs.existsSync(IMG_DIR)) return 0;
  ensureDir(PREV_DIR);
  let kept = 0;
  for (const name of fs.readdirSync(IMG_DIR)) {
    if (!name.endsWith('.cand.png')) continue;
    fs.copyFileSync(path.join(IMG_DIR, name), path.join(PREV_DIR, name));
    kept += 1;
  }
  return kept;
}

function stabilityOf(name, candidateFile) {
  const prev = path.join(PREV_DIR, `${name}.cand.png`);
  if (!candidateFile || !fs.existsSync(prev)) return null;
  return comparePngs(prev, candidateFile, { tolerateRatio: STABILITY_TOLERANCE });
}

/** Προειδοποιήσεις — **περιγραφικές**, ποτέ αποφασιστικές: αποφασίζει ο άνθρωπος. */
function buildAlerts(entry, cand, twins, stability) {
  const alerts = [];
  if (stability && (stability.state === 'unstable' || stability.state === 'size-mismatch')) {
    alerts.push({ severity: 'bad',
      text: `⛔ <b>Ασταθής</b>: το προηγούμενο πέρασμα διέφερε σε`
        + ` ${stability.diffPixels.toLocaleString('el-GR')} pixels`
        + ` (${(stability.ratio * 100).toFixed(3)}%). Μια τέτοια βάση θα είναι μονίμως κόκκινη.` });
  }
  if (cand && cand.ink.count === 0) {
    alerts.push({ severity: 'bad',
      text: '⛔ Η εικόνα έχει <b>ένα μόνο χρώμα</b> — μηδενικό σήμα. Μια τέτοια βάση δεν μπορεί'
        + ' να αποτύχει ποτέ.' });
  }
  if (twins.length) {
    alerts.push({ severity: 'warn',
      text: `⚠️ <b>Ταυτόσημη εικόνα</b> με: ${twins.join(', ')}. Δύο tests με ίδια βάση δεν`
        + ' ξεχωρίζουν το ένα από το άλλο.' });
  }
  if (entry.state === 'missing-baseline') {
    alerts.push({ severity: 'warn',
      text: '⚠️ Δεν υπήρχε βάση — αυτό είναι το <b>πρώτο</b> golden αυτού του test.' });
  }
  if (entry.state === 'no-image') {
    alerts.push({ severity: 'bad',
      text: '⛔ Το test δεν έφτασε ποτέ στη φωτογραφία (έσκασε νωρίτερα).' });
  }
  return alerts;
}

function twinIndex(entries) {
  const byHash = new Map();
  for (const e of entries) {
    if (!e.candidateFile) continue;
    const h = sha(e.candidateFile);
    if (!byHash.has(h)) byHash.set(h, []);
    byHash.get(h).push(nameOf(e.arg));
  }
  return byHash;
}

/**
 * 🔴 Οι βάσεις που έγραψε ΜΟΝΟΣ του ο Playwright (missing baseline) μετακινούνται **έξω** από
 * το `__snapshots__` πριν φτιαχτεί το φύλλο. Αλλιώς μια απλή εκτέλεση θα είχε ήδη «εγκρίνει»
 * τέσσερα golden που δεν είδε ποτέ άνθρωπος — δηλαδή το `--update-snapshots` από την πίσω πόρτα.
 */
function quarantineAutoWritten(entries, quarantineDir) {
  ensureDir(quarantineDir);
  const moved = [];
  for (const e of entries) {
    if (e.state !== 'missing-baseline' || !e.arg) continue;
    const written = path.join(SNAPSHOT_DIR, `${nameOf(e.arg)}-visual-dxf-win32.png`);
    if (!fs.existsSync(written)) continue;
    const dest = path.join(quarantineDir, path.basename(written));
    fs.copyFileSync(written, dest);
    fs.unlinkSync(written);
    moved.push({ name: nameOf(e.arg), dest });
  }
  return moved;
}

/**
 * 🔴 Ο ΛΟΓΟΣ ΠΟΥ Η ΔΙΑΛΟΓΗ ΕΙΝΑΙ ΣΩΡΕΥΤΙΚΗ: ο Playwright **αδειάζει το `test-results` στην
 * αρχή κάθε εκτέλεσης** (μετρημένο — η δεύτερη παρτίδα έσβησε τα 23 υποψήφια της πρώτης).
 * Άρα το «τρέχον υποψήφιο» ενός test μπορεί να μην υπάρχει πια στον δίσκο ενώ **υπάρχει** στο
 * φύλλο. Πηγές, με σειρά προτεραιότητας: (1) φρέσκο `actual` της παρτίδας · (2) βάση που
 * έγραψε μόνος του ο Playwright και μπήκε σε καραντίνα · (3) **μεταφερόμενο** από προηγούμενη
 * παρτίδα.
 *
 * ⚠️ Το (3) **δεν** μετράει ως απόδειξη σταθερότητας: αν το συγκρίναμε με τον εαυτό του θα
 * απαντούσε πάντα «ταυτόσημο», δηλαδή θα βεβαίωνε κάτι που δεν μέτρησε ποτέ.
 */
function resolveCandidateFile(entry, quarantined) {
  if (entry.actualPath && fs.existsSync(entry.actualPath)) {
    return { file: entry.actualPath, carried: false };
  }
  const auto = quarantined.find((q) => q.name === nameOf(entry.arg));
  if (auto) return { file: auto.dest, carried: false };
  const carried = path.join(PREV_DIR, `${nameOf(entry.arg) || entry.title}.cand.png`);
  if (fs.existsSync(carried)) return { file: carried, carried: true };
  return { file: null, carried: false };
}

function buildItems(entries, quarantined) {
  ensureDir(IMG_DIR);
  const withFiles = entries.map((e) => {
    const resolved = resolveCandidateFile(e, quarantined);
    return { ...e, candidateFile: resolved.file, carried: resolved.carried };
  });
  const byHash = twinIndex(withFiles);

  return withFiles.map((e) => {
    const name = nameOf(e.arg) || e.title;
    const cand = e.candidateFile ? analyzePng(e.candidateFile) : null;
    const goldenFile = e.goldenPath && fs.existsSync(e.goldenPath) ? e.goldenPath : null;
    const gold = goldenFile ? analyzePng(goldenFile) : null;
    const twins = (byHash.get(e.candidateFile ? sha(e.candidateFile) : '_') || [])
      .filter((n) => n !== name);
    const stability = e.carried ? null : stabilityOf(name, e.candidateFile);
    if (e.candidateFile && path.resolve(e.candidateFile) !== path.join(IMG_DIR, `${name}.cand.png`)) {
      copyInto(e.candidateFile, IMG_DIR, `${name}.cand.png`);
    }
    if (goldenFile) copyInto(goldenFile, IMG_DIR, `${name}.gold.png`);
    return {
      name,
      arg: e.arg,
      title: e.title,
      state: e.state,
      carried: e.carried === true,
      stability: stability ? stability.state : 'άγνωστη',
      candidateSrc: e.candidateFile ? `img/${name}.cand.png` : '',
      goldenSrc: goldenFile ? `img/${name}.gold.png` : '',
      candidateFacts: cand ? shortFacts(cand) : 'δεν παρήχθη εικόνα',
      goldenFacts: gold ? shortFacts(gold) : '—',
      facts: cand ? factsHtml(cand, gold) : '',
      alerts: buildAlerts(e, cand, twins, stability),
    };
  });
}

/**
 * Ενώνει όλες τις αναφορές παρτίδων. Κλειδί ταυτότητας = ο **τίτλος** του test.
 * ⚠️ Νικά η εγγραφή **με εικόνα**: μια επανάληψη υπάρχει ακριβώς επειδή η προηγούμενη δεν
 * παρήγαγε υποψήφιο· αν κέρδιζε «η τελευταία», μια αποτυχία θα έσβηνε έγκυρο υποψήφιο.
 */
function readAllReports() {
  const files = fs.existsSync(REPORT_DIR)
    ? fs.readdirSync(REPORT_DIR).filter((f) => REPORT_GLOB.test(f)).sort()
    : [];
  const merged = new Map();
  for (const file of files) {
    for (const entry of readCandidates(path.join(REPORT_DIR, file), { snapshotDir: SNAPSHOT_DIR })) {
      const previous = merged.get(entry.title);
      const better = !previous || (!previous.actualPath && entry.actualPath)
        || (previous.actualPath && entry.actualPath);
      if (better) merged.set(entry.title, entry);
    }
  }
  return { entries: [...merged.values()], files };
}

function commandSheet() {
  const { entries, files: reportFiles } = readAllReports();
  if (reportFiles.length === 0) {
    console.error(C.red(`Δεν βρέθηκε καμία αναφορά στο ${path.relative(ROOT, REPORT_DIR)}`));
    console.error(C.dim('Τρέξε πρώτα: npm run golden:capture'));
    process.exit(2);
  }
  const quarantined = quarantineAutoWritten(entries, path.join(OUT_DIR, 'auto-written'));
  const previous = rotatePrevious();
  const items = buildItems(entries, quarantined);
  ensureDir(OUT_DIR);
  const html = renderSheet(items, `${reportFiles.length} αναφορές: ${reportFiles.join(', ')}`);
  fs.writeFileSync(path.join(OUT_DIR, 'index.html'), html, 'utf8');

  console.log(C.bold('\nADR-775 · φύλλο διαλογής golden'));
  console.log(`  υποψήφια         : ${items.filter((i) => i.candidateSrc).length}/${items.length}`);
  console.log(`  χωρίς εικόνα     : ${items.filter((i) => !i.candidateSrc).length}`);
  console.log(`  αυτο-γραμμένα    : ${quarantined.length} (μετακινήθηκαν σε καραντίνα)`);
  console.log(`  μεταφερόμενα     : ${items.filter((i) => i.carried).length}`
    + ' (από προηγούμενη παρτίδα — σταθερότητα ΑΓΝΩΣΤΗ)');
  console.log(`  σύγκριση με προηγούμενο πέρασμα: ${previous ? `${previous} εικόνες` : 'καμία'}`);
  if (previous) {
    const unstable = items.filter((i) => i.stability === 'unstable'
      || i.stability === 'size-mismatch');
    console.log(`  ${unstable.length ? C.red(`ΑΣΤΑΘΗ: ${unstable.length}`) : C.green('όλα σταθερά')}`
      + (unstable.length ? ` — ${unstable.map((i) => i.name).join(', ')}` : ''));
  }
  console.log(`  ${C.green('ΑΝΟΙΞΕ')} : ${path.join(OUT_DIR, 'index.html')}\n`);
}

function loadDecisions(file) {
  const payload = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!Array.isArray(payload.decisions)) {
    throw new Error('Το JSON αποφάσεων δεν έχει πίνακα `decisions`.');
  }
  return payload.decisions;
}

function resolveCandidate(name) {
  const cand = path.join(IMG_DIR, `${name}.cand.png`);
  if (!fs.existsSync(cand)) throw new Error(`Λείπει το υποψήφιο: ${path.relative(ROOT, cand)}`);
  return cand;
}

function commandApply(decisionsFile, { dryRun }) {
  const decisions = loadDecisions(decisionsFile);
  const approved = decisions.filter((d) => d.decision === 'yes');
  const rejected = decisions.filter((d) => d.decision === 'no');
  const pending = decisions.filter((d) => d.decision !== 'yes' && d.decision !== 'no');

  console.log(C.bold('\nADR-775 · εφαρμογή αποφάσεων'));
  console.log(`  ✅ εγκεκριμένα ${approved.length} · ❌ απορριφθέντα ${rejected.length}`
    + ` · ⏳ χωρίς απόφαση ${pending.length}`);
  if (pending.length) {
    console.log(C.yellow('  ⚠️ Τα «χωρίς απόφαση» ΔΕΝ γράφονται — απουσία δεν είναι έγκριση.'));
  }

  for (const d of approved) {
    const src = resolveCandidate(d.name);
    const dest = path.join(SNAPSHOT_DIR, `${d.name}-visual-dxf-win32.png`);
    if (dryRun) { console.log(C.dim(`  [dry] ${d.name} → ${path.relative(ROOT, dest)}`)); continue; }
    ensureDir(path.dirname(dest));
    fs.copyFileSync(src, dest);
    console.log(C.green(`  ✅ ${d.name}`));
  }
  console.log('');
}

function main() {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes('--dry-run');
  const applyAt = argv.indexOf('--apply');
  if (applyAt !== -1) {
    const file = argv[applyAt + 1];
    if (!file) { console.error(C.red('Χρήση: --apply <golden-decisions.json>')); process.exit(2); }
    commandApply(file, { dryRun });
    return;
  }
  commandSheet();
}

main();
