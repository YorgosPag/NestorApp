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

/**
 * 🔴 **Αφαιρεί σχόλια πριν από κάθε μέτρηση — και αυτό είναι ουσία, όχι
 * καλλωπισμός** (μετρημένο 2026-08-01, ADR-742 §7octies).
 *
 * Η Ομάδα 4 μετέφερε δύο διαδρομές από `403` σε `404` και το
 * {@link NOT_YET_MIGRATED} **έμεινε πράσινο στο 4** — όχι επειδή δεν άλλαξε
 * τίποτα, αλλά επειδή έφυγαν **δύο πραγματικές** παραβάσεις και μπήκαν **δύο
 * σχόλια** που τεκμηριώνουν το παλιό σχήμα (*«απαντούσε 403 'Access denied - …'»*).
 * Η ισότητα κρατήθηκε **κατά τύχη**, δηλαδή ο μετρητής μετρούσε **πρόζα**.
 *
 * Το ίδιο θα χτυπούσε και το κλείδωμα του Βήματος 7: τα SSoT modules **οφείλουν**
 * να περιγράφουν τι αντικατέστησαν. Αν η τεκμηρίωση μετράει ως παράβαση, το
 * gate γίνεται θόρυβος — και ένα gate που βγάζει θόρυβο το χαλαρώνει κάποιος.
 *
 * ⚠️ Ο διαχωρισμός είναι σκόπιμα **συντακτικός και ανόητος**: αφαιρεί
 * `/* … *\/` και `// …`. Δεν προσπαθεί να καταλάβει συμβολοσειρές που περιέχουν
 * `//` — για τα δύο σήματα που ψάχνουμε δεν υπάρχει τέτοια περίπτωση, και ένας
 * «έξυπνος» αναλυτής εδώ θα ήταν δεύτερη μηχανή προς συντήρηση.
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

const SRC_FILES = SCANNED_TREES.flatMap((tree) => listTypeScriptFiles(join(process.cwd(), tree)))
  .filter((f) => !/\.(test|spec)\.tsx?$/.test(f))
  .map((file) => {
    const raw = readFileSync(file, 'utf8');
    return { path: relative(file), source: stripComments(raw), raw };
  });

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

/**
 * Χειρόγραφη σύγκριση ιδιοκτησίας — αυτό που αντικαθιστά ο SSoT.
 *
 * 🔴 **Δύο μορφές, όχι μία** (μετρημένο 2026-08-01, ADR-742 §7decies.3): η
 * γραφή `data?.[FIELDS.COMPANY_ID] !== ctx.companyId` κάνει **ακριβώς** το ίδιο
 * και **δεν πιανόταν**. Δύο σημεία της Ομάδας 4 ήταν γραμμένα έτσι και τα
 * έχασαν **τρεις** σαρώσεις (§7octies.2α)· ένα **τρίτο** —
 * `communications/share-to-channel`, πόρος `contact` σε **άλλο δέντρο** —
 * επέζησε ολόκληρης της Ομάδας 4 και βρέθηκε μόνο όταν η μορφή προστέθηκε εδώ.
 *
 * *Το grep μετρά τη ΜΟΡΦΗ που έψαξες, όχι το φαινόμενο* (μάθημα #1) — και αυτό
 * ισχύει **και για το ίδιο το gate**.
 */
const HAND_ROLLED_OWNERSHIP = /(\.companyId|\[FIELDS\.COMPANY_ID\])\s*!==\s*ctx\.companyId/;

/**
 * **Άρνηση που ΚΑΤΟΝΟΜΑΖΕΙ τον λόγο** — η μεταμφίεση που δεν προσποιείται καν
 * (ADR-742 §7decies.4).
 *
 * Η μισογραμμένη μεταμφίεση ({@link HALF_WRITTEN_DISGUISE}) κρατά σωστό κείμενο
 * και λάθος κωδικό. **Αυτό** εδώ είναι το αντίθετο άκρο: το μήνυμα λέει στον
 * καλούντα **γιατί** του αρνήθηκαν — «belongs to a different company», «from
 * your company» — δηλαδή επιβεβαιώνει ότι το έγγραφο **υπάρχει και ανήκει
 * αλλού**. Κωδικός σωστός ή λάθος, το κείμενο **είναι** το μαντείο.
 *
 * Τρία ζωντανά σημεία το έγραφαν μέχρι τις 2026-08-01: οι δύο διαδρομές
 * συνομιλιών, το μαζικό `messages/delete` (ως `reason` σε απάντηση 200) και —
 * το πιο ακριβό — ο **κοινός** `soft-delete-engine`, που εξυπηρετεί έξι
 * οντότητες και ακύρωνε μόνος του τη μεταμφίεση **τριών** ήδη
 * «μεταναστευμένων» πόρων.
 *
 * ⚠️ Δεν σαρώνει `logger.*` / audit metadata: εκεί η αλήθεια **πρέπει** να
 * επιβιώνει (§3.4). Γι' αυτό ο έλεγχος κοιτά μόνο κείμενο που φεύγει στο σύρμα
 * — `ApiError(...)` και **κυριολεκτικά** `error: '…'` / `reason: '…'`.
 *
 * 🔴 Η απαίτηση για **εισαγωγικό** μετά το `error:` δεν είναι λεπτομέρεια: χωρίς
 * αυτήν, το `logger.error('…', { …, error: new Error('X belongs to a different
 * company') })` του `communications-triage-actions` μετριόταν ως παράβαση —
 * ενώ είναι ακριβώς το **ίχνος ελέγχου που οφείλει** να λέει την αλήθεια.
 * Ένα gate που καταγγέλλει το σωστό το χαλαρώνει κάποιος.
 */
