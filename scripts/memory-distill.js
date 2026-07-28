#!/usr/bin/env node
/**
 * memory-distill.js — αποστάζει τον ΔΙΑΧΡΟΝΙΚΟ πυρήνα από ένα επεισοδιακό ημερολόγιο.
 *
 * ΤΟ ΠΡΟΒΛΗΜΑ ΠΟΥ ΛΥΝΕΙ: τα ημερολόγια υλοποίησης φτάνουν τα 70 KB. Κανείς — ούτε
 * άνθρωπος ούτε πράκτορας — δεν τα ξαναδιαβάζει ολόκληρα. Μέσα τους όμως κρύβονται
 * διαχρονικοί κανόνες («η ανοχή signature ΠΡΕΠΕΙ να είναι λεπτότερη από το μικρότερο
 * σημαντικό βήμα») θαμμένοι ανάμεσα σε «Slice 6b ✅ DONE 2026-06-11, 34 jest, pending
 * commit». Το επεισοδιακό ΛΗΓΕΙ· ο κανόνας ΟΧΙ. Ανακατεμένα, το ληγμένο δηλώνεται
 * με σιγουριά ως τρέχον — ακριβώς το σχήμα του «91 unprotected» (CLAUDE.md N.12).
 *
 * ΠΩΣ: ο συγγραφέας σημαδεύει το διαχρονικό με σταθερό λεξιλόγιο (ΜΑΘΗΜΑ, ΡΙΖΑ,
 * ΚΛΕΙΔΙ, ΠΑΓΙΔΑ, SSoT, ΑΠΟΦΑΣΕΙΣ LOCKED…). Το εργαλείο κόβει σε προτάσεις, κρατά
 * όσες φέρουν δείκτη διαχρονικότητας, πετάει όσες είναι καθαρά κατάσταση εργασίας,
 * και βγάζει ΚΑΙ τα μονοπάτια αρχείων (οι δείκτες SSoT είναι ο πιο χρήσιμος πυρήνας).
 *
 * 🔴 ΔΕΝ ΑΠΟΦΑΣΙΖΕΙ ΤΟ ΕΡΓΑΛΕΙΟ. Παράγει **υποψήφιο υλικό για ανάγνωση** — τον
 * πυρήνα τον γράφει άνθρωπος/πράκτορας με κρίση. Και δεν διαγράφει ΤΙΠΟΤΑ: το πλήρες
 * κείμενο ζει στο `archive/` (βλ. memory-archive.js --split), άρα ό,τι δεν προαχθεί
 * παραμένει ανακτήσιμο με `grep`.
 *
 * Χρήση:
 *   node scripts/memory-distill.js <slug>            # απόσταγμα
 *   node scripts/memory-distill.js <slug> --dropped  # ΚΑΙ ό,τι απορρίφθηκε (έλεγχος)
 *   node scripts/memory-distill.js --all             # σύνοψη μεγέθους για όλα τα >10KB
 */

'use strict';

const store = require('./lib/memory/memory-store');

/** Δείκτες διαχρονικότητας — το λεξιλόγιο με το οποίο γράφεται ένας κανόνας. */
// SSoT: το λεξιλόγιο ζούσε εδώ και ήταν αόρατο στη μέτρηση υγείας — γι' αυτό το
// επεισοδιακό χρέος έμεινε αμέτρητο. Τώρα ένα module, δύο καταναλωτές.
const vocab = require('./lib/memory/memory-vocabulary');
const { TIMELESS, EPISODIC, hasAny: has } = vocab;

/** Κόβει σε προτάσεις. Ο συγγραφέας χωρίζει με `·`, `.`, νέα γραμμή — όλα μετράνε. */
function toSentences(body) {
  return body
    .split(/\r?\n/)
    .flatMap((line) => line.split(/(?<=[.·;])\s+/))
    .map((s) => s.trim())
    .filter((s) => s.length > 20);
}

/** Μονοπάτια πηγαίου κώδικα — ο πιο πυκνός τύπος διαχρονικού δείκτη. */
function sourcePaths(text) {
  const out = new Set();
  for (const m of text.matchAll(/[\w./-]*(?:src|scripts|packages)\/[\w./-]+\.[a-z]{2,4}\b/g)) {
    out.add(m[0].replace(/^[^a-zA-Z]*/, ''));
  }
  for (const m of text.matchAll(/`([\w-]+\.(?:ts|tsx|js|json))`/g)) out.add(m[1]);
  return [...out].sort();
}

