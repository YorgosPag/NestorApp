#!/usr/bin/env node
/**
 * memory-archive.js — αρχειακή βαθμίδα του auto-memory (Letta-style archival tier).
 *
 * ΤΙ ΛΥΝΕΙ: ένα «memory» των 70 KB δεν είναι μνήμη — είναι ημερολόγιο υλοποίησης.
 * Μέσα του το διαχρονικό («ο κανόνας X ισχύει») είναι ανακατεμένο με το επεισοδιακό
 * («τη Δευτέρα κάναμε τη Φάση 3»). Όποιος το διαβάσει δηλώνει με σιγουριά κάτι που
 * έπαψε να ισχύει. Η θεραπεία είναι ΔΙΑΧΩΡΙΣΜΟΣ, όχι διαγραφή: ο κανόνας μένει ως
 * μικρό semantic memory στον γράφο, το ημερολόγιο πάει εδώ — ανακτήσιμο ρητά, ποτέ
 * αυτόματα, ώστε να μην μπορεί να παραπλανήσει.
 *
 * ΓΙΑΤΙ ΕΙΝΑΙ ΠΑΡΑΓΟΜΕΝΟ ΚΑΙ ΟΧΙ ΧΕΙΡΟΓΡΑΦΟ: το `MANIFEST.md` είναι ευρετήριο σε
 * ~190 αρχεία. Ένα χειρόγραφο ευρετήριο αυτού του μεγέθους ΘΑ αποκλίνει — και όταν
 * αποκλίνει, κανείς δεν το μαθαίνει. Ακριβώς το σχήμα του «91 unprotected» (N.12):
 * ένας αριθμός έζησε 2 μήνες ως αλήθεια επειδή κανείς δεν άνοιξε το αρχείο. Εδώ το
 * ευρετήριο ΔΕΝ μπορεί να αποκλίνει: παράγεται από τα ίδια τα αρχεία σε κάθε κλήση.
 * Η ανθρώπινη πρόζα ζει χωριστά, στο `archive/_manifest-header.md`.
 *
 * ΗΜΕΡΟΜΗΝΙΑ ΕΠΕΙΣΟΔΙΟΥ — γιατί ΟΧΙ mtime: το mtime είναι μεταδεδομένο συστήματος
 * αρχείων· οποιοδήποτε εργαλείο το σβήνει γράφοντας. Συνέβη ήδη (η κανονικοποίηση
 * ταυτότητας ξαναέγραψε 422 αρχεία και ισοπέδωσε τις ημερομηνίες τους). Η ημερομηνία
 * που ΕΧΕΙ σημασία γράφεται μέσα στο κείμενο από τον ίδιο τον συγγραφέα. Άρα:
 * μεγαλύτερη ISO ημερομηνία στο σώμα → αλλιώς mtime.
 *
 * Χρήση:
 *   node scripts/memory-archive.js --manifest            # αναπαραγωγή ευρετηρίου
 *   node scripts/memory-archive.js --move <slug> [...]   # μεταφορά + αναπαραγωγή
 *   node scripts/memory-archive.js --move <slug> --force # αγνόησε ζωντανούς δείκτες
 */

'use strict';

const fs = require('fs');
const path = require('path');

const store = require('./lib/memory/memory-store');
const { extractLinks, normalizeId, buildAliasMap, resolveLink } = require('./lib/memory/memory-graph');

const ARCHIVE_DIR = path.join(store.MEMORY_DIR, 'archive');
const MANIFEST = path.join(ARCHIVE_DIR, 'MANIFEST.md');
const HEADER = path.join(ARCHIVE_DIR, '_manifest-header.md');
const NO_ADR = 'Χωρίς ADR αναφορά';

// ── συλλογή ─────────────────────────────────────────────────────────────────

/** Αρχεία της βαθμίδας. `_`-prefixed = υλικό του εργαλείου, όχι memories. */
function archiveFiles() {
  if (!fs.existsSync(ARCHIVE_DIR)) return [];
  return fs
    .readdirSync(ARCHIVE_DIR)
    .filter((f) => f.endsWith('.md') && f !== 'MANIFEST.md' && !f.startsWith('_'))
    .sort();
}

