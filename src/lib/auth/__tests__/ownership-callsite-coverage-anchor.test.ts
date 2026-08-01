/**
 * ⚓ ADR-742 §7terdecies.3 — **ο πίνακας κάλυψης δεν επιτρέπεται να ξεχάσει σημείο**
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΤΟ ΠΡΟΒΛΗΜΑ ΠΟΥ ΦΥΛΑΕΙ — ΓΙΑΤΙ ΔΕΝ ΑΡΚΟΥΝ ΟΙ ΣΟΥΙΤΕΣ
 * ─────────────────────────────────────────────────────────────────────────────
 * Οι σουίτες `ownership-empty-pair-*` οδηγούνται από **πίνακα**. Αν κάποιος
 * σβήσει μια γραμμή του πίνακα, το test **παύει να τρέχει** και όλα μένουν
 * πράσινα — *κατώφλι δεν πιάνει αφαίρεση* (ADR-742 μάθημα #7). Το ίδιο ισχύει
 * αν προστεθεί **νέο** σημείο κλήσης: κανείς δεν ρωτά «το κάλυψες;».
 *
 * Αυτός ο anchor κλείνει και τα δύο: σαρώνει το δέντρο για κλήσεις του SSoT και
 * απαιτεί **κάθε αρχείο** να έχει ρητή ταξινόμηση, **και** το αρχείο σουίτας
 * που επικαλείται η ταξινόμηση να **περιέχει όντως** τη διαδρομή. Η γραμμή που
 * σβήστηκε από τον πίνακα κοκκινίζει εδώ.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΙ **ΔΕΝ** ΒΛΕΠΕΙ (δηλωμένο — «πράσινο που κοίταξε το τίποτα»)
 * ─────────────────────────────────────────────────────────────────────────────
 * - **Την ποιότητα** του test της σουίτας. Ελέγχει ότι η διαδρομή αναφέρεται,
 *   όχι ότι το test είναι καλό. Την ποιότητα την κρίνει η **μετάλλαξη**, που
 *   τρέχει με το χέρι (`scripts` του ADR) και είναι καταγεγραμμένη στο §7terdecies.
 * - **Σημεία εκτός της περιμέτρου της Φάσης Γ.** Ο SSoT καλείται και από άλλες
 *   φάσεις (Α/Β/Δ) με **δικές τους** σουίτες. Μετρημένα και δηλωμένα στο
 *   {@link OUTSIDE_PHASE_C_PERIMETER} ώστε το πράσινο να μη διαβάζεται ως «όλα
 *   καλυμμένα από εμάς».
 * - **Κειμενικός** ο έλεγχος: κλήση γραμμένη με άλλο όνομα (alias import) δεν
 *   βρίσκεται. Το κόστος του εναλλακτικού (AST) δεν δικαιολογείται για ένα
 *   σύμβολο που κανείς δεν μετονομάζει· δηλώνεται ρητά αντί να αποσιωπηθεί.
 *
 * @module lib/auth/__tests__/ownership-callsite-coverage-anchor
 * @see adrs/ADR-742 §7terdecies
 */

import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, sep } from 'path';

const SRC_ROOT = join(process.cwd(), 'src');

