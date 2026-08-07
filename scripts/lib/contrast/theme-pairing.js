/**
 * Η ΜΗΧΑΝΗ του CHECK 3.39 — αποφασίζει ποιες δηλώσεις χρώματος του TypeScript
 * συστήματος είναι **δομικά ασύμβατες** με μια εφαρμογή δύο θεμάτων.
 *
 * ΤΟ ΚΡΙΤΗΡΙΟ, ΚΑΙ ΓΙΑΤΙ ΟΧΙ ΤΟ ΠΡΟΦΑΝΕΣ
 * ---------------------------------------
 * Το προφανές κριτήριο («κάθε ζεύγος κειμένου/επιφάνειας ≥ 4,5:1») μετρήθηκε πρώτα και
 * **απορρίφθηκε**: δίνει 141 ευρήματα από 230 ζεύγη, επειδή περιλαμβάνει συνδυασμούς που
 * **δεν συμβαίνουν ποτέ** — λευκό κείμενο πάνω σε λευκή κάρτα αποτυγχάνει, αλλά κανείς
 * δεν το γράφει. Πάνω από 10% ψευδώς θετικά σε μπλοκάρουσα πύλη είναι αποτυχία
 * σχεδίασης, όχι αυστηρότητα.
 *
 * Το κριτήριο που κρατήθηκε ρωτά κάτι που **δεν χρειάζεται να μαντέψει τι συμβαίνει**:
 *
 *   «Αλλάζει η ετυμηγορία ανάμεσα στα δύο θέματα;»
 *
 * Ένα ΣΤΑΘΕΡΟ hex που περνά στο ένα θέμα και αποτυγχάνει στο άλλο είναι αποδεδειγμένα
 * ασύμβατο με δίθεμη εφαρμογή — ανεξάρτητα από το ποιος το χρησιμοποιεί και πού.
 * Η βλάβη είναι ιδιότητα της **δήλωσης**, όχι της οθόνης.
 *
 * Βαθμονόμηση: το κριτήριο αναπαράγει ντετερμινιστικά το ζωντανό εύρημα του ADR-759
 * (`colors.text.primary` πάνω σε `--card`: φωτεινό 12,83:1 → σκοτεινό **1,01:1**), το
 * οποίο είχε βρεθεί με το μάτι σε πραγματική σελίδα.
 *
 * @module scripts/lib/contrast/theme-pairing
 */

'use strict';

const { surfaceTokens, foregroundTokens } = require('./css-token-themes');
const { hslToRgb, contrastRatio } = require('./wcag-contrast');

/** WCAG 2.1 §1.4.3 — κείμενο κανονικού μεγέθους. */
const AA_TEXT = 4.5;
/** WCAG 2.1 §1.4.11 — εικονίδια, περιγράμματα, κάθε μη-κείμενο. */
const AA_NON_TEXT = 3.0;

/** `#rgb` · `#rrggbb` · (`#rrggbbaa` → το άλφα αγνοείται εδώ, βλ. `alphaOf`). */
function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const full = h.length === 3 || h.length === 4
    ? h.slice(0, 3).split('').map((c) => c + c).join('')
    : h.slice(0, 6);
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

/**
 * Εικονίδιο ή κείμενο; Καθορίζει το κατώφλι (3,0 vs 4,5) και **δεν μαντεύεται**:
 * προκύπτει από το όνομα που έδωσε ο συγγραφέας του token.
 */
function isTextual(entry) {
  return !entry.segments.some((s) => /^icon/i.test(s) || /[a-z]Icon(Colors?)?s?$/.test(s));
}

/** Το κατώφλι που ισχύει για μια καταχώρηση, με το πρότυπο που το ορίζει. */
function thresholdFor(entry) {
  if (entry.role === 'border') return { min: AA_NON_TEXT, rule: 'WCAG 1.4.11' };
  if (entry.role === 'foreground' && isTextual(entry)) return { min: AA_TEXT, rule: 'WCAG 1.4.3' };
  return { min: AA_NON_TEXT, rule: 'WCAG 1.4.11' };
}

/**
 * ΚΑΤΗΓΟΡΙΑ Α — **δηλωμένα ζεύγη** (`colors.severity.critical = {background, icon, border}`).
 *
 * Εδώ ο ίδιος ο κώδικας δηλώνει ότι τα χρώματα προορίζονται να συνυπάρξουν, οπότε η
 * αποτυχία είναι **βεβαιότητα**, όχι πιθανότητα. Δεν υπάρχει τίποτα να μαντέψουμε και
 * τίποτα να ανεχθούμε: κατάσταση `declared-pair-fail`, μηδενική ανοχή.
 */
