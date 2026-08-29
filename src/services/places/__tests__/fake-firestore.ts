/**
 * @fileoverview Ελάχιστος **πλαστός Firestore** για τις άγκυρες του επιπέδου Α.
 * @related services/places/public-place-write.service.ts
 *
 * ⚠️ **Δεν είναι προσομοίωση του Firestore** και δεν προσποιείται ότι είναι. Υλοποιεί
 * **ακριβώς** τις πράξεις που κάνει ο γραφέας — `doc().get/create/set`,
 * `where().where().limit().get()`, `batch().create().commit()` — ώστε οι άγκυρες να
 * κρίνουν **τη δική μας λογική** (ταυτότητα, κατάταξη, ερώτηση διπλότυπου) χωρίς
 * εξομοιωτή. Ό,τι αφορά **κανόνες πρόσβασης** δοκιμάζεται αλλού, σε **πραγματικό**
 * εξομοιωτή (`tests/firestore-rules/`), γιατί εκεί το ερώτημα είναι άλλο.
 *
 * 🔑 **Το `create()` πετά όταν το έγγραφο υπάρχει** — αυτό είναι το μόνο συμβόλαιο του
 * Firestore από το οποίο εξαρτάται η ορθότητα του γραφέα (N.6: ποτέ γραφή πάνω σε
 * υπάρχουσα ταυτότητα), οπότε ο πλαστός **οφείλει** να το τηρεί.
 */

type Doc = Record<string, unknown>;

interface WhereClause {
  readonly field: string;
  readonly op: '==' | '>=' | '<=';
  readonly value: unknown;
}

/** `a.b.c` → η τιμή, ή `undefined`. */
function readPath(doc: Doc, path: string): unknown {
  return path.split('.').reduce<unknown>(
    (node, key) => (node === null || typeof node !== 'object' ? undefined : (node as Doc)[key]),
    doc,
  );
}

/**
 * 🔴 **Η ΑΝΙΣΟΤΗΤΑ ΔΕΧΕΤΑΙ ΚΑΙ ΣΥΜΒΟΛΟΣΕΙΡΕΣ — ΚΑΙ Η ΑΠΟΥΣΙΑ ΤΟΥΣ ΗΤΑΝ ΤΥΦΛΟ ΣΗΜΕΙΟ**
 * (§8.33).
 *
 * Ο πλαστός συνέκρινε **μόνο αριθμούς**, οπότε κάθε ερώτημα εύρους πάνω σε
 * **ημερομηνία ISO** επέστρεφε σιωπηλά **κενό** — δηλαδή μια άγκυρα «βρες ό,τι έληξε»
 * θα ήταν πράσινη με **μηδέν** ευρήματα, για λόγο που δεν έχει καμία σχέση με τον
 * κώδικα που δοκιμάζει. Το ακριβές σχήμα «0 = κανείς δεν κοίταξε», μέσα στο εργαλείο
 * που υπάρχει για να το πιάνει.
 *
 * ⚠️ **Λεξικογραφική σύγκριση, όπως το πραγματικό Firestore.** Και είναι σωστή για ISO
 * χρονοσφραγίδες **ακριβώς επειδή** η μορφή είναι σταθερού πλάτους σε UTC: η αλφαβητική
 * σειρά **ταυτίζεται** με τη χρονολογική. Δεν είναι σύμπτωση — είναι ο λόγος που όλο
 * το έργο αποθηκεύει ISO αντί για epoch.
 *
 * ⚠️ **Ανόμοιοι τύποι ⇒ `false`**, ποτέ σύγκριση με εξαναγκασμό: το `'5' <= 10` της
 * JavaScript είναι `true`, και το πραγματικό Firestore **δεν** συγκρίνει ποτέ αριθμό
 * με συμβολοσειρά.
 */
function matches(doc: Doc, clause: WhereClause): boolean {
  const value = readPath(doc, clause.field);
  if (clause.op === '==') return value === clause.value;

  const comparable =
    (typeof value === 'number' && typeof clause.value === 'number') ||
    (typeof value === 'string' && typeof clause.value === 'string');
  if (!comparable) return false;

  const left = value as number | string;
  const right = clause.value as number | string;
  return clause.op === '>=' ? left >= right : left <= right;
}

export class FakeFirestore {
  /** συλλογή → (id → έγγραφο) */
  private readonly store = new Map<string, Map<string, Doc>>();

