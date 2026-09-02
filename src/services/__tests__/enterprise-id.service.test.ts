import { EnterpriseIdService } from '../enterprise-id.service';
import { ENTERPRISE_ID_PREFIXES } from '../enterprise-id-prefixes';

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('EnterpriseIdService', () => {
  let service: EnterpriseIdService;

  beforeEach(() => {
    service = new EnterpriseIdService({ enableLogging: false, enableCache: true, cacheSize: 100 });
  });

  // ===== ID GENERATION =====
  describe('ID generation', () => {
    it('generateCompanyId returns string with comp_ prefix', () => {
      const id = service.generateCompanyId();
      expect(id).toMatch(/^comp_/);
    });

    it('generateProjectId returns string with proj_ prefix', () => {
      const id = service.generateProjectId();
      expect(id).toMatch(/^proj_/);
    });

    it('generateBuildingId returns string with bldg_ prefix', () => {
      const id = service.generateBuildingId();
      expect(id).toMatch(/^bldg_/);
    });

    it('generated ID contains valid UUID v4', () => {
      const id = service.generateCompanyId();
      const uuid = id.replace(/^comp_/, '');
      expect(uuid).toMatch(UUID_V4_REGEX);
    });

    it('generateFloorplanBackgroundId returns string with rbg_ prefix (ADR-340)', () => {
      const id = service.generateFloorplanBackgroundId();
      expect(id).toMatch(/^rbg_/);
      const uuid = id.replace(/^rbg_/, '');
      expect(uuid).toMatch(UUID_V4_REGEX);
    });

    it('sample of entity types have correct prefixes', () => {
      const tests: [string, string][] = [
        [service.generateContactId(), ENTERPRISE_ID_PREFIXES.CONTACT],
        [service.generateFloorId(), ENTERPRISE_ID_PREFIXES.FLOOR],
        [service.generateWorkspaceId(), ENTERPRISE_ID_PREFIXES.WORKSPACE],
        [service.generateTaskId(), ENTERPRISE_ID_PREFIXES.TASK],
        [service.generateSessionId(), ENTERPRISE_ID_PREFIXES.SESSION],
        [service.generateErrorId(), ENTERPRISE_ID_PREFIXES.ERROR],
        [service.generateFloorplanBackgroundId(), ENTERPRISE_ID_PREFIXES.RASTER_BACKGROUND],
      ];

      for (const [id, expectedPrefix] of tests) {
        expect(id.startsWith(`${expectedPrefix}_`)).toBe(true);
      }
    });
  });

  // ===== UNIQUENESS =====
  describe('uniqueness', () => {
    it('100 generated IDs are all unique', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(service.generateCompanyId());
      }
      expect(ids.size).toBe(100);
    });

    it('IDs from different generators are unique', () => {
      const ids = new Set([
        service.generateCompanyId(),
        service.generateProjectId(),
        service.generateBuildingId(),
        service.generateContactId(),
        service.generateTaskId()
      ]);
      expect(ids.size).toBe(5);
    });
  });

  // ===== DETERMINISTIC COMPOSITES =====
  describe('deterministic composite keys', () => {
    it('generateAiUsageDocId is deterministic', () => {
      const id1 = service.generateAiUsageDocId('telegram', 'user123', '2026-04');
      const id2 = service.generateAiUsageDocId('telegram', 'user123', '2026-04');
      expect(id1).toBe(id2);
    });

    it('generateAiUsageDocId varies with params', () => {
      const id1 = service.generateAiUsageDocId('telegram', 'user123', '2026-04');
      const id2 = service.generateAiUsageDocId('telegram', 'user456', '2026-04');
      expect(id1).not.toBe(id2);
    });

    it('generateQueryStrategyDocId sorts filters', () => {
      const id1 = service.generateQueryStrategyDocId('contacts', ['status', 'name']);
      const id2 = service.generateQueryStrategyDocId('contacts', ['name', 'status']);
      expect(id1).toBe(id2);
    });

    it('generateChatHistoryDocId is deterministic', () => {
      const id1 = service.generateChatHistoryDocId('telegram', '12345');
      const id2 = service.generateChatHistoryDocId('telegram', '12345');
      expect(id1).toBe(id2);
    });
  });

  // ===== DETERMINISTIC ENTITY GENERATORS — Η ΚΛΑΣΗ, ΟΧΙ ΤΟ ΔΕΙΓΜΑ (ADR-841 Α9.7) =====
  //
  // 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ — ΜΕΤΡΗΜΕΝΟ 2026-09-02, ΖΩΝΤΑΝΟ ΣΦΑΛΜΑ:
  // ο `deterministicUuid` εκπέμπει nibble έκδοσης **5** (name-based), ενώ ο
  // επικυρωτής του ΙΔΙΟΥ έργου (`enterprise-id-parse.ts`, `UUID_V4`) δέχεται
  // **μόνο 4** ⇒ `isValidEnterpriseId('comp_<v5>')` → `false`. Το
  // `readsAsWorkspaceIdentity` απέρριπτε την ταυτότητα, ο `resolveAlias` έπεφτε
  // στο `workspace_aliases`, δεν έβρισκε, και το `/pro/<ταυτότητα>` έδειχνε
  // «Δεν υπάρχει βιτρίνα σε αυτή τη διεύθυνση» για βιτρίνα που ΥΠΗΡΧΕ και
  // φαινόταν στον κατάλογο.
  //
  // 🔑 ΓΙΑΤΙ ΑΠΑΡΙΘΜΗΣΗ ΚΑΙ ΟΧΙ ΛΙΣΤΑ: άγκυρα καρφωμένη στο `comp_` φυλάει το
  // ΔΕΙΓΜΑ. Το σφάλμα είναι της ΜΗΧΑΝΗΣ (`generateDeterministicId`), άρα ισχύει
  // για κάθε γεννήτορα — και για όποιον προστεθεί ΑΥΡΙΟ. Η σάρωση της αλυσίδας
  // πρωτοτύπων βάζει τον καινούργιο στον έλεγχο ΧΩΡΙΣ να το θυμηθεί κανείς.
  // (Το `CLAUDE.md` μετρά ΤΕΣΣΕΡΑ περιστατικά χειρόγραφων λιστών που πάλιωσαν.)
  describe('deterministic entity-id generators (enumerated class contract)', () => {
    type SeededGenerator = (seed: string) => string;
    type NullaryGenerator = () => string;

    /**
     * Κάθε `generateDeterministic<Οντότητα>Id` της αλυσίδας πρωτοτύπων.
     * Η ΜΗΧΑΝΗ `generateDeterministicId(prefix, seed)` δεν ταιριάζει σκόπιμα:
     * μετά το `Deterministic` απαιτείται όνομα οντότητας ΚΑΙ κατάληξη `Id`.
     */
    const DETERMINISTIC_GENERATORS: readonly string[] = (() => {
      const found = new Set<string>();
      for (
        let proto: object | null = EnterpriseIdService.prototype;
        proto && proto !== Object.prototype;
        proto = Object.getPrototypeOf(proto) as object | null
      ) {
        for (const key of Object.getOwnPropertyNames(proto)) {
          if (!/^generateDeterministic[A-Z][A-Za-z0-9]*Id$/.test(key)) continue;
          if (typeof (proto as Record<string, unknown>)[key] === 'function') found.add(key);
        }
      }
      return [...found].sort();
    })();

    const call = (name: string, seed: string): string => {
      const fn = (service as unknown as Record<string, unknown>)[name];
      if (typeof fn !== 'function') throw new Error(`${name} is not callable on the service`);
      return (fn as SeededGenerator).call(service, seed);
    };

    // 🔑 ΚΑΤΩΦΛΙ, ΟΧΙ ΑΠΟΓΡΑΦΗ: αν το μοτίβο ονομασίας αλλάξει, η σάρωση γυρίζει
    // κενή και κάθε έλεγχος παρακάτω παύει να εξετάζει οτιδήποτε. Ο αριθμός είναι
    // ΚΑΤΩ ΦΡΑΓΜΑ (5 τη στιγμή γραφής) και μόνο μεγαλώνει.
    //
    // ⚠️ ΜΕΤΡΗΜΕΝΟ, ΟΧΙ ΥΠΟΤΕΘΕΝ (μετάλλαξη Α2, 2026-09-02): με κενή σάρωση το Jest
    // ΔΕΝ σιωπά — μετατρέπει κάθε `it.each([])` σε ΑΠΟΤΥΧΙΑ με ωμό «%s» στο όνομα.
    // Άρα αυτός εδώ δεν είναι το μόνο δίχτυ· είναι ο έλεγχος που ΟΝΟΜΑΖΕΙ την αιτία
    // αντί να αφήσει πέντε ακατανόητα «%s» να την κρύψουν.
    it('the sweep actually finds generators — an empty sweep is a broken anchor, not a clean tree', () => {
      expect(DETERMINISTIC_GENERATORS.length).toBeGreaterThanOrEqual(5);
    });

    /**
     * 🔴 **Η ΑΓΚΥΡΑ ΜΕΤΡΗΣΕ ΤΗΝ ΚΛΑΣΗ ΚΑΙ ΒΡΗΚΕ ΤΕΣΣΕΡΑ ΑΚΟΜΗ ΣΠΑΣΙΜΕΝΑ.**
     *
     * Η Φ6-Β θεράπευσε **μόνο** τον `generateDeterministicCompanyId` — γιατί μόνο
     * αυτός είχε ζωντανή εκδήλωση *(η σελίδα βιτρίνας)*. Η απαρίθμηση έδειξε ότι
     * **κάθε άλλος** ντετερμινιστικός γεννήτορας παράγει id που ο επικυρωτής του
     * ίδιου έργου λέει **άκυρο**. Δεν ήταν άγνωστο· ήταν **αμέτρητο**.
     *
     * ⚠️ **ΓΙΑΤΙ ΔΕΝ ΘΕΡΑΠΕΥΟΝΤΑΙ ΕΔΩ**: η καθολική θεραπεία *(v4 nibble στον
     * `deterministicUuid`, ή διεύρυνση του `UUID_V4`)* αλλάζει **κοινό πυρήνα** —
     * ορφανεύει κάθε ντετερμινιστικό id που έχει ήδη γραφτεί *(αρχεία,
     * αναθεωρήσεις σχεδίων)* και ξαναγράφει τον ορισμό του *«τι είναι enterprise
     * id»*. Είναι **απόφαση του Giorgio**, δηλωμένο ανοιχτό #2 του handoff της
     * Φ6-Β — όχι απόφαση του πράκτορα που έγραψε την άγκυρα.
     *
     * 🔑 **ΓΙΑΤΙ ΚΑΡΑΝΤΙΝΑ ΚΑΙ ΟΧΙ ΣΙΩΠΗ**: η άγκυρα κάνει την απόφαση **ασφαλή**.
     * Ένας **έκτος** γεννήτορας που θα γεννηθεί σπασμένος αύριο **κοκκινίζει
     * αμέσως** — δεν προστίθεται σιωπηλά στο χρέος. Και η καραντίνα είναι
     * **διπλής κατεύθυνσης** *(δες τον έλεγχο της καραντίνας παρακάτω)*: αν κάποιος θεραπεύσει έναν από
     * τους τέσσερις, ο έλεγχος **κοκκινίζει** ζητώντας να φύγει η γραμμή. Ίδιο
     * πρότυπο με κάθε baseline του έργου — «οι παραβιάσεις μόνο μειώνονται».
     */
    const V5_QUARANTINE: readonly string[] = [
      'generateDeterministicDrawingRevisionId',
      'generateDeterministicFileId',
      'generateDeterministicRailingId',
      'generateDeterministicSlabOpeningId',
    ];

    /**
     * ⚠️ **ΚΑΝΕΝΑ ΠΡΑΣΙΝΟ TEST ΔΕΝ ΕΠΙΤΡΕΠΕΤΑΙ ΝΑ ΛΕΕΙ ΨΕΜΑΤΑ.** Οι δύο λίστες
     * είναι **χωριστές** ώστε ο σπασμένος γεννήτορας να **ονομάζεται** στην
     * έξοδο ως χρέος, αντί να περνά σιωπηλά μέσα από ένα `if (…) return`.
     */
    const HEALTHY = DETERMINISTIC_GENERATORS.filter((name) => !V5_QUARANTINE.includes(name));

    // 🔴 Η ΚΥΡΙΑ ΑΓΚΥΡΑ: γεννήτορας ⟷ επικυρωτής, δεμένοι.
    it.each(HEALTHY)('%s produces an id that the OWN validator of this project accepts', (name) => {
      expect(service.validateId(call(name, 'anchor-seed'))).toBe(true);
    });

    // 🔑 Η ΑΛΛΗ ΚΑΤΕΥΘΥΝΣΗ: ο πίνακας καραντίνας ΔΕΝ ΜΠΟΡΕΙ να παλιώσει. Χωρίς
    // αυτό, μια γραμμή θα επιβίωνε της θεραπείας της και το χρέος θα φαινόταν
    // μεγαλύτερο απ' όσο είναι — «λίστα που πάλιωσε», το σχήμα που το `CLAUDE.md`
    // μετρά τέσσερις φορές. Όταν λυθεί το ανοιχτό #2, ΑΥΤΟ κοκκινίζει και ζητά
    // να αδειάσει η λίστα.
    // ⚠️ ΕΝΑ test, ΟΧΙ `it.each` — ΚΑΙ Ο ΛΟΓΟΣ ΜΕΤΡΗΘΗΚΕ (μετάλλαξη Α2): το Jest
    // μετατρέπει το `it.each([])` σε **ΑΠΟΤΥΧΙΑ**. Τη μέρα που λύνεται το ανοιχτό #2
    // και η καραντίνα αδειάζει, ένα `it.each` θα κοκκίνιζε τη σουίτα **επειδή το
    // χρέος ΕΞΟΦΛΗΘΗΚΕ** — τιμωρία για τη διόρθωση. Εδώ, άδεια λίστα = πράσινο, και
    // τότε ο έλεγχος **σβήνεται μαζί με τη σταθερά**.
    it('every quarantined generator is STILL rejected — declared debt, ADR-841 Α9.7 open #2', () => {
      const healed = V5_QUARANTINE.filter((name) => service.validateId(call(name, 'anchor-seed')));
      expect(healed).toEqual([]);
    });

    it('the v5 quarantine names only generators that EXIST', () => {
      const ghosts = V5_QUARANTINE.filter((name) => !DETERMINISTIC_GENERATORS.includes(name));
      expect(ghosts).toEqual([]);
    });

    // 🔑 ΤΟ «ΣΩΣΤΟ ΠΡΟΘΕΜΑ» ΧΩΡΙΣ ΧΕΙΡΟΓΡΑΦΟ ΠΙΝΑΚΑ: ο ντετερμινιστικός
    // γεννήτορας οφείλει να κόβει την ΙΔΙΑ οντότητα με τον τυχαίο αδελφό του
    // (`generateDeterministicFooId` ⟷ `generateFooId`). Ο πίνακας θα πάλιωνε·
    // ο αδελφός ζει δίπλα στον γεννήτορα και δεν παλιώνει ποτέ.
    it.each(DETERMINISTIC_GENERATORS)('%s mints the same kind as its random sibling', (name) => {
      const siblingName = name.replace('Deterministic', '');
      const sibling = (service as unknown as Record<string, unknown>)[siblingName];
      expect(typeof sibling).toBe('function');
      const prefixOf = (id: string): string => id.split('_')[0];
      expect(prefixOf(call(name, 'anchor-seed'))).toBe(
        prefixOf((sibling as NullaryGenerator).call(service)),
      );
    });

    /**
     * 🔴 **ΓΙΑΤΙ ΧΡΥΣΟ ΔΕΙΓΜΑ ΚΑΙ ΟΧΙ «δύο κλήσεις, ίδιο αποτέλεσμα» — ΜΕΤΡΗΜΕΝΟ.**
     *
     * Η πρώτη γραφή αυτής της άγκυρας έλεγχε `call(seed) === call(seed)`. Η
     * μετάλλαξη `deterministicUuid(seed + Date.now())` την άφησε **ΠΡΑΣΙΝΗ**: δύο
     * κλήσεις στο **ίδιο χιλιοστό** δίνουν τον ίδιο χρόνο. Η ισότητα **μέσα** στην
     * εκτέλεση είναι τυφλή σε εξάρτηση από **χρόνο, μηχανή ή στιγμιότυπο** — και
     * ακριβώς αυτές οι εξαρτήσεις σπάνε τον seeder.
     *
     * 🔑 **Το χρυσό δείγμα δεν είναι απλώς αυστηρότερο — είναι το ΣΩΣΤΟ συμβόλαιο.**
     * Το id **ΕΙΝΑΙ η διεύθυνση του εγγράφου** στο Firestore. Αν η τιμή για δεδομένο
     * σπόρο αλλάξει, κάθε **ήδη γραμμένο** έγγραφο γίνεται **απρόσιτο**: δεν είναι
     * θέμα στυλ, είναι **απώλεια δεδομένων**. Ο έλεγχος «ίδιος σπόρος ⇒ ίδιο id»
     * οφείλει να ισχύει **ΔΙΑΧΡΟΝΙΚΑ**, όχι μέσα στο ίδιο τρέξιμο.
     *
     * ⚠️ Οι τιμές είναι **καταγεγραμμένες, όχι επιλεγμένες**: παρήχθησαν από τους
     * ίδιους τους γεννήτορες (2026-09-02). Το `5` στο τρίτο τμήμα των τεσσάρων
     * τελευταίων **είναι** το χρέος της καραντίνας, ορατό με γυμνό μάτι.
     */
    const GOLDEN_SEED = 'anchor-seed';
    const GOLDEN_IDS: Readonly<Record<string, string>> = {
      generateDeterministicCompanyId: 'comp_a387d0b1-9ad7-4af3-8db1-b8faf2f9bf16',
      generateDeterministicDrawingRevisionId: 'drev_a387d0b1-9ad7-5af3-8db1-b8faf2f9bf16',
      generateDeterministicFileId: 'file_a387d0b1-9ad7-5af3-8db1-b8faf2f9bf16',
      generateDeterministicRailingId: 'ral_a387d0b1-9ad7-5af3-8db1-b8faf2f9bf16',
      generateDeterministicSlabOpeningId: 'slbopn_a387d0b1-9ad7-5af3-8db1-b8faf2f9bf16',
    };

    // Ένας ΝΕΟΣ γεννήτορας δεν μπορεί να μπει σιωπηλά: οφείλει να δηλώσει το
    // συμβόλαιο διάρκειάς του, αλλιώς αυτό κοκκινίζει.
    it('every enumerated generator has a recorded golden id', () => {
      const undeclared = DETERMINISTIC_GENERATORS.filter((name) => !(name in GOLDEN_IDS));
      expect(undeclared).toEqual([]);
    });

    // 🔑 Η ΙΔΙΟΤΗΤΑ ΠΟΥ ΚΡΑΤΑ ΤΟΝ SEEDER IDEMPOTENT (N.7.2 #3) — αφύλακτη ως σήμερα.
    // Χωρίς αυτήν, κάθε επανεκτέλεση σποράς γεννά ΝΕΑ εταιρεία και ΝΕΑ βιτρίνα, και
    // ο κατάλογος γεμίζει διπλότυπα που κανείς δεν ξεχωρίζει από τα αληθινά.
    it.each(DETERMINISTIC_GENERATORS)('%s still mints its recorded id', (name) => {
      expect(call(name, GOLDEN_SEED)).toBe(GOLDEN_IDS[name]);
    });

    it.each(DETERMINISTIC_GENERATORS)('%s: a different seed yields a different id', (name) => {
      expect(call(name, 'seed-alpha')).not.toBe(call(name, 'seed-beta'));
    });
  });

  // ===== VALIDATION =====
  describe('validateId', () => {
    it('returns true for valid enterprise ID', () => {
      const id = service.generateCompanyId();
      expect(service.validateId(id)).toBe(true);
    });

    it('returns false for random string', () => {
      expect(service.validateId('random-string-here')).toBe(false);
    });

    it('returns false for empty string', () => {
      expect(service.validateId('')).toBe(false);
    });

    it('returns false for missing prefix', () => {
      expect(service.validateId('550e8400-e29b-41d4-a716-446655440000')).toBe(false);
    });
  });

  // ===== PARSING =====
  describe('parseId', () => {
    it('parses valid ID into components', () => {
      const id = service.generateCompanyId();
      const parsed = service.parseId(id);

      expect(parsed).not.toBeNull();
      expect(parsed!.prefix).toBe(ENTERPRISE_ID_PREFIXES.COMPANY);
      expect(parsed!.uuid).toMatch(UUID_V4_REGEX);
    });

    it('returns null for invalid ID', () => {
      expect(service.parseId('invalid')).toBeNull();
    });

    it('returns null for empty string', () => {
      expect(service.parseId('')).toBeNull();
    });
  });

  // ===== getIdType =====
  describe('getIdType', () => {
    it('returns prefix for valid ID', () => {
      const id = service.generateProjectId();
      expect(service.getIdType(id)).toBe(ENTERPRISE_ID_PREFIXES.PROJECT);
    });

    it('returns null for invalid ID', () => {
      expect(service.getIdType('not-an-id')).toBeNull();
    });
  });

  // ===== isLegacyId =====
  describe('isLegacyId', () => {
    it('enterprise ID is not legacy', () => {
      const id = service.generateCompanyId();
      expect(service.isLegacyId(id)).toBe(false);
    });

    it('random string is legacy', () => {
      expect(service.isLegacyId('old-format-id-12345')).toBe(true);
    });

    it('Date.now() style is legacy', () => {
      expect(service.isLegacyId('1700000000000')).toBe(true);
    });
  });

  // ===== STATS & CACHE =====
  describe('stats and cache', () => {
    it('getStats returns counters', () => {
      service.generateCompanyId();
      service.generateProjectId();
      const stats = service.getStats();

      expect(stats.totalGenerated).toBeGreaterThanOrEqual(2);
      expect(stats.config).toBeDefined();
    });

    it('clearCaches resets state', () => {
      service.generateCompanyId();
      service.clearCaches();
      const stats = service.getStats();
      expect(stats.cacheSize).toBe(0);
    });
  });
});
