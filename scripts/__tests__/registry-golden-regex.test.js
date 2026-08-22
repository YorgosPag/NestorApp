/**
 * =============================================================================
 * Registry Golden Regex Tests (ADR-749 · ADR-294 · ADR-314)
 * =============================================================================
 *
 * Google-style «δοκίμασε το ίδιο το εργαλείο επιβολής».
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΙ ΑΛΛΑΞΕ ΣΤΙΣ 2026-08-03 ΚΑΙ ΓΙΑΤΙ (ADR-749)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Αυτό το αρχείο επικύρωνε τα patterns με **`grep -E`** (POSIX ERE), με το
 * σκεπτικό ότι το ERE είναι «η στενότερη μηχανή» και άρα ασφαλής τομή.
 *
 * Το σκεπτικό ήταν **μισό**. Προστάτευε από κατασκευές JS-only (`(?:...)`),
 * αλλά **όχι** από κατασκευές ERE-only. Και το `[[:space:]]` είναι ακριβώς
 * αυτό: **έγκυρο ERE**, άρα περνούσε αυτό το test — και **νεκρό σε JS**, όπου
 * σημαίνει «κλάση χαρακτήρων `[ : s p a c e` και μετά literal `]`».
 *
 * Αποτέλεσμα, μετρημένο: **6 patterns σε 5 modules ήταν πράσινα σε 44 tests
 * και έπιαναν ΜΗΔΕΝ στην πύλη.** Το `tabs-primitive` έχανε **22** πραγματικές
 * παραβιάσεις· το `agent-capability-registry` **80** γραμμές.
 *
 * 🔑 **Ένα test σε μηχανή που κανείς δεν εκτελεί δεν είναι test.**
 * Ο μόνος καταναλωτής του ERE ήταν το `ssot-audit.sh`, που **διαγράφηκε**
 * (ADR-749). Πλέον υπάρχει **μία** διάλεκτος: JS RegExp — αυτή που τρέχει η
 * πύλη. Η επικύρωση γίνεται εδώ με τον **ίδιο** μεταγλωττιστή που χρησιμοποιεί
 * η πύλη: `lib/ssot/registry.compilePattern`.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΤΡΕΙΣ ΟΜΑΔΕΣ
 * ─────────────────────────────────────────────────────────────────────────────
 *   1. **Κλείδωμα διαλέκτου** — κάθε pattern μεταγλωττίζεται στη μηχανή της
 *      πύλης, και καμία ξένη κατασκευή δεν γίνεται δεκτή. Περιλαμβάνει
 *      αυτοέλεγχο του ίδιου του κλειδώματος (αν ο φρουρός δεν πιάνει τα
 *      γνωστά κακά δείγματα, δεν είναι φρουρός).
 *   2. **Σημασιολογική ορθότητα** — `shouldMatch` πρέπει να πυροδοτεί,
 *      `shouldSkip` όχι — εκτελεσμένο **ανά γραμμή**, ακριβώς όπως η πύλη.
 *   3. **Απόδειξη ζωής (ratchet)** — πόσα patterns δεν αποδεικνύεται ότι
 *      μπορούν να πιάσουν οτιδήποτε. Μόνο μειώνεται.
 *
 * @see ADR-749 — SSoT violation engine unification
 */

'use strict';

const path = require('node:path');

const REGISTRY_PATH = path.resolve(__dirname, '..', '..', '.ssot-registry.json');
const REGISTRY = require(REGISTRY_PATH);

const {
  compilePattern,
  findForeignDialect,
  loadRegistry,
  FOREIGN_DIALECT_RULES,
} = require('../lib/ssot/registry');
const { PATTERN_PROOFS, provenPatternKeys, patternKey } = require('../lib/ssot/proofs');

/** Τα `_comment_*` κλειδιά δεν έχουν forbiddenPatterns. */
const REAL_MODULES = Object.entries(REGISTRY.modules).filter(
  ([, m]) => m && typeof m === 'object' && Array.isArray(m.forbiddenPatterns)
);

