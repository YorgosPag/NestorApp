/**
 * @fileoverview **ΕΝΑ ΛΕΞΙΛΟΓΙΟ ΓΙΑ ΤΟΝ ΧΩΡΙΚΟ ΟΡΟ — και ένα ψευδώνυμο που ΞΕΡΕΙ ΠΟΤΕ ΠΕΘΑΙΝΕΙ.**
 * @related types/geo/coordinates.ts (`GeoCircle`) · ADR-777 §8.53 · N.0.2 · N.18
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ΤΙ ΣΥΝΕΒΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο όρος «κύκλος αναζήτησης» *(`center` + `radiusKm`)* μιλιόταν σε **πέντε** σημεία σε
 * **τρεις** τομείς, και **ένα μόνο** τον είχε ονομάσει. Τα δύο χειρότερα δεν τον
 * ξανάγραφαν — **τρυπούσαν μέσα σε ξένο τύπο** για να τον δανειστούν:
 *
 * ```
 * lib/demand/demand-listing-filters.ts   type ProjectedGeo = ListingFilters['near']
 * lib/demand/demand-similarity.ts        areasIntersect(a: ListingFilters['near'], …)
 * ```
 *
 * Δηλαδή ο τομέας της **ζήτησης** εξαρτιόταν δομικά από τον τομέα των **αγγελιών** για
 * καθαρή **γεωμετρία** — λάθος κατεύθυνση εξάρτησης, και το κλασικό σύμπτωμα SSoT που
 * λείπει: **όταν δεν υπάρχει όνομα, ο κόσμος δείχνει αντί να ονομάσει.**
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🏆 ΓΙΑΤΙ ΑΥΤΗ Η ΑΓΚΥΡΑ ΞΕΠΕΡΝΑ ΤΗΝ ΠΡΑΚΤΙΚΗ ΤΩΝ ΜΕΓΑΛΩΝ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το ψευδώνυμο συμβατότητας **είναι** η πρακτική τους — *«type aliasing and forwarding
 * functions are invaluable for allowing existing users to continue to function while
 * introducing new systems and migrating users to them **non-atomically**»* (SWE at
 * Google, κεφ. 22 «Large-Scale Changes»). Έχει όμως **δύο μετρημένες αδυναμίες**:
 *
 * 1. **Δεν εμποδίζει νέες χρήσεις.** Ο κανόνας `no-deprecated` δεν πιάνει αξιόπιστα
 *    ψευδώνυμα re-export — γνωστό, ανοιχτό κενό *(`palantir/tslint#3751`)*.
 * 2. **Δεν πεθαίνει.** Η διαγραφή περιμένει να τη θυμηθεί άνθρωπος ή ένα ticket, και
 *    έτσι το «προσωρινό» ψευδώνυμο γίνεται το επόμενο **μόνιμο κάτοπτρο**.
 *
 * Εδώ κλείνουν **και τα δύο, μηχανικά**: το Κ3 μπλοκάρει κάθε **νέο** εισαγωγέα, και το
 * Κ4 είναι **αμφίδρομο** — το ψευδώνυμο επιτρέπεται να υπάρχει **αν και μόνο αν** το
 * χρειάζεται κάποιος. Τη στιγμή που φεύγει ο τελευταίος, αυτό το test γίνεται **ΚΟΚΚΙΝΟ
 * και απαιτεί τη διαγραφή του**. Ψευδώνυμο που δεν ξέρει πότε πεθαίνει δεν είναι
 * μετάβαση — είναι χρέος με άλλο όνομα.
 *
 * ⚠️ **ΤΟ `0` ΣΗΜΑΙΝΕΙ «ΚΑΝΕΙΣ ΔΕΝ ΚΟΙΤΑΞΕ» ΜΕΧΡΙ ΝΑ ΑΠΟΔΕΙΧΘΕΙ.** Η πρώτη εκδοχή
 * αυτού του μετρητή τύπωσε **0 εισαγωγείς** ενώ ο εισαγωγέας υπήρχε: το `node -e "…"`
 * είχε φάει ένα επίπεδο backslash και το `\b` είχε γίνει χαρακτήρας **backspace**, οπότε
 * το regex ταίριαζε με το τίποτα. Γι' αυτό το **Κ6** εκτελεί τους ανιχνευτές σε
 * δείγματα **γνωστού θετικού ΚΑΙ γνωστού αρνητικού** πριν εμπιστευτεί οποιονδήποτε
 * αριθμό — *κανένας αδρανής φρουρός*.
 */
