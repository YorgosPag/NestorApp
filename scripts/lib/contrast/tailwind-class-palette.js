/**
 * Η **πέμπτη αρχή χρώματος** (ADR-773 §3) διαβασμένη σε μορφή που κρίνει το ΥΠΑΡΧΟΝ
 * `theme-pairing.js` — χωρίς νέα μηχανή κρίσης.
 *
 * ΤΟ ΜΕΤΡΗΜΕΝΟ ΓΕΓΟΝΟΣ: το `src/design-system/tokens/colors.ts:76-78` δηλώνει
 * `text.primary = 'text-slate-900'`, `secondary = 'text-slate-600'`,
 * `muted = 'text-slate-400'` — **και τα τρία μονοθεματικά** — και τα σερβίρει σε **875
 * αρχεία** μέσω `useSemanticColors`. Στο **προεπιλεγμένο (σκοτεινό)** θέμα το
 * `text-slate-900` δίνει **1,02:1** πάνω στο `--background`: **χειρότερο** από το 1,01:1
 * του ADR-759 που ξεκίνησε ολόκληρη την εκστρατεία.
 *
 * 🔴 ΓΙΑΤΙ ΚΑΜΙΑ ΠΥΛΗ ΔΕΝ ΤΟ ΕΒΛΕΠΕ — ΚΑΙ ΔΕΝ ΕΙΝΑΙ ΚΕΝΟ ΚΑΜΙΑΣ:
 *   · CHECK 3.26 ρωτά «**παρακάμπτεις** το SSoT;» και τα αρχεία είναι στην allowlist —
 *     **ορθά**: *είναι* το SSoT. Φρουρεί την παράκαμψη, όχι την **ποιότητα**.
 *   · CHECK 3.38 ψάχνει `text-primary`· εδώ γράφεται `text-slate-900`.
 *   · CHECK 3.39/3.40 διαβάζουν **τιμές**· εδώ υπάρχει **κλάση**.
 * Η ερώτηση «**οι κλάσεις που παράγει η κεντρική αρχή χρώματος είναι θεματικές;**» δεν
 * είχε διατυπωθεί ποτέ.
 *
 * 🔑 Η ΕΜΒΕΛΕΙΑ ΕΙΝΑΙ Η ALLOWLIST ΤΟΥ 3.26, ΚΑΙ ΑΥΤΟ ΕΙΝΑΙ ΔΟΜΙΚΟ. Μέχρι σήμερα,
 * προσθέτοντας ένα αρχείο σε εκείνη την allowlist το εξαιρούσες από το 3.26 **και
 * κανένας άλλος δεν το κοίταζε ποτέ** — έξοδος διαφυγής χωρίς αντίβαρο. Τώρα οι δύο
 * πύλες είναι τα δύο μισά ενός ερωτήματος και μοιράζονται **μία** λίστα: ό,τι
 * απαλλάσσεται από τη μία, κρίνεται από την άλλη. Μετρημένο: **21 εγγραφές**, **647**
 * ωμές κλάσεις παλέτας.
 *
 * ⚠️ ΚΑΝΕΝΑ ΚΡΙΤΗΡΙΟ ΕΠΙΠΕΔΟΥ ΑΡΧΕΙΟΥ. Το `color-bridge.ts` έχει **και** σωστά
 * (`bg-card`, `text-foreground`, 61 σκόπιμα κατηγορικά) **και** λάθος (`text-red-700`),
 * στο **ίδιο αντικείμενο** — όπως το `contacts-query.service.ts` του CHECK 3.35 είχε 5
 * σωστές συναρτήσεις και 1 σπασμένη. Κρίνεται η **δήλωση**.
 *
 * @module scripts/lib/contrast/tailwind-class-palette
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { loadRegistry } = require('../ssot/registry');
const { readPaletteFromFiles, derivePairs, classifyRole } = require('./ts-token-palette');
const { loadTailwindColors, resolveClassString } = require('./tailwind-class-resolver');
const { hexToRgb } = require('./theme-pairing');

const MODULE_NAME = 'tailwind-hardcoded-palette';
const JUDGED_ROLES = ['foreground', 'surface', 'border'];

/** Αρχεία που δεν είναι κώδικας προϊόντος — ίδιο σκεπτικό με το `exemptPatterns`. */
const SKIP_DIR = /(^|\/)(__tests__|node_modules|\.next)(\/|$)/;

