#!/usr/bin/env node
/**
 * Η ΑΝΑΦΟΡΑ του CHECK 3.29 — ADR-663 / ADR-757 ΦΑΣΗ Β #2.
 *
 * Το τρίτο κομμάτι της τριάδας: `tsc-runner.js` **τρέχει**, `tsc-diagnostics.js`
 * **διαβάζει**, αυτό **λέει**. Χωρίστηκε από την πύλη για τον λόγο του N.7.1
 * (η πύλη έμενε ένα SRP αρχείο) αλλά και για έναν ουσιαστικότερο: η **κρίση**
 * («ανέβηκαν τα σφάλματα;») είναι άλλη ευθύνη από την **αφήγηση** («γιατί;»),
 * και η αφήγηση είναι ακριβώς αυτό που έλειπε επί ένα μήνα.
 *
 * ── ΤΡΕΙΣ ΚΑΝΟΝΕΣ, ΓΡΑΜΜΕΝΟΙ ΑΠΟ ΤΟ ΣΥΜΒΑΝ ──────────────────────────────────
 *
 * **1. Η αναφορά γράφεται ΠΑΝΤΑ — και στο πράσινο.** Το job του CHECK 3.40
 *    ανεβάζει το στιγμιότυπό του με `if: always()` ακριβώς γι' αυτό: μια
 *    πράσινη εκτέλεση είναι η **βαθμονόμηση** της επόμενης κόκκινης. Αν η
 *    αναφορά υπάρχει μόνο όταν σπάει κάτι, δεν υπάρχει τίποτα να συγκρίνεις.
 *
 * **2. «Δεν μέτρησα» ΔΕΝ γράφεται ποτέ ως άδεια λίστα.** Αν ο μεταγλωττιστής
 *    δεν έτρεξε, το `measured` είναι `false` και το `census` είναι `null` —
 *    **όχι** `[]`. Ένα `[]` διαβάζεται από άνθρωπο και από script ως «κοίταξα
 *    και δεν βρήκα», που είναι η υπογραφή «0 = κανείς δεν κοίταξε» (N.11/N.12,
 *    και το ακριβές ελάττωμα που κόστισε 9 μέρες στο ADR-757 §7.2).
 *
 * **3. Κάθε περικοπή ΟΝΟΜΑΖΕΙ τη συνέχειά της.** Η κονσόλα επιτρέπεται να κόβει
 *    — 191 γραμμές σε log είναι θόρυβος — αλλά **μόνο** αν η επόμενη γραμμή λέει
 *    πού βρίσκονται τα υπόλοιπα. Το «… and 171 more» χωρίς προορισμό ήταν
 *    αδιέξοδο, όχι μορφοποίηση. (Μετρημένο 09/08: η ίδια περικοπή χωρίς
 *    προορισμό υπάρχει σε **4 ακόμη** πύλες — καταγράφηκε στο
 *    `.claude-rules/pending-ratchet-work.md` ως κλάση, όχι ως δείγμα.)
 */

'use strict';

const { censusByCode, concentration } = require('./tsc-diagnostics');

/** Πόσες γραμμές δείχνει η κονσόλα πριν παραπέμψει στην αναφορά. */
const CONSOLE_LIMIT = 20;
/** Πόσες γραμμές δείχνει ο πίνακας του GITHUB_STEP_SUMMARY. */
const SUMMARY_LIMIT = 40;

/**
 * Οι διαγνώσεις που αντιστοιχούν στα αρχεία που **ανέβηκαν** — δηλαδή τα ΝΕΑ
 * σφάλματα, που είναι το μόνο που ρωτά η πύλη.
 *
 * ⚠️ Χρεώνει **ΟΛΑ** τα διαγνωστικά ενός αρχείου που ανέβηκε, όχι μόνο τη
 * διαφορά: το `tsc` δεν λέει ποιο από τα 3 σφάλματα ενός αρχείου είναι το νέο,
 * και μια αυθαίρετη επιλογή «τα τελευταία N» θα ήταν εφεύρεση. Δηλώνεται.
 */
function regressionDiagnostics(regressions, diagnostics, normalize) {
  const rising = new Set(regressions.map((r) => r.file));
  return diagnostics.filter((d) => d.file && rising.has(normalize(d.file)));
}

/** Ομαδοποίηση διαγνωστικών ανά (κανονικοποιημένο) αρχείο, για το per-file παράρτημα. */
function groupByFile(diagnostics, normalize) {
  const map = new Map();
  for (const d of diagnostics) {
    if (!d.file) continue;
    const key = normalize(d.file);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push({ line: d.line, column: d.column, code: d.code, message: d.message });
  }
  return map;
}

