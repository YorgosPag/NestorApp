#!/usr/bin/env node
/**
 * ΓΕΝΝΗΤΟΡΑΣ ΤΟΥ ΠΙΝΑΚΑ ΣΚΕΛΕΤΟΥ — UTS #39 (ADR-787 §5.3 δ / Ε-5 §8)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΤΙ ΛΥΝΕΙ
 * ─────────────────────────────────────────────────────────────────────────────
 * Το ελληνικό `ο` (U+03BF) και το λατινικό `o` (U+006F) είναι **διαφορετικοί
 * χαρακτήρες με ταυτόσημο σχήμα**. Σε πλατφόρμα όπου ανταλλάσσονται μελέτες και
 * συμβόλαια, ένα γραφείο με ψευδώνυμο που **φαίνεται** ίδιο με άλλου δεν είναι
 * θεωρητικό πρόβλημα — είναι διαδρομή προς λάθος παραλήπτη.
 *
 * Το πρότυπο **UTS #39** ορίζει τη συνάρτηση `skeleton`: κάθε χαρακτήρας
 * αντικαθίσταται με τον αντιπρόσωπο της **οπτικής** του οικογένειας. Δύο
 * ονόματα με τον ίδιο σκελετό είναι **οπτικά ταυτόσημα**.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔑 ΓΙΑΤΙ ΠΑΡΑΓΩΓΗ ΚΑΙ ΟΧΙ ΠΑΚΕΤΟ npm
 * ─────────────────────────────────────────────────────────────────────────────
 * Υπάρχουν πακέτα (`unicode-confusables`, `confusables-js`) με άδεια MIT. Δεν
 * χρησιμοποιούνται, για τον ίδιο λόγο που το CHECK 3.42 ρωτά το **ίδιο** το
 * Tailwind αντί να κρατά χάρτη: **η αυθεντία είναι το πρότυπο**, και ένα πακέτο
 * είναι *αντίγραφο του προτύπου σε άγνωστη έκδοση*. Εδώ η έκδοση Unicode είναι
 * **γραμμένη στο παραγόμενο αρχείο**, η πηγή ζει στο repo, και η αναβάθμιση
 * είναι **ρητή πράξη με ορατό diff** — όχι `npm update`.
 *
 * Ίδιο ιδίωμα με `generate:i18n-types` και `generate:i18n-shell-slice`:
 * παραγόμενο artifact + `sha256` της εισόδου στην κεφαλίδα (πρότυπο CHECK 3.33).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠️ Ο ΠΙΝΑΚΑΣ ΜΕΝΕΙ **ΠΛΗΡΗΣ** — ΚΑΜΙΑ ΚΛΑΔΕΜΕΝΗ ΕΚΔΟΧΗ
 * ─────────────────────────────────────────────────────────────────────────────
 * Μετρήθηκε ότι το κλάδεμα σε «μόνο γράμματα/ψηφία» θα έσωζε 80.251 → 63.817
 * bytes. **Απορρίφθηκε**: το κριτήριο κλαδέματος θα έπρεπε να συμφωνεί για πάντα
 * με τον επικυρωτή χαρακτήρων του ψευδωνύμου — δηλαδή **δεύτερο κριτήριο που
 * μπορεί να αποκλίνει σιωπηλά** (ADR-749). Ο πίνακας είναι `server-only`, άρα
 * ο πελάτης δεν πληρώνει τίποτα και τα 16 KB δεν αγοράζουν κανένα ρίσκο.
 *
 * Εντολή: `npm run generate:confusable-skeleton`
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const SOURCE = path.join(PROJECT_ROOT, 'scripts', 'data', 'confusables.txt');
const OUTPUT = path.join(PROJECT_ROOT, 'src', 'lib', 'unicode', 'generated', 'confusable-skeleton.json');

/**
 * Μια γραμμή δεδομένων του `confusables.txt`:
 *   `<πηγή> ; <στόχος…> ; MA #  σχόλιο`
 * Ο στόχος μπορεί να είναι **περισσότεροι από έναν** κωδικοί (π.χ. `m → rn`).
 *
 * ⚠️ Το σχόλιο κόβεται **πρώτο**: περιέχει τους ίδιους τους χαρακτήρες σε
 * αναγνώσιμη μορφή, και ένα regex πάνω στην πλήρη γραμμή θα διάβαζε παράδειγμα
 * αντί για δεδομένο (το σχήμα που το CHECK 3.50 πλήρωσε με άγκυρα `Κ7β`).
 */