/**
 * Η allowlist → συγκεκριμένα αρχεία.
 *
 * Μια εγγραφή είναι είτε ακριβές αρχείο είτε **πρόθεμα φακέλου** (τελειώνει σε `/`).
 * ⚠️ Εγγραφή που δεν αντιστοιχεί σε τίποτα **δηλώνεται** (`drift`), δεν αγνοείται:
 * μια allowlist που δείχνει σε διαγραμμένο αρχείο είναι μπαγιάτικη, και η μόνη στιγμή
 * που κάποιος θα το μάθει είναι εδώ.
 */
function resolveScope(repoRoot = process.cwd()) {
  const { modules } = loadRegistry(path.join(repoRoot, '.ssot-registry.json'));
  const mod = modules.find((m) => m.name === MODULE_NAME);
  if (!mod) {
    throw new Error(`tailwind-class-palette: λείπει το module "${MODULE_NAME}" από το μητρώο — fail-closed.`);
  }

  const files = [];
  const drift = [];
  for (const entry of mod.allowlist) {
    const abs = path.join(repoRoot, entry);
    if (entry.endsWith('/')) {
      const dir = abs.replace(/[\\/]$/, '');
      if (!fs.existsSync(dir)) { drift.push(entry); continue; }
      const before = files.length;
      walkDir(dir, repoRoot, files);
      if (files.length === before) drift.push(entry);
      continue;
    }
    if (!fs.existsSync(abs)) { drift.push(entry); continue; }
    if (/\.tsx?$/.test(entry)) files.push(entry);
  }
  return { files: [...new Set(files)].sort(), drift, allowlist: mod.allowlist };
}

function walkDir(dir, repoRoot, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, e.name);
    const rel = path.relative(repoRoot, abs).replace(/\\/g, '/');
    if (SKIP_DIR.test(rel)) continue;
    if (e.isDirectory()) walkDir(abs, repoRoot, out);
    else if (/\.tsx?$/.test(e.name)) out.push(rel);
  }
}

/**
 * `// theme-exempt: <λόγος>` — η ρητή διαφυγή, με **υποχρεωτικό λόγο**.
 *
 * Ίδιο πρότυπο με το `tenant-scope-exempt` του CHECK 3.35: ένα κατηγορικό χρώμα
 * ταυτότητας (debug overlay, χρώμα περιορισμού, εικονίδιο τύπου αρχείου) **δεν οφείλει**
 * να είναι θεματικό, αλλά ο λόγος πρέπει να γραφτεί — αλλιώς η διαφυγή γίνεται σιωπηλή
 * απόρριψη με καλύτερους τρόπους. Δεκτή στην ίδια γραμμή ή στις 3 από πάνω.
 */
const EXEMPT_RE = /\/\/\s*theme-exempt:\s*(\S.*)$/;

function findExemption(lines, lineNumber) {
  for (let i = lineNumber - 1; i >= Math.max(0, lineNumber - 4); i--) {
    const text = lines[i];
    if (text === undefined) continue;
    const m = EXEMPT_RE.exec(text);
    if (m) return m[1].trim();
    // Σταμάτα μόλις βγεις από τη γειτονιά σχολίων πάνω από τη δήλωση.
    if (i < lineNumber - 1 && !/^\s*(\/\/|\*|\/\*)/.test(text)) break;
  }
  return null;
}

/**
 * ΟΙ ΚΑΔΟΙ. Κάθε δήλωση-συμβολοσειρά των αρχείων εμβέλειας μπαίνει σε **ακριβώς έναν**.
 *
 * ⚠️ Η ΛΟΓΙΣΤΙΚΗ ΕΙΝΑΙ ΚΛΕΙΣΤΗ ΚΑΙ ΕΛΕΓΧΕΤΑΙ. Η πρώτη εκδοχή του Στρώματος 2β έδινε
 * `balanced: true` ενώ 9 από 12 ημιδιαφανείς δεν κρίνονταν καθόλου — ένα άθροισμα που
 * κλείνει χωρίς να ρωτά «**ποιος** κρίθηκε» επικυρώνει τον εαυτό του.
 */