// =============================================================================
// Ομάδα 1 — Κλείδωμα διαλέκτου (και τα 671 patterns, στη μηχανή της πύλης)
// =============================================================================
describe('Κλείδωμα διαλέκτου: κάθε pattern μεταγλωττίζεται στη μηχανή ΤΗΣ ΠΥΛΗΣ', () => {
  it('κανένα forbiddenPattern δεν χρησιμοποιεί ξένη διάλεκτο', () => {
    const offenders = [];
    for (const [name, m] of REAL_MODULES) {
      m.forbiddenPatterns.forEach((p, i) => {
        const foreign = findForeignDialect(p);
        if (foreign.length > 0) {
          offenders.push(`  [${name}][${i}] ${p}\n      ${foreign.map(f => `${f.id}: ${f.hint}`).join('\n      ')}`);
        }
      });
    }
    if (offenders.length > 0) {
      throw new Error(
        'Patterns εκτός ECMAScript στο .ssot-registry.json.\n' +
        'Είναι συντακτικά «έγκυρα» αλλού και ΝΕΚΡΑ στην πύλη — δηλαδή φρουροί που δεν φυλάνε:\n' +
        offenders.join('\n')
      );
    }
  });

  it('κάθε forbiddenPattern μεταγλωττίζεται χωρίς εξαίρεση', () => {
    const broken = [];
    for (const [name, m] of REAL_MODULES) {
      m.forbiddenPatterns.forEach((p, i) => {
        try {
          compilePattern(name, i, p);
        } catch (err) {
          broken.push(`  ${err.message}`);
        }
      });
    }
    expect(broken).toEqual([]);
  });

  it('το exemptPatterns μεταγλωττίζεται και δεν έχει ξένη διάλεκτο', () => {
    expect(findForeignDialect(REGISTRY.exemptPatterns)).toEqual([]);
    expect(() => new RegExp(REGISTRY.exemptPatterns)).not.toThrow();
  });

  // ── Αυτοέλεγχος του φρουρού ────────────────────────────────────────────────
  // Χωρίς αυτό, ένα κλείδωμα που δεν πιάνει τίποτα θα ήταν μονίμως πράσινο —
  // δηλαδή ακριβώς το σφάλμα που το κλείδωμα υπάρχει για να αποτρέψει.
  describe('αυτοέλεγχος: το ίδιο το κλείδωμα πιάνει τα γνωστά κακά δείγματα', () => {
    const KNOWN_BAD = [
      ['posix-bracket-class', 'type:[[:space:]]*\'function\''],
      ['gnu-word-boundary', '\\<useState\\>'],
      ['inline-flags', '(?i)someCall\\('],
      ['atomic-group', '(?>foo|bar)baz'],
      ['pcre-keep', 'prefix\\Ksuffix'],
      ['python-named-group', '(?P<name>\\w+)'],
    ];

    it.each(KNOWN_BAD)('πιάνει %s', (ruleId, sample) => {
      const found = findForeignDialect(sample).map(f => f.id);
      expect(found).toContain(ruleId);
    });

    it('κάθε κανόνας διαλέκτου καλύπτεται από δείγμα', () => {
      const covered = new Set(KNOWN_BAD.map(([id]) => id));
      const declared = FOREIGN_DIALECT_RULES.map(r => r.id);
      expect(declared.filter(id => !covered.has(id))).toEqual([]);
    });

    it('δεν πιάνει έγκυρα ECMAScript patterns (χωρίς ψευδώς θετικά)', () => {
      const GOOD = [
        'addDoc\\(',
        'e\\.key\\s*===\\s*[\'"]Escape[\'"]',
        'BIM_TO_ATOE_MAPPING(?![^\'"]*BimToBoqBridge)',
        'objectStyles\\[[\'"](?:wall|column)[\'"]\\]\\?\\.visible',
        '^\\s*ResponsiveContainer,?\\s*$',
        '(?<=prefix)value',
      ];
      for (const g of GOOD) expect(findForeignDialect(g)).toEqual([]);
    });
  });

  // ===========================================================================
  // 🔴 ADR-751 — ΧΑΡΑΚΤΗΡΕΣ ΕΛΕΓΧΟΥ: το `\b` που ΔΕΝ είναι όριο λέξης
  // ===========================================================================
  //
  // ── ΤΟ ΜΕΤΡΗΜΕΝΟ ΕΛΑΤΤΩΜΑ ΠΟΥ ΚΛΕΙΝΕΙ (2026-08-04) ──
  //
  // Το `"...\b"` μέσα σε JSON **δεν** είναι το regex `\b`: ο αναλυτής JSON το διαβάζει ως
  // BACKSPACE (U+0008), οπότε το pattern γίνεται `function\s+edgeAutoPanVelocity␈` και **δεν
  // πιάνει τίποτα, ποτέ**. Βρέθηκαν **21 patterns σε 3 modules** (`topo-point-elevation`,
  // `table-selection-range` με 14, `drag-edge-autopan` με 6) — δηλαδή τρία modules που
  // φαίνονταν ζωντανά στο μητρώο και **δεν επέβαλλαν απολύτως τίποτα**.
  //
  // Είναι η **ίδια οικογένεια** με το «0 = κανείς δεν κοίταξε» του N.11/N.12, αλλά πιο
  // ύπουλη: εκεί ο αριθμός είναι μηδέν και φαίνεται· εδώ το μητρώο δείχνει 14 φρουρούς.
  //
  // ⚠️ Ο έλεγχος είναι σε **ΟΛΑ** τα patterns, όχι στο δείγμα των αποδείξεων: η αστοχία
  // είναι τυπογραφική, άρα μπορεί να μπει σε οποιοδήποτε module — και μπήκε σε τρία μέσα σε
  // μία εβδομάδα. Η γραφή που θέλει το μητρώο είναι `\\b` (δύο χαρακτήρες στο JSON).
  describe('Χαρακτήρες ελέγχου — το `\\b` που έγινε BACKSPACE', () => {
    // Γραμμένο με **escapes** επίτηδες: ένας ωμός χαρακτήρας ελέγχου μέσα στο ίδιο το αρχείο
    // του φρουρού θα ήταν αόρατος σε κάθε ανάγνωση — δηλαδή το ίδιο ακριβώς σφάλμα, μία
    // στρώση πιο μέσα. (Συνέβη γράφοντας αυτό ακριβώς το test· γι' αυτό καταγράφεται εδώ.)
    const CONTROL_CHAR = new RegExp('[\\u0000-\\u001F]');

    it('κανένα forbiddenPattern δεν περιέχει χαρακτήρα ελέγχου', () => {
      const offenders = [];
      for (const [name, mod] of REAL_MODULES) {
        (mod.forbiddenPatterns || []).forEach((p, i) => {
          if (CONTROL_CHAR.test(p)) {
            offenders.push(`${name}#${i}: ${JSON.stringify(p)}`);
          }
        });
      }
      expect(offenders).toEqual([]);
    });
  });
});

