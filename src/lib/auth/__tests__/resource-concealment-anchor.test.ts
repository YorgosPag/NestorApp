/**
 * ⚓ ADR-742 anchor — **ένας πόρος είναι κρυμμένος μόνο αν ΟΛΕΣ οι διαδρομές του συμφωνούν**
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΤΟ ΠΡΟΒΛΗΜΑ ΠΟΥ ΦΥΛΑΕΙ — ΚΑΙ ΓΙΑΤΙ ΚΑΝΕΝΑ UNIT TEST ΔΕΝ ΤΟ ΠΙΑΝΕΙ
 * ─────────────────────────────────────────────────────────────────────────────
 * Το μαντείο ύπαρξης **δεν** είναι ιδιότητα μιας διαδρομής· είναι ιδιότητα του
 * **πόρου**. Αν δεκαπέντε διαδρομές δέχονται `projects/{id}` και **μία** από
 * αυτές απαντά `403` ενώ οι υπόλοιπες `404`, ο πόρος είναι **αποκαλυμμένος** —
 * και κάθε unit test κάθε μιας από τις δεκαπέντε μένει **πράσινο**, γιατί
 * καθεμιά είναι εσωτερικά συνεπής.
 *
 * Ακριβώς αυτό συνέβη: η Ομάδα 3 μεταμφίεσε δέκα σημεία, και η μεταμφίεση
 * **ακυρωνόταν** από τέσσερις αδελφικές διαδρομές (`/customers`,
 * `/efka-declaration`, `/v2/.../customers`, `floors`) που περνούσαν από τον
 * `requireDocInTenant` και απαντούσαν `403 'Access denied'` για **το ίδιο id**.
 * Το βρήκε **μέτρηση**, όχι ανάγνωση — και το βρήκε **μετά** τη μετανάστευση.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🏆 ΓΙΑΤΙ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ ΠΑΕΙ ΠΑΡΑΠΕΡΑ ΑΠΟ ΤΗ ΒΙΟΜΗΧΑΝΙΑ
 * ─────────────────────────────────────────────────────────────────────────────
 * GitHub, Google (AIP-193/211), AWS S3 και Figma **δηλώνουν** τον κανόνα σε
 * πεζό κείμενο και βασίζονται στον έλεγχο κώδικα για την ομοιομορφία. Κανένας
 * δεν δημοσιεύει **αυτόματο έλεγχο** ότι όλες οι διαδρομές ενός πόρου
 * συμφωνούν. Το κείμενο όμως δεν σπάει ποτέ — σπάει η **δέκατη έκτη διαδρομή**,
 * που γράφεται έξι μήνες αργότερα από κάποιον που δεν διάβασε το ADR.
 *
 * ⚠️ **Δεν είναι ratchet και δεν έχει baseline.** Ένας μεταναστευμένος πόρος
 * είναι **μηδέν ή τίποτα**: «λιγότερες διαρροές» δεν κρύβει τίποτα.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΤΙ **ΔΕΝ** ΒΛΕΠΕΙ (δηλωμένο, γιατί πράσινο test που κοίταξε το τίποτα είναι
 * χειρότερο από κανένα test — το μάθημα των «0» του N.11/N.12)
 * ─────────────────────────────────────────────────────────────────────────────
 * - **Πόρους που δεν έχουν μεταναστεύσει ακόμη.** Καλύπτονται από το
 *   {@link NOT_YET_MIGRATED} με **μετρημένο** αριθμό, ώστε το πράσινο να μη
 *   διαβάζεται ως «όλα καθαρά».
 * - **Άρνηση ΤΑΥΤΟΤΗΤΑΣ ή ΔΙΚΑΙΩΜΑΤΟΣ** (401/403 για «δεν είσαι συνδεδεμένος»
 *   ή «δεν έχεις το δικαίωμα X»). Είναι **άλλη ερώτηση** και νόμιμα 403: δεν
 *   αφορούν *ποιο* έγγραφο, άρα δεν μαρτυρούν ύπαρξη κανενός.
 * - **Άρνηση ΠΑΡΑΜΕΤΡΟΥ** (`requireTenantScope`, ADR-702): ο καλών ονομάζει
 *   ρητά ξένη εταιρεία, οπότε δεν μαθαίνει τίποτα που δεν έγραψε ο ίδιος.
 * - Δυναμικά συντιθέμενα μηνύματα — ο έλεγχος είναι κειμενικός.
 *
 * @module lib/auth/__tests__/resource-concealment-anchor
 * @see adrs/ADR-742 §3.3, §7.1, §7septies
 */