import fs from 'fs';
import path from 'path';

const SRC_ROOT = path.resolve(__dirname, '..', '..', '..');

/**
 * Χτισμένο από κομμάτια **επίτηδες**: γραμμένο ολόκληρο, αυτό το αρχείο θα εμφανιζόταν
 * στη δική του σάρωση και θα μετρούσε τον εαυτό του (ίδιο ιδίωμα με το
 * `inline-editable-predicate-ratchet.test.ts`).
 */
const ALIAS = `Listing${'GeoFilter'}`;

/** Ο ΜΟΝΟΣ επιτρεπτός εισαγωγέας του ψευδωνύμου, με τον λόγο του. */
/**
 * ✅ **ΑΔΕΙΑ — Η ΜΕΤΑΒΑΣΗ ΕΚΛΕΙΣΕ (2026-09-06).** Ο τελευταίος καταναλωτής
 * (`lib/agency/showcase-filter.ts`) μετανάστευσε, και **το Κ4 απαίτησε τη διαγραφή του
 * ψευδωνύμου την ίδια στιγμή** — ακριβώς όπως σχεδιάστηκε. Ο πίνακας μένει εδώ ως
 * **ενεργός φρουρός**: αν κάποιος ξαναγεννήσει ψευδώνυμο για τον χωρικό όρο, το Κ3 θα
 * απαιτήσει γραμμή **με λόγο**, και το Κ4 ημερομηνία λήξης.
 */
const PENDING_MIGRATION: ReadonlyMap<string, string> = new Map([]);

/**
 * Το ΜΟΝΟ αρχείο που επιτρέπεται να γράψει το σχήμα `{ center; radiusKm }` ανώνυμα —
 * γιατί εκεί **δεν** είναι ανώνυμο: εκεί ονομάζεται `GeoCircle`.
 */
const VOCABULARY_HOME = 'types/geo/coordinates.ts';

const SKIPPED_DIRECTORIES: ReadonlySet<string> = new Set([
  'node_modules',
  'coverage',
  'reports',
  '.next',
  'dist',
]);

/** Εισαγωγή του ψευδωνύμου — **πραγματικός** καταναλωτής, ποτέ αναφορά σε σχόλιο. */
const IMPORTS_ALIAS = new RegExp(`import[^;]*\\b${ALIAS}\\b[^;]*from`);

/** Το ανώνυμο δίδυμο: το σχήμα ξαναγραμμένο με το χέρι αντί να ζητηθεί με το όνομά του. */
const ANONYMOUS_TWIN = /center\s*:\s*GeoPoint\s*;[\s\S]{0,160}?radiusKm\s*:\s*number/;

function collectSourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIPPED_DIRECTORIES.has(entry.name)) continue;
      collectSourceFiles(path.join(dir, entry.name), acc);
      continue;
    }
    if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
      acc.push(path.join(dir, entry.name));
    }
  }
  return acc;
}

function relative(file: string): string {
  return path.relative(SRC_ROOT, file).split(path.sep).join('/');
}

const read = (rel: string): string => fs.readFileSync(path.join(SRC_ROOT, rel), 'utf8');

