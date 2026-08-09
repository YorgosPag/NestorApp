/**
 * Η ΑΠΟΓΡΑΦΗ ΤΩΝ ΤΡΙΤΩΝ — **τι δηλώνει το ίδιο το `node_modules`**.
 *
 * 🔑 ΓΙΑΤΙ ΞΕΧΩΡΙΣΤΑ ΑΠΟ ΤΟ `foreign.js`: η **λογιστική** («ποιος ξένος γράφει στρώση;»)
 * είναι άλλη ευθύνη από την **κρίση** («τι κάναμε γι' αυτό, και ισχύει ακόμη;») — το ίδιο
 * σκεπτικό που έβγαλε το `palette-ledger.js` έξω από τη μηχανή κρίσης του CHECK 3.39.
 * Ο διαχωρισμός δεν είναι αισθητικός: αυτό εδώ αγγίζει τον **δίσκο** και είναι το μόνο
 * ακριβό κομμάτι (~6s), γι' αυτό και είναι το μόνο που παραλείπεται στο Layer 1.
 *
 * @module scripts/lib/zindex/foreign-census
 */

'use strict';

const fs = require('fs');
const path = require('path');

const { GLOBAL_LAYER_FLOOR, PROJECT_ROOT } = require('./scale');

const SCANNABLE = /\.(css|js|mjs|cjs)$/;
const MAX_WALK_DEPTH = 7;
const toPosix = (p) => p.split(path.sep).join('/');

/**
 * ⚠️ ΤΟ ΙΔΙΟ ΜΟΤΙΒΟ ΠΙΑΝΕΙ **ΚΑΙ** CSS **ΚΑΙ** JS. Δεν είναι χαλαρότητα: το `sonner`
 * γράφει `z-index: 999999999` σε `styles.css` **και** στο `dist/index.js` (τα στυλ του
 * εγχέονται ως `<style>` από JS), και το `@react-aria/overlays` το γράφει **μόνο** ως
 * `zIndex: 100000` σε αντικείμενο JS. Απογραφή που διαβάζει μόνο `.css` θα έλεγε
 * «καθαρό» για το μισό οικοσύστημα — το ίδιο σφάλμα με τις τρεις διαλέκτους του πρώτου
 * καταστίχου, μια στάθμη πιο έξω.
 */
const FOREIGN_PATTERN = /z-?index\s*:\s*['"]?(\d{4,})/gi;

function walkPackage(dir, depth, onFile) {
  if (depth > MAX_WALK_DEPTH) return;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '.git' || entry.name === '.bin') continue;
      walkPackage(full, depth + 1, onFile);
    } else if (SCANNABLE.test(entry.name)) {
      onFile(full);
    }
  }
}

/**
 * Ο πλήρης κατάλογος των πακέτων που δηλώνουν καθολική στρώση, με τη **μέγιστη** τιμή
 * τους και ένα αποδεικτικό αρχείο. Αυθεντία των πακέτων = το `package.json`, ποτέ
 * χειρόγραφη λίστα (μια λίστα εδώ θα ήταν ακριβώς ό,τι το μητρώο υπάρχει για να ελέγχει).
 *
 * ⚠️ ΔΗΛΩΜΕΝΟ ΟΡΙΟ: ανοίγονται τα **άμεσα** runtime dependencies (και τα ένθετα
 * `node_modules` τους). Ένα **έμμεσο** πακέτο που δεν το φέρνει κανένα άμεσο δεν
 * σαρώνεται· πλήρης σάρωση όλου του δέντρου μετρήθηκε απαγορευτική. Γράφεται εδώ ώστε
 * το «0» να μη διαβαστεί ως «καθαρό».
 */
function censusNodeModules(repoRoot = PROJECT_ROOT, floor = GLOBAL_LAYER_FLOOR) {
  const pkgJson = path.join(repoRoot, 'package.json');
  const deps = Object.keys(JSON.parse(fs.readFileSync(pkgJson, 'utf8')).dependencies || {});
  const modulesRoot = path.join(repoRoot, 'node_modules');
  if (!fs.existsSync(modulesRoot)) {
    throw new Error(
      'CHECK 3.50 / σύνορο: δεν υπάρχει node_modules — η απογραφή δεν μπορεί να τρέξει και '
      + 'μια πύλη που δεν βρήκε την αυθεντία της δεν επιτρέπεται να απαντήσει «καθαρό».',
    );
  }

  const census = new Map();
  for (const dep of deps) {
    const dir = path.join(modulesRoot, ...dep.split('/'));
    if (!fs.existsSync(dir)) continue;
    walkPackage(dir, 0, (full) => {
      let text;
      try {
        text = fs.readFileSync(full, 'utf8');
      } catch {
        return;
      }
      FOREIGN_PATTERN.lastIndex = 0;
      let m;
      while ((m = FOREIGN_PATTERN.exec(text)) !== null) {
        const value = Number(m[1]);
        if (value < floor) continue;
        const prev = census.get(dep);
        if (!prev || value > prev.max) {
          census.set(dep, { pkg: dep, max: value, evidenceFile: toPosix(path.relative(repoRoot, full)) });
        }
      }
    });
  }
  return census;
}

module.exports = { FOREIGN_PATTERN, MAX_WALK_DEPTH, walkPackage, censusNodeModules };