function distill(slug) {
  const raw = store.readRaw(slug);
  const fm = store.splitFrontmatter(raw);
  const body = fm ? raw.slice(fm.end + 4) : raw;
  const kept = [];
  const dropped = [];
  for (const s of toSentences(body)) {
    (has(s, TIMELESS) ? kept : dropped).push(s);
  }
  return {
    slug,
    body,
    bytes: raw.length,
    description: store.readField(raw, 'description'),
    adrs: [...new Set([...raw.matchAll(/ADR-(\d{1,4})/g)].map((m) => `ADR-${m[1]}`))].sort(),
    paths: sourcePaths(body),
    kept,
    dropped: dropped.filter((s) => !has(s, EPISODIC)),
    droppedEpisodic: dropped.filter((s) => has(s, EPISODIC)).length,
  };
}

// ── αναφορά ─────────────────────────────────────────────────────────────────

function printOne(d, showDropped) {
  const keptBytes = d.kept.join('').length;
  console.log(`\n${'═'.repeat(78)}\n📦 ${d.slug} — ${(d.bytes / 1024).toFixed(1)} KB`);
  console.log(`   ${d.description}`);
  console.log(`   ADR: ${d.adrs.join(' ') || '—'}`);
  console.log(
    `   απόσταγμα: ${d.kept.length} προτάσεις / ${(keptBytes / 1024).toFixed(1)} KB ` +
      `(${Math.round((100 * keptBytes) / d.bytes)}%) · απορρίφθηκαν ${d.droppedEpisodic} επεισοδιακές`,
  );

  if (d.paths.length) {
    console.log(`\n── ΔΕΙΚΤΕΣ ΠΗΓΑΙΟΥ (${d.paths.length}) ──`);
    console.log(d.paths.map((p) => `   ${p}`).join('\n'));
  }

  console.log(`\n── ΔΙΑΧΡΟΝΙΚΟ ΥΛΙΚΟ ──`);
  for (const s of d.kept) console.log(`  • ${s}`);

  if (showDropped) {
    console.log(`\n── ΑΠΟΡΡΙΦΘΗΚΑΝ ΧΩΡΙΣ ΔΕΙΚΤΗ (έλεγξε για διαφυγόντα) ──`);
    for (const s of d.dropped) console.log(`  ▫ ${s.slice(0, 200)}`);
  }
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('--all')) {
    // ΚΑΤΩΦΛΙ 4 KB, όχι 10 KB: με 10 KB φαίνονταν **2** αρχεία ενώ το πραγματικό
    // χρέος ήταν 69 στη ζώνη 4-10 KB. Ένα εργαλείο που δείχνει 2 από τα 69 δεν
    // «είναι εντάξει» — είναι τυφλό, και η σιωπή του διαβάζεται ως καθαρότητα.
    const debtOnly = argv.includes('--debt');
    for (const slug of [...store.listSlugs()].sort()) {
      const bytes = store.sizeOf(slug);
      if (bytes < vocab.DEBT_MIN_BYTES) continue;
      const d = distill(slug);
      const score = vocab.scoreEpisodic(d.body);
      const debt = vocab.isEpisodicDebt(bytes, score, slug);
      if (debtOnly && !debt) continue;
      const pct = Math.round((100 * d.kept.join('').length) / d.bytes);
      console.log(
        `${(bytes / 1024).toFixed(1).padStart(6)} KB → ${String(pct).padStart(3)}% ` +
          `(${String(d.kept.length).padStart(3)} προτ.)  ${debt ? '📓' : '  '} ${d.slug}`,
      );
    }
    return 0;
  }
  const slug = argv.find((a) => !a.startsWith('--'));
  if (!slug) {
    console.error('✖ Χρήση: node scripts/memory-distill.js <slug> [--dropped] | --all');
    return 2;
  }
  if (!store.listSlugs().has(slug)) {
    console.error(`✖ δεν υπάρχει memory: ${slug}`);
    return 2;
  }
  printOne(distill(slug), argv.includes('--dropped'));
  return 0;
}

process.exit(main());