// =============================================================================
// Ομάδα 2 — Σημασιολογική ορθότητα (δείγμα modules × patterns)
// =============================================================================
describe('Golden fixtures — σημασιολογία, εκτελεσμένη ΑΝΑ ΓΡΑΜΜΗ όπως η πύλη', () => {
  const { modules } = loadRegistry(REGISTRY_PATH);
  const byName = new Map(modules.map(m => [m.name, m]));

  for (const moduleName of Object.keys(PATTERN_PROOFS)) {
    const mod = byName.get(moduleName);
    if (!mod) {
      it(`[${moduleName}] λείπει από το μητρώο`, () => {
        throw new Error(`Το ${moduleName} έχει απόδειξη αλλά δεν υπάρχει στο .ssot-registry.json`);
      });
      continue;
    }

    describe(moduleName, () => {
      const proof = PATTERN_PROOFS[moduleName];

      mod.patterns.forEach((pattern, i) => {
        // ⚠️ ΑΝΑ ΓΡΑΜΜΗ, χωρίς σημαία `m`. Η πύλη τρέχει `re.test(line)` σε κάθε
        // γραμμή χωριστά· η παλιά εκδοχή έτρεχε `re.test(ολόκληρο κείμενο)` με
        // `m`. Για patterns με `^`/`$` αυτά ΔΕΝ είναι ισοδύναμα, και η δοκιμή
        // πρέπει να μιμείται την παραγωγή, όχι το αντίστροφο.
        it(`pattern[${i}] πυροδοτεί στο shouldMatch`, () => {
          const hit = proof.shouldMatch.split('\n').some(line => pattern.re.test(line));
          if (!hit) {
            throw new Error(
              `το pattern[${i}] δεν πιάνει καμία γραμμή του shouldMatch\n` +
              `  pattern: ${pattern.source}\n  fixture:\n${proof.shouldMatch}`
            );
          }
        });

        it(`pattern[${i}] ΔΕΝ πυροδοτεί στο shouldSkip`, () => {
          const falsePositives = proof.shouldSkip
            .split('\n')
            .filter(line => pattern.re.test(line));
          if (falsePositives.length > 0) {
            throw new Error(
              `το pattern[${i}] πιάνει λάθος γραμμές του shouldSkip\n` +
              `  pattern: ${pattern.source}\n  γραμμές: ${JSON.stringify(falsePositives)}`
            );
          }
        });
      });
    });
  }
});

