/**
 * ΤΟ ΑΡΧΕΙΟ-ΕΠΙΠΕΔΟ ΕΡΩΤΗΜΑ ΤΟΥ knip — ΜΙΑ ΜΗΧΑΝΗ (CHECK 3.22 / ADR-357, ADR-749)
 *
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ ΡΗΤΟ `--workspace .` ΚΑΙ ΔΕΝ ΕΙΝΑΙ ΠΡΟΤΙΜΗΣΗ.
 *
 * Το `knip.json` το διαβάζουν **δύο** πύλες με **διαφορετικό** ερώτημα:
 *
 *   • CHECK 3.22 (εδώ)  — «ποιο ΑΡΧΕΙΟ δεν το φτάνει κανείς;»
 *   • ADR-598 G15       — «ποιο ΠΑΚΕΤΟ δηλώθηκε και δεν χρησιμοποιείται;»
 *
 * Στις 2026-08-25 το δεύτερο χρειάστηκε να δει το `src/subapps/dxf-viewer` (τέσσερις
 * νεκρές εξαρτήσεις ζούσαν εκεί **δομικά αόρατες**, μία από το initial commit —
 * ADR-800), οπότε το `ignore: ["src/subapps/dxf-viewer/**"]` του `knip.json` έφυγε.
 * Το commit που το έκανε δήλωνε γραπτά ότι «*το file-level dead-code scope ΔΕΝ
 * αγγίχθηκε*». **Ήταν ψευδές, και μετρήθηκε**: το CHECK 3.22 πήγε **10 → 213** νέα
 * «νεκρά» αρχεία στην ίδια εκτέλεση. Η ρύθμιση είναι **μία**· η εμβέλεια του
 * αρχείο-επίπεδου ελέγχου **προέκυπτε σιωπηλά** από ένα `ignore` που άλλαξε σκοπό.
 *
 * ⚠️ Τα 213 **δεν είναι ευρήματα** — είναι ακριβώς τα ψευδώς θετικά που το ADR-357
 * έχει ήδη μετρήσει (2026-06-21): το subapp επιλύει modules μέσα από **δυναμικά
 * μητρώα** που το knip δεν βλέπει. Δηλαδή θόρυβος **πολύ** πάνω από τον πήχη <10%
 * για **μπλοκάρουσα** πύλη, πάνω σε κώδικα που δουλεύει.
 *
 * Πλέον η εμβέλεια είναι **δήλωση**, όχι παρενέργεια: `--workspace .`. Επαληθευμένο
 * ζωντανά ότι επιστρέφει **ακριβώς** τα 10 της baseline — ίδιο σύνολο, όχι ίδιο πλήθος.
 *
 * ⚠️ **ΜΗΝ ξαναγράψεις τα ορίσματα σε καλούντα.** Η πύλη και ο **γεννήτορας της
 * baseline της** ήταν ήδη δύο μηχανές: μόνο η πύλη έκοβε το `npm info …` πρόθεμα που
 * βάζει το `.npmrc` (loglevel=info), οπότε ο γεννήτορας **έσκαγε** σε ακριβώς την
 * περίπτωση που η πύλη ανεχόταν. Είναι το σχήμα του CHECK 3.8 («η πύλη και ο
 * γεννήτορας της baseline της ήταν ΔΥΟ ΜΗΧΑΝΕΣ»): baseline φουσκωμένη ⇒ το ratchet
 * συγκρίνει `τρέχον(Α)` με `baseline(Β)` ⇒ αρχείο μπορεί να **κερδίσει** νεκρό κώδικα
 * και να **περάσει**.
 *
 * @module scripts/lib/knip/file-scope
 */

'use strict';

const { spawnSync } = require('node:child_process');

/**
 * Τα ορίσματα του αρχείο-επίπεδου ερωτήματος. `--cache` **μόνο** στην πύλη: ο
 * γεννήτορας γράφει τη μέτρηση με την οποία θα κριθούν όλοι, άρα δεν επιτρέπεται να
 * απαντήσει από κρυφή μνήμη προηγούμενης διαμόρφωσης.
 */
function fileScopeArgs({ cache = false } = {}) {
  return ['knip', '--workspace', '.', '--reporter', 'json', ...(cache ? ['--cache'] : [])];
}