const BUCKETS = {
  'judged-mono': 'σταθερό χρώμα σε σημασιολογικό ρόλο — ΚΡΙΝΕΤΑΙ (theme-flip)',
  'judged-themed-pair': 'βάση + `dark:` παραλλαγή — ΚΡΙΝΕΤΑΙ ανά θέμα',
  'judged-translucent': 'ημιδιαφανές — ΚΡΙΝΕΤΑΙ με σύνθεση',
  'themed-var': 'δείχνει σε token του globals.css — υγιές εκ κατασκευής',
  'dangling-var': '🔴 δείχνει σε custom property που ΔΕΝ ορίζεται σε κανένα θέμα',
  'class-unknown': '🔴 η οικογένεια υπάρχει, το σκαλί όχι — η κλάση ΔΕΝ παράγει CSS',
  'theme-scoped-single': 'μόνο `dark:` χωρίς βάση — δεσμευμένο σε ένα θέμα',
  'gradient': 'διαβάθμιση — δεν έχει ΜΙΑ ετυμηγορία, εκτός εμβέλειας',
  'multi-color': 'δύο utilities σε μία δήλωση — ΚΡΙΝΟΝΤΑΙ και τα δύο, χωριστά',
  'role-out-of-scope': 'το μονοπάτι δεν ισχυρίζεται σημασιολογικό ρόλο (primitive/κατηγορικό)',
  'keyword': 'transparent/currentColor — χρώμα, αλλά καμία ετυμηγορία δεν είναι δυνατή',
  'not-a-class': 'η τιμή δεν είναι κλάση Tailwind (κείμενο, id, μονάδα)',
  'literal-value-uncovered': '🔶 ΩΜΗ ΤΙΜΗ χρώματος, όχι κλάση — ΔΗΛΩΜΕΝΑ ΑΚΑΛΥΠΤΗ εδώ (ADR-773 #6)',
  'exempt': 'ρητή εξαίρεση με λόγο (`// theme-exempt:`)',
};

/**
 * Ομαδοποίησε τα λυμένα λεκτικά ανά utility, ώστε `bg-gray-100 dark:bg-slate-800` να
 * αναγνωριστεί ως **θεματικό ζεύγος** — το ΣΩΣΤΟ μοτίβο, που υπάρχει ήδη στο
 * `hover-effects.ts`. Χωρίς αυτό, κάθε αρχείο που κάνει τη δουλειά του σωστά θα
 * κατέληγε στη baseline ως παραβίαση.
 */
function groupByUtility(resolved) {
  const byUtil = new Map();
  for (const r of resolved) {
    if (!byUtil.has(r.util)) byUtil.set(r.util, { base: [], dark: [] });
    byUtil.get(r.util)[r.dark ? 'dark' : 'base'].push(r);
  }
  return byUtil;
}

/**
 * Όταν μια δήλωση βάφει **δύο** utilities (`'bg-gray-100 text-muted-foreground'` —
 * ζεύγος σε μία συμβολοσειρά), οι δύο κρίσεις χρειάζονται **διαφορετική ταυτότητα**,
 * αλλιώς η μία σβήνει την άλλη μέσα στο σύνολο του ratchet. Με ένα utility το μονοπάτι
 * μένει καθαρό, ώστε η baseline να μη γεμίσει θόρυβο.
 */
function groupSuffix(resolvedColors, util) {
  const utils = new Set(resolvedColors.map((r) => r.util));
  return utils.size > 1 ? ` [${util}]` : '';
}

/**
 * Ο ρόλος που δηλώνει το ίδιο το utility του Tailwind.
 *
 * ⚠️ ΧΡΗΣΙΜΟΠΟΙΕΙΤΑΙ **ΜΟΝΟ** ΟΤΑΝ Η ΔΗΛΩΣΗ ΕΧΕΙ ΠΑΝΩ ΑΠΟ ΕΝΑ UTILITY, και αυτό δεν
 * είναι υπαναχώρηση από τον κανόνα «ο ρόλος βγαίνει από το μονοπάτι». Το μονοπάτι έχει
 * ήδη κάνει τη δουλειά του: αποφάσισε ότι **αυτή η δήλωση ισχυρίζεται σημασιολογικό
 * ρόλο** (αλλιώς θα είχε βγει στο `role-out-of-scope`). Αλλά ένα μονοπάτι δίνει **έναν**
 * ρόλο, ενώ το `'bg-slate-900 text-slate-400'` βάφει **δύο** πράγματα — οπότε είναι
 * *αποδεδειγμένα* ανεπαρκές, και το πρόθεμα είναι η ρητή δήλωση του συγγραφέα για το
 * ποιο σκέλος είναι ποιο. Χωρίς αυτό, το χρώμα κειμένου κρινόταν ως **επιφάνεια**.
 */
const UTILITY_ROLE = { bg: 'surface', text: 'foreground', fill: 'foreground', border: 'border', ring: 'border', stroke: 'border' };