import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

/**
 * Τα δέντρα όπου **γεννιέται** μια άρνηση HTTP. Δηλωμένος περιορισμός, όχι
 * παράλειψη: συστατικά UI δεν εκπέμπουν κωδικούς κατάστασης, και το
 * `src/subapps/**` έχει **δικό του** `node_modules` με σπασμένους συνδέσμους
 * που κάνουν τη σάρωση ολόκληρου του `src` αναξιόπιστη.
 */
const SCANNED_TREES = ['src/app/api', 'src/lib', 'src/server', 'src/services'] as const;

const SKIP_DIRS = new Set(['__tests__', 'node_modules', '.next', '__mocks__']);

function listTypeScriptFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    if (SKIP_DIRS.has(entry)) return [];
    const full = join(dir, entry);
    let isDir: boolean;
    try {
      isDir = statSync(full).isDirectory();
    } catch {
      return []; // σπασμένος σύνδεσμος — δεν υπάρχει πηγαίος κώδικας να διαβαστεί
    }
    if (isDir) return listTypeScriptFiles(full);
    return (entry.endsWith('.ts') || entry.endsWith('.tsx')) && !entry.endsWith('.d.ts')
      ? [full]
      : [];
  });
}

const relative = (file: string): string =>
  file.slice(process.cwd().length + 1).split('\\').join('/');

const SRC_FILES = SCANNED_TREES.flatMap((tree) => listTypeScriptFiles(join(process.cwd(), tree)))
  .filter((f) => !/\.(test|spec)\.tsx?$/.test(f))
  .map((file) => ({ path: relative(file), source: readFileSync(file, 'utf8') }));

// ============================================================================
// ΤΑ ΣΗΜΑΤΑ
// ============================================================================

/**
 * Η **μισογραμμένη μεταμφίεση**: σωστό κείμενο, λάθος κωδικός. Κάποιος είχε
 * ήδη καταλάβει τον κανόνα και έβαλε το «X not found» μέσα στο μήνυμα, αλλά
 * κράτησε το `403` **και** πρόσθεσε το πρόθεμα. Και τα δύο προδίδουν.
 *
 * Είναι το πιο **διακριτικό** σήμα ολόκληρου του δόγματος: μηδέν ψευδώς
 * θετικά, γιατί κανείς δεν γράφει αυτή τη φράση κατά λάθος.
 */
const HALF_WRITTEN_DISGUISE = /Access denied - /;

/** Χειρόγραφη σύγκριση ιδιοκτησίας — αυτό που αντικαθιστά ο SSoT. */
const HAND_ROLLED_OWNERSHIP = /\.companyId\s*!==\s*ctx\.companyId/;

/**
 * Πόροι των οποίων η μεταμφίεση έχει **ολοκληρωθεί**. Ο κατάλογος **μεγαλώνει**
 * καθώς κλείνουν οι ομάδες της Φάσης Γ+Δ· δεν συρρικνώνεται ποτέ.
 */
const CONCEALED_RESOURCES = [
  {
    label: 'project',
    dir: 'src/app/api/projects/',
    notFoundMessage: 'Project not found',
    /** Το καθαρό module του πόρου: μόνο εκεί επιτρέπεται να **περιγράφεται** το παλιό σχήμα. */
    ssot: 'src/app/api/projects/_shared/project-ownership.ts',
  },
] as const;

/**
 * 🔴 Πόροι που **δεν** έχουν μεταναστεύσει, με **μετρημένο** αριθμό σημείων.
 *
 * Υπάρχει ώστε το πράσινο αυτού του αρχείου να μη διαβάζεται ποτέ ως «ο
 * κώδικας δεν έχει μαντεία». Όταν κλείσει η Ομάδα 4, ο αριθμός γίνεται 0 και
 * ο πόρος μετακομίζει στο {@link CONCEALED_RESOURCES}.
 */
const NOT_YET_MIGRATED = [
  { label: 'contact (Ομάδα 4)', dir: 'src/app/api/contacts/', disguiseHits: 4 },
] as const;

