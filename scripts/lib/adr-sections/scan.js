'use strict';

/**
 * =============================================================================
 * CHECK 3.53 — σαρωτής ενοτήτων & δεικτών  (ADR-739 §0.3 / ADR-777 §0.4)
 * =============================================================================
 *
 * Χτίζει δύο πράγματα και **τίποτα άλλο** — η κρίση ζει στο `resolve.js`:
 *
 *  1. **Ευρετήριο ενοτήτων**: `§X` → σε ποιο αρχείο και ποια γραμμή ζει.
 *  2. **Απογραφή δεικτών**: ποιος γράφει `§X`, πού, και με ποια μορφή.
 *
 * 🔴 **ΡΗΤΟΣ ΠΙΝΑΚΑΣ, ΟΧΙ «ΠΛΗΣΙΕΣΤΕΡΗ ΠΡΟΗΓΟΥΜΕΝΗ ΕΠΙΚΕΦΑΛΙΔΑ».** Μετρήθηκε ότι η
 * αρίθμηση του ADR-739 **δεν είναι μονότονη**: το `§36.9` και το `§36.10` κάθονται
 * φυσικά **ανάμεσα** στο `§42` και το `§43`. Ένας resolver που υποθέτει σειρά θα τα
 * έλυνε **λάθος** — και θα το έκανε **σιωπηλά**, απαντώντας με γειτονική ενότητα αντί
 * για «δεν υπάρχει».
 *
 * ⚠️ **Οι επικεφαλίδες αγνοούν τα code fences, οι δείκτες ΟΧΙ.** Ένα παράδειγμα
 * markdown μέσα σε ``` θα γεννούσε **φάντασμα ενότητας** (ακριβώς το σχήμα που
 * πλήρωσε το CHECK 3.36 με τα μονά εισαγωγικά). Αντίθετα, ένας δείκτης μέσα σε
 * σχόλιο κώδικα είναι **εξίσου σπασμένος** αν δείχνει σε ανύπαρκτη ενότητα — άρα
 * μετριέται.
 *
 * ⚠️ **Η γραμματική έχει ΤΕΣΣΕΡΑ επίπεδα και ελληνικό τελικό τόνο**: `§19.9.α`
 * (μετρημένα 11 τέτοιες). Γραμματική μόνο με ψηφία θα τις έκοβε **σιωπηλά** — και η
 * σιωπηλή απόρριψη διαβάζεται ως «καθαρό».
 *
 * @module scripts/lib/adr-sections/scan
 */

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

/**
 * Η γραμματική ταυτότητας ενότητας: αυθαίρετα επίπεδα ψηφίων, με προαιρετικό
 * **ελληνικό** τελικό τόνο.
 *
 * 🔴 **ΤΟ `{1,2}` ΔΕΝ ΕΙΝΑΙ ΠΑΡΑΝΟΙΑ — ΤΟ ΕΠΙΑΣΕ Η ΒΑΘΜΟΝΟΜΗΣΗ.** Η πρώτη γραφή
 * δεχόταν **ένα** γράμμα (`[α-ω]`) και έκοβε σιωπηλά το `§67.10.στ` σε `67.10` —
 * το «στ» είναι το ελληνικό αριθμητικό για το **6ο**, δύο γράμματα. Αποτέλεσμα: η
 * ενότητα «εξαφανιζόταν» και το `§67.10` εμφανιζόταν ως **ψεύτικο διπλότυπο**, δηλαδή
 * η πύλη κατήγγειλε βλάβη που **η ίδια είχε κατασκευάσει**. Μετρημένες μορφές στο
 * πραγματικό δέντρο: `.α ×3` · `.β ×2` · `.γ .δ .ε .στ ×1` · `.Φ2 ×1`.
 * *Μια γραμματική που κόβει σιωπηλά διαβάζεται ως «καθαρό».*
 */
const SECTION_ID = String.raw`\d+(?:\.\d+)*(?:\.[α-ωΑ-Ω]{1,2}\d*)?`;

/** Οι φάσεις είναι ΚΕΦΑΛΑΙΑ ελληνικά, με προαιρετικό αριθμό βήματος (`Φ.Β1`). */
const PHASE_ID = String.raw`[Α-Ω]\d*(?:\.\d+)?`;

const toPosix = p => p.replace(/\\/g, '/');

/**
 * Ό,τι θα περιέχει το commit — **το index του git, όχι ο δίσκος**.
 * Ο δίσκος βλέπει untracked προσχέδια ⇒ άλλο αποτέλεσμα ανά πράκτορα (ADR-779).
 */
function listIndexedFiles(cwd) {
  const out = execFileSync('git', ['ls-files', '-z'], {
    cwd,
    maxBuffer: 1024 * 1024 * 256,
    encoding: 'utf8',
  });
  return out.split('\0').filter(Boolean);
}

/**
 * YAML-lite για το frontmatter του προτύπου ADR-777: top-level scalars, flow arrays
 * (`sections: ["§13", "§14"]`) και η λίστα `links:` με ζεύγη `kind`/`target`.
 * ⚠️ Σκόπιμα **δεν** εισάγεται πλήρης YAML parser: το σχήμα είναι κλειστό και
 * γνωστό, και μια δεύτερη εξάρτηση για 20 γραμμές θα ήταν κόστος χωρίς αντίκρισμα.
 */