/** Το σύμβολο του οποίου οι κλήσεις μετριούνται. */
const CALL_PATTERN = /isPayloadOwnedByCompany\s*\(/;

/**
 * Το ίδιο το module ορισμού: περιέχει την κλήση μέσα στους δικούς του
 * φύλακες, αλλά **δεν είναι** σημείο κλήσης πεδίου ορισμού.
 */
const DEFINITION_MODULE = 'lib/auth/tenant-ownership.ts';

// =============================================================================
// Η ταξινόμηση
// =============================================================================

type Classification =
  /**
   * Αποδεδειγμένο με **ζεύγος κενό/κενό**: μετάλλαξη του SSoT το κοκκινίζει.
   * Το `suite` **πρέπει** να αναφέρει τη διαδρομή — έτσι πιάνεται η αφαίρεση
   * γραμμής από τον πίνακα.
   */
  | { readonly kind: 'empty-pair'; readonly suite: string }
  /**
   * Το ζεύγος κενό/κενό είναι **απρόσιτο** λόγω φύλακα ανάντη, άρα ο SSoT είναι
   * εκεί αποδεδειγμένα ισοδύναμος με σκέτο `===`. Φυλάμε τον **ανάντη**.
   */
  | { readonly kind: 'upstream-guarded'; readonly suite: string; readonly why: string };

/**
 * 🔴 Η **περίμετρος της Φάσης Γ** — τα 12 αρχεία / 14 σημεία που η Φάση Γ
 * μετέτρεψε από σκέτο `!==` σε κλήση του SSoT, και που στις 2026-08-01
 * μετρήθηκε ότι **επιζούσαν** της μετάλλαξης (215 από 224 σουίτες πράσινες).
 */
const PHASE_C_PERIMETER: Readonly<Record<string, Classification>> = {
  'services/assignment/AssignmentPolicyRepository.ts': {
    kind: 'empty-pair',
    suite: 'src/services/__tests__/ownership-empty-pair-services.test.ts',
  },
  'services/opportunities-server.service.ts': {
    kind: 'empty-pair',
    suite: 'src/services/__tests__/ownership-empty-pair-services.test.ts',
  },
  'services/brokerage-server.service.ts': {
    kind: 'empty-pair',
    suite: 'src/services/__tests__/ownership-empty-pair-services.test.ts',
  },
  'services/property-showcase/load-text-digest.ts': {
    kind: 'empty-pair',
    suite: 'src/services/__tests__/ownership-empty-pair-services.test.ts',
  },
  'services/agent-capability/capabilities/boq/boq-tenant-guard.ts': {
    kind: 'empty-pair',
    suite: 'src/services/__tests__/ownership-empty-pair-services.test.ts',
  },
  'services/floorplan-background/floor-wipe-queries.ts': {
    kind: 'empty-pair',
    suite: 'src/services/__tests__/ownership-empty-pair-services.test.ts',
  },
  'services/ai-pipeline/tools/handlers/attachment-handler.ts': {
    kind: 'empty-pair',
    suite: 'src/services/ai-pipeline/tools/__tests__/handlers/ownership-empty-pair-handlers.test.ts',
  },
  'services/ai-pipeline/tools/handlers/org-structure-handler-utils.ts': {
    kind: 'empty-pair',
    suite: 'src/services/ai-pipeline/tools/__tests__/handlers/ownership-empty-pair-handlers.test.ts',
  },
  'services/ai-pipeline/tools/handlers/procurement-handler.ts': {
    kind: 'empty-pair',
    suite: 'src/services/ai-pipeline/tools/__tests__/handlers/ownership-empty-pair-handlers.test.ts',
  },
  'services/saved-reports/saved-reports-service.ts': {
    kind: 'empty-pair',
    suite: 'src/services/saved-reports/__tests__/saved-reports-service.test.ts',
  },
  'services/communications-triage-actions.ts': {
    kind: 'upstream-guarded',
    suite: 'src/services/__tests__/ownership-upstream-guarded.test.ts',
    why: '`if (!companyId || !adminUid)` στην ίδια συνάρτηση απορρίπτει τον κενό καλούντα',
  },
  'services/showcase-core/api/create-unified-public-pdf-route.ts': {
    kind: 'upstream-guarded',
    suite: 'src/services/__tests__/ownership-upstream-guarded.test.ts',
    why: '`lookupPublicShowcaseShare` επιστρέφει `null` σε share χωρίς `companyId`',
  },
  'app/api/showcase/[token]/pdf/route.ts': {
    kind: 'upstream-guarded',
    suite: 'src/services/__tests__/ownership-upstream-guarded.test.ts',
    why: '`resolveShare` ΚΑΙ `loadEntityHeader` επιστρέφουν `null` σε κενό `companyId`',
  },
};

/**
 * Σημεία **εκτός** της περιμέτρου της Φάσης Γ — άλλες φάσεις, δικές τους
 * σουίτες. **Μετρημένα 2026-08-01: 16 αρχεία.**
 *
 * ⚠️ Ο αριθμός υπάρχει για να **μη διαβάζεται** το πράσινο ως «όλα καλυμμένα
 * από τη Φάση Γ». Αν κάποιο από αυτά μεταναστεύσει στην περίμετρο, μετακινείται
 * παραπάνω — δεν διαγράφεται από εδώ σιωπηλά.
 */
const OUTSIDE_PHASE_C_PERIMETER: readonly string[] = [
  'app/api/admin/role-management/project-members/route.ts',
  'app/api/contacts/resolve/resolve-helpers.ts',
  'app/api/floorplan-backgrounds/floorplan-backgrounds.handlers.ts',
  'app/api/projects/[projectId]/customers/route.ts',
  'app/api/properties/[id]/showcase/generate/helpers.ts',
  'app/api/quotes/_shared/quote-comments.ts',
  'app/api/storages/route.ts',
  'lib/auth/resource-ownership-guard.ts',
  'lib/auth/tenant-isolation.ts',
  'lib/firestore/entity-creation.service.ts',
  'lib/firestore/soft-delete-engine.ts',
  'services/ai-pipeline/tools/tool-tenant-guard.ts',
  'services/banking/bank-accounts-server.service.ts',
  'services/sharing/resolver-core/share-entity-access.ts',
  'subapps/procurement/services/rfq-service.ts',
];

/**
 * 🔴 Ο **μάρτυρας** (μάθημα #7). Αν η σάρωση σπάσει — λάθος ρίζα, εξαίρεση σε
 * `readdirSync`, αλλαγμένο pattern — το σύνολο αδειάζει και **όλοι** οι έλεγχοι
 * πληρότητας γίνονται κενά αληθείς. Αυτά τα δύο αρχεία **πρέπει** να βρεθούν:
 * ένα υπηρεσίας και ένα διαδρομής, ώστε ο μάρτυρας να καλύπτει **δύο δέντρα**,
 * όχι ένα (η επέκταση του Βήματος Β για τον ίδιο ακριβώς λόγο).
 */
const WITNESS_FILES: readonly string[] = [
  'services/saved-reports/saved-reports-service.ts',
  'app/api/showcase/[token]/pdf/route.ts',
];

/** Κατώφλι κατά της άδειας σάρωσης, συντηρητικό (μετρημένα 29 στις 2026-08-01). */
const MIN_CALLSITE_FILES = 20;

// =============================================================================
// Σάρωση
// =============================================================================

function collectSourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '__tests__') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      collectSourceFiles(full, acc);
    } else if (/\.tsx?$/.test(entry) && !/\.(test|spec)\.tsx?$/.test(entry)) {
      acc.push(full);
    }
  }
  return acc;
}