/** Κάθε `ADR-###` του κειμένου, κανονικοποιημένο σε αριθμό (ADR-040 ≡ ADR-40). */
function adrRefs(text) {
  const out = new Set();
  for (const m of text.matchAll(/ADR-(\d{1,4})/g)) out.add(Number(m[1]));
  return out;
}

/** Ημερομηνία επεισοδίου: η τελευταία ISO ημερομηνία του κειμένου, αλλιώς mtime. */
function episodeDate(text, file) {
  const found = [...text.matchAll(/\b(20\d{2}-\d{2}-\d{2})\b/g)].map((m) => m[1]).sort();
  if (found.length) return found[found.length - 1];
  return fs.statSync(file).mtime.toISOString().slice(0, 10);
}

function collectEntries() {
  return archiveFiles().map((f) => {
    const file = path.join(ARCHIVE_DIR, f);
    const raw = fs.readFileSync(file, 'utf8');
    const desc = (store.readField(raw, 'description') || '').replace(/^"|"$/g, '').trim();
    const adrs = [...adrRefs(raw)].sort((a, b) => a - b);
    return {
      file: f,
      kb: Math.round(fs.statSync(file).size / 1024),
      date: episodeDate(raw, file),
      desc: desc.length > 160 ? `${desc.slice(0, 160)}…` : desc,
      adrs,
      primaryAdr: pickPrimaryAdr(f, raw, adrs),
    };
  });
}

// ── απόδοση ─────────────────────────────────────────────────────────────────

/**
 * ΜΙΑ εγγραφή ανά αρχείο, στο ΚΥΡΙΟ του ADR — τα υπόλοιπα ως cross-refs στην ίδια
 * γραμμή. ΓΙΑΤΙ: αν κάθε αρχείο καταχωρηθεί σε κάθε ADR που απλώς αναφέρει, το
 * ευρετήριο τριπλασιάζεται (852 γρ. αντί 300) χωρίς να προσθέτει ανάκληση — η
 * αναζήτηση κατά ADR γίνεται έτσι κι αλλιώς με `grep -rl` στα ΑΡΧΕΙΑ, όχι εδώ.
 * Ένα ευρετήριο που δεν διαβάζεται επειδή είναι τεράστιο δεν είναι ευρετήριο.
 */
function groupByAdr(entries) {
  const groups = new Map();
  for (const e of entries) {
    const key = e.adrs.length ? `ADR-${e.primaryAdr}` : NO_ADR;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(e);
  }
  const adrNum = (k) => (k === NO_ADR ? Infinity : Number(k.slice(4)));
  return [...groups.entries()].sort((a, b) => adrNum(a[0]) - adrNum(b[0]));
}

/** Κύριο ADR: αυτό του filename αν υπάρχει, αλλιώς το συχνότερο στο κείμενο. */
function pickPrimaryAdr(fileName, text, adrs) {
  const inName = fileName.match(/adr[_-]?(\d{2,4})/i);
  if (inName && adrs.includes(Number(inName[1]))) return Number(inName[1]);
  const freq = new Map();
  for (const m of text.matchAll(/ADR-(\d{1,4})/g)) {
    const n = Number(m[1]);
    freq.set(n, (freq.get(n) || 0) + 1);
  }
  return [...freq.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]?.[0] ?? null;
}

function renderManifest(entries) {
  const header = fs.existsSync(HEADER)
    ? fs.readFileSync(HEADER, 'utf8').trimEnd()
    : '# ARCHIVAL TIER — episodic implementation logs\n\n---';
  const totalKb = entries.reduce((n, e) => n + e.kb, 0);
  const lines = [
    header.replace(/^\*\*\d+ αρχεία \/ \d+ KB\*\*/m, `**${entries.length} αρχεία / ${totalKb} KB**`),
    '',
    '## Ευρετήριο κατά ADR',
    '',
    '<!-- ΠΑΡΑΓΟΜΕΝΟ από `node scripts/memory-archive.js --manifest`. ΜΗΝ το γράφεις με το χέρι. -->',
  ];
  for (const [key, list] of groupByAdr(entries)) {
    lines.push('', `### ${key}`);
    for (const e of list.sort((a, b) => a.file.localeCompare(b.file))) {
      const also = e.adrs.filter((n) => n !== e.primaryAdr);
      const xref = also.length ? ` · +${also.map((n) => `ADR-${n}`).join(' ')}` : '';
      lines.push(`- \`${e.file}\` (${e.date}, ${e.kb}KB${xref}) — ${e.desc}`);
    }
  }
  return `${lines.join('\n')}\n`;
}

