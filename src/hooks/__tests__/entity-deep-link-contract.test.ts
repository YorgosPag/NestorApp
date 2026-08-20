/**
 * @fileoverview **ΑΓΚΥΡΕΣ ΠΗΓΑΙΟΥ ΚΩΔΙΚΑ: το συμβόλαιο δεν ξεχνιέται** (ADR-777 §8.31).
 * @related hooks/useEntityPageState · hooks/entity-selection-state
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΔΙΑΒΑΖΟΥΝ ΑΡΧΕΙΑ ΑΠΟ ΤΟΝ ΔΙΣΚΟ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το `entity-selection-state.test.ts` αποδεικνύει ότι η **συνάρτηση** αποφασίζει
 * σωστά. Δεν αποδεικνύει ότι κάποιος **τη ρωτά** — και το ζωντανό ελάττωμα ήταν
 * ακριβώς αυτό: κάθε κομμάτι σωστό, κανένας δεν έκανε την ερώτηση.
 *
 * Ίδιο σκεπτικό με την `Α1` του §8.30 (`property-card-route.test.ts`): *«η
 * ερώτηση που έλειπε είναι τι κάνει ο προορισμός»*.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const REPO_ROOT = join(__dirname, '..', '..', '..');
const read = (relative: string): string => readFileSync(join(REPO_ROOT, relative), 'utf8');

/**
 * 🔴 **ΧΩΡΙΣ ΣΧΟΛΙΑ, για κάθε έλεγχο «ΔΕΝ πρέπει να υπάρχει».**
 *
 * Οι πρώτες γραφές των `Α7` και `Α10` κοκκίνιζαν πάνω στα **δικά μας σχόλια**:
 * το `entity-deep-link-sources.ts` **ονομάζει** το `getStorageUnitById` για να
 * το απαγορεύσει, και το `trashed-status.ts` **εξηγεί** ότι ο διακομιστής είναι
 * `server-only`. Ένα σχόλιο που τεκμηριώνει τον κίνδυνο **δεν είναι** ο κίνδυνος
 * — αλλιώς κάθε προειδοποίηση προς τον επόμενο γίνεται η ίδια παράβαση
 * (ίδιο μάθημα με την άγκυρα `Κ7β` του CHECK 3.50).
 */
const withoutComments = (source: string): string =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

const GENERIC_HOOK = 'src/hooks/useEntityPageState.ts';

/** Οι τέσσερις λεπτοί προσαρμογείς πάνω στο κοινό εξάρτημα (ADR-203). */
const WRAPPERS = [
  'src/hooks/useBuildingsPageState.ts',
  'src/hooks/useStoragesPageState.ts',
  'src/hooks/useParkingPageState.ts',
  'src/hooks/useProjectsPageState.ts',
];

/** Οι τέσσερις οθόνες που τους μοντάρουν. */
const PAGES = [
  'src/components/building-management/BuildingsPageContent.tsx',
  'src/components/space-management/StoragesPage/StoragePageContent.tsx',
  'src/components/space-management/ParkingPage/ParkingPageContent.tsx',
  'src/components/projects/projects-page-content.tsx',
];

