#!/usr/bin/env node
/**
 * CHECK 3.41 — **διακριτότητα καναλιού κατάστασης** (ADR-771 Φ.1). ZERO TOLERANCE.
 *
 * Κρίνει τα σημάδια ζωντάνιας του δεσμού πίνακα (`TABLE_BOUND_STATE`, ADR-767/769) με **δύο
 * ανεξάρτητους** κανόνες. Το «ανεξάρτητους» είναι ολόκληρος ο σχεδιασμός — δες παρακάτω.
 *
 * ## ΓΙΑΤΙ ΥΠΑΡΧΕΙ
 * Μέχρι 07/08 η «παράκαμψη» και η «σύγκρουση» ζωγραφίζονταν ως **ταυτόσημο** τρίγωνο, στην
 * **ίδια** γωνία, στο **ίδιο** μέγεθος — και διέφεραν **μόνο** στην απόχρωση. Καμία πύλη δεν
 * τα κοίταζε: το CHECK 3.32 μετρά **μόνο** την παλέτα γραφημάτων, το CHECK 3.38/3.39 μετρούν
 * κλάσεις και δηλώσεις tokens, και ο μεταγλωττιστής δεν έχει γνώμη για δύο hex.
 *
 * ## 🔴 ΓΙΑΤΙ ΔΥΟ ΚΑΝΟΝΕΣ ΚΑΙ ΟΧΙ ΕΝΑΣ ΜΕ «Ή»
 * Ο προφανής σχεδιασμός ήταν «*διαφορετικό σχήμα **Ή** αρκετή χρωματική απόσταση*».
 * **Δοκιμάστηκε και απορρίφθηκε με μέτρηση**: το ζεύγος `#f59e0b` ↔ `#ef4444` δίνει ΔE
 * **13,9** στη χειρότερη προσομοίωση CVD, δηλαδή **πάνω** από το κατώφλι 8. Ένας κανόνας με
 * «ή» θα έμενε **πράσινος** ακόμα και με τα δύο τρίγωνα στην ίδια γωνία — δηλαδή θα επικύρωνε
 * ακριβώς την κατάσταση που υπάρχει για να αποτρέψει.
 *
 * Οι δύο κανόνες απαντούν **διαφορετικές ερωτήσεις** και γι' αυτό δεν συμψηφίζονται:
 *
 * | | ερώτηση | πρότυπο |
 * |---|---|---|
 * | **Κ1** | «ξέρω **ποιο είναι ποιο** χωρίς να δω χρώμα;» | WCAG **1.4.1** Use of Color |
 * | **Κ2** | «η χρωματική διαφορά που υπόσχομαι είναι **αληθινή για όλους**;» | Machado 2009, ΔE ≥ 8 |
 *
 * Το Κ1 δεν έχει χρωματική διέξοδο **σε καμία τιμή ΔE**: δύο πανομοιότυπα σχήματα δεν
 * αποκτούν ταυτότητα επειδή απέχουν χρωματικά. Το Κ2 δεν έχει γεωμετρική διέξοδο: ένα χρώμα
 * που *δηλώνεται* διαφορετικό αλλά δεν *φαίνεται* διαφορετικό είναι ψεύτικη υπόσχεση.
 *
 * ## ⚠️ ΤΙ ΔΕΝ ΚΑΝΕΙ
 * Δεν κρίνει **αντίθεση** των σημαδιών με το φόντο — αυτό είναι άλλη ερώτηση (1.4.11) και
 * άλλος ιδιοκτήτης (`adaptive-entity-color`). Δεν σαρώνει άλλες οικογένειες καταστάσεων· ο
 * αναγνώστης (`lib/contrast/state-marks.js`) είναι εσκεμμένα στοχευμένος, ώστε μια δεύτερη
 * οικογένεια να **προστεθεί ρητά** αντί να συμπεριληφθεί κατά λάθος και να γεννήσει θόρυβο.
 *
 * Usage:  node scripts/check-state-channel-distinctness.js [--verbose]
 * Escape: SKIP_STATE_CHANNEL=1
 */

'use strict';

const { hexToRgb, worstCvdDeltaE, deltaE } = require('./lib/contrast/cvd');
const { readBoundStateMarks, COLOR_CONFIG_PATH } = require('./lib/contrast/state-marks');

/**
 * Το ίδιο κατώφλι με το CHECK 3.32 — **επίτηδες**. Δύο κατώφλια για την ίδια ερώτηση («είναι
 * αυτά τα δύο χρώματα διακριτά σε αχρωματοψία;») θα ήταν δύο απαντήσεις.
 */
const CVD_TARGET = 8.0;

const C = {
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
};

/** Κάθε ζεύγος καταστάσεων, μία φορά. */
function* pairs(items) {
  for (let i = 0; i < items.length; i += 1) {
    for (let j = i + 1; j < items.length; j += 1) yield [items[i], items[j]];
  }
}