// ── μεταφορά ────────────────────────────────────────────────────────────────

/**
 * Ποια ΖΩΝΤΑΝΑ έγγραφα δείχνουν σε αυτό το slug. ΓΙΑΤΙ ΜΠΛΟΚΑΡΕΙ: αν αρχειοθετήσεις
 * κάτι που το ευρετήριο ακόμη δείχνει, ο δείκτης γίνεται σιωπηλά νεκρός — δηλαδή
 * ξαναφτιάχνεις ακριβώς το πρόβλημα που η εξυγίανση ήρθε να λύσει.
 */
function inboundLinks(slug, slugs) {
  const target = normalizeId(slug);
  const hits = [];
  const check = (label, text) => {
    for (const raw of extractLinks(text)) {
      if (normalizeId(raw) === target) {
        hits.push(label);
        return;
      }
    }
  };
  check(store.INDEX, store.readIndex());
  for (const s of slugs) if (s !== slug) check(`${s}.md`, store.readRaw(s));
  return hits;
}

function moveToArchive(targets, force) {
  const slugs = store.listSlugs();
  let moved = 0;
  for (const slug of targets) {
    if (!slugs.has(slug)) {
      console.error(`  ✖ δεν υπάρχει: ${slug}`);
      continue;
    }
    const inbound = inboundLinks(slug, slugs);
    if (inbound.length && !force) {
      console.error(`  🔴 ${slug} — ${inbound.length} ζωντανοί δείκτες, ΔΕΝ μετακινήθηκε:`);
      for (const src of inbound.slice(0, 6)) console.error(`       ← ${src}`);
      console.error('     Διόρθωσε τους δείκτες πρώτα (ή --force αν είναι σκόπιμο).');
      continue;
    }
    fs.mkdirSync(ARCHIVE_DIR, { recursive: true });
    const dest = path.join(ARCHIVE_DIR, `${slug}.md`);
    if (fs.existsSync(dest)) {
      console.error(`  ✖ υπάρχει ήδη archive/${slug}.md — δεν γράφω από πάνω.`);
      continue;
    }
    fs.renameSync(store.pathOf(slug), dest);
    console.log(`  → archive/${slug}.md`);
    moved++;
  }
  return moved;
}

/**
 * CONSOLIDATION (episodic → semantic): αντιγράφει το πλήρες ημερολόγιο στη βαθμίδα
 * αρχείου και ΑΦΗΝΕΙ το ζωντανό αρχείο στη θέση του, για να το ξαναγράψει ο άνθρωπος
 * με μόνο τον διαχρονικό πυρήνα.
 *
 * ΓΙΑΤΙ ΙΔΙΟ ΟΝΟΜΑ ΚΑΙ ΟΧΙ ΜΕΤΑΚΙΝΗΣΗ: το ζωντανό slug έχει εισερχόμενους δείκτες
 * από το ευρετήριο και από hubs. Μετακίνηση = 27 σπασμένοι δείκτες προς διόρθωση με
 * το χέρι, δηλαδή ακριβώς ο τρόπος με τον οποίο χάθηκαν 259 memories την πρώτη φορά.
 * Ο πυρήνας κρατάει το slug· το ημερολόγιο παίρνει το ίδιο όνομα στο `archive/`.
 */
/**
 * Δείκτες αυτού του αρχείου που είναι η ΜΟΝΑΔΙΚΗ οδός προς τον στόχο τους.
 *
 * ΓΙΑΤΙ: όταν ένα 70άρι ημερολόγιο συμπυκνώνεται σε πυρήνα 2 KB, οι δεκάδες δείκτες
 * του δεν χωράνε όλοι. Όποιος όμως είναι η μόνη οδός προς τον στόχο του, αν πέσει
 * κάνει εκείνο το memory ΑΠΡΟΣΙΤΟ — αναπαράγοντας σε μικρογραφία την ίδια αστοχία
 * που η εξυγίανση ήρθε να λύσει. Συνέβη ήδη μία φορά (ADR-441 → wysiwyg-placement-preview).
 * Άρα το εργαλείο τους ονομάζει ΠΡΙΝ γραφτεί ο πυρήνας: αυτοί ΠΡΕΠΕΙ να επιβιώσουν.
 */
