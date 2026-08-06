#!/usr/bin/env node
/**
 * ΜΕΤΡΗΣΗ — «πόσα από τα `text-primary` είναι πραγματικά αόρατα;» (ADR-759 §4.12.1, δρόμος Α)
 *
 * ΔΕΝ διορθώνει τίποτα. Παράγει αριθμό.
 *
 * Δύο επίπεδα, γιατί το ένα χωρίς το άλλο είναι εικασία:
 *
 *   ΕΠΙΠΕΔΟ 1 — ΑΠΟΔΕΙΞΗ (κλειστή, εξαντλητική): ο πίνακας `--primary`-ως-κείμενο επί
 *   ΚΑΘΕ επιφάνειας του θέματος. Δεν είναι δείγμα — είναι όλες οι δυνατές επιφάνειες.
 *   Αν ΟΛΕΣ αποτυγχάνουν, η ερώτηση «σε ποια επιφάνεια κάθεται το σημείο Χ;» παύει να έχει σημασία.
 *
 *   ΕΠΙΠΕΔΟ 2 — ΑΠΑΡΙΘΜΗΣΗ: κάθε σημείο στον κώδικα, με ΡΗΤΗ κατάσταση. Καμία σιωπηλή απόρριψη.
 *   Οι αισιόδοξες καταστάσεις λέγονται «θέλει ματιά», ΠΟΤΕ «εντάξει» — η στατική ανάλυση μπορεί
 *   να αποδείξει βλάβη, δεν μπορεί να αποδείξει υγεία (αυτό είναι ερώτημα runtime).
 *
 * Χρήση:  node scripts/measure-text-primary-contrast.js [--json <αρχείο>]
 */

'use strict';

const fs = require('fs');
const { readThemes, surfaceTokens } = require('./lib/contrast/css-token-themes');
const { hslToRgb, contrastRatio, compositeOver, toHex, grade, parseHslToken } = require('./lib/contrast/wcag-contrast');
const { scanTextPrimarySites } = require('./lib/contrast/text-primary-sites');

/** WCAG AA για σώμα κειμένου. Κάτω από 3.0 δεν είναι «χαμηλό» — είναι μη αναγνώσιμο. */
const AA_BODY = 4.5;
const LARGE_TEXT = 3.0;

/** Ο πίνακας: το `--primary` ως ΚΕΙΜΕΝΟ πάνω σε κάθε επιφάνεια του θέματος, για κάθε διαφάνεια που χρησιμοποιεί ο κώδικας. */
function buildMatrix(theme, alphas) {
  const primary = parseHslToken(theme.get('--primary') || '');
  if (!primary) return null;
  const fg = hslToRgb(primary);
  return surfaceTokens(theme).map((surface) => {
    const bg = hslToRgb(surface.hsl);
    const perAlpha = alphas.map((alpha) => {
      const composited = alpha === 1 ? fg : compositeOver(fg, bg, alpha);
      const ratio = contrastRatio(composited, bg);
      return { alpha, ratio: Number(ratio.toFixed(2)), grade: grade(ratio) };
    });
    return { surface: surface.name, surfaceHex: toHex(bg), textHex: toHex(fg), perAlpha };
  });
}

function tally(sites, key) {
  const out = new Map();
  for (const s of sites) out.set(s[key], (out.get(s[key]) || 0) + 1);
  return [...out.entries()].sort((a, b) => b[1] - a[1]);
}

function area(file) {
  if (file.startsWith('src/subapps/dxf-viewer/')) return 'dxf-viewer';
  if (file.startsWith('src/subapps/')) return 'subapps (άλλα)';
  if (file.startsWith('src/components/ui/')) return 'components/ui (primitives)';
  if (file.startsWith('src/components/')) return 'components';
  if (file.startsWith('src/app/')) return 'app (σελίδες)';
  return 'λοιπά';
}

function printMatrix(label, matrix, alphas) {
  console.log(`\n── ΘΕΜΑ: ${label} — «text-primary» πάνω σε κάθε επιφάνεια ──`);
  if (!matrix) return console.log('  (το --primary δεν είναι κυριολεκτική τιμή HSL — δεν μετρήθηκε)');
  const header = alphas.map((a) => (a === 1 ? 'πλήρες' : `/${a * 100}`).padStart(14)).join('');
  console.log(`  ${'επιφάνεια'.padEnd(22)}${'χρώμα'.padEnd(10)}${header}`);
  for (const row of matrix) {
    const cells = row.perAlpha.map((p) => `${p.ratio.toFixed(2)}:1 ${p.grade}`.padStart(14)).join('');
    console.log(`  ${row.surface.padEnd(22)}${row.surfaceHex.padEnd(10)}${cells}`);
  }
  const worst = Math.max(...matrix.flatMap((r) => r.perAlpha.map((p) => p.ratio)));
  const failing = matrix.filter((r) => r.perAlpha[0].ratio < LARGE_TEXT).length;
  console.log(`  ⇒ ${failing}/${matrix.length} επιφάνειες κάτω από 3.0:1 · ΚΑΛΥΤΕΡΗ περίπτωση σε όλο το θέμα: ${worst.toFixed(2)}:1`);
}

