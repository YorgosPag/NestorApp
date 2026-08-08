'use strict';

/**
 * CHECK 3.49 / ADR-779 — **η μέτρηση**: ποιος αριθμός ADR απαντά σε πόσα έγγραφα.
 *
 * Ζει χωριστά από την πύλη για τον ίδιο λόγο με το `scripts/lib/contrast-promise/ts-read.js`:
 * η **μέτρηση** («ποιος διεκδικεί τι») είναι άλλη ευθύνη από την **κρίση** («μπλοκάρει;»), και
 * τα mutation tests χρειάζονται τη μέτρηση χωρίς το `process.exit` του CLI.
 *
 * @module scripts/lib/adr-identity/scan
 */

const path = require('path');
const { execFileSync } = require('child_process');

/**
 * 🔴 **Η ΑΥΘΕΝΤΙΑ ΕΙΝΑΙ ΤΟ INDEX ΤΟΥ GIT, ΟΧΙ ΤΟ ΔΙΣΚΟΣ.**
 *
 * Τρεις υποψήφιες πηγές μετρήθηκαν, και η επιλογή δεν είναι αισθητική:
 *
 *  · **δίσκος (`readdirSync`)** — βλέπει και untracked προσχέδια, άρα η baseline θα άλλαζε ανά
 *    πράκτορα και ανά στιγμή. Μια πύλη που δίνει άλλο αποτέλεσμα σε δύο μηχανές δεν είναι πύλη.
 *  · **`git ls-files --others`** — ίδιο πρόβλημα, με επιπλέον κόστος.
 *  · **`git ls-files` (index)** ✅ — είναι **ακριβώς ό,τι θα περιέχει το commit**, ταυτόσημο σε
 *    pre-commit και σε CI. Και το ουσιώδες: ένα δεύτερο `ADR-776-*.md` γίνεται ορατό τη στιγμή
 *    που κάποιος το κάνει `git add` — δηλαδή **πριν** προσγειωθεί, όχι αφού.
 *
 * ⚠️ Συνέπεια που δηλώνεται ρητά: όσο τα δύο `ADR-776-*.md` είναι **untracked**, η πύλη δεν τα
 * βλέπει. Αυτό είναι **σωστό** — δεν έχουν προσγειωθεί ακόμη — και είναι ακριβώς ο λόγος που η
 * πύλη θα μπλοκάρει το επόμενο `git add`, που είναι η μόνη στιγμή που κάτι μπορεί να γίνει.
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
 * Ένα «έγγραφο ADR» είναι αρχείο του οποίου το **βασικό όνομα** ξεκινά με `ADR-<ψηφία>`.
 *
 * ⚠️ Το κριτήριο είναι το **όνομα**, όχι ο φάκελος, και αυτό είναι σκόπιμο: μια χειρόγραφη λίστα
 * φακέλων-«σπιτιών» είναι κατά γράμμα το σχήμα που απέκλινε στο CHECK 3.34 (δύο λίστες namespace,
 * απόκλιση 63) και στο 3.37 (λίστα 18 έναντι δέντρου 26). Τα σπίτια **παράγονται** από τη μέτρηση
 * και κρίνονται ως δηλώσεις — δες το {@link scanAdrIdentity}.
 */
const ADR_BASENAME = /^ADR-(\d+)/;

/**
 * Η ταυτότητα ενός εγγράφου μέσα στη μέτρηση.
 *
 * Ο **αριθμός** κανονικοποιείται σε ακέραιο ώστε `ADR-034` και `ADR-34` να μην περνούν ως δύο
 * διαφορετικοί αριθμοί: το μηδενικό μπροστά είναι ορθογραφία, όχι ταυτότητα, και ο άνθρωπος που
 * γράφει «ADR-34» εννοεί το ίδιο έγγραφο.
 */
function parseAdrFile(file) {
  const base = path.posix.basename(file.split(path.sep).join('/'));
  const m = ADR_BASENAME.exec(base);
  if (!m) return null;
  const dir = file.split(path.sep).join('/').split('/').slice(0, -1).join('/');
  return { file: file.split(path.sep).join('/'), number: Number(m[1]), home: dir || '<ρίζα>' };
}

/**
 * 🔴 Οι **δύο** καταστάσεις παράβασης — ποτέ μία με «ή» (μάθημα CHECK 3.41).
 *
 * Είναι **διαφορετικές αιτίες** με διαφορετική θεραπεία, και η μέτρηση το έδειξε:
 *
 *  · `collided-same-home`  — δύο έγγραφα στο **ίδιο** σπίτι διεκδικούν τον αριθμό. Αυτό είναι
 *    ο αγώνας δρόμου δύο συντακτών (η περίπτωση `ADR-776`). Θεραπεία: **bumping** — ο ένας
 *    παίρνει τον επόμενο ελεύθερο, πρακτική RFC-0000 («collisions resolved by bumping»).
 *  · `collided-cross-home` — ο **χώρος αριθμών διχάστηκε**: το ίδιο νούμερο ζει σε δύο σπίτια
 *    (`adrs/ADR-294-dynamic-imports-optimization.md` έναντι
 *    `docs/…/adrs/ADR-294-ssot-ratchet-enforcement.md`). Εδώ δεν φταίει κανένας συντάκτης —
 *    φταίει ότι υπάρχουν δύο αριθμητικά. Θεραπεία: **ένα σπίτι**, όχι μετονομασία.
 *
 * Μια ενιαία κατάσταση «duplicate» θα έκρυβε ότι το ~60% των συγκρούσεων **δεν διορθώνεται με
 * μετονομασία** — δηλαδή θα οδηγούσε σε λάθος δουλειά.
 */
