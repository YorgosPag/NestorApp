#!/usr/bin/env node
/**
 * CHECK 3.73 — Πύλη λεξιλογίου τομέα (ADR-812)
 *
 * «Είναι κάθε δήλωση που απαριθμεί το λεξιλόγιο ΔΕΜΕΝΗ στη ρίζα του;»
 *
 * 🔴 Η ΑΙΤΙΑ, μετρημένη 2026-08-26 με AST σε 15.344 αρχεία: το ADR-287 δήλωσε
 * SSoT «ProjectStatus» και υπήρχαν ΔΕΚΑΤΡΙΑ σώματα με ΤΕΣΣΕΡΑ ασύμβατα σύνολα
 * τιμών, συν ΔΥΟ ομώνυμα PROJECT_STATUSES (το ένα λεξιλόγιο, το άλλο πίνακας
 * χρωμάτων badge). Το χειρότερο δεν ήταν η ασυμφωνία αλλά ότι ΚΑΝΕΙΣ δεν
 * μπορούσε να τη δει: το types/validation/schemas.ts έκανε Object.keys() πάνω
 * στον πίνακα ΧΡΩΜΑΤΩΝ και το έδινε σε Zod — τα κλειδιά ενός πίνακα
 * παρουσίασης γίνονταν κανόνας εγκυρότητας του API. Από πάνω, το σχόλιο έγραφε
 * «Use centralized status constants (NO MORE DUPLICATES)»: η περιγραφή της
 * διόρθωσης ΗΤΑΝ η απόκλιση (σχήμα CHECK 3.34 · 3.37 · 3.57).
 *
 * 🔑 ΤΟ ΚΡΙΤΗΡΙΟ ΔΕΝ ΕΙΝΑΙ «ΠΟΣΑ ΣΩΜΑΤΑ», ΚΑΙ ΤΟ ΑΠΟΦΑΣΙΣΕ Η ΜΕΤΡΗΣΗ.
 * Η επανάληψη είναι συχνά ΝΟΜΙΜΗ: ένα έργο χρειάζεται χάρτη badge variants
 * (Record<ProjectStatus, GridCardBadgeVariant>), υποσύνολο στόχων μετάβασης
 * (Extract<ProjectStatus, …>) και λεξικό λέξεων-κλειδιών NLU
 * (Partial<Record<ProjectStatus, string[]>>). Καθένας απαριθμεί τις ίδιες τιμές
 * για ΑΛΛΟ λόγο, και η συγχώνευσή τους θα ήταν λάθος. Πύλη που μετρούσε πλήθος
 * θα μπλόκαρε τη ΣΩΣΤΗ αρχιτεκτονική.
 *
 * Το ερώτημα είναι αν η δήλωση είναι ΔΕΜΕΝΗ: αν ο τύπος της αναφέρει τη ρίζα, ο
 * μεταγλωττιστής πιάνει την απόκλιση — μια έβδομη κατάσταση, ή ένα typo, σπάει
 * το build αντί να ξεθωριάσει στην οθόνη. Η απόκλιση γίνεται ΜΗ ΕΚΦΡΑΣΙΜΗ, όχι
 * απλώς ανιχνεύσιμη.
 *
 * 🏆 ΠΟΥ ΞΕΠΕΡΝΑΜΕ (ερευνήθηκε 2026-08-26):
 *  · typescript-eslint — οι δύο σχετικοί κανόνες (no-duplicate-enum-values,
 *    no-duplicate-type-constituents) είναι ΑΝΑ ΑΡΧΕΙΟ. Το «σε πόσα αρχεία ζει
 *    αυτό το σύνολο τιμών, και δείχνουν όλα στο ίδιο;» δεν είναι εκφράσιμο.
 *  · ISO 19650 — ορίζει σωστά ότι το «suitable for review» (S3) ανήκει στο
 *    information container και όχι στο έργο, αλλά είναι πρότυπο σε PDF: κανένας
 *    μηχανισμός δεν το επιβάλλει σε κώδικα.
 *  · Revit / Figma — κρατούν τους δύο άξονες χωριστά εκ σχεδιασμού, αλλά είναι
 *    κλειστά προϊόντα: δεν φυλάνε τον κώδικα κανενός.
 *  · CHECK 3.59 (ADR-792) ρωτά «ένα ΟΝΟΜΑ → ένα σπίτι». Εδώ τα δεκατρία σώματα
 *    είχαν δεκατρία ΔΙΑΦΟΡΕΤΙΚΑ ονόματα και ένα κοινό σύνολο τιμών, άρα ήταν
 *    δομικά τυφλό. Άλλο ερώτημα, άλλη θεραπεία (μάθημα CHECK 3.41) — αλλά ΚΑΜΙΑ
 *    νέα μηχανή: επαναχρησιμοποιεί collectSourceFiles, resolve-specifier και
 *    ts.createSourceFile parse-only (N.17).
 *
 * ⚠️ ΤΟ ΚΛΕΙΣΤΟ ΣΥΝΟΛΟ ΦΥΛΑΕΙ ΚΑΙ ΤΗ ΣΩΣΤΗ ΠΡΑΞΗ: νέο λεξιλόγιο ή νέα εξαίρεση
 * ΜΠΛΟΚΑΡΕΙ ακόμα κι αν είναι σωστή, ώστε να τη δει άνθρωπος. Ένα σύνολο που
 * εγκρίνει σιωπηλά τη δεύτερη σωστή πράξη δεν θα έβλεπε ποτέ την τρίτη.
 *
 * ⚠️ ΜΗΝ το κάνεις ratchet: δεν υπάρχει «λιγότερα αδέσμευτα λεξιλόγια από
 * χθες» — ένα αρκεί για να δεχτεί το API τιμή που η οθόνη δεν ξέρει να
 * ζωγραφίσει. Είναι εφικτό ως zero-tolerance επειδή το ίδιο ρεύμα δουλειάς
 * μηδένισε τους παραβάτες, ΜΕΤΡΗΜΕΝΑ (ήταν 2, έγιναν 0) — όχι ελπιζόμενα.
 *
 * ⚠️ ΜΗΝ λύσεις κόκκινο σβήνοντας λεξιλόγιο από το μητρώο: βγαίνει από την
 * ΕΜΒΕΛΕΙΑ και κάθε δεύτερο σώμα του γίνεται ΑΟΡΑΤΟ — «πράσινο επειδή κανείς
 * δεν κοίταξε». Το orphan-declaration υπάρχει ακριβώς για να μην πληρώνεται
 * αυτό σιωπηλά (μάθημα CHECK 3.59 Κ2).
 *
 * Escape: SKIP_DOMAIN_VOCABULARY=1
 */