/**
 * Το αντικείμενο που ανεβαίνει ως artifact. Ένα σχήμα, καταναλώσιμο από άνθρωπο
 * και από script — η επόμενη συνεδρία διαβάζει ΑΥΤΟ, όχι το log.
 */
function buildReport(input) {
  const {
    check, adr, project, heapMb, elapsedSeconds, environment, environmentDrift,
    measurement, baseline, current, regressions = [], cleaned = [], analysis, normalize = (f) => f,
  } = input;

  const measured = Boolean(measurement && measurement.measured);
  const base = {
    check, adr, project,
    verdict: input.verdict,
    environment: {
      current: environment || null,
      baseline: baseline ? baseline.environment || null : null,
      // `comparable: null` ⇒ η baseline δεν κατέγραψε περιβάλλον. **Άγνωστο**,
      // που δεν επιτρέπεται να διαβαστεί ως «ίδιο».
      comparable: environmentDrift ? environmentDrift.comparable : null,
      drift: environmentDrift ? environmentDrift.drift : [],
    },
    measurement: {
      measured,
      outcome: measurement ? measurement.outcome : 'not-attempted',
      detail: measurement ? measurement.detail || null : null,
      heapMb: heapMb ?? null,
      elapsedSeconds: elapsedSeconds ?? null,
    },
    baseline: baseline
      ? { generatedAt: baseline.generatedAt || null, totalErrors: baseline.totalErrors, files: Object.keys(baseline.byFile || {}).length }
      : null,
  };

  // ΚΑΝΟΝΑΣ 2: καμία άδεια λίστα όταν δεν έγινε μέτρηση.
  if (!measured) {
    return { ...base, totals: null, census: null, regressions: null, cleaned: null, ledger: null };
  }

  const rising = regressionDiagnostics(regressions, analysis.errors, normalize);
  const perFile = groupByFile(analysis.errors, normalize);

  return {
    ...base,
    totals: {
      totalErrors: current.totalErrors,
      sourceErrors: current.sourceErrors,
      testErrors: current.testErrors,
      files: Object.keys(current.byFile).length,
      globalDiagnostics: analysis.global.length,
    },
    census: {
      all: censusByCode(analysis.errors),
      regressions: censusByCode(rising),
      concentration: concentration(rising),
    },
    regressions: regressions.map((r) => ({
      ...r,
      diagnostics: perFile.get(r.file) || [],
    })),
    cleaned,
    ledger: {
      lines: analysis.ledger,
      totalLines: analysis.totalLines,
      balanced: analysis.balanced,
      unrecognisedSamples: analysis.unrecognisedSamples,
      unrecognisedSuspicious: analysis.unrecognisedSuspicious,
      suspiciousSamples: analysis.suspiciousSamples,
    },
  };
}

function mdTable(header, rows) {
  if (rows.length === 0) return '_(καμία εγγραφή)_';
  const sep = header.map(() => '---');
  return [header, sep, ...rows].map((r) => `| ${r.join(' | ')} |`).join('\n');
}

