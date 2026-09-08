/**
 * @fileoverview **ΟΙ ΑΓΚΥΡΕΣ ΤΟΥ ΠΑΡΑΓΟΜΕΝΟΥ ΔΕΙΚΤΗ** — ADR-841 §7 Α21.14 · ADR-657 §3.3.
 * @related scripts/_shared/rules-location-map · scripts/check-firestore-rules-test-coverage ·
 *   scripts/check-storage-rules-test-coverage
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΙ ΦΥΛΑΕΙ, ΚΑΙ ΓΙΑΤΙ Η ΔΕΥΤΕΡΗ ΟΜΑΔΑ ΕΙΝΑΙ Η ΣΗΜΑΝΤΙΚΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η **Α** κρίνει τη μηχανή του δείκτη. Η **Β** κρίνει κάτι που καμία μηχανή δεν μπορεί:
 * ότι **δεν ξαναγεννιέται το `rulesRange`**.
 *
 * Και δεν είναι θεωρητικό. Το πεδίο έζησε **μήνες** σε δύο manifest επειδή έμοιαζε
 * χρήσιμο, ενώ:
 *
 * | πλευρά | μέτρηση | πότε |
 * |---|---|---|
 * | `firestore.rules` | **124 από 127 λάθος (98%)**, χειρότερη απόκλιση **1853** γραμμές | 2026-09-08 |
 * | `storage.rules` | **11 από 11 λάθος (100%)** | 2026-08-24 |
 *
 * 🔴 Και η **κεφαλίδα** του CHECK 3.19 υποσχόταν *«non-blocking `--verbose` warning σε
 * drift»* — **προειδοποίηση που δεν γράφτηκε ποτέ**. Δηλαδή το πεδίο δεν ήταν απλώς
 * ανεπικύρωτο: ήταν ανεπικύρωτο **δίπλα σε πρόταση που έλεγε ότι επικυρώνεται**.
 *
 * 🏆 Η αφαίρεση ακολουθεί την πρακτική των μεγάλων, όχι γούστο: το **PHPStan baseline**
 * γράφει ρητά *«No line numbers»* ως συνειδητή απόφαση, και το **ESLint bulk
 * suppressions** (v9.24+) αποθηκεύει `{αρχείο: {κανόνας: {count}}}` — **καμία γραμμή**.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { buildRulesLocationMap } = require('../_shared/rules-location-map');
const {
  parseFirestoreRules,
  findDuplicateMatchPaths,
} = require('../_shared/firestore-rules-parser');

const ROOT = path.resolve(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const FIRESTORE_MANIFEST = 'tests/firestore-rules/_registry/coverage-manifest.ts';
const STORAGE_MANIFEST = 'tests/storage-rules/_registry/coverage-manifest.ts';
const FIRESTORE_CHECKER = 'scripts/check-firestore-rules-test-coverage.js';
const STORAGE_CHECKER = 'scripts/check-storage-rules-test-coverage.js';

/** Ο κώδικας **χωρίς** σχόλια — η κρίση γίνεται σε ό,τι **εκτελείται**. */
function executable(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

// ===========================================================================

describe('🔴 Α — Η ΜΗΧΑΝΗ ΤΟΥ ΔΕΙΚΤΗ', () => {
  const blocks = [
    { identity: 'beta', lineStart: 40, lineEnd: 55 },
    { identity: 'alpha', lineStart: 10, lineEnd: 20 },
    { identity: 'orphan', lineStart: 80, lineEnd: 90 },
  ];

  it('🔑 ΣΕΙΡΑ ΑΡΧΕΙΟΥ, όχι αλφαβητική — ο άνθρωπος έχει το αρχείο ανοιχτό δίπλα', () => {
    const { lines } = buildRulesLocationMap(blocks, ['alpha', 'beta', 'orphan'], 'x.rules');

    expect(lines[0]).toContain('alpha');
    expect(lines[1]).toContain('beta');
    expect(lines[2]).toContain('orphan');
  });

  it('🔑 η θέση είναι ΚΛΙΚΑΡΙΣΙΜΗ: `αρχείο:αρχή-τέλος`', () => {
    const { lines } = buildRulesLocationMap(blocks, ['alpha'], 'firestore.rules');

    expect(lines[0]).toContain('firestore.rules:10-20');
  });

  it('🔴 ΛΕΕΙ ΚΑΙ ΤΙΣ ΔΥΟ ΚΑΤΕΥΘΥΝΣΕΙΣ — αυτό που ένα λάθος νούμερο ΔΕΝ μπορούσε', () => {
    // 🔑 Ένα μπαγιάτικο `rulesRange` έδειχνε σε **υπαρκτή** γραμμή λάθος μπλοκ: μοιάζει
    //    σωστό και είναι λάθος. Ο δείκτης εδώ ονομάζει χωριστά το «κανόνας χωρίς δήλωση»
    //    και το «δήλωση χωρίς κανόνα», που είναι **δύο** προβλήματα με δύο θεραπείες.
    const map = buildRulesLocationMap(blocks, ['alpha', 'beta', 'ghost'], 'x.rules');

    expect(map.orphanBlocks).toEqual(['orphan']);
    expect(map.danglingEntries).toEqual(['ghost']);
  });

  it('🔑 σημαδεύει οπτικά τον αδήλωτο κανόνα, χωρίς να τον κρύβει', () => {
    const { lines } = buildRulesLocationMap(blocks, ['alpha', 'beta'], 'x.rules');

    expect(lines.find((l) => l.includes('orphan'))).toMatch(/^\s+\?\s/);
    expect(lines.find((l) => l.includes('alpha'))).toMatch(/^\s+·\s/);
  });

  it('🔑 κενή είσοδος ΔΕΝ πετά — απαντά «τίποτα»', () => {
    expect(buildRulesLocationMap([], [], 'x.rules')).toEqual({
      lines: [],
      orphanBlocks: [],
      danglingEntries: [],
    });
  });
});

describe('🔴 Β — ΤΟ `rulesRange` ΕΦΥΓΕ, ΚΑΙ ΔΕΝ ΞΑΝΑΓΥΡΙΖΕΙ', () => {
  it('⛔ ΚΑΝΕΝΑ manifest δεν δηλώνει εύρος γραμμών', () => {
    // 🔴 **Η ΜΕΤΑΛΛΑΞΗ**: ξαναβάλε ένα `rulesRange: [1, 2]` σε οποιοδήποτε entry ⇒ κόκκινο.
    //    Χωρίς αυτή τη γραμμή, το πεδίο επιστρέφει με το πρώτο copy-paste από παλιό entry
    //    — και ξαναρχίζει το 98%.
    for (const manifest of [FIRESTORE_MANIFEST, STORAGE_MANIFEST]) {
      expect(executable(read(manifest))).not.toMatch(/rulesRange/);
    }
  });

  it('⛔ ΚΑΜΙΑ πύλη δεν διαβάζει εύρος γραμμών από manifest', () => {
    for (const checker of [FIRESTORE_CHECKER, STORAGE_CHECKER]) {
      expect(executable(read(checker))).not.toMatch(/rulesRange/);
    }
  });

  it('🔑 και το «μην το ξαναβάλεις» είναι ΓΡΑΜΜΕΝΟ εκεί που θα το δει ο επόμενος', () => {
    // ⚠️ Ένα σβησμένο πεδίο χωρίς εξήγηση είναι **παράλειψη** για τον επόμενο αναγνώστη·
    //    με εξήγηση είναι **απόφαση**. Δες N.0.2 / «δηλωμένο κενό, όχι παράλειψη».
    for (const manifest of [FIRESTORE_MANIFEST, STORAGE_MANIFEST]) {
      expect(read(manifest)).toContain('ΜΗΝ ΤΟ ΞΑΝΑΒΑΛΕΙΣ');
    }
  });

  it('🔴 Η ΨΕΥΔΗΣ ΥΠΟΣΧΕΣΗ ΤΟΥ CHECK 3.19 ΕΙΝΑΙ ΠΛΕΟΝ ΟΝΟΜΑΣΜΕΝΗ ΩΣ ΨΕΥΔΗΣ', () => {
    // 🔴 Η κεφαλίδα έγραφε «a non-blocking `--verbose` warning is emitted if a range no
    //    longer contains its block's parsed start line» — και **καμία τέτοια γραμμή δεν
    //    υπήρχε στον κώδικα**. Ίδια κλάση με το ψευδές σχόλιο που έλυσε η Α21.11.
    //
    // ⚠️ **Η ΠΡΩΤΗ ΓΡΑΦΗ ΑΥΤΗΣ ΤΗΣ ΑΓΚΥΡΑΣ ΗΤΑΝ ΛΑΘΟΣ**, και το έδειξε η εκτέλεση: ζητούσε
    //    να **λείπει** η φράση, ενώ η νέα κεφαλίδα την **παραθέτει επίτηδες** για να
    //    διδάξει το μάθημα. Σβήνοντας το αντιπαράδειγμα θα το έχανε ο επόμενος — ίδια
    //    απόφαση με το `showcase-mark-view.test`. ⇒ Η άγκυρα ρωτά αν η παράθεση είναι
    //    **χαρακτηρισμένη**, όχι αν λείπει.
    const header = read(STORAGE_CHECKER);

    expect(header).toContain('The warning was never written.');
    expect(header).toContain('`rulesRange` IS GONE');
  });
});

describe('🔴 Γ — Η ΤΑΥΤΟΤΗΤΑ ΕΙΝΑΙ ΕΓΚΥΡΟ ΚΛΕΙΔΙ (ADR-657 §3.3)', () => {
  /**
   * 🔴 **ΤΟ ΕΥΡΗΜΑ ΠΟΥ ΓΕΝΝΗΣΕ Η ΙΔΙΑ Η ΕΡΩΤΗΣΗ** *(ADR-841 §7 Α21.14.8)*.
   *
   * Η πρώτη γραφή ρωτούσε *«είναι κάθε `match /<collection>/` μοναδικό;»* και **κοκκίνισε**:
   * **5** ονόματα εμφανίζονταν δύο φορές. Δύο από αυτά ήταν **υποσυλλογές**
   * *(`/rfqs/{id}/lines/{lineId}`)*, δηλαδή **40% ψευδώς θετικά** — η ερώτηση έπρεπε να
   * γίνει στη **διαδρομή**, όχι στη συλλογή.
   *
   * 🔴 **Και τα υπόλοιπα ΤΡΙΑ ήταν αληθινά.** Στους κανόνες του Firestore το `allow` είναι
   * η **ΕΝΩΣΗ** όλων των μπλοκ που ταιριάζουν ⇒ το **χαλαρότερο νικά**. Μετρημένο στο
   * `leads`: το δεύτερο μπλοκ *(PR-1D)* προσθέτει `resource == null` στο `create`,
   * `resource != null` σε `update`/`delete` και **αφαιρεί** το `assignedTo` — δηλαδή ήταν
   * **αυστηροποίηση που δεν ίσχυσε ποτέ**, γιατί το πρώτο *(PR-1B)* τα επέτρεπε ήδη.
   *
   * ✅ **ΔΙΟΡΘΩΘΗΚΕ 2026-09-08** *(Α21.14.8, ίδιο ADR)*: ένωση σε **ΕΝΑ** μπλοκ ανά
   * διαδρομή, με το `assignedTo` του PR-1B **και** τους φρουρούς του PR-1D. Και επειδή
   * ο μετρητής είναι πλέον **0**, η ερώτηση έγινε **φραγμός** στο CHECK 3.16
   * *(`validateNoDuplicateMatchPaths`, Validation F)* — όπως ακριβώς προβλεπόταν: η
   * μετατροπή σε zero-tol είναι η **τελευταία** πράξη, όχι η πρώτη.
   */
  // ✅ **ΕΚΛΕΙΣΕ 2026-09-08 (Α21.14.8) — Ο ΜΕΤΡΗΤΗΣ ΕΙΝΑΙ ΜΗΔΕΝ.** Και τα τρία ενώθηκαν
  //    σε **ΕΝΑ** μπλοκ το καθένα, με τους κοινούς όρους σε βοηθούς `crm*()`. Δεν
  //    σβήστηκε το ένα μπλοκ: κρατήθηκε το `assignedTo` του PR-1B **και** οι φρουροί
  //    του PR-1D, γιατί το καθένα είχε δίκιο σε **δικό του άξονα**.
  //
  // 📊 Η ένωση ΜΕΤΡΗΘΗΚΕ, δεν εκτιμήθηκε: 756 μετρήσεις (3 συλλογές × 7 πρόσωπα ×
  //    10 σχήματα εγγράφου × 3 πράξεις, + create/list/ghost), **10 διαφορές**, ΟΛΕΣ
  //    ALLOW→DENY. Επτά έκλεισαν **εγγραφή πάνω από το σύνορο του tenant** (ο έλεγχος
  //    υπήρχε στο `read`, έλειπε από `update`/`delete`)· τρεις είναι ο φρουρός
  //    `resource != null` που επιτέλους δαγκώνει σε διαγραφή **ανύπαρκτου** εγγράφου.
  //
  // ⛔ Η ΠΥΛΗ ΕΙΝΑΙ ΠΛΕΟΝ ΦΡΑΓΜΟΣ: `validateNoDuplicateMatchPaths()` (CHECK 3.16,
  //    Validation F). Άρα εδώ η ερώτηση γίνεται **ισότητα με το μηδέν** — το ratchet
  //    δεν έχει πια τι να ανεχθεί.
  const KNOWN_DUPLICATE_PATHS = [];

  it('⛔ ZERO-TOL: ΚΑΜΙΑ διπλή διαδρομή — το allow είναι η ΕΝΩΣΗ των μπλοκ', () => {
    const duplicates = findDuplicateMatchPaths(parseFirestoreRules(read('firestore.rules')));

    expect(duplicates).toEqual(KNOWN_DUPLICATE_PATHS);
  });

  it('🔑 η ΔΙΑΔΡΟΜΗ είναι το σωστό κλειδί — η συλλογή δίνει ψευδώς θετικά στις υποσυλλογές', () => {
    // 🔴 **Η ΜΕΤΑΛΛΑΞΗ**: γύρνα το `findDuplicateMatchPaths` να μετρά `collection` ⇒ οι
    //    υποσυλλογές `/rfqs/{id}/lines/{lineId}` και `/ownership_tables/{id}/revisions/{id}`
    //    εμφανίζονται ως διπλότυπα του γονέα τους, και η γραμμή κοκκινίζει.
    const blocks = parseFirestoreRules(read('firestore.rules'));
    const byCollection = new Set(
      blocks.map((b) => b.collection).filter((c, i, all) => all.indexOf(c) !== i),
    );

    expect(findDuplicateMatchPaths(blocks).length).toBeLessThan(byCollection.size);
    expect(blocks.every((b) => b.matchPath.startsWith(`/${b.collection}`))).toBe(true);
  });

  it('🏆 ο δείκτης ΤΡΕΧΕΙ πάνω στο ΠΡΑΓΜΑΤΙΚΟ `firestore.rules` και δεν χάνει κανένα μπλοκ', () => {
    const blocks = parseFirestoreRules(read('firestore.rules'));
    const map = buildRulesLocationMap(
      blocks.map((b) => ({ identity: b.collection, lineStart: b.lineStart, lineEnd: b.lineEnd })),
      blocks.map((b) => b.collection),
      'firestore.rules',
    );

    expect(map.lines).toHaveLength(blocks.length);
    expect(map.orphanBlocks).toEqual([]);
    expect(map.danglingEntries).toEqual([]);
    // 🔑 Και κάθε γραμμή δείχνει σε **αύξουσα** θέση — η σειρά αρχείου δεν είναι ευχή.
    const starts = blocks.map((b) => b.lineStart);
    expect([...starts].sort((a, b) => a - b)).toEqual(starts);
  });
});
