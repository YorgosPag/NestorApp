/**
 * @fileoverview 🔴 **Η ΑΓΚΥΡΑ ΠΑΝΩ ΣΤΗ ΔΙΑΝΕΜΟΜΕΝΗ ΙΕΡΑΡΧΙΑ** — ADR-846 · ADR-772.
 *
 * Οι υπόλοιπες άγκυρες της εμβέλειας κρίνουν **λογική** με ταυτότητες που τους δίνουμε
 * *(`coverage-match.test.ts`)* ή **γεωμετρία** *(`admin-footprints-data.test.ts`)*.
 * Αυτή ρωτά το μόνο πράγμα που καμία άλλη δεν ρωτά:
 *
 * > **«Είναι το αρχείο ταυτοτήτων που ΔΙΑΝΕΜΟΥΜΕ ικανό να απαντήσει;»**
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΓΡΑΦΤΗΚΕ — ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ ΠΟΥ ΤΗΝ ΠΛΗΡΩΣΕ
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Το `scripts/update-municipalities.py` πρόσθεσε **οκτώ** δήμους μετά-Κλεισθένη με
 * **χειρόγραφους** κωδικούς και γονείς. Κανείς δεν ρώτησε αν οι κωδικοί ήταν ελεύθεροι
 * — και **τρεις** έπεσαν πάνω σε υπαρκτούς δήμους. Το αποτέλεσμα δεν ήταν σφάλμα: ήταν
 * **σιωπή**. Ο `Map.set` κρατά τον **τελευταίο**, άρα ο ΔΗΜΟΣ ΝΕΣΤΟΥ εξαφανίστηκε πίσω
 * από άλλον δήμο, και ο γεννήτορας αποτυπωμάτων — ο **μόνος** που το πρόσεξε — απλώς
 * **αρνήθηκε** να δώσει γεωμετρία και στους δύο. Τρεις υπαρκτοί δήμοι *(Νέστου,
 * Δεσκάτης, Παξών)* έγιναν **γεωγραφικά αόρατοι**, χωρίς ούτε μία κόκκινη γραμμή.
 *
 * 🔑 **Η άγκυρα διαβάζει το `public/`** — το ίδιο byte-προς-byte αρχείο που κατεβάζει ο
 * φυλλομετρητής *(`useAdministrativeHierarchy`)* και που διαβάζει ο διακομιστής
 * *(`services/places/administrative-hierarchy.reader`)*. Άγκυρα πάνω στο `src/data`
 * θα επικύρωνε **αντίγραφο**, όχι ό,τι φτάνει στον άνθρωπο.
 *
 * ⚠️ **ΚΑΘΕ ΚΡΙΤΗΡΙΟ ΕΙΝΑΙ ΕΡΩΤΗΣΗ ΠΟΥ ΚΑΜΙΑ ΑΛΛΗ ΔΕΝ ΚΑΝΕΙ.** Αν προσθέσεις κριτήριο,
 * γράψε **ποιο περιστατικό** θα είχε πιάσει· αλλιώς είναι θόρυβος.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { HIERARCHY_SOURCE, lineageIdsOf } from '@/hooks/useAdministrativeHierarchy';

// =============================================================================
// ΤΟ ΑΡΧΕΙΟ — ΑΠΟ ΤΟΝ ΔΙΣΚΟ, ΑΠΟ ΤΗ ΔΗΜΟΣΙΑ ΔΙΑΔΡΟΜΗ
// =============================================================================

const PUBLIC_DIR = join(process.cwd(), 'public', 'data');
const BUNDLED_DIR = join(process.cwd(), 'src', 'data');
const PUBLIC_PATH = join(PUBLIC_DIR, 'administrative-hierarchy.json');

interface HierarchyRow {
  readonly id: string;
  readonly n: string;
  readonly c: string;
  readonly p: string | null;
  readonly l: number;
}

interface HierarchyFile {
  readonly meta: { readonly counts: Readonly<Record<string, number>> };
  readonly data: readonly HierarchyRow[];
}

const file = JSON.parse(readFileSync(PUBLIC_PATH, 'utf8')) as HierarchyFile;
const rows = file.data;

/**
 * Το πρόθεμα ταυτότητας κάθε βαθμίδας — **η ίδια σύμβαση** που παράγει το `id` και την
 * οποία διαβάζουν πελάτης και διακομιστής. Γράφεται εδώ ως **προσδοκία**, ώστε μια
 * σιωπηλή μετονομασία προθέματος να γίνει κόκκινη αντί για «κανένα αποτέλεσμα».
 */
const LEVEL_PREFIX: Readonly<Record<number, string>> = {
  1: 'major_geographic_unit',
  2: 'decentralized_administration',
  3: 'region',
  4: 'regional_unit',
  5: 'municipality',
  6: 'municipal_unit',
  7: 'community',
  8: 'settlement',
};