function escapeCell(text) {
  return String(text).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

function renderCensusSection(report) {
  const c = report.census;
  const conc = c.concentration;
  const lines = [
    '### Απογραφή ανά κωδικό TS — στα αρχεία που **ανέβηκαν**',
    '',
    mdTable(
      ['κωδικός', 'σφάλματα', 'αρχεία', 'δείγμα μηνύματος'],
      c.regressions.slice(0, SUMMARY_LIMIT).map((e) => [
        e.code, e.count, e.files, escapeCell(e.sampleMessage).slice(0, 120),
      ]),
    ),
    '',
    conc.total > 0
      ? `**Συγκέντρωση**: ο κορυφαίος κωδικός \`${conc.topCode}\` κρατά ` +
        `**${conc.topCount}/${conc.total}** (${(conc.topShare * 100).toFixed(1)}%) των σφαλμάτων ` +
        `σε **${conc.topFiles}** αρχεία· συνολικά **${conc.distinctCodes}** διακριτοί κωδικοί.`
      : '_(κανένα σφάλμα σε αρχείο που ανέβηκε)_',
    '',
    '> Λίγοι κωδικοί + μεγάλο μερίδιο κορυφής ⇒ **ένα** ριζικό αίτιο που διαχέεται.',
    '> Πολλοί κωδικοί + μικρό μερίδιο ⇒ **συσσώρευση**. Ο πίνακας είναι μέτρηση, όχι ετυμηγορία.',
  ];
  return lines.join('\n');
}

function renderRegressionSection(report) {
  const rows = report.regressions.slice(0, SUMMARY_LIMIT).map((r) => [
    `\`${r.file}\``,
    `${r.baseline} → ${r.current} (+${r.delta})`,
    r.isNew ? '🔴 ΝΕΟ ΑΡΧΕΙΟ' : 'άνοδος',
    [...new Set(r.diagnostics.map((d) => d.code))].join(', ') || '—',
  ]);
  const more = report.regressions.length - rows.length;
  return [
    `### Αρχεία που ανέβηκαν (${report.regressions.length})`,
    '',
    mdTable(['αρχείο', 'πλήθος', 'είδος', 'κωδικοί'], rows),
    more > 0 ? `\n_… και άλλα **${more}**. Πλήρης λίστα με γραμμή/στήλη/μήνυμα: artifact \`dxf-tsc-report\`._` : '',
  ].join('\n');
}

function renderLedgerSection(report) {
  const l = report.ledger;
  const rows = Object.entries(l.lines).map(([k, v]) => [`\`${k}\``, v]);
  // Το ⚠️ ανάβει ΜΟΝΟ σε γραμμή που φέρει κωδικό TS — δηλαδή που *μοιάζει* με
  // διαγνωστικό και δεν διαβάστηκε. Ένα ⚠️ πάνω στο σκέτο πλήθος θα άναβε σε κάθε
  // εκτέλεση (ο `npx` τυπώνει πάντα μια γραμμή) και θα μάθαινε τον αναγνώστη να το
  // προσπερνά: το alert fatigue του ADR-757, μέσα στο όργανο που το θεραπεύει.
  const suspicious = l.unrecognisedSuspicious || 0;
  const warn = suspicious > 0
    ? `\n🔴 **${suspicious}** αταξινόμητες γραμμές **φέρουν κωδικό TS** — δηλαδή μοιάζουν με `
      + 'διαγνωστικά που **δεν διαβάστηκαν**. Δείγματα:\n'
      + (l.suspiciousSamples || []).map((s) => `- \`${escapeCell(s).slice(0, 160)}\``).join('\n')
      + '\n\n> Πιθανότατα **άλλαξε η μορφή εξόδου του `tsc`** ⇒ ο μετρητής υπολογίζει **λιγότερα** '
      + 'από όσα υπάρχουν και η πτώση θα διαβαστεί ως πρόοδος. **ΜΗΝ** κάνεις reseed πριν εξηγηθεί.'
    : l.lines.unrecognised > 0
      ? `\n_${l.lines.unrecognised} αταξινόμητες γραμμές, καμία με κωδικό TS — θόρυβος εργαλείων. `
        + `Δείγμα: \`${escapeCell(l.unrecognisedSamples[0] || '').slice(0, 100)}\`_`
      : '';
  return [
    `### Κλειστή λογιστική γραμμών (${l.totalLines} συνολικά, κλείνει: ${l.balanced ? 'ναι' : 'ΟΧΙ'})`,
    '',
    mdTable(['κάδος', 'γραμμές'], rows),
    warn,
  ].join('\n');
}

/**
 * Το περιβάλλον της μέτρησης — και **αν επιτρέπεται καν η σύγκριση**.
 * Μια baseline χωρίς περιβάλλον δεν είναι σύγκριση κώδικα· είναι σύγκριση με
 * κάτι που κανείς δεν μπορεί πια να ανακατασκευάσει.
 */
function renderEnvironmentSection(report) {
  const e = report.environment;
  const cur = e.current || {};
  const rows = [
    ['TypeScript', e.baseline ? e.baseline.typescript : '❔ δεν καταγράφηκε', cur.typescript],
    ['λειτουργικό', e.baseline ? e.baseline.platform : '❔ δεν καταγράφηκε', cur.platform],
    ['Node', e.baseline ? e.baseline.node : '❔ δεν καταγράφηκε', cur.node],
  ];
  const verdict = e.comparable === null
    ? '❔ **Η baseline δεν κατέγραψε περιβάλλον** — δεν μπορεί να αποκλειστεί ότι μέρος της διαφοράς '
      + 'είναι αλλαγή **κριτή** (έκδοση TS, διάκριση πεζών/κεφαλαίων σε Linux) και όχι χειροτέρευση κώδικα. '
      + 'Το επόμενο `--write-baseline` το καταγράφει.'
    : e.comparable
      ? '✅ Ίδιο περιβάλλον με τη baseline — η διαφορά αφορά **τον κώδικα**.'
      : `🔴 **Το περιβάλλον ΑΛΛΑΞΕ**: ${e.drift.map((d) => `\`${d.key}\` ${d.baseline} → ${d.current}`).join(', ')}. `
        + 'Μέρος της διαφοράς μπορεί να μην είναι κώδικας.';
  return ['### Περιβάλλον μέτρησης', '', mdTable(['', 'baseline', 'τώρα'], rows), '', verdict].join('\n');
}

/** Το markdown που πάει στο `$GITHUB_STEP_SUMMARY`. */
function renderMarkdown(report) {
  const head = [`## ${report.check} — DXF Viewer TypeScript ratchet (${report.adr})`, ''];

  if (!report.measurement.measured) {
    return head.concat([
      `⚠️ **UNKNOWN — δεν έγινε μέτρηση** (κατάσταση: \`${report.measurement.outcome}\`).`,
      '',
      'Αυτό **δεν** είναι παλινδρόμηση: τίποτα δεν μετρήθηκε. Διόρθωσε την εκτέλεση, μετά διάβασε τον αριθμό.',
      '',
      `- γιατί: ${report.measurement.detail || '—'}`,
      `- heap: \`--max-old-space-size=${report.measurement.heapMb}\` MB`,
      '',
      renderEnvironmentSection(report),
    ]).join('\n');
  }

  const t = report.totals;
  const b = report.baseline;
  const totals = mdTable(
    ['μέγεθος', 'baseline', 'τώρα'],
    [
      ['σύνολο σφαλμάτων', b ? b.totalErrors : '—', t.totalErrors],
      ['πηγαίος κώδικας', '—', t.sourceErrors],
      ['tests', '—', t.testErrors],
      ['αρχεία με σφάλμα', b ? b.files : '—', t.files],
      ['καθολικά διαγνωστικά (χωρίς αρχείο)', '—', t.globalDiagnostics],
    ],
  );

  const verdictLine = report.verdict === 'pass'
    ? '✅ **Καμία άνοδος** έναντι της baseline.'
    : `❌ **Άνοδος σε ${report.regressions.length} αρχεία.** Καμία `
      + '`any` / `as any` / `@ts-ignore` (CLAUDE.md). Reseed **μόνο** μετά από νόμιμη διόρθωση.';

  return head.concat([
    verdictLine,
    '',
    `baseline: \`${b ? b.generatedAt : '—'}\` · μεταγλώττιση: ${report.measurement.elapsedSeconds}s · heap: ${report.measurement.heapMb} MB`,
    '',
    totals,
    '',
    renderEnvironmentSection(report),
    '',
    report.verdict === 'pass' ? '' : renderRegressionSection(report),
    '',
    renderCensusSection(report),
    '',
    renderLedgerSection(report),
  ]).join('\n');
}