  /** Πόσες εγγραφές έγιναν — ώστε οι άγκυρες να μετρούν **πράξεις**, όχι μόνο κατάσταση. */
  public writes = 0;

  /**
   * Η βάση **δεν απαντά**.
   *
   * 🔴 **Υπάρχει επειδή το «δεν μάθαμε» χρειάζεται ΑΠΟΔΕΙΞΗ ΖΩΗΣ** (ADR-749 §5). Κάθε
   * καταναλωτής του επιπέδου Α οφείλει να ξεχωρίζει *«δεν υπάρχει»* από *«δεν
   * ρωτήθηκε επιτυχώς»* (SPEC-777A §13.7.2 #5) — και ένας κλάδος που **καμία** άγκυρα
   * δεν μπορεί να πυροδοτήσει είναι φρουρός χωρίς απόδειξη ζωής, όσο σωστά κι αν
   * γράφτηκε.
   */
  public failReads = false;

  private bucket(name: string): Map<string, Doc> {
    const existing = this.store.get(name);
    if (existing !== undefined) return existing;
    const created = new Map<string, Doc>();
    this.store.set(name, created);
    return created;
  }

  /** Ό,τι υπάρχει σε μια συλλογή — για τους ισχυρισμούς των άγκυρων. */
  public all<T>(collection: string): readonly T[] {
    return [...this.bucket(collection).values()] as T[];
  }

  public seed(collection: string, id: string, doc: Doc): void {
    this.bucket(collection).set(id, doc);
  }

  public collection(name: string): FakeCollection {
    return new FakeCollection(this, this.bucket(name), name);
  }

  public batch(): FakeBatch {
    return new FakeBatch(this);
  }

  /**
   * 🔴 **ΕΛΕΙΠΕ, ΚΑΙ Η ΑΠΟΥΣΙΑ ΤΟΥ ΕΙΝΑΙ ΤΟ ΙΔΙΟ ΣΧΗΜΑ ΜΕ ΤΟ `delete`** (§8.34).
   *
   * Το Admin SDK το εκθέτει **στη ρίζα** (`db.getAll(...refs)`) και είναι ο κανονικός
   * τρόπος να διαβαστούν N έγγραφα σε **ένα** ταξίδι — ό,τι κάνει ο κατάλογος εντολών
   * για τα ονόματα των πελατών. Χωρίς αυτό εδώ, η κλήση έσκαγε με *«db.getAll is not
   * a function»*, δηλαδή **καμία** άγκυρα δεν μπορούσε να ελέγξει τη μισή γραμμή του
   * καταλόγου.
   *
   * ⚠️ Επιστρέφει snapshot **και για τα ανύπαρκτα** (`exists: false`), όπως το
   * αληθινό: η σειρά αντιστοιχεί ένα προς ένα στις αναφορές που δόθηκαν, αλλιώς ο
   * καλών δεν μπορεί να ζευγαρώσει αποτέλεσμα με αίτημα.
   */
  public async getAll(
    ...refs: readonly FakeDocRef[]
  ): Promise<{ id: string; exists: boolean; data: () => Doc | undefined }[]> {
    return Promise.all(refs.map((ref) => ref.get()));
  }

  public countWrite(): void {
    this.writes += 1;
  }

  /**
   * 🔴 **Ο ΑΝΤΑΓΩΝΙΣΤΗΣ — Η ΣΚΑΝΔΑΛΗ ΠΟΥ ΚΑΝΕΙ ΤΟ CAS ΜΕΤΡΗΣΙΜΟ** (ADR-827 §9.21).
   *
   * Καλείται **μία φορά**, αμέσως μετά την **πρώτη** ανάγνωση μιας συναλλαγής, και
   * μετά μηδενίζεται. Είναι ο τρόπος να γραφτεί *«ο συνάδελφος πρόλαβε ανάμεσα στο
   * `get` και στο `commit`»* — το **μόνο** σενάριο που το CAS υπάρχει για να πιάσει.
   *
   * ⚠️ **Χωρίς αυτό, μια άγκυρα «διπλής αποδοχής» θα ήταν ΨΕΥΔΗΣ**: θα έσπερνε
   * `accepted` **πριν** την κλήση και θα δοκίμαζε τον απλό φρουρό της φάσης 1, όχι το
   * ξαναδιάβασμα μέσα στη συναλλαγή. Πράσινο test για μηχανισμό που δεν εκτελέστηκε.
   */
  public interfere: (() => void) | null = null;