const sideEntry = (entry, resolved, suffix) => ({
  ...entry,
  path: `${entry.path}${suffix}`,
  form: 'literal-hex',
  hex: resolved.hex,
  raw: resolved.token,
});

/**
 * Χτίσε την παλέτα που τρώει το `theme-pairing.evaluate` + το `evaluateTranslucent`.
 *
 * @param {string} [repoRoot]
 * @param {{light:Map,dark:Map}} themes έξοδος του `readThemes` — για τον έλεγχο ύπαρξης var
 */
function buildClassPalette(repoRoot, themes) {
  const scope = resolveScope(repoRoot);
  const { colors, source } = loadTailwindColors(repoRoot);
  const raw = readPaletteFromFiles(scope.files, repoRoot);

  const sourceLines = new Map();
  const linesOf = (file) => {
    if (!sourceLines.has(file)) {
      sourceLines.set(file, fs.readFileSync(path.join(repoRoot, file), 'utf8').split(/\r?\n/));
    }
    return sourceLines.get(file);
  };

  const varExists = (name) => themes.light.has(name) || themes.dark.has(name);

  const entries = [];
  const themedPairs = [];
  const translucent = [];
  /** Το ΚΛΕΙΣΤΟ ΣΥΝΟΛΟ: κάθε ταυτότητα που όντως κρίθηκε (μοντέλο Atlassian). */
  const judged = [];
  const extraFindings = [];
  const buckets = Object.fromEntries(Object.keys(BUCKETS).map((k) => [k, []]));
  const notAClassByFile = {};

  /**
   * ⚠️ ΕΝΑ ΚΑΔΟΣ ΑΝΑ ΔΗΛΩΣΗ, ΠΑΝΤΑ. Η πρώτη εκδοχή τοποθετούσε **ανά utility**, οπότε
   * μια δήλωση σαν `'bg-gray-100 text-muted-foreground'` (ζεύγος σε μία συμβολοσειρά)
   * μετριόταν **δύο φορές** — και η λογιστική έβγαινε 1533/1532. Το ότι το έπιασε το
   * `balanced` πριν μπει η baseline είναι όλος ο λόγος ύπαρξης του ελέγχου.
   */
  const place = (bucket, entry, extra) => buckets[bucket].push(extra ? { ...entry, ...extra } : entry);

  for (const entry of raw.entries) {
    const value = entry.hex ?? entry.raw ?? '';
    const resolved = resolveClassString(value, colors);

    if (!resolved.colors.length) {
      const kind = entry.form === 'non-color' ? 'not-a-class' : 'literal-value-uncovered';
      place(kind, entry);
      if (kind === 'literal-value-uncovered') {
        notAClassByFile[entry.file] = (notAClassByFile[entry.file] || 0) + 1;
      }
      continue;
    }

    const id = `${entry.file}::${entry.path}`;

    /**
     * ⚠️ ΟΙ ΔΥΟ ΒΛΑΒΕΣ «ΚΑΜΙΑΣ ΤΙΜΗΣ» ΚΡΙΝΟΝΤΑΙ **ΠΡΙΝ** ΑΠΟ ΡΟΛΟ ΚΑΙ ΠΡΙΝ ΑΠΟ ΕΞΑΙΡΕΣΗ.
     * Μια κλάση που δεν παράγει CSS, ή που δείχνει σε ανύπαρκτο custom property, είναι
     * σπασμένη **ακόμα κι αν το χρώμα είναι κατηγορικό** — δεν υπάρχει «λόγος
     * αντίθεσης» να συζητηθεί όταν δεν βάφεται τίποτα. Γι' αυτό το `// theme-exempt:`
     * **δεν** μπορεί να τις σβήσει: είναι διαφυγή για **θεματική** κρίση, όχι για λάθος.
     */
    const unknown = resolved.colors.find((r) => r.form === 'class-unknown');
    if (unknown) {
      place('class-unknown', entry);
      extraFindings.push({
        state: 'class-unknown', file: entry.file, line: entry.line, id, declId: id,
        detail: `${entry.path} = "${value}": η κλάση «${unknown.token}» δεν αντιστοιχεί σε χρώμα του theme — ΔΕΝ παράγει CSS (περιστατικό green-707, ADR-365 §10)`,
      });
      continue;
    }

    const dangling = resolved.colors.find((r) => r.form === 'css-var' && !varExists(r.varName));
    if (dangling) {
      place('dangling-var', entry);
      extraFindings.push({
        state: 'dangling-var', file: entry.file, line: entry.line, id, declId: id,
        detail: `${entry.path} = "${value}": το ${dangling.varName} δεν ορίζεται σε κανένα θέμα — invalid at computed-value time ⇒ κληρονομεί αυθαίρετο χρώμα`,
      });
      continue;
    }

    const exemptReason = findExemption(linesOf(entry.file), entry.line);
    if (exemptReason) { place('exempt', entry, { reason: exemptReason }); continue; }

    if (resolved.colors.some((r) => r.form === 'gradient')) { place('gradient', entry); continue; }

    // Ο ρόλος από το ΜΟΝΟΠΑΤΙ (όχι από το πρόθεμα) — αλλιώς κάθε κατηγορικό χρώμα
    // ταυτότητας γίνεται ψευδώς θετικό. Βλ. επικεφαλίδα του resolver.
    const role = entry.role !== 'unknown' ? entry.role : classifyRole(entry.segments);
    if (!JUDGED_ROLES.includes(role)) { place('role-out-of-scope', entry); continue; }

    // Κάθε utility της δήλωσης κρίνεται· ο ΚΑΔΟΣ όμως είναι ένας, κατά προτεραιότητα.
    const outcomes = [];
    const utilities = groupByUtility(resolved.colors);
    for (const [util, sides] of utilities) {
      const base = sides.base.find((r) => r.form === 'literal-hex');
      const dark = sides.dark.find((r) => r.form === 'literal-hex');
      const suffix = groupSuffix(resolved.colors, util);
      const declId = `${entry.file}::${entry.path}${suffix}`;
      const sideRole = utilities.size > 1 ? (UTILITY_ROLE[util] || role) : role;

      if (base && dark) {
        judged.push(declId);
        themedPairs.push({
          light: { ...sideEntry(entry, base, `${suffix} (base)`), role: sideRole },
          dark: { ...sideEntry(entry, dark, `${suffix} (dark:)`), role: sideRole },
        });
        outcomes.push('judged-themed-pair');
      } else if (dark) {
        outcomes.push('theme-scoped-single');
      } else if (base && base.alpha < 1) {
        judged.push(declId);
        translucent.push({
          file: entry.file, line: entry.line, path: `${entry.path}${suffix}`, role: sideRole,
          segments: entry.segments, rgb: hexToRgb(base.hex), alpha: base.alpha, raw: base.token,
        });
        outcomes.push('judged-translucent');
      } else if (base) {
        judged.push(declId);
        entries.push({
          ...entry, path: `${entry.path}${suffix}`, role: sideRole, form: 'literal-hex', hex: base.hex, raw: base.token,
        });
        outcomes.push('judged-mono');
      } else if (sides.base.concat(sides.dark).some((r) => r.form === 'css-var')) {
        outcomes.push('themed-var');
      } else if (sides.base.concat(sides.dark).some((r) => r.form === 'keyword')) {
        outcomes.push('keyword');
      } else {
        outcomes.push('not-a-class');
      }
    }

    place(outcomes.length > 1 ? 'multi-color' : outcomes[0], entry);
  }

  const { declaredPairs } = derivePairs(entries);

  return {
    source: `${scope.files.length} αρχεία allowlist × ${source}`,
    files: scope.files,
    drift: scope.drift,
    entries,
    declaredPairs,
    themedPairs,
    translucent,
    judged: [...new Set(judged)].sort(),
    extraFindings,
    buckets,
    notAClassByFile,
    totalDeclarations: raw.entries.length,
  };
}

/**
 * Η ΛΟΓΙΣΤΙΚΗ, ρητά. Επιστρέφει `balanced:false` αν έστω μία δήλωση δεν μπήκε σε κάδο —
 * και ο έλεγχος ρωτά «ποιος κρίθηκε», όχι «κλείνει το άθροισμα».
 */
function auditBuckets(palette) {
  const counts = Object.fromEntries(
    Object.entries(palette.buckets).map(([k, v]) => [k, v.length]),
  );
  const placed = Object.values(counts).reduce((a, b) => a + b, 0);
  const judged = counts['judged-mono'] + counts['judged-themed-pair'] + counts['judged-translucent'];
  return {
    counts,
    placed,
    total: palette.totalDeclarations,
    balanced: placed === palette.totalDeclarations,
    judged,
    descriptions: BUCKETS,
  };
}

module.exports = {
  buildClassPalette,
  auditBuckets,
  resolveScope,
  findExemption,
  BUCKETS,
  MODULE_NAME,
  JUDGED_ROLES,
};
