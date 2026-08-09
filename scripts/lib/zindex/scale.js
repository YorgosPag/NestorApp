/**
 * Η **ΜΙΑ** κλίμακα z-index, διαβασμένη από την αυθεντία της — ποτέ αντιγραμμένη.
 *
 * 🔑 ΓΙΑΤΙ ΔΙΑΒΑΖΕΤΑΙ ΚΑΙ ΔΕΝ ΓΡΑΦΕΤΑΙ ΕΔΩ: το `design-tokens.json` είναι η πηγή που
 * παράγει **και** το CSS (`--z-index-*` στο `design-system/generated/variables.css`)
 * **και** το TS (`zIndexScale` στο `design-tokens/generated/tokens.ts`). Ένας πίνακας
 * ρόλων γραμμένος εδώ θα ήταν **τρίτο** πρόσωπο της ίδιας αλήθειας, δηλαδή ακριβώς το
 * σχήμα που η πύλη υπάρχει για να κυνηγά (ADR-749: 4 μηχανές, 5 διάλεκτοι, 3 αριθμοί).
 * Νέος ρόλος στο JSON ⇒ η πύλη τον δέχεται **δωρεάν**, χωρίς να την αγγίξει κανείς.
 *
 * 🔬 ΤΟ ΚΑΤΩΦΛΙ ΤΩΝ 1000 ΔΕΝ ΕΙΝΑΙ ΑΥΘΑΙΡΕΤΟ. Μετρήθηκε καθαρό στο δέντρο (τα
 * `z-index: 1/2/3/10/20/50/100` είναι **τοπική** στοίβαξη μέσα σε component, όχι
 * παραβίαση) **και** επιβεβαιώνεται ανεξάρτητα από τρεις κλίμακες της βιομηχανίας, που
 * όλες χωρίζουν στο ίδιο σημείο:
 *   Microsoft Atlas  active 1 · hover 2 · focus 3 · multi 4   →  dropdown **1000** … 1070
 *   Salt (JPMorgan)  default 1                                 →  appHeader **1000** … 1500
 *   Bootstrap        —                                          →  dropdown **1000** … 1090
 * Δηλαδή «κάτω από 1000 = μέσα σε component· από 1000 και πάνω = καθολικό στρώμα» είναι
 * σύμβαση που ισχύει και έξω από εδώ. Αν το κατέβαζες, ο θόρυβος ξεπερνά τον πήχη <10%
 * ψευδώς θετικών της Google για **μπλοκάρουσα** πύλη.
 *
 * @module scripts/lib/zindex/scale
 */

'use strict';

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');
const TOKENS_JSON = path.join(PROJECT_ROOT, 'design-tokens.json');

/** Κάτω από αυτό, ένας ωμός αριθμός είναι **τοπική** στοίβαξη και δεν κρίνεται. */
const GLOBAL_LAYER_FLOOR = 1000;

/** Το πρόθεμα που παράγει ο `build-design-tokens.js` για τη ρίζα `zIndex` του JSON. */
const CSS_VAR_PREFIX = '--z-index-';

/**
 * Λέξεις-κλειδιά του CSS που **δεν** είναι στρώση.
 * ⚠️ Το `auto` είναι σημασιολογικά το αντίθετο μιας στρώσης: λέει «**μη** δημιουργείς
 * stacking context». Αν το κρίναμε ως τιμή, θα ζητούσαμε token για μια δήλωση που
 * υπάρχει ακριβώς για να **μην** συμμετέχει στη σειρά.
 */
const KEYWORDS = new Set(['auto', 'inherit', 'initial', 'unset', 'revert', 'revert-layer']);