/** Το κλειδί του `meta.counts` ανά βαθμίδα — η δήλωση πλήθους που ενημερώνει ο γεννήτορας. */
const LEVEL_COUNT_KEY: Readonly<Record<number, string>> = {
  1: 'major_geographic_units',
  2: 'decentralized_administrations',
  3: 'regions',
  4: 'regional_units',
  5: 'municipalities',
  6: 'municipal_units',
  7: 'communities',
  8: 'settlements',
};

const MUNICIPALITY_LEVEL = 5;
const LEVELS = Object.keys(LEVEL_PREFIX).map(Number);

/** Πόσα δείχνουμε σε αποτυχία — αρκετά για διάγνωση, όχι τοίχος κειμένου. */
const SAMPLE = 8;

/** Η αποτυχία ως **πρόταση**: πλήθος + δείγμα. Ένα σκέτο `toHaveLength(0)` δεν διαγιγνώσκει. */
function summarize(bad: readonly HierarchyRow[]): string {
  if (bad.length === 0) return 'καμία';
  const shown = bad.slice(0, SAMPLE).map((row) => `${row.id} «${row.n}»`);
  const rest = bad.length > SAMPLE ? ` … (+${bad.length - SAMPLE} ακόμη)` : '';
  return `${bad.length}: ${shown.join(' · ')}${rest}`;
}

// =============================================================================
// Κ0 — ΜΙΑ ΑΥΘΕΝΤΙΑ, ΟΧΙ ΔΥΟ
// =============================================================================

describe('Κ0 · κανένα δεδομένο δεν έχει δύο ιδιοκτήτες', () => {
  /**
   * 🔴 **Η ΚΛΑΣΗ, ΟΧΙ ΤΟ ΔΕΙΓΜΑ.** Η ιεραρχία υπήρχε **δύο φορές** *(`src/data/` +
   * `public/data/`, ίδιο md5, 4,17 MB το καθένα)*: ο πελάτης και ο διακομιστής διάβαζαν
   * το δημόσιο, το script ενημέρωσης έγραφε στο **άλλο** — μια διόρθωση θα έφτανε στον
   * έναν και **ποτέ** στον άλλο.
   *
   * ⚠️ **Και δεν ήταν μοναδικό**: το `public-services-registry.json` είχε **ακριβώς** το
   * ίδιο δίδυμο *(840 KB ×2, ίδιο md5, μηδέν καταναλωτές στο `src/`)*. Γι' αυτό το
   * κριτήριο ρωτά για **κάθε** αρχείο του `public/data/`, όχι για ένα με το όνομά του:
   * ένα κριτήριο καρφωμένο στο δείγμα θα άφηνε το δεύτερο δίδυμο ζωντανό.
   *
   * 🔑 **Η γέννηση του διδύμου είναι καταγεγραμμένη**: commit `12f97cd8`
   * *«fix(data): load administrative+service JSON via fetch from /public»* — αντέγραψε
   * και τα δύο στο `public/`, και **ξέχασε να σβήσει** τα πρωτότυπα.
   */
  it('κανένα αρχείο του `public/data/` δεν έχει δίδυμο στο `src/data/`', () => {
    const twins = readdirSync(PUBLIC_DIR).filter((name) =>
      existsSync(join(BUNDLED_DIR, name)),
    );
    expect(twins).toEqual([]);
  });
});

// =============================================================================
// Κ1 — ΟΙ ΔΥΟ ΤΑΥΤΟΤΗΤΕΣ ΠΟΥ ΠΡΕΠΕΙ ΝΑ ΕΙΝΑΙ ΜΟΝΑΔΙΚΕΣ
// =============================================================================

describe('Κ1 · κάθε ταυτότητα ανήκει σε ΕΝΑΝ', () => {
  it('κάθε `id` εμφανίζεται ακριβώς ΜΙΑ φορά', () => {
    const seen = new Map<string, HierarchyRow>();
    const collisions: string[] = [];

    for (const row of rows) {
      const first = seen.get(row.id);
      if (first === undefined) seen.set(row.id, row);
      else collisions.push(`${row.id} = «${first.n}» ΚΑΙ «${row.n}»`);
    }

    expect(collisions).toEqual([]);
  });

  /**
   * 🔑 **Δεύτερη ερώτηση, όχι η ίδια.** Ο `build-admin-footprints` δεν ρωτά με `id` —
   * ρωτά με `<επίπεδο>:<κωδικός Καλλικράτη>`, γιατί έτσι έρχεται η γεωμετρία από το WFS.
   * Δύο γραμμές μπορούν να έχουν **διαφορετικό** `id` και **ίδιο** `(l, c)`: τότε το
   * `id` περνά και η **γεωμετρία** σιωπά. Το ένα κριτήριο δεν καλύπτει το άλλο.
   */
  it('κάθε ζεύγος (επίπεδο, κωδικός) εμφανίζεται ακριβώς ΜΙΑ φορά', () => {
    const seen = new Map<string, HierarchyRow>();
    const collisions: string[] = [];

    for (const row of rows) {
      const key = `${row.l}:${row.c}`;
      const first = seen.get(key);
      if (first === undefined) seen.set(key, row);
      else collisions.push(`${key} = «${first.n}» ΚΑΙ «${row.n}»`);
    }

    expect(collisions).toEqual([]);
  });
});