  /**
   * 🔴 **ΕΛΕΙΠΕ — ΚΑΙ ΕΙΝΑΙ Η ΕΒΔΟΜΗ ΕΜΦΑΝΙΣΗ ΤΟΥ ΣΧΗΜΑΤΟΣ** «ο πλαστός δεν είχε τη
   * μέθοδο που μετράει» (ADR-827 §9.21).
   *
   * Η αποδοχή του Σ3 **είναι** συναλλαγή: τρεις γραφές ή καμία, με CAS στο `status`.
   * Χωρίς `runTransaction` εδώ, η κλήση έσκαγε με *«db.runTransaction is not a
   * function»* — δηλαδή **καμία** άγκυρα δεν μπορούσε να αγγίξει την καρδιά της Φάσης Β.
   *
   * ────────────────────────────────────────────────────────────────────────────
   * 🔑 ΞΑΝΑΕΚΤΕΛΕΙ ΤΟ ΣΩΜΑ ΣΕ ΣΥΓΚΡΟΥΣΗ — ΓΙΑΤΙ ΑΥΤΟ ΚΑΝΕΙ ΚΑΙ ΤΟ ΑΛΗΘΙΝΟ
   * ────────────────────────────────────────────────────────────────────────────
   *
   * Ένας πλαστός που απλώς **σειριοποιεί** τις πράξεις θα ήταν πιο **συγχωρητικός**
   * από την παραγωγή: δεν θα μπορούσε ποτέ να δείξει ότι το σώμα τρέχει δύο φορές —
   * δηλαδή θα έκρυβε ακριβώς τη βλάβη που η κεφαλίδα του
   * `mandate-acceptance.service.ts` απαγορεύει ονομαστικά *(παρενέργεια μέσα στη
   * συναλλαγή φεύγει **πολλές φορές**)*.
   *
   * Ο κύκλος: εκτέλεσε το σώμα με **αναβαλλόμενες** γραφές· πριν το commit, επαλήθευσε
   * ότι **κάθε** έγγραφο που διαβάστηκε είναι ακόμη όπως το είδαμε. Αν όχι,
   * **ξαναεκτέλεσε** — μέχρι {@link TRANSACTION_ATTEMPTS}.
   *
   * ⚠️ **Η σύγκριση είναι σειριοποίηση, όχι ταυτότητα αντικειμένου**: τα έγγραφα
   * κλωνοποιούνται σε κάθε ανάγνωση, οπότε μια σύγκριση με `===` θα κοκκίνιζε **πάντα**
   * και ο πλαστός θα εξαντλούσε τις προσπάθειες σε κάθε συναλλαγή.
   */
  public async runTransaction<T>(body: (transaction: FakeTransaction) => Promise<T>): Promise<T> {
    for (let attempt = 0; attempt < TRANSACTION_ATTEMPTS; attempt += 1) {
      const transaction = new FakeTransaction(this);
      const result = await body(transaction);

      if (transaction.readsAreStillValid()) {
        transaction.flush();
        return result;
      }
    }

    // ⚠️ Το αληθινό Admin SDK πετά `ABORTED` όταν εξαντληθούν οι προσπάθειες. Ένας
    //    πλαστός που «τα παρατούσε ήσυχα» θα επέστρεφε αποτέλεσμα από εκτέλεση που
    //    **δεν έγραψε τίποτα** — το χειρότερο δυνατό ψέμα προς την άγκυρα.
    throw new Error('ABORTED: too much contention');
  }

  /** Τι λέει **τώρα** ο δίσκος για ένα έγγραφο — για τον έλεγχο φρεσκάδας. */
  public snapshotOf(collection: string, id: string): string {
    return JSON.stringify(this.bucket(collection).get(id) ?? null);
  }

  public write(collection: string, id: string, doc: Doc): void {
    this.bucket(collection).set(id, doc);
    this.countWrite();
  }
}

/** Πόσες φορές ξαναδοκιμάζει το σώμα μιας συναλλαγής, όπως το Admin SDK. */
const TRANSACTION_ATTEMPTS = 5;