/** `viewerModal` → `viewer-modal`. Η ΙΔΙΑ πράξη με τον generator· δες τη σημείωση παρακάτω. */
function toKebabCase(str) {
  return str.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

/**
 * Το όνομα της custom property ενός ρόλου.
 *
 * ⚠️ ΑΝΤΙΓΡΑΦΕΙ ΤΗ ΓΡΑΜΜΑΤΙΚΗ ΤΟΥ GENERATOR, ΚΑΙ ΑΥΤΟ ΕΙΝΑΙ ΔΗΛΩΜΕΝΟ ΟΡΙΟ. Ο generator
 * (`scripts/build-design-tokens.js`) παράγει `--z-index-viewer-modal` από το κλειδί
 * `viewerModal`. Εδώ ξαναγράφεται ο **ίδιος** μετασχηματισμός — δηλαδή δύο υλοποιήσεις
 * μιας γραμματικής. Ο λόγος που δεν εισάγεται: ο generator είναι εκτελέσιμο script που
 * **γράφει αρχεία** στο `require`-time μονοπάτι του, και μια πύλη δεν επιτρέπεται να
 * γράφει. Το αντίβαρο είναι η κατάσταση `unknown-token`: αν οι δύο γραμματικές
 * αποκλίνουν, η πύλη **μπλοκάρει** αντί να σιωπήσει, γιατί το παραγόμενο όνομα δεν θα
 * βρεθεί στο `variables.css`. Άγκυρα: το test που συγκρίνει **κάθε** ρόλο με το
 * πραγματικό περιεχόμενο του `variables.css`.
 */
function cssVarNameOf(role) {
  return `${CSS_VAR_PREFIX}${toKebabCase(role)}`;
}

/**
 * Διαβάζει την κλίμακα. **Πετάει** αν λείπει ή είναι κενή — fail-closed: μια πύλη που
 * δεν βρήκε την αυθεντία της δεν επιτρέπεται να απαντήσει «καθαρό».
 */
function readScale(repoRoot = PROJECT_ROOT) {
  const file = path.join(repoRoot, 'design-tokens.json');
  const json = JSON.parse(fs.readFileSync(file, 'utf8'));
  const node = json.zIndex;
  if (!node || typeof node !== 'object') {
    throw new Error('design-tokens.json: λείπει η ρίζα "zIndex" — η κλίμακα δεν έχει αυθεντία');
  }

  const roles = [];
  for (const [key, token] of Object.entries(node)) {
    if (!token || typeof token !== 'object' || token.value === undefined) continue;
    const value = Number(token.value);
    if (!Number.isInteger(value)) {
      throw new Error(`design-tokens.json ▸ zIndex.${key}: "${token.value}" δεν είναι ακέραιος`);
    }
    roles.push({
      role: key,
      value,
      cssVar: cssVarNameOf(key),
      description: token.description || '',
      // Ρόλος **περιορισμένης χρήσης**: μόνο αρχεία κάτω από αυτά τα προθέματα επιτρέπεται
      // να τον ζητούν. Υπάρχει επειδή η κλίμακα απέκτησε σκαλιά που **δεν είναι στρώση
      // προϊόντος** (`devtoolsGuard` = άμυνα του dev overlay· `debugOverlay` = εργαλείο).
      // Χωρίς επιβολή, ο πρώτος που θα χρειαστεί «λίγο πιο πάνω» θα άρπαζε την κορυφή —
      // ακριβώς το «z-index arms race» που η κλίμακα υπάρχει για να σταματήσει.
      restrictedTo: Array.isArray(token.restrictedTo) && token.restrictedTo.length
        ? token.restrictedTo
        : null,
    });
  }
  if (roles.length === 0) {
    throw new Error('design-tokens.json ▸ zIndex: κανένας ρόλος — η κλίμακα είναι κενή');
  }
  return roles;
}

/**
 * ⛔ ΑΥΤΟΕΛΕΓΧΟΣ: η κλίμακα πρέπει να είναι **γνησίως αύξουσα** στη σειρά δήλωσης.
 *
 * 🔑 ΓΙΑΤΙ ΕΙΝΑΙ ΠΥΛΗ ΚΑΙ ΟΧΙ ΣΧΟΛΙΟ: η σειρά των κλειδιών στο JSON **είναι** το
 * ανθρώπινο νόημα («ποιο κάθεται πάνω από ποιο»). Αν κάποιος προσθέσει ρόλο στη λάθος
 * θέση, το αρχείο **διαβάζεται** σαν να λέει κάτι που ο αριθμός διαψεύδει — και κανένας
 * μεταγλωττιστής δεν έχει γνώμη για τη σειρά κλειδιών ενός JSON. Χωρίς αυτό, η κλίμακα
 * θα μπορούσε να γίνει η επόμενη «δεύτερη αλήθεια» **μέσα στον εαυτό της**.
 *
 * ⚠️ ΓΝΗΣΙΩΣ αύξουσα, όχι «μη φθίνουσα»: δύο ρόλοι με τον ίδιο αριθμό είναι δύο ονόματα
 * για ένα σκαλί, δηλαδή η σειρά τους αποφασίζεται από τη σειρά DOM — που είναι ακριβώς
 * η κατάσταση που η κλίμακα υπάρχει για να μην αφήνει στην τύχη.
 */
function findScaleDisorder(roles) {
  const problems = [];
  for (let i = 1; i < roles.length; i += 1) {
    const prev = roles[i - 1];
    const cur = roles[i];
    if (cur.value <= prev.value) {
      problems.push({
        role: cur.role,
        detail: `"${cur.role}" (${cur.value}) δεν είναι πάνω από "${prev.role}" (${prev.value}) `
          + 'ενώ δηλώνεται μετά από αυτόν — η σειρά του JSON είναι η σειρά στρώσης',
      });
    }
  }
  return problems;
}

/**
 * 🏆 Η **ΔΙΑΤΑΞΗ** ΤΗΣ ΚΛΙΜΑΚΑΣ ΩΣ ΤΑΥΤΟΤΗΤΑ — ΟΧΙ ΟΙ ΤΙΜΕΣ ΤΗΣ.
 *
 * ΤΟ ΘΕΩΡΗΜΑ: αν η απεικόνιση «παλιά τιμή → νέα τιμή» είναι **γνησίως αύξουσα**, τότε για
 * **κάθε** ζεύγος επιφανειών το πρόσημο του `z(a) − z(b)` μένει ίδιο ⇒ η σχετική διάταξη
 * διατηρείται **παντού**, και στα ζεύγη που κανείς δεν σκέφτηκε να κοιτάξει. Άρα μια
 * επαναρίθμηση της κλίμακας (π.χ. κορυφή 10400 → 1370) είναι **αποδεδειγμένα** μηδενικής
 * οπτικής αλλαγής, χωρίς να χρειάζεται καμία παρατήρηση.
 *
 * 🏆 ΠΟΥ ΞΕΠΕΡΝΑΜΕ ΤΟΥΣ ΜΕΓΑΛΟΥΣ (μετρημένο, ADR-780 §11.4): η Atlassian μεταναστεύει
 * tokens με codemod που «*only provides token suggestions, **manual review is required***»
 * και επικυρώνει με **visual regression** — δηλαδή **δείγμα** (ό,τι φωτογραφήθηκε) συν
 * **ανάθεση σε άνθρωπο**. Ένα screenshot δεν αποδεικνύει ποτέ τα ζεύγη που δεν βγήκαν στο
 * κάδρο. Εδώ η **ίδια η πύλη** είναι το όργανο της απόδειξης: μονότονη επαναρίθμηση ⇒
 * **καμία** εγγραφή δεν αλλάζει ⇒ πράσινο **χωρίς reseed**. Αναδιάταξη ⇒ μπλοκ.
 *
 * ⚠️ ΓΙΑΤΙ «ΠΑΝΩ ΑΠΟ ΤΟΝ ΑΜΕΣΩΣ ΠΡΟΗΓΟΥΜΕΝΟ» ΚΑΙ ΟΧΙ ΑΠΟΛΥΤΟ rank: ο συγκριτής του
 * ratchet είναι **συνόλου** (`compareSets`), άρα η θέση πρέπει να ζει **μέσα** στο string.
 * Με απόλυτο rank, η παρεμβολή **ενός** ρόλου στη μέση θα μετακινούσε τους πάντες από πάνω
 * και θα ανέφερε **N** αλλαγές για **μία** πράξη — θόρυβος που θα έσπρωχνε σε τυφλό reseed.
 * Με τον γείτονα, μια παρεμβολή αλλάζει **ακριβώς μία** εγγραφή και προσθέτει μία. Η σχέση
 * «αμέσως επόμενος» ορίζει **μονοσήμαντα** την ολική διάταξη, άρα δεν χάνεται πληροφορία.
 *
 * ⚠️ Η ΖΩΝΗ ΕΙΝΑΙ ΜΕΡΟΣ ΤΗΣ ΤΑΥΤΟΤΗΤΑΣ, ΚΑΙ ΔΕΝ ΕΙΝΑΙ ΔΙΑΚΟΣΜΗΣΗ. Η διάταξη μόνη της δεν
 * βλέπει το κατώφλι: ένα `dropdown` που θα κατέβαινε 1000 → 999 κρατά τη σειρά του, αλλά
 * περνά **κάτω** από το `GLOBAL_LAYER_FLOOR` — και τότε κάθε ωμή δήλωση της περιοχής του
 * αλλάζει σιωπηλά κατάσταση από `raw-literal` σε `local-stacking`, δηλαδή **η ίδια η πύλη
 * σταματά να ρωτά**. Χειρότερα: το `MODAL_Z_INDEX_THRESHOLD` (=50) του
 * `modal-presence-detect.ts` κρίνει «είναι modal;» **με αριθμό**, άρα μια συμπίεση κάτω από
 * αυτό θα έσπαγε την ανίχνευση modal χωρίς καμία δήλωση να φαίνεται λάθος.
 */
function orderIdentities(roles) {
  return roles.map((r, i) => {
    const below = i === 0 ? '—' : roles[i - 1].role;
    const zone = r.value >= GLOBAL_LAYER_FLOOR ? 'global' : 'local';
    return `${r.role}|πάνω-από:${below}|ζώνη:${zone}`;
  });
}

/** Ευρετήριο ρόλων κατά όνομα CSS μεταβλητής — η ερώτηση «υπάρχει αυτό το token;». */
function indexByCssVar(roles) {
  return new Map(roles.map((r) => [r.cssVar, r]));
}

/** Ευρετήριο ρόλων κατά τιμή — η ερώτηση «ποιος ρόλος έχει ήδη αυτόν τον αριθμό;». */
function indexByValue(roles) {
  const map = new Map();
  for (const r of roles) if (!map.has(r.value)) map.set(r.value, r);
  return map;
}

module.exports = {
  PROJECT_ROOT,
  TOKENS_JSON,
  GLOBAL_LAYER_FLOOR,
  CSS_VAR_PREFIX,
  KEYWORDS,
  toKebabCase,
  cssVarNameOf,
  readScale,
  findScaleDisorder,
  orderIdentities,
  indexByCssVar,
  indexByValue,
};