'use strict';
const fs = require('fs');
const path = require('path');
const PROJECT_ROOT = path.resolve(__dirname, '..');
const { STATES, BLOCKING, MIN_REASON, scanFile, verifyRoot, boundToSibling } = require('./lib/domain-vocabulary/scan');
const { collectSourceFiles } = require('./lib/module-graph/scan-config');
const { toPosix } = require('./lib/module-graph/resolve-specifier');

const CONFIG_PATH = path.join(PROJECT_ROOT, '.domain-vocabulary.json');

function loadConfig(configPath = CONFIG_PATH) {
  const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  if (!Array.isArray(cfg.vocabularies) || cfg.vocabularies.length === 0) {
    throw new Error('.domain-vocabulary.json: κενό vocabularies — φρουρός χωρίς πληθυσμό δεν είναι φρουρός');
  }
  for (const v of cfg.vocabularies) {
    for (const field of ['id', 'root', 'rootSymbol', 'typeName', 'values', 'threshold', 'reason']) {
      if (v[field] === undefined) throw new Error(`λεξιλόγιο «${v.id || '?'}»: λείπει το πεδίο ${field}`);
    }
    if (String(v.reason).trim().length < MIN_REASON) {
      throw new Error(`λεξιλόγιο «${v.id}»: ο λόγος είναι υποχρεωτικός (≥${MIN_REASON} χαρακτήρες)`);
    }
  }
  return cfg;
}