/**
 * **Η συναλλαγή**: αναγνώσεις που **καταγράφονται**, γραφές που **αναβάλλονται**.
 *
 * ⚠️ **Δεν επιβάλλει «όλα τα get πριν από κάθε write»**, παρότι το αληθινό Firestore
 * το απαιτεί. Είναι **δηλωμένη** απόκλιση: ο πλαστός εδώ υπάρχει για να κρίνει τη
 * **δική μας** λογική (CAS, ατομικότητα), και ένας επιπλέον έλεγχος σειράς θα
 * κοκκίνιζε με μήνυμα άσχετο με το ερώτημα κάθε άγκυρας.
 */
export class FakeTransaction {
  private readonly reads = new Map<string, string>();
  private readonly writes: (() => void)[] = [];
  private interfered = false;

  constructor(private readonly db: FakeFirestore) {}

  async get(ref: FakeDocRef): Promise<{ id: string; exists: boolean; data: () => Doc | undefined }> {
    const snapshot = await ref.get();

    // 🔴 **ΚΑΤΑΓΡΑΦΕΤΑΙ Ο,ΤΙ ΕΠΕΣΤΡΕΨΕ Η ΑΝΑΓΝΩΣΗ — ΟΧΙ Ο,ΤΙ ΛΕΕΙ Ο ΔΙΣΚΟΣ ΤΩΡΑ.**
    //    Η πρώτη γραφή ρωτούσε ξανά τον δίσκο (`snapshotOf`) και ήταν **λάθος με
    //    σιωπηλή συνέπεια**: όταν δύο `get` τρέχουν σε `Promise.all`, ο ανταγωνιστής
    //    προλαβαίνει ανάμεσά τους — και το δεύτερο κατέγραφε την **ήδη αλλαγμένη**
    //    τιμή ενώ επέστρεφε την παλιά. Δηλαδή ο έλεγχος φρεσκάδας συνέκρινε το νέο με
    //    το νέο, έβγαινε «έγκυρο», και **η συναλλαγή δέσμευε αγγελία που είχε ήδη
    //    ανατεθεί αλλού**. Το βρήκε η άγκυρα Α2, όχι η ανάγνωση.
    this.reads.set(
      `${ref.collectionName}/${ref.id}`,
      JSON.stringify(snapshot.data() ?? null),
    );

    // 🔴 Ο ανταγωνιστής χτυπά **εδώ**: ανάμεσα στην ανάγνωση και στο commit.
    if (!this.interfered && this.db.interfere !== null) {
      this.interfered = true;
      const strike = this.db.interfere;
      this.db.interfere = null;
      strike();
    }

    return snapshot;
  }

  set(ref: FakeDocRef, doc: Doc): void {
    this.writes.push(() => this.db.write(ref.collectionName, ref.id, doc));
  }

  update(ref: FakeDocRef, patch: Doc): void {
    this.writes.push(() => {
      void ref.update(patch);
    });
  }

  /** Είναι ακόμη αληθινό ό,τι διαβάσαμε; */
  readsAreStillValid(): boolean {
    for (const [key, seen] of this.reads) {
      const [collection, id] = key.split('/');
      if (this.db.snapshotOf(collection, id) !== seen) return false;
    }
    return true;
  }

  flush(): void {
    this.writes.forEach((apply) => apply());
  }
}

export class FakeDocRef {
  constructor(
    private readonly db: FakeFirestore,
    private readonly bucket: Map<string, Doc>,
    public readonly id: string,
    /**
     * ⚠️ **Η συλλογή ταξιδεύει μαζί με την αναφορά**, γιατί η συναλλαγή χρειάζεται
     * **σταθερό κλειδί** για να θυμάται τι διάβασε. Το Admin SDK το εκθέτει ως
     * `ref.path`· εδώ αρκεί το όνομα, και είναι ρητό αντί για παραγόμενο.
     */
    public readonly collectionName: string = '',
  ) {}