function soleInboundTargets(slug, slugs) {
  const alias = buildAliasMap(slugs, (s) => store.readField(store.readRaw(s), 'name'));
  const out = [];
  for (const rawLink of extractLinks(store.readRaw(slug))) {
    const target = resolveLink(rawLink, alias);
    if (!target || target === slug) continue;
    if (inboundLinks(target, slugs).every((src) => src === `${slug}.md`)) out.push(target);
  }
  return [...new Set(out)].sort();
}

function splitToArchive(targets) {
  const slugs = store.listSlugs();
  let done = 0;
  for (const slug of targets) {
    if (!slugs.has(slug)) {
      console.error(`  ✖ δεν υπάρχει: ${slug}`);
      continue;
    }
    const dest = path.join(ARCHIVE_DIR, `${slug}.md`);
    if (fs.existsSync(dest)) {
      console.error(`  ✖ υπάρχει ήδη archive/${slug}.md — δεν γράφω από πάνω.`);
      continue;
    }
    fs.mkdirSync(ARCHIVE_DIR, { recursive: true });
    const raw = store.readRaw(slug);
    const fm = store.splitFrontmatter(raw);
    const note =
      `${fm ? fm.eol : '\n'}> 📓 ΠΛΗΡΕΣ ΗΜΕΡΟΛΟΓΙΟ ΥΛΟΠΟΙΗΣΗΣ — episodic, ΔΕΝ είναι τρέχουσα κατάσταση.` +
      `${fm ? fm.eol : '\n'}> Ο διαχρονικός πυρήνας ζει στο ζωντανό memory με το ΙΔΙΟ όνομα. Αλήθεια = ADR + git.${fm ? fm.eol : '\n'}`;
    const stamped = fm ? raw.slice(0, fm.end + 4) + note + raw.slice(fm.end + 4) : note + raw;
    fs.writeFileSync(dest, stamped, 'utf8');
    console.log(`  📓 archive/${slug}.md  (${Math.round(raw.length / 1024)}KB) — ξαναγράψε τώρα τον πυρήνα`);
    const sole = soleInboundTargets(slug, slugs);
    if (sole.length) {
      console.log(`     🔴 ΚΡΑΤΑ ΑΥΤΟΥΣ ΤΟΥΣ ΔΕΙΚΤΕΣ (μοναδική οδός προς τον στόχο):`);
      for (const t of sole) console.log(`        [[${t}]]`);
    }
    done++;
  }
  return done;
}

// ── main ────────────────────────────────────────────────────────────────────

function main() {
  const argv = process.argv.slice(2);
  const force = argv.includes('--force');
  const moveAt = argv.indexOf('--move');
  const splitAt = argv.indexOf('--split');

  if (splitAt !== -1) {
    const targets = argv.slice(splitAt + 1).filter((a) => !a.startsWith('--'));
    if (!targets.length) {
      console.error('✖ --split χωρίς slugs.');
      return 2;
    }
    if (splitToArchive(targets) === 0) return 1;
  }

  if (moveAt !== -1) {
    const targets = argv.slice(moveAt + 1).filter((a) => !a.startsWith('--'));
    if (!targets.length) {
      console.error('✖ --move χωρίς slugs.');
      return 2;
    }
    const moved = moveToArchive(targets, force);
    if (moved === 0) return 1;
  }

  const entries = collectEntries();
  fs.writeFileSync(MANIFEST, renderManifest(entries), 'utf8');
  console.log(
    `✅ MANIFEST.md — ${entries.length} αρχεία / ${entries.reduce((n, e) => n + e.kb, 0)} KB, ` +
      `${groupByAdr(entries).length} ενότητες.`,
  );
  return 0;
}

process.exit(main());