/**
 * ΜΙΑ ανάγνωση ανά αρχείο, για ΟΛΑ τα λεξιλόγια (2026-10-29).
 *
 * 🔴 Μέχρι σήμερα ο βρόχος ξαναδιάβαζε ΟΛΟ το δέντρο από τον δίσκο μία φορά ΑΝΑ
 * λεξιλόγιο: 18 × 21.580 = ~388.000 αναγνώσεις, 104s μόνη της ⇒ timeout 120s
 * δίπλα στις άλλες πύλες. Το κόστος μεγάλωνε γραμμικά με το μητρώο, άρα κάθε νέο
 * λεξιλόγιο έφερνε την πύλη πιο κοντά στο SKIP_ (μάθημα CHECK 3.52).
 * Εδώ το προφίλτρο κρίνεται για όλα τα λεξιλόγια στο ΙΔΙΟ πέρασμα και κρατιούνται
 * μόνο οι υποψήφιοι (~2.200 αρχεία). Η σειρά αρχείων ανά λεξιλόγιο μένει ίδια.
 * Με `noPrefilter` όλα τα λεξιλόγια μοιράζονται ΤΟΝ ΙΔΙΟ πίνακα (ένα αντίγραφο).
 */
function readCandidates(files, vocabularies, noPrefilter) {
  const all = [];
  const byVocab = new Map(vocabularies.map(v => [v, noPrefilter ? all : []]));
  for (const abs of files) {
    let text;
    try {
      text = fs.readFileSync(abs, 'utf8');
    } catch {
      continue;
    }
    if (noPrefilter) {
      all.push({ abs, text });
      continue;
    }
    for (const vocab of vocabularies) {
      let seen = 0;
      for (const value of vocab.values) {
        if (text.includes(value) && ++seen >= vocab.threshold) break;
      }
      if (seen >= vocab.threshold) byVocab.get(vocab).push({ abs, text });
    }
  }
  return byVocab;
}

