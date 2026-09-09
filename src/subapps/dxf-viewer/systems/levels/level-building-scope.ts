/**
 * level-building-scope — pure guard for the level↔storey↔building containment
 * invariant (ADR-845 Ο-18/Ο-19).
 *
 * ## Η ερώτηση
 *
 * *«Συμφωνεί το `buildingId` που **δηλώνει** ένα επίπεδο με το κτήριο που
 * **περιέχει** τον `floorId` του;»*
 *
 * Κανείς δεν τη ρωτούσε. Μετρημένο ζωντανά (2026-09-09): **3 στα 5** δεμένα
 * `dxf_viewer_levels` δήλωναν κτήριο **διαφορετικό** από το κτήριο του ορόφου
 * τους, και το `projectId` απέκλινε στα **ίδια τρία**. Δεν φάνηκε ποτέ με το μάτι
 * γιατί **έξι από τα επτά** κτήρια του μισθωτή λέγονται «Κτήριο Α».
 *
 * ## Γιατί δεν είναι κοσμητικό — **η γεωμετρία φεύγει από το κτήριό της**
 *
 * Το `floorId` δεν είναι ετικέτα: είναι το **κλειδί εμβέλειας κάθε BIM οντότητας**
 * (ADR-420, `bim-floor-scope.ts`). Επίπεδο με λάθος `floorId` γράφει τους τοίχους,
 * τα υποστυλώματα και τις σκάλες του **στον όροφο ξένου κτηρίου** — και ο 3Δ
 * aggregator εκείνου του κτηρίου τα **σερβίρει ως δικά του**. Μετρημένο: **17
 * υποστυλώματα + 1 σκάλα** ζουν σε ορόφους κτηρίων όπου ο μηχανικός **ποτέ** δεν
 * σχεδίασε, ενώ οι σωστοί όροφοι έχουν **0**. Ίδια κλάση με το ADR-399 sticky
 * `fileRecordId` που γέννησε τον αδελφό αυτού του αρχείου.
 *
 * ## Η αρχή — το κτήριο **παράγεται**, δεν συνυπάρχει
 *
 * Στο IFC (και στο Revit που το ακολουθεί) ο `IfcBuildingStorey` **περιέχεται**
 * στο `IfcBuilding` μέσω `IfcRelAggregates`: δεν υπάρχει όροφος που «δηλώνει»
 * άλλο κτήριο, γιατί το κτήριο **δεν είναι πεδίο του ορόφου** — είναι ο γονέας
 * του. Το δικό μας `Level` κρατά **δύο ανεξάρτητα** ξένα κλειδιά (`floorId` +
 * `buildingId`) που μπορούν να διαφωνήσουν· αυτό είναι το δομικό ελάττωμα.
 *
 * Άρα ο κανόνας: **όταν υπάρχει `floorId`, το `buildingId` είναι ΑΝΤΙΓΡΑΦΟ
 * (denormalised cache) του κτηρίου εκείνου του ορόφου** — ποτέ δεύτερη γνώμη.
 * Όταν δεν υπάρχει `floorId` (γενική κάτοψη έργου/κτηρίου — δεν είναι όροφος),
 * το `buildingId` είναι πρωτογενές και δεν έχει με τι να συγκριθεί.
 *
 * Pure + dependency-free (μηδέν imports), ώστε να εκτελείται **αυτούσιο** και
 * στον διακομιστή — ίδια απόφαση με το `cross-floor-link.ts`: ένας ορισμός, δύο
 * σημεία επιβολής.
 *
 * @module subapps/dxf-viewer/systems/levels/level-building-scope
 * @see subapps/dxf-viewer/systems/levels/cross-floor-link — ο αδελφός φρουρός (αρχείο↔όροφος)
 * @see docs/centralized-systems/reference/adrs/ADR-845-public-3d-execution.md §7.14
 */

/** Τα δύο ξένα κλειδιά εμβέλειας ενός επιπέδου, όπως ζουν στο Firestore. */
export interface LevelBuildingScopeInput {
  readonly floorId?: string | null;
  readonly buildingId?: string | null;
}

/**
 * Η ετυμηγορία. Ονομασμένη, όχι boolean: *«δεν μπορώ να κρίνω»* και *«κρίνω και
 * είναι λάθος»* είναι **διαφορετικές** απαντήσεις, και μια πύλη που τις μπερδεύει
 * είτε σιωπά όταν πρέπει να μιλήσει είτε κατηγορεί χωρίς στοιχεία.
 */