const RATCHETED_STATES = Object.freeze(['collided-same-home', 'collided-cross-home']);

/** `ADR-034 :: adrs/ADR-034-guide-commands-split.md` — ταυτότητα **ανά αρχείο**, όχι ανά αριθμό. */
function violationId(v) {
  return `ADR-${String(v.number).padStart(3, '0')} :: ${v.file}`;
}

/**
 * Η μέτρηση, ολόκληρη.
 *
 * 🔑 **ΓΙΑΤΙ Η ΤΑΥΤΟΤΗΤΑ ΕΙΝΑΙ ΑΝΑ ΑΡΧΕΙΟ ΚΑΙ ΟΧΙ ΑΝΑ ΑΡΙΘΜΟ.** Το προφανές (`ADR-034#5`,
 * αριθμός με πλήθος) δοκιμάστηκε και είναι **λάθος**: μια νόμιμη διόρθωση 5→4 θα έσβηνε την
 * ταυτότητα `#5` και θα γεννούσε την `#4`, δηλαδή θα φαινόταν **νέα παραβίαση** και η πύλη θα
 * μπλόκαρε την ίδια τη θεραπεία. Με ταυτότητα ανά αρχείο, η αφαίρεση ενός εγγράφου είναι
 * καθαρή αφαίρεση — και η προσθήκη έκτου είναι καθαρή προσθήκη.
 *
 * ## Κλειστή λογιστική, fail-closed
 * Κάθε έγγραφο ADR του index προσγειώνεται σε **έναν** κάδο, χωρίς υπόλοιπο. Άγνωστη κατάσταση
 * ⇒ `throw`, ποτέ σιωπηλή απόρριψη: το «0» που δεν μετρήθηκε διαβάζεται ως «καθαρό», και αυτό
 * το repo το έχει πληρώσει οκτώ φορές.
 */
function scanAdrIdentity(cwd) {
  const docs = listIndexedFiles(cwd).map(parseAdrFile).filter(Boolean);

  const byNumber = new Map();
  for (const d of docs) {
    if (!byNumber.has(d.number)) byNumber.set(d.number, []);
    byNumber.get(d.number).push(d);
  }

  const violations = [];
  const counts = { unique: 0, 'collided-same-home': 0, 'collided-cross-home': 0 };

  for (const [number, group] of byNumber) {
    if (group.length === 1) { counts.unique += 1; continue; }
    const homes = new Set(group.map((d) => d.home));
    const state = homes.size > 1 ? 'collided-cross-home' : 'collided-same-home';
    for (const d of group) {
      counts[state] += 1;
      violations.push({
        number,
        file: d.file,
        // Το εύρημα είναι **επιπέδου αρχείου**: η ταυτότητα ενός ADR δηλώνεται στο όνομά του,
        // όχι σε γραμμή. Το `1` είναι η σύμβαση που χρησιμοποιεί κάθε linter για τέτοια
        // ευρήματα, και κάνει την έξοδο `path:1` **πατήσιμη** στον κοινό εκτυπωτή του
        // `runSetRatchetCli` — που τυπώνει πάντα `${file}:${line}`. Χωρίς αυτό η αναφορά
        // έγραφε `:undefined`.
        line: 1,
        home: d.home,
        state,
        detail: `ο αριθμός ADR-${String(number).padStart(3, '0')} διεκδικείται από ${group.length} έγγραφα`
          + (homes.size > 1 ? ` σε ${homes.size} σπίτια` : ''),
      });
    }
  }

  const placed = counts.unique + counts['collided-same-home'] + counts['collided-cross-home'];
  if (placed !== docs.length) {
    throw new Error(`λογιστική ανοιχτή: ${placed} τοποθετημένα ≠ ${docs.length} έγγραφα ADR`);
  }

  // Τα «σπίτια» **παράγονται**, ποτέ χειρόγραφα — δες το {@link ADR_BASENAME}.
  const homes = [...new Set(docs.map((d) => d.home))].sort();

  return {
    documents: docs.length,
    numbers: byNumber.size,
    counts,
    homes,
    violations: violations.sort((a, b) => a.number - b.number || a.file.localeCompare(b.file)),
    violationIds: violations.map(violationId).sort(),
    declarations: homes,
    balanced: placed === docs.length,
  };
}

module.exports = { scanAdrIdentity, parseAdrFile, violationId, listIndexedFiles, RATCHETED_STATES };