  /**
   * ⚠️ **Το `exists` ΕΙΝΑΙ μέρος του συμβολαίου, όχι ευκολία.** Το Admin SDK το εκθέτει
   * ως **ιδιότητα** (όχι μέθοδο, όπως ο πελάτης), και ο κώδικας που ρωτά *«υπάρχει
   * αυτός ο τόπος;»* ρωτά **αυτό**. Ένας πλαστός που έδινε μόνο `data()` θα ανάγκαζε
   * τον καταναλωτή να ρωτήσει αλλιώς **μέσα στο test** απ' ό,τι στην παραγωγή — δηλαδή
   * θα δοκίμαζε κώδικα που κανείς δεν εκτελεί.
   */
  async get(): Promise<{ id: string; exists: boolean; data: () => Doc | undefined }> {
    if (this.db.failReads) throw new Error('FAKE_FIRESTORE_UNAVAILABLE');
    const found = this.bucket.get(this.id);
    // 🔴 **Το `id` ΕΙΝΑΙ μέρος του συμβολαίου** (§8.34). Το Admin SDK το εκθέτει σε
    // **κάθε** snapshot, και ο κώδικας που ανασυνθέτει οντότητα γράφει
    // `{ ...snapshot.data(), id: snapshot.id }` — αλλιώς το `id` του εγγράφου χάνεται.
    // Χωρίς αυτό εδώ, η ανασύνθεση έδινε `id: undefined` **μέσα στο test** και το
    // πέρασμα ήταν πράσινο για κώδικα που στην παραγωγή δείχνει σε κενό αναγνωριστικό.
    return { id: this.id, exists: found !== undefined, data: () => found };
  }

  async create(doc: Doc): Promise<void> {
    if (this.bucket.has(this.id)) {
      throw new Error(`ALREADY_EXISTS: ${this.id}`);
    }
    this.bucket.set(this.id, doc);
    this.db.countWrite();
  }

  /**
   * 🔴 **ΤΟ `{ merge: true }` ΕΛΕΙΠΕ — ΕΚΤΗ ΕΜΦΑΝΙΣΗ ΤΟΥ ΣΧΗΜΑΤΟΣ** (ADR-827 §9.20).
   *
   * Ο πλαστός δεχόταν **μόνο** το έγγραφο και **αντικαθιστούσε πάντα**. Δηλαδή για
   * κάθε γραφέα που κάνει `set(patch, { merge: true })` — το κανονικό μοτίβο του
   * έργου για μερική ενημέρωση προφίλ — ο πλαστός **έσβηνε σιωπηλά κάθε άλλο πεδίο**
   * και **καμία άγκυρα δεν μπορούσε να το δει**: το test έγραφε ένα πεδίο, διάβαζε
   * ένα πεδίο, και έβγαινε πράσινο.
   *
   * 🔑 **Η βλάβη που θα περνούσε**: γραφέας που ξεχνά το `{ merge: true }` στην
   * παραγωγή **σβήνει ολόκληρο το προφίλ του ανθρώπου** — όνομα, εταιρεία, ρόλο.
   * Με τον παλιό πλαστό, ο σωστός και ο καταστροφικός γραφέας ήταν
   * **δυσδιάκριτοι**. Τώρα η μετάλλαξη «αφαίρεσε το merge» κοκκινίζει.
   *
   * ⚠️ Η συγχώνευση είναι **ρηχή**, όπως και του Admin SDK χωρίς `mergeFields`:
   * ένθετο αντικείμενο **αντικαθίσταται ολόκληρο**. Μη «βελτιώσεις» σε βαθιά —
   * θα ήταν πλαστός **πιο συγχωρητικός** από την παραγωγή.
   */
  async set(doc: Doc, options?: { readonly merge?: boolean }): Promise<void> {
    const next = options?.merge === true
      ? { ...(this.bucket.get(this.id) ?? {}), ...doc }
      : doc;
    this.bucket.set(this.id, next);
    this.db.countWrite();
  }

