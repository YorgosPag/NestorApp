#!/usr/bin/env node
/**
 * memory-normalize-ids.js — ΒΗΜΑ 1 εξυγίανσης: μία, προβλέψιμη ταυτότητα ανά memory.
 *
 * ΤΟ ΠΡΟΒΛΗΜΑ: κάθε memory έχει filename (`reference_grip_size_default_ssot.md`) ΚΑΙ
 * `name:` στο frontmatter. Στα 402 από 451 το `name:` είναι ελεύθερος τίτλος
 * («Google-level quality standard — ΑΔΙΑΠΡΑΓΜΑΤΕΥΤΟ»), σε άλλα slug χωρίς πρόθεμα,
 * σε 2 σκέτο λάθος (`project-2-rule`). Ο resolver το ΑΝΕΧΕΤΑΙ σήμερα — γι' αυτό
 * τίποτα δεν φαίνεται σπασμένο — αλλά αυτή ακριβώς η ασυνέπεια ήταν η ρίζα-αίτιο
 * των 259 απρόσιτων memories (43% του όγκου) που βρήκε η Φάση 1.
 *
 * Η ΘΕΡΑΠΕΙΑ: `name:` == filename με παύλες. Ένα αρχείο, ένα id, μηδέν μαντεψιά.
 *
 * ΓΙΑΤΙ ΔΕΝ ΣΠΑΕΙ ΤΙΠΟΤΑ — ΚΑΙ ΓΙΑΤΙ ΤΟ ΑΠΟΔΕΙΚΝΥΟΥΜΕ ΑΝΤΙ ΝΑ ΤΟ ΥΠΟΘΕΣΟΥΜΕ:
 * ένα `name:` δεν είναι μόνο ετικέτα — είναι ΚΑΙ alias μέσω του οποίου λύνονται
 * δείκτες. Αλλάζοντάς το, ένας δείκτης που λυνόταν ΜΟΝΟ μέσω του παλιού alias θα
 * γινόταν σιωπηλά νεκρός. Άρα το εργαλείο, πριν γράψει, λύνει ΚΑΘΕ δείκτη του
 * corpus δύο φορές — με τον παλιό και με τον νέο χάρτη — και μπλοκάρει αν έστω
 * ένας αλλάξει προορισμό. Δεν είναι προαιρετικό βήμα· είναι προϋπόθεση εγγραφής.
 *
 * Χρήση:
 *   node scripts/memory-normalize-ids.js              # dry-run + απόδειξη ασφάλειας
 *   node scripts/memory-normalize-ids.js --write      # εφαρμογή (μπλοκάρει αν βρει regression)
 *   node scripts/memory-normalize-ids.js --json
 */

'use strict';

const store = require('./lib/memory/memory-store');
const {
  TYPE_PREFIXES,
  normalizeId,
  canonicalName,
  extractLinks,
  buildAliasMap,
  resolveLink,
} = require('./lib/memory/memory-graph');

const SLUG_SHAPE = /^[a-z0-9][a-z0-9-]*$/;

// ── σχεδιασμός ──────────────────────────────────────────────────────────────

/** Γιατί αλλάζει αυτό το αρχείο — για αναφορά, όχι για λογική. */
function classifyName(slug, name) {
  if (name === null) return 'missing';
  if (name === canonicalName(slug)) return 'ok';
  if (!SLUG_SHAPE.test(name)) return 'freeTitle';
  if (normalizeId(name) !== normalizeId(slug)) return 'mismatch';
  return 'noPrefix';
}

/**
 * Πόση από την πληροφορία του παλιού τίτλου ΛΕΙΠΕΙ από το `description:`.
 * ΓΙΑΤΙ: ο παλιός τίτλος δεν πετιέται «επειδή έτσι» — μετριέται αν κουβαλάει κάτι
 * που δεν λέει ήδη η περιγραφή. 0 = πλήρως πλεονάζων, 1 = τελείως νέα πληροφορία.
 */
function titleInfoLoss(title, description, slug) {
  // Τίτλος που ΕΙΝΑΙ το filename (π.χ. «feedback_dont_touch_means_surgical») δεν
  // κουβαλάει πληροφορία — είναι το id γραμμένο αλλιώς. Αλλιώς θα σκόραρε 1.00
  // επειδή η περιγραφή είναι στα ελληνικά και το id στα λατινικά.
  if (normalizeId(title) === normalizeId(slug)) return 0;
  const words = (s) =>
    String(s || '')
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((w) => w.length > 3);
  const want = new Set(words(title));
  if (want.size === 0) return 0;
  const have = new Set(words(description));
  let missing = 0;
  for (const w of want) if (!have.has(w)) missing++;
  return missing / want.size;
}

function planChanges(slugs) {
  const plan = [];
  for (const slug of [...slugs].sort()) {
    const raw = store.readRaw(slug);
    const oldName = store.readField(raw, 'name');
    const newName = canonicalName(slug);
    const kind = classifyName(slug, oldName);
    if (kind === 'ok') continue;
    plan.push({
      slug,
      oldName,
      newName,
      kind,
      infoLoss:
        kind === 'freeTitle' ? titleInfoLoss(oldName, store.readField(raw, 'description'), slug) : 0,
    });
  }
  return plan;
}

// ── απόδειξη ασφάλειας ──────────────────────────────────────────────────────

/** Κάθε ωμός δείκτης που υπάρχει στο corpus (ευρετήριο + κάθε memory). */
function collectAllLinks(slugs) {
  const links = new Set();
  for (const raw of extractLinks(store.readIndex())) links.add(raw);
  for (const slug of slugs) {
    for (const raw of extractLinks(store.readRaw(slug))) links.add(raw);
  }
  return links;
}