function measure(opts = {}) {
  const root = opts.root || PROJECT_ROOT;
  const cfg = opts.config || loadConfig(opts.configPath);
  const files = opts.files || collectSourceFiles(root);
  if (!opts.files && files.length < 1000) {
    throw new Error(`ΦΡΟΥΡΟΣ: μόνο ${files.length} αρχεία σαρώθηκαν — η σάρωση δεν κοίταξε`);
  }
  const findings = [];
  const tally = Object.fromEntries(Object.values(STATES).map(s => [s, 0]));
  const bump = s => {
    if (!(s in tally)) throw new Error(`ΑΓΝΩΣΤΗ ΚΑΤΑΣΤΑΣΗ: ${s}`);
    tally[s] += 1;
  };

  const candidates = readCandidates(files, cfg.vocabularies, opts.noPrefilter);

  for (const vocab of cfg.vocabularies) {
    const rootAbs = path.join(root, vocab.root);
    // 1. Η ΡΙΖΑ ΟΡΙΖΕΙ ΑΚΟΜΗ ΤΟ ΛΕΞΙΛΟΓΙΟ; Χωρίς αυτό κάθε άλλη ετυμηγορία
    //    κρίνεται έναντι μητρώου που δεν αντιστοιχεί σε κώδικα — fail-closed.
    if (!fs.existsSync(rootAbs)) {
      bump(STATES.ROOT_DRIFT);
      findings.push({ state: STATES.ROOT_DRIFT, vocabulary: vocab.id, file: vocab.root, detail: 'η ρίζα δεν υπάρχει' });
      continue;
    }
    const verdict = verifyRoot(fs.readFileSync(rootAbs, 'utf8'), rootAbs, vocab);
    if (!verdict.ok) {
      bump(STATES.ROOT_DRIFT);
      findings.push({ state: STATES.ROOT_DRIFT, vocabulary: vocab.id, file: vocab.root, detail: verdict.reason });
      continue;
    }
    bump(STATES.ROOT);

    // 2. Οι δηλωμένες εξαιρέσεις υπάρχουν και έχουν λόγο;
    const exemptions = new Map((vocab.exemptions || []).map(e => [e.file, e]));
    for (const [file, entry] of exemptions) {
      if (!fs.existsSync(path.join(root, file))) {
        bump(STATES.ORPHAN_DECLARATION);
        findings.push({ state: STATES.ORPHAN_DECLARATION, vocabulary: vocab.id, file,
          detail: 'δηλωμένη εξαίρεση για αρχείο που δεν υπάρχει' });
      } else if (!entry.reason || String(entry.reason).trim().length < MIN_REASON) {
        bump(STATES.REASONLESS_DECLARATION);
        findings.push({ state: STATES.REASONLESS_DECLARATION, vocabulary: vocab.id, file,
          detail: `ο λόγος είναι υποχρεωτικός (≥${MIN_REASON} χαρακτήρες)` });
      }
    }

    // 3. Κάθε δήλωση εκτός ρίζας.
    //
    // ⚠️ ΠΡΟΦΙΛΤΡΟ ΚΕΙΜΕΝΟΥ — 17,9s → ~2s. Είναι ΑΣΦΑΛΕΣ και ο λόγος είναι
    // δομικός, όχι εμπειρικός: μια δήλωση που απαριθμεί ≥threshold τιμές του
    // λεξιλογίου ΠΡΕΠΕΙ να περιέχει τουλάχιστον τόσες από αυτές ως κείμενο στο
    // αρχείο — το AST δεν μπορεί να δει ταυτοποιητή που δεν υπάρχει στα bytes.
    // Το φίλτρο ΥΠΕΡ-εκτιμά (περνά και σχόλια, που το AST μετά αγνοεί) και ποτέ
    // δεν υπο-εκτιμά. Επαληθευμένο ζωντανά: ταυτόσημη λογιστική με και χωρίς.
    //
    // ⚠️ Πύλη που κοστίζει 18s δεν είναι αυστηρότερη — είναι ανενεργή, γιατί ο
    // επόμενος βάζει SKIP_ (μάθημα CHECK 3.52).
    // 🔴 ΤΟ ΑΡΧΕΙΟ ΤΗΣ ΡΙΖΑΣ ΣΑΡΩΝΕΤΑΙ ΚΙ ΑΥΤΟ — ΔΙΟΡΘΩΘΗΚΕ 2026-09-02 (ADR-841 Α9.4).
    //
    // Μέχρι σήμερα η γραμμή ήταν `if (rel === vocab.root) continue;` και παρέκαμπτε
    // ΟΛΟΚΛΗΡΟ το αρχείο, όχι μόνο τη ρίζα. Άρα κάθε ΔΕΥΤΕΡΗ απαρίθμηση γραμμένη
    // ΔΙΠΛΑ στη ρίζα — το πιο φυσικό μέρος να τη γράψει κανείς — ήταν ΑΟΡΑΤΗ:
    // «πράσινο επειδή κανείς δεν κοίταξε», το σχήμα που αυτή η πύλη υπάρχει για
    // να κλείσει. Δεν φάνηκε ποτέ επειδή το μόνο λεξιλόγιο του μητρώου
    // (`project-status`) έχει ρίζα που δεν περιέχει τίποτε άλλο· το αποκάλυψε το
    // δεύτερο (`registry-authority`), όπου δύο ολικοί πίνακες ζουν στο ίδιο αρχείο.
    //
    // ⚠️ Παρακάμπτεται ΜΟΝΟ ο κόμβος της ρίζας, ονομαστικά — το `verifyRoot` την
    // έχει ήδη κρίνει παραπάνω, και χωρίς αυτή την εξαίρεση θα μετριόταν δεύτερη
    // φορά ως `untyped-vocabulary` (η ρίζα ΔΕΝ αναφέρει τον εαυτό της στον τύπο της).
    for (const { abs, text } of candidates.get(vocab)) {
      const rel = toPosix(path.relative(root, abs));
      const skipSymbol = rel === vocab.root ? vocab.rootSymbol : null;
      let hits;
      try {
        hits = scanFile(abs, text, vocab, rel);
      } catch {
        continue; // μη αναλύσιμο αρχείο: το φυλά το CHECK 3.70, όχι αυτό
      }
      for (const hit of hits) {
        if (hit.name === skipSymbol) continue; // η ίδια η ρίζα — κρίθηκε από το verifyRoot
        const sibling = hit.state === STATES.UNTYPED_VOCABULARY ? boundToSibling(hit, cfg.vocabularies) : null;
        const state = sibling !== null
          ? STATES.BOUND_ELSEWHERE
          : hit.state === STATES.UNTYPED_VOCABULARY && exemptions.has(rel)
            ? STATES.DECLARED_EXEMPT
            : hit.state;
        bump(state);
        if (state !== STATES.BOUND) findings.push({ ...hit, state, vocabulary: vocab.id, ...(sibling ? { boundTo: sibling } : {}) });
      }
    }
  }
  return { findings, tally, vocabularies: cfg.vocabularies.length };
}