  /**
   * 🔴 **ΕΛΕΙΠΕ — ΚΑΙ ΕΙΝΑΙ Η ΠΕΜΠΤΗ ΕΜΦΑΝΙΣΗ ΤΟΥ ΙΔΙΟΥ ΣΧΗΜΑΤΟΣ** (ADR-827 §9.13).
   *
   * Ο γραφέας του κύκλου ζωής της ικανότητας
   * (`services/company/organization-capability.service.ts`) κάνει **μόνο** `update()`
   * με **μονοπάτι πεδίου** — και επειδή ο πλαστός δεν το είχε, **καμία** άγκυρα δεν
   * μπορούσε να τρέξει πάνω του: μηδέν αρχεία test τον ανέφεραν, δηλαδή ο ρυθμιστικός
   * κύκλος ζωής ήταν **αδοκίμαστος** χωρίς να το δηλώνει τίποτα.
   *
   * 🔑 **ΤΟ ΜΟΝΟΠΑΤΙ ΠΕΔΙΟΥ ΕΙΝΑΙ ΤΟ ΟΛΟ ΝΟΗΜΑ, ΟΧΙ ΛΕΠΤΟΜΕΡΕΙΑ.** Το
   * `update({ 'capabilities.brokerage_listings': record })` **δεν** γράφει κλειδί με
   * τελεία: γράφει **εμφωλευμένα**, **διατηρώντας τα αδέλφια**. Ένας πλαστός με σκέτο
   * `Object.assign` θα κρατούσε `settings` και `plan` κατά τύχη (γιατί δεν τα αγγίζει)
   * αλλά θα έφτιαχνε κλειδί `"capabilities.brokerage_listings"` — και κάθε ανάγνωση
   * μέσω {@link readPath} θα έβρισκε `undefined`. Δηλαδή **ο πλαστός θα δοκίμαζε
   * γραφή που η παραγωγή δεν κάνει.**
   *
   * ⚠️ **Πετά όταν το έγγραφο ΔΕΝ υπάρχει** — όπως το Admin SDK (`NOT_FOUND`). Ο
   * γραφέας βασίζεται σε αυτό: ρωτά πρώτα `get()` και επιστρέφει `absent`. Ένας
   * πλαστός που «δημιουργούσε» σιωπηλά θα έκρυβε ακριβώς αυτόν τον κλάδο.
   */
  async update(patch: Doc): Promise<void> {
    const current = this.bucket.get(this.id);
    if (current === undefined) throw new Error(`NOT_FOUND: ${this.id}`);

    // ⚠️ Αντίγραφο, ποτέ επιτόπια μετάλλαξη: οι άγκυρες κρατούν στιγμιότυπα από
    //    προηγούμενες αναγνώσεις, και ένα κοινόχρηστο αντικείμενο θα τα άλλαζε
    //    αναδρομικά — πράσινο test για κατάσταση που δεν υπήρξε ποτέ.
    const next: Doc = structuredClone(current);

    for (const [path, value] of Object.entries(patch)) {
      const keys = path.split('.');
      const leaf = keys.pop() as string;
      let node = next;
      for (const key of keys) {
        const child = node[key];
        if (child === null || typeof child !== 'object') node[key] = {};
        node = node[key] as Doc;
      }
      node[leaf] = value;
    }

    this.bucket.set(this.id, next);
    this.db.countWrite();
  }

  /**
   * 🔴 **ΕΛΕΙΠΕ, ΚΑΙ Η ΑΠΟΥΣΙΑ ΤΟΥ ΕΚΡΥΒΕ ΜΙΣΗ ΣΥΜΠΕΡΙΦΟΡΑ** (§8.33).
   *
   * Ο γραφέας της δημόσιας προβολής κάνει **δύο** πράξεις: γράφει όταν η αγγελία
   * είναι στην αγορά, και **σβήνει** όταν δεν είναι (απόσυρση · πουλημένο · εντολή
   * χωρίς έγκριση · ληγμένη εντολή). Χωρίς `delete` εδώ, ο δεύτερος κλάδος έσκαγε με
   * *«ref.delete is not a function»* — και επειδή ο γραφέας **δεν πετά ποτέ**, το
   * σφάλμα γινόταν σιωπηλό `'failed'` και **κάθε** άγκυρα πάνω στο «σβήνει» θα ήταν
   * πράσινη χωρίς να σβήσει τίποτα.
   *
   * ⚠️ **Idempotent**, όπως το Admin SDK: σβήσιμο ανύπαρκτου εγγράφου δεν είναι λάθος.
   */
  async delete(): Promise<void> {
    this.bucket.delete(this.id);
    this.db.countWrite();
  }
}