// =============================================================================
// Κ2 — ΤΟ ΣΧΗΜΑ ΤΗΣ ΤΑΥΤΟΤΗΤΑΣ ΚΑΙ ΤΟΥ ΔΕΣΜΟΥ
// =============================================================================

describe('Κ2 · η ταυτότητα ΠΑΡΑΓΕΤΑΙ, δεν επινοείται', () => {
  it('κάθε `id` είναι ακριβώς `<πρόθεμα επιπέδου>:<κωδικός>`', () => {
    const bad = rows.filter((row) => row.id !== `${LEVEL_PREFIX[row.l]}:${row.c}`);
    expect(summarize(bad)).toBe('καμία');
  });

  it('κάθε δηλωμένος γονέας ΥΠΑΡΧΕΙ ως γραμμή', () => {
    const ids = new Set(rows.map((row) => row.id));
    const bad = rows.filter((row) => row.p !== null && !ids.has(row.p));
    expect(summarize(bad)).toBe('καμία');
  });
});

// =============================================================================
// Κ3 — ΤΟ ΕΡΩΤΗΜΑ ΤΟΥ ΕΠΙΣΚΕΠΤΗ, ΠΑΝΩ ΣΤΟΝ ΠΡΑΓΜΑΤΙΚΟ ΑΝΑΓΝΩΣΤΗ
// =============================================================================

describe('Κ3 · κάθε τόπος ξέρει σε ΠΟΙΟΝ ΔΗΜΟ ανήκει', () => {
  beforeAll(async () => {
    // 🔑 Ο **πραγματικός** `lineageIdsOf` πάνω στο **πραγματικό** αρχείο: ό,τι απαντά
    //    εδώ είναι ό,τι απαντά στον φυλλομετρητή. Δεύτερη υλοποίηση περιπάτου θα
    //    επαλήθευε τη φαντασία μας, όχι τον κώδικα (N.18).
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (!url.endsWith('/data/administrative-hierarchy.json')) {
        throw new Error(`Απρόσμενο fetch: ${url}`);
      }
      return { json: async () => file } as Response;
    }) as typeof fetch;

    await HIERARCHY_SOURCE.load();
  });

  it('ο τεμπέλης φορτωτής γέμισε — αλλιώς κάθε επόμενο κριτήριο είναι κενό', () => {
    // ⚠️ Χωρίς αυτό, ένα `lineageIdsOf` που επιστρέφει παντού `[]` θα έκανε το επόμενο
    //    κριτήριο **κόκκινο για λάθος λόγο** — ή, χειρότερα, πράσινο αν το γυρίζαμε
    //    ανάποδα. Η φόρτωση δηλώνεται, δεν υπονοείται.
    expect(HIERARCHY_SOURCE.peek()?.entities.size ?? 0).toBeGreaterThan(20_000);
  });

  /**
   * 🔴 **Το ελάττωμα που πιάνει**: 176 κοινότητες και 465 οικισμοί έχουν `p: null` —
   * είναι **αποκομμένοι** από το δέντρο *(οι δήμοι τους δεν έχουν δημοτικές ενότητες,
   * και ο γεννήτορας δεν κρέμασε το παιδί έναν όροφο ψηλότερα)*. Ο επισκέπτης που
   * διαλέγει τέτοιον οικισμό **δεν βρίσκει** τον επαγγελματία που δήλωσε ολόκληρο τον
   * δήμο, γιατί η γενεαλογία του **δεν φτάνει ποτέ** στον δήμο. Κανένα πράσινο test δεν
   * το έβλεπε: ο κριτής απαντούσε **σωστά σε λάθος είσοδο**.
   */
  it('η γενεαλογία κάθε κοινότητας/οικισμού περνά από ΕΝΑΝ δήμο', () => {
    const municipalities = new Set(
      rows.filter((row) => row.l === MUNICIPALITY_LEVEL).map((row) => row.id),
    );
    const stranded = rows
      .filter((row) => row.l > MUNICIPALITY_LEVEL)
      .filter((row) => !lineageIdsOf(row.id).some((id) => municipalities.has(id)));

    expect(summarize(stranded)).toBe('καμία');
  });
});

// =============================================================================
// Κ4 — ΤΑ META ΛΕΝΕ ΤΗΝ ΑΛΗΘΕΙΑ
// =============================================================================

describe('Κ4 · η δήλωση πλήθους δεν παλιώνει σιωπηλά', () => {
  it.each(LEVELS)('το `meta.counts` του επιπέδου %i συμφωνεί με τις γραμμές', (level) => {
    const actual = rows.filter((row) => row.l === level).length;
    expect(file.meta.counts[LEVEL_COUNT_KEY[level]]).toBe(actual);
  });
});