function report(result, log = console.log) {
  const { tally, findings } = result;
  log('');
  log('🏷️  CHECK 3.73 — Πύλη λεξιλογίου τομέα (ADR-812)');
  log('');
  log(`   λεξιλόγια στο μητρώο: ${result.vocabularies}`);
  log('');
  // ⚠️ Οι μπλοκάρουσες τυπώνονται ΠΑΝΤΑ, ακόμα και στο μηδέν: ένα «0» που δεν
  // τυπώνεται διαβάζεται ως «δεν υπάρχει τέτοιος έλεγχος» (μάθημα CHECK 3.48).
  for (const s of BLOCKING) log(`   ⛔ ${s.padEnd(24)} ${tally[s]}`);
  log('');
  for (const s of [STATES.ROOT, STATES.BOUND, STATES.BOUND_ELSEWHERE, STATES.DECLARED_EXEMPT]) {
    log(`   ✅ ${s.padEnd(24)} ${tally[s]}`);
  }
  const blocking = findings.filter(f => BLOCKING.includes(f.state));
  if (blocking.length) {
    log('');
    log('   ── ΕΥΡΗΜΑΤΑ ──');
    for (const f of blocking) {
      log(`   ⛔ ${f.state}  ${f.file}${f.line ? ':' + f.line : ''}  ${f.name || ''}`);
      if (f.typeSurface !== undefined) {
        log(`        τύπος: «${(f.typeSurface || '—').replace(/\s+/g, ' ')}»`);
        log(`        τιμές: ${f.values.join(' · ')}`);
        log('        ΘΕΡΑΠΕΙΑ: δώσε του τύπο που αναφέρει τη ρίζα —');
        log('                  Record<ProjectStatus, …> · Partial<Record<…>> ·');
        log('                  Extract<ProjectStatus, …> · satisfies readonly ProjectStatus[]');
      } else if (f.detail) {
        log(`        ${f.detail}`);
      }
    }
  }
  return blocking.length;
}

function main() {
  if (process.env.SKIP_DOMAIN_VOCABULARY === '1') {
    console.log('⏭️  CHECK 3.73 παραλείφθηκε (SKIP_DOMAIN_VOCABULARY=1)');
    return 0;
  }
  const result = measure();
  const blocking = report(result);
  if (blocking > 0) {
    console.log('');
    console.log(`❌ CHECK 3.73 ΑΠΕΤΥΧΕ — ${blocking} μπλοκάρουσα(ες) παραβίαση(εις)`);
    console.log('');
    return 1;
  }
  console.log('');
  console.log('✅ CHECK 3.73 — κάθε δήλωση του λεξιλογίου είναι δεμένη στη ρίζα της');
  console.log('');
  return 0;
}

if (require.main === module) process.exit(main());
module.exports = { measure, report, main, loadConfig, STATES, BLOCKING };
