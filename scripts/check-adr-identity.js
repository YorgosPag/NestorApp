#!/usr/bin/env node
/**
 * CHECK 3.49 / ADR-779 — **η πύλη ταυτότητας ADR**: «απαντά ο αριθμός `ADR-NNN` σε ΕΝΑ έγγραφο;»
 *
 * ΤΟ ΜΕΤΡΗΜΕΝΟ ΓΕΓΟΝΟΣ (2026-08-08): **60 αριθμοί** διεκδικούνται από περισσότερα του ενός
 * έγγραφα, σε **4 σπίτια** ADR. Το `ADR-320` υπάρχει **με το ίδιο ακριβώς όνομα αρχείου** σε δύο
 * σπίτια. Δηλαδή η φράση «δες το ADR-294» **δεν προσδιορίζει έγγραφο** — και το ADR-294 είναι ο
 * ίδιος ο κανόνας N.12 του `CLAUDE.md`.
 *
 * 🔴 ΓΙΑΤΙ ΚΑΜΙΑ ΠΥΛΗ ΔΕΝ ΤΟ ΡΩΤΟΥΣΕ — ΚΑΙ ΓΙΑΤΙ ΜΙΑ ΟΔΗΓΙΑ ΔΕΝ ΑΡΚΕΣΕ:
 * Το `CLAUDE.md` **έχει** κανόνα («use the next sequential number»), **έχει** προειδοποίηση για
 * το ADR-145 («do NOT create a third») και **έχει** ρητή παραδοχή ότι ο δηλωμένος επόμενος
 * αριθμός παλιώνει: *«stale by 357 … by 6 … by 10 … by 18, so verify with `ls` instead of
 * trusting it»*. Δηλαδή η οδηγία ζητά από κάθε συντάκτη να κάνει με το χέρι έναν έλεγχο που
 * **καμία μηχανή δεν εκτελεί** — κατά λέξη το σχήμα που το CHECK 3.36 ονόμασε: **«ένα anchor
 * χωρίς gate είναι σχόλιο»**. Το αποτέλεσμα μετρήθηκε: 60 συγκρούσεις.
 *
 * 🔬 Η ΠΡΑΚΤΙΚΗ ΤΩΝ ΜΕΓΑΛΩΝ, ΕΡΕΥΝΗΜΕΝΗ ΠΡΙΝ ΓΡΑΦΤΕΙ ΓΡΑΜΜΗ:
 *   · οι αριθμοί ADR είναι **αμετάβλητα αναγνωριστικά** — «keep the numbering stable, never
 *     renumber»· ό,τι αλλάζει γράφεται ως **νέο** έγγραφο που υπερισχύει του παλιού·
 *   · η σύγκρουση λύνεται με **bumping** (διαδικασία RFC-0000: «collisions resolved by bumping»)·
 *   · και το ουσιώδες: η αποτροπή είναι **CI lint** — τα εργαλεία ADR (`adrs-core`, GitHub
 *     Action για ADRs) τρέχουν `check_all` που ελέγχει *duplicate numbers*, σπασμένους
 *     συνδέσμους και ακεραιότητα supersession.
 * Άρα η πύλη **δεν επινοεί** πολιτική· εκτελεί τη γραμμένη, που μέχρι σήμερα δεν εκτελούσε κανείς.
 *
 * 🔑 ΤΡΙΑ ΠΡΑΓΜΑΤΑ ΠΟΥ **ΔΕΝ** ΓΡΑΦΤΗΚΑΝ, ΚΑΙ ΓΙ' ΑΥΤΟ ΕΙΝΑΙ ΣΩΣΤΟ:
 *   1. **Καμία νέα μηχανή ratchet.** Καταναλώνει το `runSetRatchetCli` (ADR-749/770), το ίδιο
 *      που κινεί τα CHECK 3.39/3.40/3.42/3.44.
 *   2. **Καμία χειρόγραφη λίστα «σπιτιών» ADR.** Τα σπίτια **παράγονται** από τη μέτρηση και
 *      κρίνονται ως **δηλώσεις** — δες παρακάτω γιατί αυτό δεν είναι διακόσμηση.
 *   3. **Κανένας κανόνας «αδέσποτης αναφοράς».** Μετρήθηκε: **68** υποψήφιοι, από τους οποίους
 *      η μεγάλη πλειονότητα είναι ψευδώς θετικοί (δεύτερο σπίτι `adrs/`, `archived/`, fixtures
 *      `ADR-900/901`, και **μελλοντικοί** αριθμοί που το ίδιο το `CLAUDE.md` δεσμεύει —
 *      `ADR-777`, `ADR-779`). Πολύ πάνω από τον πήχη <10% ψευδώς θετικών για **μπλοκάρουσα**
 *      πύλη ⇒ **δηλώνεται ως ανοιχτό**, δεν γράφεται μισό.
 *
 * 🔴 ΓΙΑΤΙ ΟΙ **ΔΗΛΩΣΕΙΣ** ΕΙΝΑΙ ΤΑ ΣΠΙΤΙΑ — και όχι κενό σύνολο για να «γεμίσει το σχήμα»:
 * Το κλειστό σύνολο δηλώσεων υπάρχει για να μπλοκάρει **δομικά επικίνδυνες προσθήκες, ακόμα κι
 * αν σήμερα περνούν**. Εδώ η δομικά επικίνδυνη προσθήκη είναι **νέο σπίτι ADR**: μόλις τα
 * έγγραφα ζήσουν σε δεύτερο φάκελο, ο χώρος αριθμών **διχάζεται** και οι συγκρούσεις γίνονται
 * αναπόφευκτες χωρίς κανείς να κάνει λάθος. Μετρημένο ότι δεν είναι υποθετικό: **η πλειονότητα**
 * των 60 είναι `collided-cross-home`. Ένα κενό `declarations: []` θα ήταν φρουρός που **δεν
 * μπορεί να πυροδοτήσει** — προσθήκη στους 606 αδρανείς του ADR-749 §5.
 *
 * ⚠️ ΤΟ ΠΛΗΘΟΣ ΔΕΝ ΕΙΝΑΙ ΔΕΙΚΤΗΣ ΥΓΕΙΑΣ. Η θεραπεία των `collided-cross-home` **δεν** είναι
 * μετονομασία αλλά **ένα σπίτι**· των `collided-same-home` είναι bumping. Δύο διαφορετικές
 * δουλειές — γι' αυτό δύο καταστάσεις και όχι μία. **Άνοιξε τη baseline πριν επικαλεστείς αριθμό.**
 *
 * ⚠️ ΜΗΝ το κάνεις zero-tolerance: δοκιμάστηκε, **60** υπάρχουσες ⇒ μονίμως κόκκινο, δηλαδή
 * πύλη που ο πρώτος βιαστικός θα παρακάμψει με `SKIP_`. ⚠️ ΜΗΝ μετονομάσεις ADR που **αναφέρεται**
 * χωρίς να διορθώσεις τις αναφορές: η ίδια η έρευνα λέει «never renumber» ακριβώς γι' αυτό.
 *
 * ΚΟΣΤΟΣ: ~0,5s (ένα `git ls-files -z` + string ops). Layer 1 τρέχει **μόνο** όταν είναι staged
 * αρχείο με βασικό όνομα `ADR-*` — που είναι **ακριβώς** η μόνη στιγμή που γεννιέται σύγκρουση.
 *
 * CLI:
 *   node scripts/check-adr-identity.js                  # έλεγχος
 *   node scripts/check-adr-identity.js --report         # αναφορά
 *   node scripts/check-adr-identity.js --write-baseline # reseed μετά από νόμιμο καθάρισμα
 *
 * Env: SKIP_ADR_IDENTITY=1 · ADR_IDENTITY_BASELINE_FILE
 */