function parseConfusables(text) {
  const table = Object.create(null);
  let dataLines = 0;
  let version = null;
  let date = null;

  for (const line of text.split(/\r?\n/)) {
    if (version === null) {
      const v = line.match(/^#\s*Version:\s*(\S+)/);
      if (v) version = v[1];
    }
    if (date === null) {
      const d = line.match(/^#\s*Date:\s*(.+?)\s*$/);
      if (d) date = d[1];
    }

    const payload = line.split('#')[0].trim();
    if (!payload) continue;

    const fields = payload.split(';').map((f) => f.trim());
    if (fields.length < 2) continue;
    if (!/^[0-9A-F]{4,6}$/.test(fields[0])) continue;

    const source = String.fromCodePoint(parseInt(fields[0], 16));
    const target = fields[1]
      .split(/\s+/)
      .map((hex) => String.fromCodePoint(parseInt(hex, 16)))
      .join('');

    table[source] = target;
    dataLines += 1;
  }

  if (!dataLines) throw new Error('CONFUSABLES: μηδέν γραμμές δεδομένων — η μορφή του αρχείου άλλαξε;');
  if (!version) throw new Error('CONFUSABLES: δεν βρέθηκε «# Version:» — η προέλευση ΠΡΕΠΕΙ να είναι γραμμένη');

  return { table, dataLines, version, date };
}

function main() {
  if (!fs.existsSync(SOURCE)) {
    console.error(`❌ Λείπει η πηγή: ${path.relative(PROJECT_ROOT, SOURCE)}`);
    console.error('   Κατέβασέ την: https://www.unicode.org/Public/security/latest/confusables.txt');
    process.exit(1);
  }

  const raw = fs.readFileSync(SOURCE, 'utf8');
  const sha256 = crypto.createHash('sha256').update(raw, 'utf8').digest('hex');
  const { table, dataLines, version, date } = parseConfusables(raw);

  const payload = {
    _generated: 'ΜΗΝ ΤΟ ΕΠΕΞΕΡΓΑΣΤΕΙΣ — παράγεται από το scripts/generate-confusable-skeleton.js',
    _command: 'npm run generate:confusable-skeleton',
    _adr: 'ADR-787 §5.3 δ (Ε-5 §8) — UTS #39 skeleton',
    _source: 'https://www.unicode.org/Public/security/latest/confusables.txt',
    _unicodeVersion: version,
    _unicodeDate: date,
    _sourceSha256: sha256,
    _entries: dataLines,
    map: table,
  };

  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  // ⚠️ Χωρίς εσοχή: 6.565 εγγραφές × 2 επίπεδα θα διπλασίαζαν το αρχείο χωρίς
  //    να το κάνουν αναγνώσιμο — κανείς δεν διαβάζει πίνακα 6.565 γραμμών.
  fs.writeFileSync(OUTPUT, `${JSON.stringify(payload)}\n`, 'utf8');

  const bytes = Buffer.byteLength(JSON.stringify(payload), 'utf8');
  console.log(`✅ ${path.relative(PROJECT_ROOT, OUTPUT)}`);
  console.log(`   Unicode ${version} (${date}) · ${dataLines} αντιστοιχίες · ${bytes} bytes`);
  console.log(`   sha256(πηγή) = ${sha256}`);
}

if (require.main === module) main();

module.exports = { parseConfusables, SOURCE, OUTPUT };