describe('ADR-777 §8.53 — ένα λεξιλόγιο για τον χωρικό όρο', () => {
  // Το ίδιο το αρχείο του test κρατά δείγματα· δεν μετρά τον εαυτό του.
  const files = collectSourceFiles(SRC_ROOT).filter(
    (file) => relative(file) !== 'lib/geo/__tests__/geo-circle-vocabulary.test.ts',
  );

  const importers = files.filter((f) => IMPORTS_ALIAS.test(fs.readFileSync(f, 'utf8'))).map(relative);
  const twins = files.filter((f) => ANONYMOUS_TWIN.test(fs.readFileSync(f, 'utf8'))).map(relative);

  /**
   * Κ6 ΠΡΩΤΑ, ΕΠΙΤΗΔΕΣ: αριθμός από ανιχνευτή που δεν αποδείχθηκε ζωντανός είναι
   * διακόσμηση. Ο ανιχνευτής πρέπει να λέει **ναι** στο γνωστό θετικό **και όχι** στο
   * γνωστό αρνητικό — αλλιώς το «0 παραβιάσεις» σημαίνει «δεν κοίταξα».
   */
  describe('Κ6 — κανένας αδρανής φρουρός: οι ανιχνευτές ΟΝΤΩΣ ανιχνεύουν', () => {
    it('ο ανιχνευτής εισαγωγής πιάνει πραγματική εισαγωγή του ψευδωνύμου', () => {
      const positive = `import { readGeoFilter, type ${ALIAS} } from '@/lib/listings/listing-filters';`;
      expect(IMPORTS_ALIAS.test(positive)).toBe(true);
    });

    it('…και ΔΕΝ πιάνει απλή αναφορά σε σχόλιο (αλλιώς θα μετρούσε πρόζα)', () => {
      const negative = ` * το ίδιο σχήμα με το \`${ALIAS}\` της οθόνης 2`;
      expect(IMPORTS_ALIAS.test(negative)).toBe(false);
    });

    it('ο ανιχνευτής διδύμου πιάνει το σχήμα ξαναγραμμένο με το χέρι', () => {
      const positive = 'interface X {\n  readonly center: GeoPoint;\n  readonly radiusKm: number;\n}';
      expect(ANONYMOUS_TWIN.test(positive)).toBe(true);
    });

    it('…και ΔΕΝ πιάνει επίπεδη φόρμα, όπου τα δύο πεδία ζουν χωριστά ΝΟΜΙΜΑ', () => {
      const negative = 'const shape = { lat: optionalNumber, radiusKm: optionalNumber };';
      expect(ANONYMOUS_TWIN.test(negative)).toBe(false);
    });
  });

  describe('Κ1 — ο πυρήνας είναι ΠΥΡΗΝΑΣ, δομικά', () => {
    /**
     * Ο Shared Kernel *(Evans)* ορίζεται ως *«κώδικας από τον οποίο μπορεί να εξαρτηθεί
     * οποιοδήποτε module, **αρκεί η εξάρτηση να μην αυξάνει τη σύζευξη**»*. Ένα αρχείο
     * λεξιλογίου που αποκτά εισαγωγές παύει να το εγγυάται: κάθε καταναλωτής του
     * κληρονομεί σιωπηλά ό,τι εισήγαγε. Η προϋπόθεση επιβάλλεται **εδώ**, όχι σε σχόλιο.
     */
    it('το types/geo/coordinates.ts δεν εισάγει ΤΙΠΟΤΑ', () => {
      const source = read(VOCABULARY_HOME);
      const imports = source.split('\n').filter((l) => /^\s*import\s/.test(l));
      expect(imports).toEqual([]);
    });

    it('το GeoCircle δηλώνεται εκεί, δίπλα στα υπόλοιπα ουσιαστικά του χώρου', () => {
      const source = read(VOCABULARY_HOME);
      expect(source).toContain('export interface GeoCircle');
      for (const sibling of ['GeoPoint', 'GeoOutline', 'GeoPolyline', 'GeoBoundingBox']) {
        expect(source).toContain(sibling);
      }
    });
  });

  describe('Κ2 — ο όρος δεν ξαναγράφεται ανώνυμα πουθενά αλλού', () => {
    it('το μόνο αρχείο με το σχήμα είναι εκείνο που του δίνει ΟΝΟΜΑ', () => {
      expect(twins).toEqual([VOCABULARY_HOME]);
    });

    it('κανείς δεν τρυπά πια μέσα στον τύπο των φίλτρων για να δανειστεί γεωμετρία', () => {
      const indexedAccess = `ListingFilters['near']`;
      const offenders = files
        .filter((f) => {
          const text = fs.readFileSync(f, 'utf8');
          // η αναφορά επιτρέπεται σε σχόλιο ιστορίας· απαγορεύεται σε κώδικα
          return text
            .split('\n')
            .some((line) => line.includes(indexedAccess) && !/^\s*(\*|\/\/)/.test(line));
        })
        .map(relative);
      expect(offenders).toEqual([]);
    });
  });

  describe('Κ3 — ΡΑΤΣΕΤ: το deprecated ψευδώνυμο ΜΟΝΟ χάνει καταναλωτές', () => {
    it('κανένας εισαγωγέας εκτός των δηλωμένων — ένας νέος ΜΠΛΟΚΑΡΕΤΑΙ', () => {
      const unexpected = importers.filter((f) => !PENDING_MIGRATION.has(f));
      expect(unexpected).toEqual([]);
    });

    it('η λίστα δεν κρατά ΜΠΑΓΙΑΤΙΚΗ εγγραφή — ό,τι μετανάστευσε φεύγει από εδώ', () => {
      const stale = [...PENDING_MIGRATION.keys()].filter((f) => !importers.includes(f));
      expect(stale).toEqual([]);
    });

    it('κάθε δηλωμένη εγγραφή φέρει ουσιαστικό λόγο, ποτέ κενό αλίμπι', () => {
      for (const [file, reason] of PENDING_MIGRATION) {
        expect(reason.length).toBeGreaterThan(40);
        expect(file).not.toBe('');
      }
    });
  });

  describe('Κ4 — ΑΥΤΟ-ΣΥΝΤΑΞΙΟΔΟΤΗΣΗ: το ψευδώνυμο ζει ΑΝ ΚΑΙ ΜΟΝΟ ΑΝ το χρειάζεται κάποιος', () => {
    /**
     * Αυτό είναι το βήμα πέρα από τη βιομηχανική πρακτική. Δεν ρωτά «υπάρχει ψευδώνυμο;»
     * ούτε «υπάρχουν καταναλωτές;» — ρωτά αν οι **δύο απαντήσεις συμφωνούν**. Έτσι η
     * διαγραφή δεν εξαρτάται από τη μνήμη κανενός: γίνεται **υποχρέωση της πύλης** τη
     * στιγμή ακριβώς που ο τελευταίος καταναλωτής φεύγει.
     */
    it('η ύπαρξη του ψευδωνύμου ΤΑΥΤΙΖΕΤΑΙ με την ύπαρξη καταναλωτή', () => {
      const filters = read('lib/listings/listing-filters.ts');
      const declared = new RegExp(`export type ${ALIAS}\\s*=`).test(filters);

      expect(declared).toBe(importers.length > 0);
    });

    it('όσο ζει, φέρει @deprecated ΚΑΙ δείχνει τον διάδοχο — αλλιώς δεν είναι μετάβαση', () => {
      const filters = read('lib/listings/listing-filters.ts');
      if (!new RegExp(`export type ${ALIAS}\\s*=`).test(filters)) return; // ήδη σβήστηκε
      const doc = filters.slice(0, filters.indexOf(`export type ${ALIAS}`));
      expect(doc).toContain('@deprecated');
      expect(doc).toContain('GeoCircle');
    });
  });
});