'use strict';

const path = require('path');
const { PROJECT_ROOT, runSetRatchetCli } = require('./lib/ratchet-baseline');
const { scanAdrIdentity, violationId } = require('./lib/adr-identity/scan');

const ADR = 'CHECK 3.49';

function baselineFile() {
  return process.env.ADR_IDENTITY_BASELINE_FILE
    || path.join(PROJECT_ROOT, '.adr-identity-baseline.json');
}

function measure() {
  return scanAdrIdentity(process.env.ADR_IDENTITY_CWD || PROJECT_ROOT);
}

function buildPayload(m) {
  return {
    description:
      'CHECK 3.49 (ADR-779) — ταυτότητα ADR. `violations` = ΕΝΑ αναγνωριστικό ανά ΑΡΧΕΙΟ που '
      + 'μοιράζεται τον αριθμό του· `declarations` = τα ΣΠΙΤΙΑ ADR (νέο σπίτι διχάζει τον χώρο '
      + 'αριθμών και μπλοκάρει, ακόμα κι αν σήμερα δεν συγκρούεται τίποτα). '
      + 'ΤΟ ΠΛΗΘΟΣ ΔΕΝ ΕΙΝΑΙ ΔΕΙΚΤΗΣ ΥΓΕΙΑΣ — δες την κεφαλίδα του scripts/check-adr-identity.js.',
    adr: 'ADR-779',
    check: ADR,
    documents: m.documents,
    numbers: m.numbers,
    by_state: m.counts,
    violation_count: m.violationIds.length,
    declaration_count: m.declarations.length,
    violations: m.violationIds,
    declarations: m.declarations,
  };
}