export class FakeQuery {
  constructor(
    private readonly bucket: Map<string, Doc>,
    private readonly clauses: readonly WhereClause[] = [],
    private readonly cap: number = Number.MAX_SAFE_INTEGER,
    /**
     * 🔴 **ΕΛΕΙΠΕ, ΚΑΙ ΗΤΑΝ ΑΚΡΙΒΩΣ ΤΟ ΣΧΗΜΑ ΠΟΥ Ο ΠΛΑΣΤΟΣ ΥΠΑΡΧΕΙ ΓΙΑ ΝΑ ΠΙΑΝΕΙ**
     * (ADR-827 §9.21, μετρημένο με μετάλλαξη Μ17).
     *
     * Το `failReads` ζούσε **μόνο** στο {@link FakeDocRef.get} — δηλαδή **κανένα
     * ερώτημα** δεν μπορούσε να αποτύχει ποτέ. Κάθε γραφέας που ρωτά με
     * `where().get()` και επιστρέφει `null` σε βλάβη είχε τον κλάδο του
     * **ανεκτέλεστο**: *«άγνωστο ≠ κενό»* γραμμένο, δοκιμασμένο **πουθενά**.
     *
     * 🔑 **Το βρήκε μετάλλαξη, όχι ανάγνωση**: το «βλάβη ⇒ άδεια εισερχόμενα» βγήκε
     * **ΠΡΑΣΙΝΟ** ενώ υπήρχε άγκυρα που νόμιζε ότι το φυλά — εκείνη πυροδοτούσε στην
     * **επόμενη** ανάγνωση (των δημόσιων προβολών), όχι στο ερώτημα.
     */
    private readonly failing: () => boolean = () => false,
  ) {}

  where(field: string, op: WhereClause['op'], value: unknown): FakeQuery {
    return new FakeQuery(
      this.bucket,
      [...this.clauses, { field, op, value }],
      this.cap,
      this.failing,
    );
  }

  limit(n: number): FakeQuery {
    return new FakeQuery(this.bucket, this.clauses, n, this.failing);
  }

  /**
   * 🔴 **Τα `id` ταξιδεύουν** (§8.34) — γι' αυτό διασχίζονται `entries()` και όχι
   * `values()`. Ένας κατάλογος που χτίζει γραμμές από ερώτημα χρειάζεται το κλειδί
   * κάθε εγγράφου για να τις ξεχωρίσει και να στείλει πράξη στη σωστή· χωρίς αυτό,
   * κάθε γραμμή θα είχε `undefined` κλειδί και το test θα ήταν πράσινο.
   */
  async get(): Promise<{ docs: { id: string; data: () => Doc }[]; size: number }> {
    if (this.failing()) throw new Error('FAKE_FIRESTORE_UNAVAILABLE');

    const hits = [...this.bucket.entries()]
      .filter(([, doc]) => this.clauses.every((clause) => matches(doc, clause)))
      .slice(0, this.cap);

    return {
      docs: hits.map(([id, doc]) => ({ id, data: () => doc })),
      size: hits.length,
    };
  }
}

export class FakeCollection extends FakeQuery {
  constructor(
    private readonly db: FakeFirestore,
    private readonly docs: Map<string, Doc>,
    private readonly name: string,
  ) {
    // ⚠️ **Συνάρτηση, όχι τιμή**: το `failReads` γυρίζει **μετά** τη δημιουργία της
    //    αναφοράς (`fake.failReads = true` στη μέση ενός test). Ένα στιγμιότυπο εδώ θα
    //    κρατούσε το `false` της κατασκευής και ο διακόπτης δεν θα έπιανε ποτέ.
    super(docs, [], undefined, () => db.failReads);
  }

  doc(id: string): FakeDocRef {
    return new FakeDocRef(this.db, this.docs, id, this.name);
  }
}

export class FakeBatch {
  private readonly pending: { ref: FakeDocRef; doc: Doc }[] = [];

  constructor(private readonly db: FakeFirestore) {}

  create(ref: FakeDocRef, doc: Doc): void {
    this.pending.push({ ref, doc });
  }

  async commit(): Promise<void> {
    // ⚠️ **Ατομικότητα**: όλα ή τίποτα. Ο γραφέας βασίζεται σε αυτό ώστε να μη
    // γεννηθεί ποτέ κτίριο χωρίς τη γη του — και ένας πλαστός που έγραφε ένα-ένα θα
    // έκρυβε ακριβώς αυτό το σφάλμα.
    for (const { ref } of this.pending) {
      const snapshot = await ref.get();
      if (snapshot.data() !== undefined) throw new Error(`ALREADY_EXISTS: ${ref.id}`);
    }
    for (const { ref, doc } of this.pending) await ref.create(doc);
    this.db.countWrite();
  }
}