/**
 * Τρέχει το knip και επιστρέφει τα **ταξινομημένα** μονοπάτια των αχρησιμοποίητων
 * αρχείων. Ρίχνει σε μη αναγνώσιμη έξοδο — fail-closed: ένα σιωπηλό `[]` θα
 * διαβαζόταν ως «καθαρό».
 */
function readUnusedFiles(root, { cache = false } = {}) {
  const result = spawnSync('npx', fileScopeArgs({ cache }), {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'ignore'],
    shell: true,
  });

  const raw = result.stdout ?? '';
  // Το `.npmrc` ορίζει loglevel=info, οπότε το npx προτάσσει «npm info using npm@…»
  // γραμμές πριν το JSON του knip. Ωμό `JSON.parse` πετά — και το πέταγμα διαβαζόταν
  // ως «νέος νεκρός κώδικας» σε κάθε commit εκτός dxf-viewer.
  const start = raw.indexOf('{');
  if (start < 0) throw new Error('knip: καμία αναγνώσιμη JSON έξοδος.');

  const report = JSON.parse(raw.slice(start));
  return (report.issues ?? [])
    .filter((issue) => Array.isArray(issue.files) && issue.files.length > 0)
    .map((issue) => issue.file)
    .sort();
}

/**
 * Τα untracked (μη-gitignored) αρχεία — δηλαδή ό,τι **δεν** θα περιέχει το commit.
 * `-z`: ονόματα με μη-ASCII χαρακτήρες έρχονται ωμά, όχι σε εισαγωγικά `core.quotepath`.
 */
function readUntrackedFiles(root) {
  const result = spawnSync('git', ['ls-files', '--others', '--exclude-standard', '-z'], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024,
  });
  if (result.status !== 0) throw new Error('git ls-files --others: αποτυχία.');
  return result.stdout.split('\0').filter(Boolean);
}

/**
 * 🔴 Η ΠΥΛΗ ΚΡΙΝΕΙ ΤΟ COMMIT, ΟΧΙ ΤΟ ΔΕΝΤΡΟ ΕΡΓΑΣΙΑΣ (2026-09-26).
 *
 * Το knip διαβάζει τον δίσκο. Σε κοινό δέντρο με πολλούς πράκτορες, ένα untracked WIP
 * αρχείο που **δεν έχει ακόμη καταναλωτή** (χτίζεται από κάτω προς τα πάνω) φαινόταν
 * «νέος νεκρός κώδικας» και μπλόκαρε **κάθε** commit — και των άσχετων — ωθώντας σε
 * `SKIP_DEADCODE_CHECK=1`. Μετρημένο: 2 → 10 τέτοια αρχεία ADR-890 μέσα σε 10′.
 *
 * Ό,τι είναι untracked **και** εκτός index δεν μπαίνει στο commit, άρα δεν μπορεί να
 * προσγειώσει νεκρό κώδικα· το αποκλείουμε από τα **μπλοκάροντα** (όχι σιωπηλά — ο
 * καλών το αναφέρει). Ένα `git add` το κάνει αμέσως ξανά ορατό. Ίδιο σκεπτικό με
 * `scripts/lib/adr-identity/scan.js` («το index είναι ό,τι θα περιέχει το commit»).
 *
 * ⚠️ ΜΟΝΟ στην πύλη — **ποτέ** στον γεννήτορα της baseline (θα άλλαζε ανά πράκτορα).
 * ⚠️ Τυφλό σημείο που **δεν** κλείνει εδώ: staged αρχείο με μοναδικό εισαγωγέα ένα
 *    untracked αρχείο φαίνεται ζωντανό. Το πιάνει το Layer 2 (CI, καθαρό checkout).
 */
function partitionByIndex(unusedFiles, untrackedFiles) {
  const untracked = new Set(untrackedFiles);
  const committed = [];
  const outsideIndex = [];
  for (const file of unusedFiles) (untracked.has(file) ? outsideIndex : committed).push(file);
  return { committed, outsideIndex };
}

module.exports = { fileScopeArgs, readUnusedFiles, readUntrackedFiles, partitionByIndex };