function printReport(m) {
  console.log(`${ADR} / ADR-779 — ταυτότητα ADR: απαντά ο αριθμός σε ΕΝΑ έγγραφο;\n`);
  console.log(`  αυθεντία: git ls-files (το index — ό,τι θα περιέχει το commit)`);
  console.log(`  έγγραφα ADR: ${m.documents}   ·   μοναδικοί αριθμοί: ${m.numbers}\n`);

  console.log('  ΤΟ ΚΑΘΟΛΙΚΟ — κάθε έγγραφο σε ΕΝΑΝ κάδο, χωρίς υπόλοιπο');
  console.log(`    ${String(m.counts.unique).padStart(5)}  unique               ο αριθμός απαντά σε ένα έγγραφο`);
  console.log(`    ${String(m.counts['collided-same-home']).padStart(5)}  collided-same-home   αγώνας δρόμου δύο συντακτών ⇒ θεραπεία: bumping`);
  console.log(`    ${String(m.counts['collided-cross-home']).padStart(5)}  collided-cross-home  ο χώρος αριθμών διχάστηκε ⇒ θεραπεία: ΕΝΑ σπίτι`);
  console.log(`    ${'─'.repeat(5)}`);
  console.log(`    ${String(m.documents).padStart(5)}  ΣΥΝΟΛΟ (κλείνει: ${m.balanced ? 'ΝΑΙ' : 'ΟΧΙ'})\n`);

  console.log(`  ΣΠΙΤΙΑ ADR (${m.homes.length}) — κλειστό σύνολο· νέο σπίτι μπλοκάρει`);
  for (const h of m.homes) console.log(`    · ${h}`);

  console.log('\n  ΣΥΓΚΡΟΥΣΕΙΣ ΑΝΑ ΑΡΙΘΜΟ');
  let current = null;
  for (const v of m.violations) {
    if (v.number !== current) {
      current = v.number;
      console.log(`\n    ADR-${String(v.number).padStart(3, '0')}  [${v.state}]`);
    }
    console.log(`       ${v.file}`);
  }
}

const DESCRIPTOR = {
  adr: ADR,
  skipEnv: 'SKIP_ADR_IDENTITY',
  get baselineFile() { return baselineFile(); },
  measure,
  buildPayload,
  printReport,
  violationId: (v) => violationId(v),
  labels: { violations: 'έγγραφα σε σύγκρουση', declarations: 'σπίτια ADR' },
  messages: {
    worse: 'η ταυτότητα ενός αριθμού ADR έπαψε να είναι μονοσήμαντη',
    newDeclLabel: 'ΝΕΟ ΣΠΙΤΙ ADR',
    newDeclAdvice: [
      'Δεύτερος φάκελος με έγγραφα ADR **διχάζει τον χώρο αριθμών**: από κει και πέρα δύο',
      'συντάκτες μπορούν να πάρουν τον ίδιο αριθμό χωρίς κανείς να κάνει λάθος.',
      'Μετρήθηκε ότι δεν είναι υποθετικό — η πλειονότητα των υπαρχουσών συγκρούσεων είναι',
      'ακριβώς αυτό (`collided-cross-home`).',
      'Αν το νέο σπίτι είναι σκόπιμο, κλείδωσέ το ρητά: npm run adr-identity:baseline',
    ],
  },
  commands: {
    report: 'npm run adr-identity:report',
    baseline: 'npm run adr-identity:baseline',
    seed: 'node scripts/check-adr-identity.js --write-baseline',
  },
};

const main = (argv = process.argv) => runSetRatchetCli(DESCRIPTOR, argv);

if (require.main === module) {
  main().catch((e) => {
    console.error(`❌ ${ADR} — απρόσμενο σφάλμα: ${e.message}`);
    process.exit(1);
  });
}

module.exports = { measure, buildPayload, printReport, baselineFile, main, DESCRIPTOR };