export type LevelBuildingScopeVerdict =
  /** Το επίπεδο δηλώνει τον όροφο ΚΑΙ το κτήριο που τον περιέχει. */
  | { readonly status: 'agrees'; readonly buildingId: string }
  /** Δεν υπάρχει αντιπαράθεση να κριθεί — και ο λόγος λέγεται. */
  | { readonly status: 'not-applicable'; readonly reason: NotApplicableReason }
  /** 🔴 Το επίπεδο δηλώνει κτήριο που ΔΕΝ περιέχει τον όροφό του. */
  | {
      readonly status: 'foreign-building';
      readonly declaredBuildingId: string;
      readonly actualBuildingId: string;
    };

export type NotApplicableReason =
  /** Γενική κάτοψη έργου/κτηρίου — δεν είναι όροφος, δεν έχει με τι να συγκριθεί. */
  | 'level-has-no-floor'
  /** Ο όροφος υπάρχει αλλά το επίπεδο δεν δήλωσε ποτέ κτήριο (legacy / bootstrap). */
  | 'level-has-no-building'
  /** Ο όροφος δεν βρέθηκε ή δεν δηλώνει κτήριο — **δεν κατηγορούμε χωρίς στοιχεία**. */
  | 'floor-building-unknown';

/**
 * Κρίνει την εμβέλεια ενός επιπέδου απέναντι στο κτήριο του **ίδιου του ορόφου
 * του**.
 *
 * Καθαρή: το κτήριο του ορόφου δίνεται ως **όρισμα** — αυτό το αρχείο δεν διαβάζει
 * ποτέ βάση. Έτσι ο ίδιος κανόνας τρέχει στον client (με τον όροφο από τη
 * συνδρομή), στον διακομιστή (με `floors/{id}` από το Admin SDK) και σε test
 * χωρίς καμία σκευή.
 *
 * ⚠️ **Συντηρητική εξ ορισμού**: επιστρέφει `foreign-building` **μόνο** όταν και
 * τα τρία είναι γνωστά και τα δύο κτήρια διαφέρουν. Άγνωστος όροφος ⇒ σιωπή, όχι
 * κατηγορία — αλλιώς κάθε κρεμάμενη αναφορά θα διαβαζόταν ως ασυνέπεια.
 *
 * @param level            Τα δύο πεδία εμβέλειας του επιπέδου.
 * @param floorBuildingId  Το `buildingId` του `floors/{level.floorId}` — ό,τι λέει
 *                         η **ιεραρχία**, όχι το επίπεδο.
 */
export function checkLevelBuildingScope(
  level: LevelBuildingScopeInput | null | undefined,
  floorBuildingId: string | null | undefined,
): LevelBuildingScopeVerdict {
  const floorId = level?.floorId;
  if (!floorId) return { status: 'not-applicable', reason: 'level-has-no-floor' };

  const declared = level?.buildingId;
  if (!declared) return { status: 'not-applicable', reason: 'level-has-no-building' };

  if (!floorBuildingId) return { status: 'not-applicable', reason: 'floor-building-unknown' };

  return declared === floorBuildingId
    ? { status: 'agrees', buildingId: floorBuildingId }
    : { status: 'foreign-building', declaredBuildingId: declared, actualBuildingId: floorBuildingId };
}

/**
 * Το ίδιο ερώτημα ως κατηγόρημα, για σημεία επιβολής που χρειάζονται μόνο
 * «ναι/όχι» (φρουρός γραφής, φίλτρο λίστας). Ο **λόγος** μένει διαθέσιμος από το
 * {@link checkLevelBuildingScope} — δεν ξαναγράφεται εδώ.
 */
export function isForeignBuildingLevel(
  level: LevelBuildingScopeInput | null | undefined,
  floorBuildingId: string | null | undefined,
): boolean {
  return checkLevelBuildingScope(level, floorBuildingId).status === 'foreign-building';
}