function evaluateDeclaredPairs(palette) {
  const findings = [];
  for (const pair of palette.declaredPairs) {
    const bg = hexToRgb(pair.surface.hex);
    for (const fg of [...pair.foregrounds, ...pair.borders]) {
      const { min, rule } = thresholdFor(fg);
      const ratio = contrastRatio(hexToRgb(fg.hex), bg);
      findings.push({
        state: ratio >= min ? 'declared-pair-ok' : 'declared-pair-fail',
        file: fg.file,
        line: fg.line,
        id: `${fg.file}::${fg.path}::on::${pair.surface.path}`,
        // Η ΔΗΛΩΣΗ που κρίθηκε, ξεχωριστά από την ταυτότητα του ευρήματος: ένα
        // foreground κρίνεται ΜΙΑ φορά ανά επιφάνεια, αλλά δηλώνεται μία φορά συνολικά.
        // Χωρίς αυτό, το «κάθε δήλωση κρίθηκε» δεν μπορεί καν να διατυπωθεί.
        declId: `${fg.file}::${fg.path}`,
        detail: `${fg.path} (${fg.hex}) πάνω σε ${pair.surface.path} (${pair.surface.hex}) = ${ratio.toFixed(2)}:1, απαιτείται ${min}:1 (${rule})`,
        ratio: +ratio.toFixed(2),
      });
    }
  }
  return findings;
}

/**
 * ΚΑΤΗΓΟΡΙΑ Β — **θεματικά ζεύγη** (`borderColors.default = {light, dark}`).
 *
 * Αυτό είναι το **σωστό** μοτίβο και υπάρχει ήδη μέσα στο ίδιο σύστημα: το `borders.ts`
 * δηλώνει ρητά τιμή ανά θέμα. Άρα δεν ελέγχεται για theme-flip — ελέγχεται αν **κάθε
 * σκέλος στέκει στο δικό του θέμα**, έναντι των επιφανειών εκείνου του θέματος.
 */
function evaluateThemedPairs(palette, themes) {
  const findings = [];
  const surfaces = { light: surfaceTokens(themes.light), dark: surfaceTokens(themes.dark) };
  for (const pair of palette.themedPairs) {
    for (const theme of ['light', 'dark']) {
      const entry = pair[theme];
      const { min, rule } = thresholdFor({ ...entry, role: entry.role });
      const failures = surfaces[theme].filter(
        (s) => contrastRatio(hexToRgb(entry.hex), hslToRgb(s.hsl)) < min,
      );
      findings.push({
        state: failures.length === surfaces[theme].length ? 'themed-side-invisible' : 'themed-side-ok',
        file: entry.file,
        line: entry.line,
        id: `${entry.file}::${entry.path}`,
        declId: `${entry.file}::${entry.path}`,
        detail: `${entry.path} (${entry.hex}) στο ${theme}: αποτυγχάνει σε ${failures.length}/${surfaces[theme].length} επιφάνειες (${rule} ${min}:1)`,
        failing: failures.length,
        surfaces: surfaces[theme].length,
      });
    }
  }
  return findings;
}

/**
 * ΚΑΤΗΓΟΡΙΑ Γ — **μονοθεματικές σημασιολογικές δηλώσεις**: ένα σταθερό hex που
 * ισχυρίζεται ρόλο (`colors.text.primary`) χωρίς να πει τι ισχύει σε κάθε θέμα.
 *
 * Για κάθε επιφάνεια που υπάρχει **και στα δύο** θέματα υπολογίζεται η ετυμηγορία
 * εκατέρωθεν. Τρεις εκβάσεις, όλες ονομασμένες:
 *  · `theme-flip`     — περνά εδώ, αποτυγχάνει εκεί ⇒ **δομικά ασύμβατο**
 *  · `both-fail`      — αποτυγχάνει και στα δύο ⇒ **λάθος ζεύγος**, όχι θεματικό σφάλμα
 *  · `both-pass`      — υγιές
 *
 * ⚠️ Οι επιφάνειες που υπάρχουν σε **ένα μόνο** θέμα δεν μπορούν να απαντήσουν το
 * ερώτημα — και δηλώνονται (`surface-single-theme`) αντί να πεταχτούν σιωπηλά.
 */