/**
 * Λύνει κάθε δείκτη πριν και μετά. REGRESSION = δείκτης που λυνόταν και πλέον δεν
 * λύνεται, Ή που λύνεται σε ΑΛΛΟ αρχείο. Το δεύτερο είναι χειρότερο από σπασμένο:
 * ένας δείκτης που οδηγεί σιωπηλά αλλού δίνει λάθος γνώση με σιγουριά.
 */
function proveLinkSafety(slugs, plan) {
  const renamed = new Map(plan.map((p) => [p.slug, p.newName]));
  const nameNow = (slug) => store.readField(store.readRaw(slug), 'name');
  const nameAfter = (slug) => renamed.get(slug) ?? nameNow(slug);

  const before = buildAliasMap(slugs, nameNow);
  const after = buildAliasMap(slugs, nameAfter);

  const regressions = [];
  for (const link of collectAllLinks(slugs)) {
    if (link.startsWith('http')) continue;
    const was = resolveLink(link, before);
    const now = resolveLink(link, after);
    if (was && was !== now) regressions.push({ link, was, now });
  }
  return { regressions, aliasBefore: before.size, aliasAfter: after.size };
}

// ── εφαρμογή ────────────────────────────────────────────────────────────────

function applyPlan(plan) {
  let written = 0;
  for (const { slug, newName } of plan) {
    const raw = store.readRaw(slug);
    const next = store.setField(raw, 'name', newName);
    if (next === null) {
      console.error(`  ✖ ${slug}: δεν βρέθηκε πεδίο name: στο frontmatter — παραλείπεται`);
      continue;
    }
    if (next !== raw) {
      store.writeRaw(slug, next);
      written++;
    }
  }
  return written;
}

// ── αναφορά ─────────────────────────────────────────────────────────────────

const KIND_LABEL = {
  freeTitle: 'ελεύθερος τίτλος → slug',
  noPrefix: 'slug χωρίς πρόθεμα τύπου',
  mismatch: 'ασύμφωνο με το filename',
  missing: 'λείπει το name:',
};

function report(plan, safety, isWrite) {
  const byKind = {};
  for (const p of plan) byKind[p.kind] = (byKind[p.kind] || 0) + 1;

  console.log(`\n🏷️  ΚΑΝΟΝΙΚΟΠΟΙΗΣΗ ΤΑΥΤΟΤΗΤΑΣ — ${plan.length} αρχεία προς αλλαγή\n`);
  for (const [kind, n] of Object.entries(byKind)) {
    console.log(`  ${String(n).padStart(4)}  ${KIND_LABEL[kind] ?? kind}`);
  }

  const risky = plan.filter((p) => p.infoLoss > 0.5).sort((a, b) => b.infoLoss - a.infoLoss);
  console.log(`\n📝 ΠΑΛΙΟΙ ΤΙΤΛΟΙ — πληροφορία εκτός \`description:\``);
  console.log(`  πλήρως πλεονάζοντες (loss ≤ 0.5): ${plan.filter((p) => p.kind === 'freeTitle').length - risky.length}`);
  console.log(`  ⚠️  κουβαλούν δικό τους νόημα (> 0.5): ${risky.length}`);
  for (const p of risky.slice(0, 12)) {
    console.log(`     ${p.infoLoss.toFixed(2)}  ${p.slug}\n            «${p.oldName}»`);
  }

  for (const p of plan.filter((x) => x.kind === 'mismatch' || x.kind === 'missing')) {
    console.log(`\n🔎 ${KIND_LABEL[p.kind]}: ${p.slug}\n     name: «${p.oldName}» → «${p.newName}»`);
  }

  console.log(`\n🔬 ΑΠΟΔΕΙΞΗ ΑΣΦΑΛΕΙΑΣ ΔΕΙΚΤΩΝ (alias ${safety.aliasBefore} → ${safety.aliasAfter})`);
  if (safety.regressions.length === 0) {
    console.log('  ✅ 0 regressions — κάθε δείκτης του corpus λύνεται στο ΙΔΙΟ αρχείο μετά.');
  } else {
    console.log(`  🔴 ${safety.regressions.length} REGRESSIONS — Η ΕΓΓΡΑΦΗ ΜΠΛΟΚΑΡΕΤΑΙ`);
    for (const r of safety.regressions.slice(0, 20)) {
      console.log(`     [[${r.link}]]  ${r.was} → ${r.now ?? 'ΝΕΚΡΟΣ'}`);
    }
  }

  if (!isWrite) {
    console.log('\n  (dry-run) Εφαρμογή: node scripts/memory-normalize-ids.js --write\n');
  }
}

// ── main ────────────────────────────────────────────────────────────────────

function main() {
  const isWrite = process.argv.includes('--write');
  const slugs = store.listSlugs();
  const plan = planChanges(slugs);
  const safety = proveLinkSafety(slugs, plan);

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify({ plan, safety }, null, 2));
    return safety.regressions.length ? 1 : 0;
  }

  report(plan, safety, isWrite);

  if (isWrite) {
    if (safety.regressions.length) {
      console.error('✖ Δεν γράφτηκε τίποτα: υπάρχουν regressions δεικτών.\n');
      return 1;
    }
    const written = applyPlan(plan);
    console.log(`✅ Γράφτηκαν ${written} αρχεία. Τρέξε: npm run memory:health\n`);
  }
  return safety.regressions.length ? 1 : 0;
}

process.exit(main());