// =============================================================================
// Ομάδα 3 — Κάλυψη + ratchet απόδειξης ζωής
// =============================================================================
describe('Κάλυψη αποδείξεων', () => {
  const { modules } = loadRegistry(REGISTRY_PATH);

  it('τα modules με απόδειξη καλύπτουν ≥2 αρχιτεκτονικές βαθμίδες', () => {
    const tiers = new Set();
    for (const name of Object.keys(PATTERN_PROOFS)) {
      const m = REGISTRY.modules[name];
      if (m) tiers.add(m.tier ?? 'core');
    }
    expect(tiers.size).toBeGreaterThanOrEqual(2);
  });

  it('κάθε απόδειξη έχει μη κενά shouldMatch και shouldSkip', () => {
    const bad = Object.entries(PATTERN_PROOFS).filter(
      ([, f]) =>
        typeof f.shouldMatch !== 'string' || typeof f.shouldSkip !== 'string' ||
        f.shouldMatch.length === 0 || f.shouldSkip.length === 0
    );
    expect(bad.map(([n]) => n)).toEqual([]);
  });

  /**
   * 🔒 RATCHET — ΜΟΝΟ ΜΕΙΩΝΕΤΑΙ.
   *
   * Πόσα patterns δεν έχουν **καμία απόδειξη** ότι μπορούν να πιάσουν κάτι;
   * Χωρίς απόδειξη, «0 ευρήματα στο src/» είναι διφορούμενο: ή ο φρουρός
   * είναι καθαρός, ή είναι νεκρός. Τα τέσσερα ιστορικά περιστατικά (6 POSIX ·
   * 3 xlineMode · jobs-visibility `type` αντί `interface` · v3.0 `(?:...)`)
   * ήταν όλα σε αυτή την κατηγορία.
   *
   * ⚠️ ΑΥΤΟΣ Ο ΑΡΙΘΜΟΣ ΔΕΝ ΑΝΕΒΑΙΝΕΙ. Νέο module ⇒ φέρνει την απόδειξή του
   * στο `lib/ssot/pattern-proofs.js`, στην ίδια δέσμευση. Αν πρέπει να ανέβει,
   * ο λόγος γράφεται στο changelog του ADR-749 — όχι εδώ σιωπηλά.
   */
  /**
   * ⚠️ ΤΙ ΜΕΤΡΑΕΙ ΑΚΡΙΒΩΣ: patterns χωρίς **δηλωμένη** απόδειξη. Ένα pattern
   * που πυροδοτεί σε πραγματικό κώδικα είναι κι αυτό αποδεδειγμένα ζωντανό —
   * αλλά αυτό απαιτεί πλήρη σάρωση (~22s) και αυτό το test τρέχει σε
   * pre-commit. Την **τομή** (ούτε δήλωση ούτε ευρήματα) — που είναι το
   * κοφτερό σήμα — τη δίνει το `npm run ssot:audit -- --dormant`.
   */
  // 2026-08-04 (ADR-749 §6): 622 → 615, όταν τα `bim-to-boq-bridge` και
  // `xline-mode-store` ξαναγράφτηκαν και **έφεραν την απόδειξή τους μαζί**.
  // 2026-08-05 (ADR-739 §48): 615 → 603. Το `table-formula-engine` απέκτησε **13ο** pattern
  // (φρουρός εισαγωγής του `@formulajs/formulajs`) και **ταυτόχρονα** την απόδειξη και για τα
  // δεκατρία. Καθαρό −12: +1 pattern, −13 χωρίς απόδειξη. Ο κανόνας που το επέβαλε είναι ο
  // ίδιος που έγραψε αυτή τη γραμμή — νέο pattern **φέρνει την απόδειξή του μαζί**.
  // 2026-08-22 (ADR-789): 603 → 600. Το ταβάνι ήταν **ήδη σπασμένο** (604 στο `0cd00c02`,
  // 605 μόλις μπήκε το `browser-sha256` χωρίς απόδειξη) — δηλαδή αυτό το test ήταν κόκκινο
  // στο main. Το ADR-789 πρόσθεσε 2 patterns **με** την απόδειξή τους (καθαρό 0) και
  // ξεχρέωσε τρία: `browser-sha256`, `point-in-polygon-semantics`, `geometry`.
  const UNPROVEN_CEILING = 600;

  it(`τα patterns χωρίς δηλωμένη απόδειξη δεν ξεπερνούν τα ${UNPROVEN_CEILING}`, () => {
    const proven = provenPatternKeys(modules);
    const unproven = [];
    for (const mod of modules) {
      mod.patterns.forEach((_, i) => {
        if (!proven.has(patternKey(mod.name, i))) unproven.push(`${mod.name}[${i}]`);
      });
    }

    expect(unproven.length).toBeLessThanOrEqual(UNPROVEN_CEILING);

    if (unproven.length < UNPROVEN_CEILING) {
      console.log(
        `\n  🎯 RATCHET DOWN: patterns χωρίς απόδειξη ${UNPROVEN_CEILING} → ${unproven.length}.` +
        `\n     Κατέβασε το UNPROVEN_CEILING σε ${unproven.length}.\n`
      );
    }
  });

  it('κάθε module που ΕΧΕΙ απόδειξη την έχει για ΟΛΑ τα patterns του', () => {
    const proven = provenPatternKeys(modules);
    const gaps = [];
    for (const mod of modules) {
      if (!PATTERN_PROOFS[mod.name]) continue;
      mod.patterns.forEach((p, i) => {
        if (!proven.has(patternKey(mod.name, i))) gaps.push(`${mod.name}[${i}] ${p.source}`);
      });
    }
    expect(gaps).toEqual([]);
  });
});