function evaluateMonoThemed(palette, themes) {
  const findings = [];
  const light = new Map(surfaceTokens(themes.light).map((s) => [s.name, s]));
  const dark = new Map(surfaceTokens(themes.dark).map((s) => [s.name, s]));

  const declaredIds = new Set();
  for (const pair of palette.declaredPairs) {
    for (const e of [pair.surface, ...pair.foregrounds, ...pair.borders]) declaredIds.add(`${e.file}::${e.path}`);
  }
  const themedIds = new Set();
  for (const pair of palette.themedPairs) {
    themedIds.add(`${pair.light.file}::${pair.light.path}`);
    themedIds.add(`${pair.dark.file}::${pair.dark.path}`);
  }

  for (const entry of palette.entries) {
    if (entry.form !== 'literal-hex') continue;
    if (entry.role !== 'foreground' && entry.role !== 'border') continue;
    const id = `${entry.file}::${entry.path}`;
    if (declaredIds.has(id) || themedIds.has(id)) continue; // κρίθηκε ήδη, αλλού

    const { min, rule } = thresholdFor(entry);
    const rgb = hexToRgb(entry.hex);
    let flips = 0;
    let bothFail = 0;
    let bothPass = 0;
    let singleTheme = 0;
    let worstFlip = null;

    for (const [name, ls] of light) {
      const ds = dark.get(name);
      if (!ds) { singleTheme++; continue; }
      const rl = contrastRatio(rgb, hslToRgb(ls.hsl));
      const rd = contrastRatio(rgb, hslToRgb(ds.hsl));
      const pl = rl >= min;
      const pd = rd >= min;
      if (pl && pd) { bothPass++; continue; }
      if (!pl && !pd) { bothFail++; continue; }
      flips++;
      const low = Math.min(rl, rd);
      if (!worstFlip || low < worstFlip.low) {
        worstFlip = { surface: name, light: +rl.toFixed(2), dark: +rd.toFixed(2), low, breaksIn: pl ? 'σκοτεινό' : 'φωτεινό' };
      }
    }

    const state = flips > 0 ? 'theme-flip' : bothFail > 0 ? 'both-fail' : 'both-pass';
    findings.push({
      state,
      file: entry.file,
      line: entry.line,
      id,
      declId: id,
      detail:
        state === 'theme-flip'
          ? `${entry.path} (${entry.hex}) αλλάζει ετυμηγορία σε ${flips} επιφάνειες· χειρότερη: ${worstFlip.surface} φωτεινό=${worstFlip.light}:1 σκοτεινό=${worstFlip.dark}:1 — σπάει στο ${worstFlip.breaksIn} (${rule} ${min}:1)`
          : `${entry.path} (${entry.hex}): flips=${flips} both-fail=${bothFail} both-pass=${bothPass} (${rule} ${min}:1)`,
      flips,
      bothFail,
      bothPass,
      singleTheme,
    });
  }
  return findings;
}

/**
 * ΚΑΤΗΓΟΡΙΑ Γ2 — **σταθερές επιφάνειες** (`colors.background.primary = "#ffffff"`).
 *
 * Η ερώτηση αντιστρέφεται. Μια καρφωμένη επιφάνεια δεν γίνεται αόρατη από μόνη της —
 * γίνεται **φωτεινή νησίδα** μέσα στο σκοτεινό θέμα, και αυτό που χάνεται πάνω της
 * είναι το **θεματικό** χρώμα κειμένου που βάζει εκεί η εφαρμογή (`--foreground`,
 * `--muted-foreground`, `--text-success`, …). Άρα η ετυμηγορία υπολογίζεται έναντι των
 * foreground tokens, όχι των surfaces.
 *
 * ⚠️ Χωρίς αυτή την κατηγορία, **12 από τις 43** σημασιολογικές δηλώσεις δεν κρίνονταν
 * καθόλου — και η πύλη θα ανέφερε «καθαρό» για ένα ερώτημα που δεν είχε θέσει ποτέ.
 */
function evaluateFixedSurfaces(palette, themes) {
  const findings = [];
  const light = new Map(foregroundTokens(themes.light).map((t) => [t.name, t]));
  const dark = new Map(foregroundTokens(themes.dark).map((t) => [t.name, t]));

  for (const entry of palette.entries) {
    if (entry.form !== 'literal-hex' || entry.role !== 'surface') continue;
    const bg = hexToRgb(entry.hex);
    let flips = 0;
    let bothFail = 0;
    let bothPass = 0;
    let worst = null;

    for (const [name, lt] of light) {
      const dt = dark.get(name);
      if (!dt) continue;
      const rl = contrastRatio(hslToRgb(lt.hsl), bg);
      const rd = contrastRatio(hslToRgb(dt.hsl), bg);
      const pl = rl >= AA_TEXT;
      const pd = rd >= AA_TEXT;
      if (pl && pd) { bothPass++; continue; }
      if (!pl && !pd) { bothFail++; continue; }
      flips++;
      const low = Math.min(rl, rd);
      if (!worst || low < worst.low) {
        worst = { fg: name, light: +rl.toFixed(2), dark: +rd.toFixed(2), low, breaksIn: pl ? 'σκοτεινό' : 'φωτεινό' };
      }
    }

    const state = flips > 0 ? 'surface-theme-flip' : bothFail > 0 ? 'surface-both-fail' : 'surface-both-pass';
    findings.push({
      state,
      file: entry.file,
      line: entry.line,
      id: `${entry.file}::${entry.path}`,
      declId: `${entry.file}::${entry.path}`,
      detail:
        state === 'surface-theme-flip'
          ? `${entry.path} (${entry.hex}) καρφωμένη επιφάνεια: ${flips} θεματικά χρώματα κειμένου αλλάζουν ετυμηγορία· χειρότερο ${worst.fg} φωτεινό=${worst.light}:1 σκοτεινό=${worst.dark}:1 — σπάει στο ${worst.breaksIn}`
          : `${entry.path} (${entry.hex}): flips=${flips} both-fail=${bothFail} both-pass=${bothPass}`,
      flips,
      bothFail,
      bothPass,
    });
  }
  return findings;
}