/**
 * 🏆 **Η ΑΔΙΑΙΡΕΤΗ ΑΝΑΘΕΣΗ ΕΜΒΕΛΕΙΑΣ** — ο λόγος που η ασυνέπεια μπορούσε να
 * γεννηθεί, εκφρασμένος ως τύπος.
 *
 * Η μετρημένη μηχανική του ελαττώματος: ο εισαγωγέας καλούσε
 * `updateLevelContext(levelId, { buildingId: Β, floorId: undefined })`. Το
 * `undefined` **δεν ταξιδεύει** μέσα από `JSON.stringify`, ο διακομιστής έβλεπε
 * `body.floorId === undefined` και **δεν άγγιζε** το πεδίο — άρα το επίπεδο
 * κρατούσε τον όροφο του **προηγούμενου** κτηρίου και αποκτούσε το `buildingId`
 * του **νέου**. Δύο πεδία, δύο ανεξάρτητες γραφές, μία σιωπηλή ασυμφωνία.
 *
 * Η θεραπεία δεν είναι έλεγχος — είναι **τύπος**: όροφος και κτήριο ταξιδεύουν
 * **μαζί ή καθόλου**. Δεν υπάρχει τιμή αυτού του τύπου που να γράφει το μισό
 * ζευγάρι. (Ίδιο σχήμα με το «η πρόθεση ταξιδεύει ΜΕ το γεγονός» του Ο-16 και το
 * ISO 19650 container ID του Ο-27.)
 */
export type LevelScopeAssignment =
  /** Το επίπεδο είναι **όροφος** κτηρίου: και τα δύο κλειδιά, το ένα δίπλα στο άλλο. */
  | { readonly kind: 'storey'; readonly floorId: string; readonly buildingId: string | null }
  /** Γενική κάτοψη **κτηρίου**: ρητά **χωρίς** όροφο — το `null` είναι εντολή καθαρισμού. */
  | { readonly kind: 'building'; readonly floorId: null; readonly buildingId: string }
  /** Γενική κάτοψη **έργου**: καμία από τις δύο ταυτότητες δεν ισχύει εδώ. */
  | { readonly kind: 'project' };

/**
 * Παράγει την αδιαίρετη ανάθεση από την επιλογή του εισαγωγέα.
 *
 * ⚠️ Το `floorId: null` του σκέλους `'building'` είναι **σκόπιμο και σημαντικό**:
 * `null` = *«αυτό το επίπεδο ΔΕΝ είναι όροφος»* και **σβήνει** τυχόν
 * κληρονομημένο όροφο, ενώ `undefined` θα σήμαινε *«μην αγγίξεις»* — δηλαδή
 * ακριβώς η σιωπή που γέννησε το ελάττωμα.
 */
export function resolveLevelScopeAssignment(
  selection: LevelBuildingScopeInput | null | undefined,
): LevelScopeAssignment {
  const floorId = selection?.floorId;
  if (floorId) return { kind: 'storey', floorId, buildingId: selection?.buildingId ?? null };

  const buildingId = selection?.buildingId;
  if (buildingId) return { kind: 'building', floorId: null, buildingId };

  return { kind: 'project' };
}

/**
 * Η ανάθεση ως **δύο πεδία γραφής** — η μοναδική μετάφραση από τον τύπο στο
 * `LevelContextUpdate` / `PATCH /api/dxf-levels`.
 *
 * ⚠️ **Καμία τιμή δεν λείπει ποτέ**: και τα δύο κλειδιά επιστρέφονται **πάντα**,
 * με `null` όπου η ταυτότητα δεν ισχύει. Ένα `undefined` εδώ θα σήμαινε *«μην
 * αγγίξεις»* και θα άφηνε την **προηγούμενη** τιμή να επιβιώσει δίπλα στη νέα —
 * που είναι ακριβώς η μηχανική του ελαττώματος.
 *
 * ⚠️ **Το σκέλος `'project'` καθαρίζει και τα δύο, εσκεμμένα**: μια γενική κάτοψη
 * έργου **δεν είναι όροφος**, και αν κρατούσε τον όροφο του προηγούμενου επιπέδου
 * κάθε οντότητα που θα σχεδιαστεί πάνω της θα αποθηκευόταν σε εκείνον τον όροφο
 * (ADR-420: το `floorId` **είναι** το κλειδί εμβέλειας) — δηλαδή η ίδια διαρροή
 * από άλλη πόρτα.
 */
export function levelScopeFields(assignment: LevelScopeAssignment): {
  readonly floorId: string | null;
  readonly buildingId: string | null;
} {
  switch (assignment.kind) {
    case 'storey':
      return { floorId: assignment.floorId, buildingId: assignment.buildingId };
    case 'building':
      return { floorId: null, buildingId: assignment.buildingId };
    case 'project':
      return { floorId: null, buildingId: null };
  }
}