// ============================================================================
describe('⚓ ADR-742 — ο ανιχνευτής δουλεύει (regex που δεν πιάνει τίποτα δεν αποδεικνύει τίποτα)', () => {
  it('βρίσκει αρχεία να ελέγξει', () => {
    expect(SRC_FILES.length).toBeGreaterThan(500);
  });

  it('η μισογραμμένη μεταμφίεση αναγνωρίζεται ακόμη', () => {
    expect(HALF_WRITTEN_DISGUISE.test("throw new ApiError(403, 'Access denied - Project not found')")).toBe(true);
    expect(HALF_WRITTEN_DISGUISE.test("throw new ApiError(404, 'Project not found')")).toBe(false);
  });

  it('η χειρόγραφη σύγκριση ιδιοκτησίας αναγνωρίζεται ακόμη', () => {
    expect(HAND_ROLLED_OWNERSHIP.test('if (!isSuperAdmin && p?.companyId !== ctx.companyId) {')).toBe(true);
    expect(HAND_ROLLED_OWNERSHIP.test('requireProjectAccess({ projectData, caller: ctx })')).toBe(false);
  });
});

// ============================================================================
describe.each(CONCEALED_RESOURCES)(
  '⚓ πόρος «$label» — η μεταμφίεση είναι ΟΜΟΙΟΜΟΡΦΗ σε κάθε διαδρομή',
  (resource) => {
    const owned = SRC_FILES.filter(
      (f) => f.path.startsWith(resource.dir) && f.path !== resource.ssot,
    );

    it('υπάρχουν διαδρομές να ελεγχθούν (φύλακας κατά σιωπηλά άδειας σάρωσης)', () => {
      expect(owned.length).toBeGreaterThan(5);
    });

    it('🔴 καμία διαδρομή δεν γράφει τη μισογραμμένη μεταμφίεση', () => {
      const offenders = owned.filter((f) => HALF_WRITTEN_DISGUISE.test(f.source));
      expect(offenders.map((f) => f.path)).toEqual([]);
    });

    it('🔴 καμία διαδρομή δεν ξαναγράφει τη σύγκριση ιδιοκτησίας με το χέρι', () => {
      const offenders = owned.filter((f) => HAND_ROLLED_OWNERSHIP.test(f.source));
      expect(offenders.map((f) => f.path)).toEqual([]);
    });

    it('🔴 ΠΟΥΘΕΝΑ στο src το «δεν βρέθηκε» αυτού του πόρου δεν συνοδεύεται από 403', () => {
      // Το κρίσιμο σήμα: μια **αδελφική** διαδρομή έξω από τον φάκελο του πόρου
      // (π.χ. `api/floors`, `api/buildings`) που απαντά 403 για το ίδιο id
      // ακυρώνει τη μεταμφίεση όλων των υπολοίπων.
      const pattern = new RegExp(
        `403[^\\n]{0,80}${resource.notFoundMessage}|${resource.notFoundMessage}[^\\n]{0,80}403`,
      );
      const offenders = SRC_FILES.filter(
        (f) => f.path !== resource.ssot && pattern.test(f.source),
      );
      expect(offenders.map((f) => f.path)).toEqual([]);
    });
  },
);

// ============================================================================
describe('⚓ ο ΕΝΑΣ κοινός φύλακας δεν επιστρέφει ποτέ ξανά 403 για ιδιοκτησία εγγράφου', () => {
  const guard = SRC_FILES.find((f) => f.path === 'src/lib/auth/tenant-isolation.ts');

  it('το αρχείο υπάρχει', () => {
    expect(guard).toBeDefined();
  });

  it('🔴 `requireDocInTenant` δεν φτιάχνει `TenantIsolationError` με 403 (§7septies)', () => {
    // Εξυπηρετεί **έξι** οντότητες και **41** καταναλωτές: ένα 403 εδώ
    // ξανανοίγει το μαντείο για όλες μαζί, με κάθε άλλο test πράσινο.
    expect(/403/.test(guard!.source.replace(/^\s*\*.*$/gm, ''))).toBe(false);
  });
});

// ============================================================================
describe('🔴 ΤΙ ΜΕΝΕΙ — το πράσινο ΔΕΝ σημαίνει «ο κώδικας δεν έχει μαντεία»', () => {
  it.each(NOT_YET_MIGRATED)(
    'ο πόρος «$label» έχει ΑΚΟΜΗ $disguiseHits σημεία μισογραμμένης μεταμφίεσης — μετρημένα, όχι αγνοημένα',
    ({ dir, disguiseHits }) => {
      const hits = SRC_FILES.filter(
        (f) => f.path.startsWith(dir) && HALF_WRITTEN_DISGUISE.test(f.source),
      );
      // Ισότητα, όχι ανισότητα: **αύξηση** είναι νέα διαρροή· **μείωση**
      // σημαίνει ότι η ομάδα προχώρησε και ο κατάλογος πρέπει να ενημερωθεί.
      expect(hits.length).toBe(disguiseHits);
    },
  );
});