const REASON_NAMING_DENIAL =
  /(ApiError\([^)]*|error:\s*['"`]|reason:\s*['"`])[^\n]{0,120}(belongs to (a )?different company|from your company)/;

/**
 * Πόροι των οποίων η μεταμφίεση έχει **ολοκληρωθεί**. Ο κατάλογος **μεγαλώνει**
 * καθώς κλείνουν οι ομάδες της Φάσης Γ+Δ· δεν συρρικνώνεται ποτέ.
 */
const CONCEALED_RESOURCES = [
  {
    label: 'project',
    dir: 'src/app/api/projects/',
    notFoundMessage: 'Project not found',
    minFiles: 28,
  },
  {
    label: 'contact',
    dir: 'src/app/api/contacts/',
    notFoundMessage: 'Contact not found',
    minFiles: 26,
  },
  {
    label: 'building',
    dir: 'src/app/api/buildings/',
    notFoundMessage: 'Building not found',
    minFiles: 19,
  },
  {
    label: 'message',
    dir: 'src/app/api/messages/',
    notFoundMessage: 'Message not found',
    minFiles: 6,
  },
  {
    // ⚠️ Το γνήσιο μήνυμα **παρεμβάλλει το id** (`Conversation {id} not found`),
    // οπότε το σταθερό κομμάτι είναι το **πρόθεμα**. Το id δεν είναι διαρροή:
    // ο καλών το έγραψε ο ίδιος στη διαδρομή (§7septies.3 — άρνηση παραμέτρου).
    label: 'conversation',
    dir: 'src/app/api/conversations/',
    notFoundMessage: 'Conversation ',
    minFiles: 5,
  },
] as const;

/**
 * ⚠️ **Δεν υπάρχει πια εξαίρεση για τα SSoT modules** (§7octies).
 *
 * Μέχρι τότε κάθε πόρος δήλωνε ένα `ssot:` αρχείο που εξαιρούνταν από τη
 * σάρωση, επειδή **οφείλει** να περιγράφει στα σχόλιά του το σχήμα που
 * αντικατέστησε. Αυτό ήταν workaround για το ότι ο μετρητής διάβαζε **πρόζα**.
 *
 * Με το {@link stripComments} η αιτία εξαφανίστηκε, οπότε η εξαίρεση φεύγει και
 * το gate γίνεται **αυστηρότερο**: ούτε το ίδιο το SSoT module δεν επιτρέπεται
 * να γράψει **εκτελέσιμο** `403 … not found`. Μια εξαίρεση που δεν χρειάζεται
 * είναι τρύπα που περιμένει.
 */

/**
 * 🔴 Πόροι που **δεν** έχουν μεταναστεύσει, με **μετρημένο** αριθμό σημείων.
 *
 * Υπάρχει ώστε το πράσινο αυτού του αρχείου να μη διαβάζεται ποτέ ως «ο
 * κώδικας δεν έχει μαντεία». Όταν κλείσει η Ομάδα 4, ο αριθμός γίνεται 0 και
 * ο πόρος μετακομίζει στο {@link CONCEALED_RESOURCES}.
 */
const NOT_YET_MIGRATED = [
  { label: 'dxf level/style (Ομάδα 6)', dir: 'src/app/api/dxf-levels/', handRolledHits: 1 },
  { label: 'floorplan (Ομάδα 6)', dir: 'src/app/api/floorplans/', handRolledHits: 2 },
  // ⚠️ Μετρώνται **ΑΡΧΕΙΑ**, όχι σημεία: το `parking/route.ts` έχει δύο
  // συγκρίσεις (γρ. 98 με bypass, γρ. 214 **χωρίς**) και προσμετράται ως ένα.
  { label: 'parking (Ομάδα 6)', dir: 'src/app/api/parking/', handRolledHits: 1 },
] as const;

/**
 * 🔴🔴 Η **ΚΑΘΟΛΙΚΗ** απογραφή — και γιατί ο κατάλογος ανά φάκελο δεν αρκεί
 * (ADR-742 §7decies.3)
 *
 * Ο έλεγχος «καμία διαδρομή **του φακέλου** δεν γράφει τη σύγκριση» αναπαράγει,
 * **μέσα στο ίδιο το gate**, ακριβώς το λάθος που κλείνει η §7septies: το
 * μαντείο είναι ιδιότητα **ΠΟΡΟΥ**, όχι φακέλου. Ο πόρος `contact` δηλωνόταν
 * μεταναστευμένος ενώ το `communications/share-to-channel` — άλλο δέντρο —
 * κρατούσε ζωντανή τη δική του σύγκριση **και** το δικό του 403.
 *
 * ⇒ Εδώ δηλώνεται η **πλήρης λίστα αρχείων** που επιτρέπεται να την περιέχουν,
 * με **ισότητα**. Νέο αρχείο οπουδήποτε στα σαρωμένα δέντρα σπάει το gate,
 * ακόμη κι αν ο φάκελός του δεν ανήκει σε κανέναν δηλωμένο πόρο.
 *
 * Μετρημένο 2026-08-01 μετά την Ομάδα 5: **9 αρχεία, όλα Ομάδα 6**.
 */
const HAND_ROLLED_INVENTORY = [
  'src/app/api/dxf-dimension-styles/dxf-dimension-styles.handlers.ts',
  'src/app/api/dxf-levels/dxf-levels.handlers.ts',
  // ⛔ Δηλωμένα ΕΞΩ από τη μετανάστευση (§7ter.1): φίλτρο **λίστας** πάνω σε
  // ήδη tenant-scoped ερώτημα — δεν είναι σημείο απόφασης αποκάλυψης.
  'src/app/api/floorplan-overlays/floorplan-overlays.handlers.ts',
  'src/app/api/floorplans/process/route.ts',
  'src/app/api/floorplans/scene/route.ts',
  'src/app/api/floors/floors.shared.ts',
  'src/app/api/parking/route.ts',
  'src/app/api/procurement/[poId]/pdf/route.ts',
  'src/app/api/quotes/[id]/notify-vendor/route.ts',
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

  describe('🔴 ο μετρητής μετρά ΚΩΔΙΚΑ, όχι πρόζα (§7octies)', () => {
    it('η τεκμηρίωση του παλιού σχήματος ΔΕΝ μετράει ως παράβαση', () => {
      const documented = [
        '/**',
        " * Μέχρι τις 2026-08-01 απαντούσε 403 'Access denied - Contact not found'.",
        ' * Έγραφε `data.companyId !== ctx.companyId` με το χέρι.',
        ' */',
        'export const SAFE = 1;',
      ].join('\n');

      const stripped = stripComments(documented);
      expect(HALF_WRITTEN_DISGUISE.test(stripped)).toBe(false);
      expect(HAND_ROLLED_OWNERSHIP.test(stripped)).toBe(false);
    });

    it('…αλλά ο ΠΡΑΓΜΑΤΙΚΟΣ κώδικας εξακολουθεί να μετράει', () => {
      const real = [
        '// σχόλιο που αναφέρει Access denied - κάτι',
        "throw new ApiError(403, 'Access denied - Contact not found');",
        'if (data.companyId !== ctx.companyId) return;',
      ].join('\n');

      const stripped = stripComments(real);
      expect(HALF_WRITTEN_DISGUISE.test(stripped)).toBe(true);
      expect(HAND_ROLLED_OWNERSHIP.test(stripped)).toBe(true);
    });

    it('ο διαχωρισμός δεν καταπίνει κώδικα γύρω από μονογραμμικό σχόλιο', () => {
      expect(stripComments('const a = 1; // σχόλιο\nconst b = 2;')).toContain('const b = 2;');
      expect(stripComments('const a = 1; // σχόλιο\nconst b = 2;')).toContain('const a = 1;');
    });
  });
});

// ============================================================================
describe.each(CONCEALED_RESOURCES)(
  '⚓ πόρος «$label» — η μεταμφίεση είναι ΟΜΟΙΟΜΟΡΦΗ σε κάθε διαδρομή',
  (resource) => {
    const owned = SRC_FILES.filter((f) => f.path.startsWith(resource.dir));

    // Το κατώφλι είναι **μετρημένο ανά πόρο** (2026-08-01), όχι αυθαίρετο: ένα
    // κοινό «>5» θα ήταν ψευδώς αυστηρό για μικρούς πόρους και ψευδώς χαλαρό
    // για μεγάλους — και σε καμία περίπτωση δεν θα έλεγε τι μετρήθηκε.
    it('υπάρχουν διαδρομές να ελεγχθούν (φύλακας κατά σιωπηλά άδειας σάρωσης)', () => {
      expect(owned.length).toBeGreaterThanOrEqual(resource.minFiles);
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
      const offenders = SRC_FILES.filter((f) => pattern.test(f.source));
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
    // (Το `source` είναι ήδη χωρίς σχόλια — βλ. `stripComments`. Πριν την
    // §7octies αυτή η γραμμή έκανε **δική της**, μερική αφαίρεση σχολίων:
    // έπιανε μόνο τις γραμμές `*` ενός block, όχι τα `//` ούτε τους
    // οριοθέτες. Η αφαίρεση είναι πλέον **μία** και καθολική.)
    expect(/403/.test(guard!.source)).toBe(false);
  });
});

// ============================================================================
describe('🔴 ΤΙ ΜΕΝΕΙ — το πράσινο ΔΕΝ σημαίνει «ο κώδικας δεν έχει μαντεία»', () => {
  it.each(NOT_YET_MIGRATED)(
    'ο πόρος «$label» έχει ΑΚΟΜΗ $handRolledHits χειρόγραφες συγκρίσεις — μετρημένες, όχι αγνοημένες',
    ({ dir, handRolledHits }) => {
      const hits = SRC_FILES.filter(
        (f) => f.path.startsWith(dir) && HAND_ROLLED_OWNERSHIP.test(f.source),
      );
      // Ισότητα, όχι ανισότητα: **αύξηση** είναι νέα διαρροή· **μείωση**
      // σημαίνει ότι η ομάδα προχώρησε και ο κατάλογος πρέπει να ενημερωθεί.
      expect(hits.length).toBe(handRolledHits);
    },
  );

  /**
   * 🔴🔴 Το gate που **έλειπε**: καθολική ισότητα, όχι ανά φάκελο.
   *
   * Έπιασε το `communications/share-to-channel` — πόρος `contact` σε δέντρο που
   * κανένας δηλωμένος πόρος δεν κάλυπτε, ζωντανό μετά από **ολόκληρη** την
   * Ομάδα 4 (§7decies.3).
   */
  it('🔴🔴 η ΚΑΘΟΛΙΚΗ απογραφή χειρόγραφων συγκρίσεων είναι ΑΚΡΙΒΩΣ η δηλωμένη', () => {
    const found = SRC_FILES.filter((f) => HAND_ROLLED_OWNERSHIP.test(f.source)).map((f) => f.path);

    expect([...found].sort()).toEqual([...HAND_ROLLED_INVENTORY].sort());
  });

  /**
   * 🔴🔴 Καθολικά **μηδέν**, χωρίς κατάλογο εξαιρέσεων.
   *
   * Σε αντίθεση με τη χειρόγραφη σύγκριση (που έχει ακόμη 9 νόμιμα σημεία ως τη
   * λήξη της Ομάδας 6), μια άρνηση που **κατονομάζει τον λόγο** δεν έχει καμία
   * νόμιμη χρήση στο σύρμα: ό,τι κι αν αποφασίσει ο πόρος, το κείμενο δεν
   * επιτρέπεται να λέει «ανήκει σε άλλη εταιρεία».
   */
  it('🔴🔴 καμία άρνηση στο σύρμα δεν ΚΑΤΟΝΟΜΑΖΕΙ τη διαφορά εταιρείας', () => {
    const offenders = SRC_FILES.filter((f) => REASON_NAMING_DENIAL.test(f.source)).map((f) => f.path);

    expect(offenders).toEqual([]);
  });

  it('…και ο ανιχνευτής του θα πυροδοτούσε ακόμη', () => {
    expect(
      REASON_NAMING_DENIAL.test(
        "throw new ApiError(403, `Unauthorized: ${config.labelEn} belongs to different company`);",
      ),
    ).toBe(true);
    expect(
      REASON_NAMING_DENIAL.test(
        "errors.push({ messageId, reason: 'Unauthorized - message belongs to different company' });",
      ),
    ).toBe(true);
    expect(
      REASON_NAMING_DENIAL.test(
        "throw new ApiError(403, 'Unauthorized: You can only access conversations from your company');",
      ),
    ).toBe(true);
    // Το ίχνος ελέγχου **κρατά** την αλήθεια — δεν είναι παράβαση (§3.4).
    expect(
      REASON_NAMING_DENIAL.test(
        "logger.warn('Tenant isolation violation: Policy belongs to different company', { policyId });",
      ),
    ).toBe(false);
  });

  it('🔴 ο κατάλογος των ΜΗ μεταναστευμένων δεν είναι άδειος όσο υπάρχουν ομάδες', () => {
    // Φύλακας κατά της σιωπηλής εκκένωσης: αν κάποιος «καθαρίσει» τον κατάλογο
    // αντί να μεταναστεύσει τους πόρους, το πράσινο θα σήμαινε ξανά το τίποτα.
    expect(NOT_YET_MIGRATED.length).toBeGreaterThan(0);
  });
});