function parseFrontmatter(text) {
  const lines = text.split(/\r?\n/);
  if (lines[0] !== '---') return null;
  const end = lines.indexOf('---', 1);
  if (end === -1) return null;

  const out = { links: [] };
  let inLinks = false;
  let current = null;

  for (const raw of lines.slice(1, end)) {
    if (/^links:\s*$/.test(raw)) { inLinks = true; continue; }
    if (inLinks) {
      const item = raw.match(/^\s*-\s*(\w+):\s*(.+?)\s*$/);
      if (item) { current = { [item[1]]: item[2] }; out.links.push(current); continue; }
      const cont = raw.match(/^\s+(\w+):\s*(.+?)\s*$/);
      if (cont && current) { current[cont[1]] = cont[2]; continue; }
      if (/^\w/.test(raw)) inLinks = false;
    }
    const kv = raw.match(/^(\w[\w-]*):\s*(.*)$/);
    if (!kv) continue;
    const [, key, value] = kv;
    if (key === 'links') continue;
    out[key] = /^\[.*\]$/.test(value.trim())
      ? value.trim().slice(1, -1).split(',').map(s => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean)
      : value.trim();
  }
  return out;
}

/**
 * Το ID μιας επικεφαλίδας — ή `null` αν δεν φέρει αριθμό (`## Context`, `## Changelog`).
 * Δέχεται προπορευόμενα emoji/σύμβολα (`## 28. 🔴 ΦΑΣΗ Ε`, `## §40 ⊕ …`).
 */
function headingId(headingText) {
  const stripped = headingText.replace(/^[^0-9§a-zA-Zα-ωΑ-Ω]+/u, '');
  const m = stripped.match(new RegExp(`^(?:§\\s*)?(${SECTION_ID})(?=[.\\s—:)\\]]|$)`, 'u'));
  return m ? m[1] : null;
}

/**
 * Ρητός πίνακας ID → θέση. Επιστρέφει **κάθε** εμφάνιση (ακόμη και διπλή), ώστε το
 * `ambiguous-section` να είναι ανιχνεύσιμο αντί να «κερδίζει» σιωπηλά η πρώτη.
 */
function indexHeadings(text, file) {
  const lines = text.split(/\r?\n/);
  const out = [];
  let fenced = false;

  lines.forEach((line, i) => {
    if (/^\s*(```|~~~)/.test(line)) { fenced = !fenced; return; }
    if (fenced) return;
    const h = line.match(/^(#{2,6})\s+(.*)$/);
    if (!h) return;
    const id = headingId(h[2]);
    if (!id) return;
    out.push({ id, file, line: i + 1, level: h[1].length, text: h[2].trim() });
  });
  return out;
}

/**
 * Οι δείκτες ενός αρχείου προς δηλωμένες οικογένειες.
 *
 * Τρεις μορφές, **ρητά ξεχωριστές** — ποτέ μία με «ή» (μάθημα CHECK 3.41):
 *  · `explicit` — `ADR-739 §52` (ο τρόπος που γράφει ο **έξω** κόσμος)
 *  · `internal` — σκέτο `§52` **μέσα** σε αρχείο της ίδιας οικογένειας
 *  · `phase`    — `ADR-739 Φ.Δ` / `Φάση Δ` (λεξιλόγιο **χωρίς άγκυρα**)
 *
 * ⚠️ Σκέτο `§52` **εκτός** οικογένειας αγνοείται σκόπιμα: είναι διφορούμενο (κάθε ADR
 * έχει δικό του §52) και θα παρήγαγε θόρυβο πολύ πάνω από τον πήχη <10%.
 */
function scanReferences(text, { file, familyIds, ownFamily = null }) {
  const lines = text.split(/\r?\n/);
  const refs = [];

  const alt = familyIds.map(id => id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const explicitRe = new RegExp(`(${alt})[\\s,·]*§\\s*(${SECTION_ID})`, 'gu');
  const phaseRe = new RegExp(`(${alt})[\\s,·]*(?:Φ\\.|Φάση\\s*)(${PHASE_ID})`, 'gu');
  const internalRe = new RegExp(`§\\s*(${SECTION_ID})`, 'gu');

  lines.forEach((line, i) => {
    const seen = new Set();
    for (const m of line.matchAll(explicitRe)) {
      seen.add(m.index);
      refs.push({ file, line: i + 1, family: m[1], section: m[2], form: 'explicit' });
    }
    for (const m of line.matchAll(phaseRe)) {
      refs.push({ file, line: i + 1, family: m[1], phase: m[2], form: 'phase' });
    }
    if (!ownFamily) return;
    for (const m of line.matchAll(internalRe)) {
      // ό,τι ανήκει ήδη σε explicit δείκτη δεν ξαναμετριέται — αλλιώς διπλομέτρηση
      if ([...seen].some(s => m.index > s && m.index < s + 24)) continue;
      refs.push({ file, line: i + 1, family: ownFamily, section: m[1], form: 'internal' });
    }
  });
  return refs;
}

/** Διαβάζει ένα tracked αρχείο· `null` αν δεν είναι αναγνώσιμο κείμενο. */
function readText(projectRoot, rel) {
  try {
    return fs.readFileSync(path.join(projectRoot, rel), 'utf8');
  } catch {
    return null;
  }
}

module.exports = {
  SECTION_ID,
  PHASE_ID,
  toPosix,
  listIndexedFiles,
  parseFrontmatter,
  headingId,
  indexHeadings,
  scanReferences,
  readText,
};