const STATE_LABELS = {
  'theme-surface': '🔴 σε επιφάνεια θέματος — ισχύει η απόδειξη του Επιπέδου 1',
  'file-light-bg': '🟡 το αρχείο έχει κάπου φωτεινό φόντο — ΘΕΛΕΙ ΜΑΤΙΑ (όχι «εντάξει»)',
  'element-light-bg': '🟡 η ΙΔΙΑ λίστα κλάσεων βάζει φωτεινό φόντο — ΘΕΛΕΙ ΜΑΤΙΑ',
  'scoped-override': '🟢 μέσα σε scope που ξαναδείχνει το --primary',
  'in-comment': '⚪ σχόλιο — δεν αποδίδεται',
  'inert-class': '⚫ ΑΝΥΠΑΡΚΤΗ κλάση (τυπογραφικό) — δεν βάφει τίποτα',
};

function main() {
  const jsonAt = process.argv.indexOf('--json');
  const themes = readThemes();
  const sites = scanTextPrimarySites('src', themes.primaryOverrides.map((o) => o.cssClass).filter(Boolean));
  const alphas = [...new Set([1, ...sites.map((s) => s.alpha)])].sort((a, b) => b - a);

  console.log('═══ ΜΕΤΡΗΣΗ `text-primary` — ADR-759 §4.12.1, δρόμος Α ═══');
  console.log(`πηγή token: ${themes.source} · προεπιλεγμένο θέμα εφαρμογής: dark (src/app/layout.tsx:70)`);

  const matrices = {
    light: buildMatrix(themes.light, alphas),
    dark: buildMatrix(themes.dark, alphas),
  };
  printMatrix('dark (ΠΡΟΕΠΙΛΟΓΗ)', matrices.dark, alphas);
  printMatrix('light', matrices.light, alphas);

  console.log('\n── ΤΑ SCOPES ΠΟΥ ΞΑΝΑΔΕΙΧΝΟΥΝ ΤΟ --primary ──');
  for (const o of themes.primaryOverrides) console.log(`  ${o.selector}  →  ${o.value}`);
  if (themes.primaryOverrides.length === 0) console.log('  (κανένα)');

  console.log(`\n── ΑΠΑΡΙΘΜΗΣΗ: ${sites.length} σημεία σε ${new Set(sites.map((s) => s.file)).size} αρχεία ──`);
  for (const [state, count] of tally(sites, 'state')) {
    console.log(`  ${String(count).padStart(4)}  ${STATE_LABELS[state] || state}`);
  }

  console.log('\n── ΑΝΑ ΠΕΡΙΟΧΗ (μόνο τα «σε επιφάνεια θέματος») ──');
  const broken = sites.filter((s) => s.state === 'theme-surface');
  for (const [a, count] of tally(broken.map((s) => ({ area: area(s.file) })), 'area')) {
    console.log(`  ${String(count).padStart(4)}  ${a}`);
  }

  console.log('\n── ΤΑ 12 ΑΡΧΕΙΑ ΜΕ ΤΑ ΠΕΡΙΣΣΟΤΕΡΑ ──');
  for (const [file, count] of tally(broken, 'file').slice(0, 12)) {
    console.log(`  ${String(count).padStart(3)}  ${file}`);
  }

  if (jsonAt !== -1) {
    const out = { generatedFrom: themes.source, matrices, alphas, overrides: themes.primaryOverrides, sites };
    fs.writeFileSync(process.argv[jsonAt + 1], JSON.stringify(out, null, 2));
    console.log(`\nJSON → ${process.argv[jsonAt + 1]}`);
  }

  console.log(`\n⚠️  ΟΡΙΟ ΤΟΥ ΟΡΓΑΝΟΥ: η στατική ανάλυση αποδεικνύει ΒΛΑΒΗ, δεν αποδεικνύει ΥΓΕΙΑ.`);
  console.log(`   Τα «θέλει ματιά» χρειάζονται runtime επαλήθευση (Επίπεδο 3, στον browser).`);
}

main();