/**
 * Οι γραμμές που τυπώνει η κονσόλα μετά τη λίστα των αρχείων: η απογραφή που
 * απαντά το «γιατί» + ο **προορισμός** της περικοπής (ΚΑΝΟΝΑΣ 3).
 */
function renderConsoleCensus(report, { reportPath } = {}) {
  if (!report.measurement.measured) return [];
  const c = report.census.regressions.slice(0, 10);
  const conc = report.census.concentration;
  const out = ['', 'Κωδικοί σφάλματος στα αρχεία που ανέβηκαν:'];
  for (const e of c) {
    out.push(`   ${e.code}  ×${String(e.count).padStart(4)}  σε ${String(e.files).padStart(3)} αρχεία  — ${e.sampleMessage.slice(0, 90)}`);
  }
  if (report.census.regressions.length > c.length) {
    out.push(`   … και ${report.census.regressions.length - c.length} ακόμη κωδικοί.`);
  }
  if (conc.total > 0) {
    out.push('', `Συγκέντρωση: ${conc.topCode} = ${conc.topCount}/${conc.total} (${(conc.topShare * 100).toFixed(1)}%) σε ${conc.topFiles} αρχεία· ${conc.distinctCodes} διακριτοί κωδικοί.`);
  }
  if (report.ledger.unrecognisedSuspicious > 0) {
    out.push(`🔴 ${report.ledger.unrecognisedSuspicious} αταξινόμητες γραμμές ΦΕΡΟΥΝ κωδικό TS — πιθανή αλλαγή μορφής του tsc. ΜΗΝ κάνεις reseed.`);
  }
  out.push('', `Πλήρης λίστα (γραμμή/στήλη/κωδικός/μήνυμα ανά αρχείο): ${reportPath || 'τρέξε με --report <αρχείο>'}`);
  return out;
}

module.exports = {
  CONSOLE_LIMIT,
  SUMMARY_LIMIT,
  regressionDiagnostics,
  groupByFile,
  renderEnvironmentSection,
  buildReport,
  renderMarkdown,
  renderConsoleCensus,
};