/** Αγνοεί κλήσεις μέσα σε σχόλιο ή γραμμή `import` — μετράει **κώδικα**. */
function hasCall(source: string): boolean {
  return source
    .split('\n')
    .some(line => {
      const trimmed = line.trim();
      if (trimmed.startsWith('*') || trimmed.startsWith('//') || trimmed.startsWith('/*')) return false;
      if (trimmed.startsWith('import ')) return false;
      return CALL_PATTERN.test(line);
    });
}

const callSiteFiles: readonly string[] = collectSourceFiles(SRC_ROOT)
  .filter(file => hasCall(readFileSync(file, 'utf8')))
  .map(file => relative(SRC_ROOT, file).split(sep).join('/'))
  .filter(file => file !== DEFINITION_MODULE)
  .sort();

// =============================================================================
// Οι έλεγχοι
// =============================================================================

describe('⚓ ADR-742 — πληρότητα κάλυψης των σημείων ιδιοκτησίας', () => {
  describe('φύλακας κατά της άδειας σάρωσης', () => {
    test(`βρίσκει τουλάχιστον ${MIN_CALLSITE_FILES} αρχεία με κλήση`, () => {
      expect(callSiteFiles.length).toBeGreaterThanOrEqual(MIN_CALLSITE_FILES);
    });

    test.each(WITNESS_FILES)('ο μάρτυρας «%s» βρίσκεται στη σάρωση', witness => {
      expect(callSiteFiles).toContain(witness);
    });
  });

  describe('κάθε σημείο κλήσης είναι ρητά ταξινομημένο', () => {
    test('καμία κλήση χωρίς ταξινόμηση (νέο σημείο ⇒ κόκκινο)', () => {
      const classified = new Set([
        ...Object.keys(PHASE_C_PERIMETER),
        ...OUTSIDE_PHASE_C_PERIMETER,
      ]);
      const unclassified = callSiteFiles.filter(file => !classified.has(file));

      expect(unclassified).toEqual([]);
    });

    test('καμία μπαγιάτικη καταχώρηση (αρχείο χωρίς κλήση πια ⇒ κόκκινο)', () => {
      const known = [...Object.keys(PHASE_C_PERIMETER), ...OUTSIDE_PHASE_C_PERIMETER];
      const stale = known.filter(file => !callSiteFiles.includes(file));

      expect(stale).toEqual([]);
    });
  });

  describe('η επικαλούμενη σουίτα αναφέρει όντως τη διαδρομή', () => {
    const entries = Object.entries(PHASE_C_PERIMETER);

    test.each(entries)('%s → η σουίτα υπάρχει και την ονομάζει', (file, classification) => {
      const suiteSource = readFileSync(join(process.cwd(), classification.suite), 'utf8');

      // Οι σουίτες `empty-pair` κρατούν τη διαδρομή στο πεδίο `file` του πίνακα·
      // οι `upstream-guarded` την ονομάζουν στην κεφαλίδα τους. Και στις δύο
      // περιπτώσεις η **αφαίρεση** της γραμμής σβήνει τη συμβολοσειρά.
      expect(suiteSource).toContain(file);
    });
  });

  describe('η περίμετρος της Φάσης Γ είναι πλήρης', () => {
    test('και τα 13 αρχεία της Φάσης Γ είναι ταξινομημένα', () => {
      // 12 αρχεία με 14 σημεία + το `saved-reports` που ήταν ήδη καλυμμένο.
      expect(Object.keys(PHASE_C_PERIMETER)).toHaveLength(13);
    });

    test('δέκα αποδεικνύονται με ζεύγος κενό/κενό, τρία είναι φυλαγμένα ανάντη', () => {
      const byKind = Object.values(PHASE_C_PERIMETER).reduce<Record<string, number>>(
        (acc, c) => ({ ...acc, [c.kind]: (acc[c.kind] ?? 0) + 1 }),
        {},
      );

      expect(byKind).toEqual({ 'empty-pair': 10, 'upstream-guarded': 3 });
    });
  });
});