/**
 * **Κ1 — WCAG 1.4.1.** Δύο καταστάσεις με τον ίδιο φορέα πρέπει να έχουν διαφορετικό
 * μη-χρωματικό διακριτικό. Διαφορετικός φορέας ⇒ ήδη διακριτές γεωμετρικά.
 */
function checkIdentity(marks) {
  const failures = [];
  for (const [a, b] of pairs(marks)) {
    if (a.carrier !== b.carrier) continue;
    if (a.variant !== b.variant) continue;
    failures.push({
      rule: 'Κ1',
      detail:
        `«${a.id}» και «${b.id}» ζωγραφίζονται ως ΤΑΥΤΟΣΗΜΟ ${a.carrier} (${a.variant}) — ` +
        'η ταυτότητά τους κωδικοποιείται ΜΟΝΟ σε χρώμα (WCAG 1.4.1).',
    });
  }
  return failures;
}

/**
 * **Κ2 — CVD.** Όπου δύο καταστάσεις *επιλέγουν* διαφορετικό χρώμα, η διαφορά πρέπει να
 * επιβιώνει σε πρωτανωπία και δευτερανωπία. Ίδιο hex ⇒ καμία υπόσχεση, τίποτα να ελεγχθεί.
 */
function checkColourPromise(marks, verbose) {
  const failures = [];
  for (const [a, b] of pairs(marks)) {
    if (a.hex === b.hex) continue;
    const ra = hexToRgb(a.hex);
    const rb = hexToRgb(b.hex);
    if (ra === null || rb === null) {
      failures.push({ rule: 'Κ2', detail: `Ανεπίλυτο χρώμα: ${a.id}=${a.hex} · ${b.id}=${b.hex}` });
      continue;
    }
    const worst = worstCvdDeltaE(ra, rb);
    if (verbose) {
      console.log(
        C.dim(
          `    ${a.id} ↔ ${b.id}`.padEnd(42) +
            `ΔE normal ${deltaE(ra, rb, null).toFixed(1).padStart(5)} · worst CVD ${worst.toFixed(1).padStart(5)}`,
        ),
      );
    }
    if (worst < CVD_TARGET) {
      failures.push({
        rule: 'Κ2',
        detail:
          `«${a.id}» (${a.hex}) και «${b.id}» (${b.hex}) δηλώνουν διαφορετικό χρώμα, αλλά ` +
          `απέχουν μόλις ΔE ${worst.toFixed(1)} στη χειρότερη CVD (< ${CVD_TARGET}).`,
      });
    }
  }
  return failures;
}

function main() {
  if (process.env.SKIP_STATE_CHANNEL === '1') {
    console.log(C.dim('CHECK 3.41 — παρακάμφθηκε (SKIP_STATE_CHANNEL=1)'));
    return 0;
  }
  const verbose = process.argv.includes('--verbose');
  console.log(C.bold('\nCHECK 3.41 — διακριτότητα καναλιού κατάστασης (ADR-771 Φ.1)\n'));

  let marks;
  try {
    marks = readBoundStateMarks();
  } catch (err) {
    console.error(C.red(`  [FAIL] Ανάγνωση ${COLOR_CONFIG_PATH}: ${err.message}`));
    return 1;
  }

  if (verbose) {
    for (const m of marks) {
      console.log(C.dim(`    ${m.id.padEnd(18)} ${m.carrier.padEnd(14)} ${String(m.variant).padEnd(22)} ${m.hex}`));
    }
    console.log('');
  }

  const failures = [...checkIdentity(marks), ...checkColourPromise(marks, verbose)];

  if (failures.length === 0) {
    console.log(C.green(`  [PASS] Κ1 ταυτότητα      ${marks.length} καταστάσεις, κάθε ζεύγος διακρίνεται χωρίς χρώμα`));
    console.log(C.green('  [PASS] Κ2 υπόσχεση       κάθε χρωματική διαφορά επιβιώνει σε protan + deutan'));
    console.log(C.green('\n✓ CHECK 3.41 PASS\n'));
    return 0;
  }

  for (const f of failures) console.error(C.red(`  [FAIL] ${f.rule}  ${f.detail}`));
  console.error(
    C.red(`\n✗ CHECK 3.41 FAIL — ${failures.length} παραβίαση(εις) στο ${COLOR_CONFIG_PATH}\n`),
  );
  console.error(C.dim('  Κ1 διορθώνεται ΜΟΝΟ με μη-χρωματικό κανάλι (γωνία/σχήμα/μοτίβο/ένταση).'));
  console.error(C.dim('  Ένα διαφορετικό χρώμα ΔΕΝ ικανοποιεί το Κ1 — δες την κεφαλίδα του script.\n'));
  return 1;
}

if (require.main === module) process.exit(main());

module.exports = { checkIdentity, checkColourPromise, CVD_TARGET };