/**
 * ΚΑΤΗΓΟΡΙΑ Δ — ό,τι **δεν** κρίνεται, δηλωμένο ονομαστικά.
 *
 * Ένα σκαλί παλέτας (`colors.blue.500`) δεν ισχυρίζεται ρόλο: δεν είναι ούτε κείμενο
 * ούτε φόντο μέχρι κάποιος να το βάλει κάπου. Το να το χαρακτηρίσουμε σπασμένο θα ήταν
 * ψευδώς θετικό. Καταγράφεται ώστε το «0 παραβιάσεις» να μη σημαίνει ποτέ «δεν κοίταξα».
 */
function summarizeOutOfScope(palette) {
  const counts = {};
  for (const e of palette.entries) {
    const key = e.form === 'literal-hex' ? `literal-hex/${e.role}` : e.form;
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

/**
 * Τρέξε και τις τέσσερις κατηγορίες.
 *
 * @param {object} palette έξοδος του `readTokenPalette`
 * @param {{light:Map,dark:Map}} themes έξοδος του `readThemes`
 */
function evaluate(palette, themes) {
  const findings = [
    ...evaluateDeclaredPairs(palette),
    ...evaluateThemedPairs(palette, themes),
    ...evaluateMonoThemed(palette, themes),
    ...evaluateFixedSurfaces(palette, themes),
  ];
  const byState = {};
  for (const f of findings) byState[f.state] = (byState[f.state] || 0) + 1;
  return { findings, byState, outOfScope: summarizeOutOfScope(palette) };
}

/**
 * Οι καταστάσεις που μετρώνται έναντι baseline και **μόνο μειώνονται**.
 *
 * ⚠️ Καμία από αυτές δεν είναι μηδενικής ανοχής, και αυτό μετρήθηκε πριν αποφασιστεί:
 * η πρώτη σχεδίαση όριζε το `declared-pair-fail` ως zero-tol επειδή εκεί η βλάβη είναι
 * **βεβαιότητα** — μέχρι που η εκτέλεση έδειξε **8 υπάρχοντα**. Μια πύλη μηδενικής
 * ανοχής με 8 υπάρχουσες παραβιάσεις δεν είναι αυστηρή· είναι **μονίμως κόκκινη**,
 * δηλαδή θα παρακαμπτόταν την πρώτη μέρα.
 */
const RATCHETED_STATES = [
  'declared-pair-fail',
  'theme-flip',
  'both-fail',
  'themed-side-invisible',
  'surface-theme-flip',
  'surface-both-fail',
];

/**
 * Η μηδενική ανοχή ζει αλλού, και είναι **δομική**: η baseline κλειδώνει το **σύνολο των
 * σημασιολογικών ταυτοτήτων**. Κάθε ΝΕΑ δήλωση σταθερού hex σε σημασιολογικό ρόλο
 * μπλοκάρει — ακόμα κι αν σήμερα τυχαίνει να περνά και στα δύο θέματα, γιατί θα σπάσει
 * μόλις μετακινηθεί μια επιφάνεια. Είναι το μοντέλο του Atlassian
 * (`no-unsafe-design-token-usage`): η μάζα ratchet-άρεται, το **νέο** απαγορεύεται.
 */
const HEALTHY_STATES = [
  'declared-pair-ok',
  'themed-side-ok',
  'both-pass',
  'surface-both-pass',
];

module.exports = {
  evaluate,
  evaluateDeclaredPairs,
  evaluateThemedPairs,
  evaluateMonoThemed,
  evaluateFixedSurfaces,
  hexToRgb,
  isTextual,
  thresholdFor,
  RATCHETED_STATES,
  HEALTHY_STATES,
  AA_TEXT,
  AA_NON_TEXT,
};