describe('ADR-777 §8.31 — το κοινό εξάρτημα ρωτά, και κανείς δεν το παρακάμπτει', () => {
  // ==========================================================================
  // Α1 — 🔴 Η ΑΥΤΟΜΑΤΗ ΕΠΙΛΟΓΗ ΠΕΡΝΑ ΥΠΟΧΡΕΩΤΙΚΑ ΑΠΟ ΤΟΝ ΦΡΟΥΡΟ
  // ==========================================================================

  it('Α1 🔴 το useEntityPageState δεν επιλέγει ΠΟΤΕ μόνο του χωρίς τον φρουρό', () => {
    const source = read(GENERIC_HOOK);

    // Η μοναδική επιτρεπτή αυτόματη επιλογή είναι πίσω από το `mayAutoSelectFirst`.
    expect(source).toContain('mayAutoSelectFirst(selection, autoSelectFirstItem)');

    // 🔴 Η παλιά γραφή. Αν ξαναγυρίσει, ο σύνδεσμος ξαναρχίζει να δείχνει ΑΛΛΗ
    // εγγραφή από αυτή που ζητήθηκε — σιωπηλά, όπως έκανε επί τέσσερις μήνες.
    expect(source).not.toMatch(/if\s*\(\s*autoSelectFirstItem\s*&&\s*!selectedItem/);

    // Η άδεια λίστα δεν ξανακρίνεται ως «δεν υπάρχει» (μάθημα Μ-Α).
    expect(source).not.toMatch(/if\s*\(\s*!items\.length\s*\)\s*return;/);
  });

  it('Α2 η απόφαση ζει σε ΚΑΘΑΡΗ συνάρτηση, όχι μέσα στο effect (Π5γ)', () => {
    const source = read(GENERIC_HOOK);
    expect(source).toContain("from './entity-selection-state'");
    expect(source).toContain('deriveEntitySelection<T>(');
  });

  // ==========================================================================
  // Α3 — ΤΟ `hasAnswered` ΕΙΝΑΙ ΥΠΟΧΡΕΩΤΙΚΟ, ΚΑΙ ΚΑΝΕΙΣ ΔΕΝ ΤΟ ΨΕΥΤΙΖΕΙ
  // ==========================================================================

  it('Α3 🔴 το hasAnswered δεν έχει προεπιλογή — ο μεταγλωττιστής υποχρεώνει απάντηση', () => {
    const source = read(GENERIC_HOOK);

    // Δηλωμένο ΧΩΡΙΣ `?`: προεπιλογή `true` θα σήμαινε ότι κάθε μελλοντικός
    // καταναλωτής που θα το ξεχνούσε θα ανακοίνωνε «δεν βρέθηκε» για εγγραφή
    // που απλώς δεν φόρτωσε ακόμη — το σχήμα «0 = κανείς δεν κοίταξε».
    expect(source).toMatch(/\n\s*hasAnswered: boolean;/);
    expect(source).not.toMatch(/hasAnswered\?\s*:/);
    expect(source).not.toMatch(/hasAnswered\s*=\s*true/);
  });

  it('Α4 και οι τέσσερις προσαρμογείς παραδίδουν τη ζωντανή κατάσταση της πηγής', () => {
    for (const wrapper of WRAPPERS) {
      const source = read(wrapper);
      expect(source).toContain('EntityPageStateOptions');
      // `...options` ΜΕΤΑ τις προεπιλογές: ο καλών μπορεί να παρακάμψει.
      expect(source).toContain('...options,');
    }
  });

  it('Α5 🔴 καμία οθόνη δεν καρφώνει «απάντησε» — το ρωτά τον φορτωτή της', () => {
    for (const page of PAGES) {
      const source = read(page);
      expect(source).toMatch(/hasAnswered:\s*!\w*[Ll]oading/);
      // Καρφωμένο `true` θα ήταν ψέμα με τον ίδιο ακριβώς μηχανισμό.
      expect(source).not.toMatch(/hasAnswered:\s*true/);
    }
  });

  // ==========================================================================
  // Α6 — Η ΑΠΑΝΤΗΣΗ ΦΤΑΝΕΙ ΣΤΟΝ ΑΝΘΡΩΠΟ
  // ==========================================================================

  it('Α6 και οι τέσσερις οθόνες ανακοινώνουν το «όχι» αντί να σιωπούν', () => {
    for (const page of PAGES) {
      const source = read(page);
      // ⚠️ Η ΧΡΗΣΗ, όχι η εισαγωγή. Η πρώτη γραφή έλεγχε σκέτο «DeepLinkNotice»
      // και έμενε ΠΡΑΣΙΝΗ όταν έσβηνε το στοιχείο από το JSX, γιατί η γραμμή
      // `import` αρκούσε — το βρήκε η μετάλλαξη, όχι η ανάγνωση.
      expect(source).toMatch(/<DeepLinkNotice\s+selection=\{selection\}/);
    }
  });

  // ==========================================================================
  // Α7 — 🔴 Η ΕΦΕΔΡΙΚΗ ΠΗΓΗ ΣΕΒΕΤΑΙ ΕΤΑΙΡΕΙΑ
  // ==========================================================================

  it('Α7 🔴 καμία οθόνη/hook δεν καλεί το getStorageUnitById (παρακάμπτει tenant)', () => {
    /*
     * 🔴 `services/storage.service.ts` → Admin SDK με σκέτο
     * `db.collection(...).doc(id).get()`, **κανέναν** έλεγχο `companyId`. Το
     * Admin SDK παρακάμπτει τους κανόνες Firestore ⇒ αν μια οθόνη το καλέσει με
     * ταυτότητα από τη διεύθυνση, διαβάζει **ξένη εταιρεία** (CHECK 3.35).
     */
    const offenders: string[] = [];
    for (const file of [...WRAPPERS, ...PAGES, 'src/hooks/entity-deep-link-sources.ts']) {
      if (/\bgetStorageUnitById\b/.test(withoutComments(read(file)))) offenders.push(file);
    }
    expect(offenders).toEqual([]);
  });

  it('Α8 οι εφεδρικές πηγές περνούν από τις διαδρομές με φύλακα εταιρείας', () => {
    const sources = read('src/hooks/entity-deep-link-sources.ts');
    expect(sources).toContain('API_ROUTES.STORAGES.BY_ID');
    expect(sources).toContain('API_ROUTES.PARKING.BY_ID');
    expect(sources).toContain('API_ROUTES.BUILDINGS.BY_ID');
  });

  it('Α9 🔴 το GET των κτιρίων υπάρχει και κρίνει ιδιοκτησία με τον ΙΔΙΟ φύλακα', () => {
    /*
     * Μέχρι το §8.31 αυτό το μονοπάτι είχε **μόνο** `DELETE`: μπορούσες να
     * σβήσεις κτίριο με ταυτότητα, αλλά όχι να το δεις.
     */
    const route = read('src/app/api/buildings/[buildingId]/route.ts');
    expect(route).toMatch(/export const GET\b/);
    expect(route).toContain('loadOwnedBuilding');
    expect(route).toContain("permissions: 'buildings:buildings:view'");
  });

  // ==========================================================================
  // Α10 — ΜΙΑ ΑΛΗΘΕΙΑ ΓΙΑ ΤΟ «ΣΤΟΝ ΚΑΔΟ»
  // ==========================================================================

  it('Α10 το «deleted» ορίζεται ΜΙΑ φορά, και ο διακομιστής το ξαναεξάγει', () => {
    const ssot = read('src/lib/firestore/trashed-status.ts');
    expect(ssot).toContain("export const TRASHED_STATUS = 'deleted'");
    expect(withoutComments(ssot)).not.toContain('server-only');

    const serverConfig = read('src/lib/firestore/soft-delete-config.ts');
    expect(serverConfig).toContain('export { TRASHED_STATUS } from "./trashed-status"');
    // Δεύτερη δήλωση εδώ θα ήταν δεύτερη αλήθεια που μπορεί να αποκλίνει.
    expect(serverConfig).not.toMatch(/const TRASHED_STATUS\s*=/);
  });

  // ==========================================================================
  // Α11 — ΚΑΝΕΙΣ ΝΕΟΣ ΚΑΤΑΝΑΛΩΤΗΣ ΔΕΝ ΞΕΦΕΥΓΕΙ ΣΙΩΠΗΛΑ
  // ==========================================================================

  it('Α11 κάθε αρχείο που καλεί useEntityPageState είναι γνωστό σε αυτές τις άγκυρες', () => {
    /*
     * ⚠️ Χωρίς αυτό, ένας **πέμπτος** καταναλωτής θα προσγειωνόταν αύριο χωρίς
     * καμία από τις παραπάνω άγκυρες να τον κοιτάζει — και οι Α4/Α5 θα έμεναν
     * πράσινες επειδή ελέγχουν **ονομαστική** λίστα. Ο έλεγχος «η λίστα είναι
     * πλήρης;» είναι αυτό που τις κρατά έγκυρες.
     */
    const hooksDir = join(REPO_ROOT, 'src', 'hooks');
    const callers = readdirSync(hooksDir)
      .filter((name) => name.endsWith('.ts'))
      .filter((name) => /useEntityPageState\(/.test(readFileSync(join(hooksDir, name), 'utf8')))
      .map((name) => `src/hooks/${name}`)
      .filter((path) => path !== GENERIC_HOOK)
      .sort();

    expect(callers).toEqual([...WRAPPERS].sort());
  });
});
