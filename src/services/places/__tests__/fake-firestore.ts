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

import { FieldValue } from 'firebase-admin/firestore';

type Doc = Record<string, unknown>;

interface WhereClause {
  readonly field: string;
  readonly op: '==' | '>=' | '<=' | '<' | '>' | 'in';
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
  // ADR-862 Φ0 Β14 — η μετανάστευση ρωτά `where('cdeState', 'in', [...])`.
  if (clause.op === 'in') return Array.isArray(clause.value) && clause.value.includes(value);

  const comparable =
    (typeof value === 'number' && typeof clause.value === 'number') ||
    (typeof value === 'string' && typeof clause.value === 'string');
  if (!comparable) return false;

  const left = value as number | string;
  const right = clause.value as number | string;
  // ADR-867 Ε10 — «το προηγούμενο ζωντανό μήνυμα» ρωτά `where('createdAt', '<', …)`: αυστηρή σύγκριση.
  if (clause.op === '<') return left < right;
  if (clause.op === '>') return left > right;
  return clause.op === '>=' ? left >= right : left <= right;
}

/** Είναι η τιμή το σύμβολο `FieldValue.delete()` του Admin SDK; */
function isFieldDelete(value: unknown): boolean {
  return value instanceof FieldValue && value.isEqual(FieldValue.delete());
}

/**
 * **Το βήμα ενός `FieldValue.increment(n)`**, ή `null` αν η τιμή δεν είναι αύξηση (ADR-777 §8.72).
 *
 * ⚠️ Το SDK κρατά το βήμα στο πεδίο `operand` χωρίς δημόσιο τύπο· το `isEqual` **επιβεβαιώνει** ότι η
 * τιμή είναι όντως αύξηση με αυτό το βήμα, ώστε να μη διαβαστεί ποτέ ως αύξηση κάτι άλλο.
 */
function incrementOperand(value: unknown): number | null {
  if (!(value instanceof FieldValue)) return null;
  const operand = (value as unknown as { readonly operand?: unknown }).operand;
  return typeof operand === 'number' && value.isEqual(FieldValue.increment(operand)) ? operand : null;
}

/**
 * 🔴 **Ο ΠΛΑΣΤΟΣ ΑΠΟΘΗΚΕΥΕ ΤΟ ΣΥΜΒΟΛΟ ΑΥΞΗΣΗΣ ΩΣ ΤΙΜΗ** (ADR-777 §8.72). Ένας μετρητής με
 * `FieldValue.increment(1)` γινόταν **αντικείμενο**, οπότε κάθε άγκυρα «μετρήθηκε μία φορά, όχι δύο»
 * θα ήταν τυφλή. Εδώ εφαρμόζεται πάνω στην υπάρχουσα τιμή, όπως στο αληθινό.
 */
function applyIncrements(existing: Doc, doc: Doc): Doc {
  const out: Doc = {};
  for (const [key, value] of Object.entries(doc)) {
    const step = incrementOperand(value);
    const previous = existing[key];
    out[key] = step === null ? value : (typeof previous === 'number' ? previous : 0) + step;
  }
  return out;
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

  /**
   * **Άδειασε τα πάντα** — για σουίτες που μοιράζονται **ένα** στιγμιότυπο.
   *
   * 🔴 **Χρειάζεται όταν το στιγμιότυπο είναι αιχμαλωτισμένο σε `jest.mock`** (ADR-841
   * §7 Α21.12): εκεί ο ψεύτικος δεν μπορεί να ξαναγεννηθεί ανά test — η εργοστασιακή
   * συνάρτηση του mock κλείνει πάνω στη **μία** μεταβλητή. Χωρίς μηδενισμό, το έγγραφο
   * που έγραψε το προηγούμενο test κάνει το επόμενο να περνά ή να κόβει για **λάθος
   * λόγο** — και μετρήθηκε ακριβώς αυτό: άγκυρα «ξένο μονοπάτι δεν αφήνει σημείωση»
   * έβλεπε τη σημείωση του **προηγούμενου** test και κοκκίνιζε.
   *
   * ⚠️ Μηδενίζει **και** τους μετρητές (`writes`) και τους διακόπτες βλάβης: μια
   * μισοκαθαρισμένη κατάσταση είναι χειρότερη από καμία, γιατί μοιάζει καθαρή.
   */
  public reset(): void {
    this.store.clear();
    this.writes = 0;
    this.failReads = false;
  }

  public seed(collection: string, id: string, doc: Doc): void {
    this.bucket(collection).set(id, doc);
  }

  public collection(name: string): FakeCollection {
    return new FakeCollection(this, this.bucket(name), name);
  }

  /**
   * 🔴 **Ο ΚΑΔΟΣ ΜΕ ΠΛΗΡΕΣ ΜΟΝΟΠΑΤΙ — ΓΙΑ ΤΙΣ ΥΠΟΣΥΛΛΟΓΕΣ** (ADR-862 Φ0 Β7).
   *
   * Υπάρχει **μόνο** για το {@link FakeDocRef.collection}. Ο αποθηκευτικός χώρος
   * είναι **επίπεδος** `Map<όνομα, Map<id, έγγραφο>>`, και η ένθεση εκφράζεται ως
   * **κλειδί με μονοπάτι** (`companies/c/projects/p/members`) — ακριβώς όπως το
   * αληθινό `ref.path`. Έτσι η υποσυλλογή **ΕΝΟΣ** έργου δεν μπορεί ποτέ να
   * επιστρέψει έγγραφο **άλλου**, που είναι το ίδιο το ερώτημα του Β7.
   */
  public pathBucket(fullPath: string): Map<string, Doc> {
    return this.bucket(fullPath);
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
        await transaction.flush();
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

  /**
   * 🔴 **ΤΟ ΕΡΩΤΗΜΑ ΜΕΣΑ ΣΕ ΣΥΝΑΛΛΑΓΗ ΕΛΕΙΠΕ — ΟΓΔΟΗ ΕΜΦΑΝΙΣΗ ΤΟΥ ΣΧΗΜΑΤΟΣ** (ADR-853 Φ2).
   *
   * Το Admin SDK δέχεται **και ερώτημα** στο `transaction.get()`, και **δύο** υπηρεσίες
   * παραγωγής το χρησιμοποιούν ήδη ως άμυνα σε race condition:
   * `contact/first-contact.service.ts:202` και `ai-pipeline/pipeline-queue-service.ts:99`
   * *(«prevents race condition where two concurrent calls could both pass a non-atomic
   * query check»)*. Το ADR-853 §7.3 το απαιτεί ονομαστικά για την ιδεμποτησία της
   * πρόσκλησης: **ένα ζωντανό ανά (χώρος, email)**.
   *
   * Χωρίς αυτόν τον κλάδο, ο πλαστός δεχόταν το ερώτημα, κατέγραφε την ανάγνωση ως
   * `undefined/undefined` και έσκαγε στο `snapshot.data()` — δηλαδή **καμία** άγκυρα δεν
   * μπορούσε να αγγίξει το ατομικό supersede.
   *
   * ⚠️ **ΔΗΛΩΜΕΝΟ ΟΡΙΟ — ΠΙΟ ΣΤΕΝΟ ΑΠΟ ΤΟ ΑΛΗΘΙΝΟ, ΚΑΙ ΔΕΝ ΠΡΟΣΠΟΙΕΙΤΑΙ ΤΟ ΑΝΤΙΘΕΤΟ.**
   * Καταγράφονται τα έγγραφα που **επέστρεψε** το ερώτημα. Στο πραγματικό Firestore η
   * συναλλαγή ακυρώνεται και όταν ένα **νέο** έγγραφο αρχίσει να ταιριάζει στο ερώτημα
   * (phantom read) — αυτό εδώ **δεν** το πιάνει. Πιάνει τη μετάλλαξη *«κάποιος άλλαξε
   * εγγραφή που είδα»*, που είναι το σενάριο των αγκυρών Τ3/Ι.
   *
   * ⚠️ **Ο ανταγωνιστής (`interfere`) χτυπά ΚΑΙ εδώ**, όπως και στην ανάγνωση αναφοράς:
   * αλλιώς μια άγκυρα «δύο ταυτόχρονες εκδόσεις» θα δοκίμαζε τη σειριακή διαδρομή.
   */
  async get(ref: FakeQuery): Promise<{ docs: { id: string; data: () => Doc; ref?: FakeDocRef }[]; size: number }>;
  async get(ref: FakeDocRef): Promise<{ id: string; exists: boolean; data: () => Doc | undefined }>;
  async get(ref: FakeDocRef | FakeQuery): Promise<unknown> {
    if (ref instanceof FakeQuery) return this.getByQuery(ref);
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
    this.letCompetitorStrike();

    return snapshot;
  }

  /**
   * 🔴 **ΤΟ `transaction.getAll` ΕΛΕΙΠΕ — ΕΝΑΤΗ ΕΜΦΑΝΙΣΗ ΤΟΥ ΣΧΗΜΑΤΟΣ** (ADR-867 Β9(β) Ε9).
   *
   * Το Admin SDK διαβάζει N έγγραφα σε **ένα** ταξίδι και μέσα σε συναλλαγή· η ιδιωτική πλευρά της θέσης
   * (`network_audience_private`) διαβάζεται έτσι στην αποστολή, την ανάκληση και την επεξεργασία. Κάθε
   * έγγραφο **καταγράφεται** ως ανάγνωση (ίδιος έλεγχος φρεσκάδας με το `get`), και η σειρά αντιστοιχεί ένα
   * προς ένα στις αναφορές — και για τα ανύπαρκτα, όπως το αληθινό.
   */
  async getAll(...refs: readonly FakeDocRef[]): Promise<{ id: string; exists: boolean; data: () => Doc | undefined }[]> {
    const snapshots: { id: string; exists: boolean; data: () => Doc | undefined }[] = [];
    for (const ref of refs) snapshots.push(await this.get(ref));
    return snapshots;
  }

  /**
   * Ο ανταγωνιστής, **μία φορά ανά συναλλαγή**.
   *
   * ⚠️ **Εξήχθη μόλις απέκτησε δεύτερο καλούντα** (ADR-853 Φ2 — η ανάγνωση ερωτήματος).
   * Ήταν έξι γραμμές αντιγραμμένες αυτούσιες· το CHECK 3.28 **δεν** το έπιασε, επειδή το
   * `.jscpdrc.json` μετρά από **50 tokens** και πάνω. Το «η πύλη δεν το είδε» δεν είναι
   * «δεν υπάρχει» — είναι ακριβώς το σχήμα «`0` = κανείς δεν κοίταξε» (N.0.2).
   */
  private letCompetitorStrike(): void {
    if (this.interfered || this.db.interfere === null) return;
    this.interfered = true;
    const strike = this.db.interfere;
    this.db.interfere = null;
    strike();
  }

  /** Η ανάγνωση ερωτήματος: καταγράφει **κάθε** έγγραφο που επέστρεψε. */
  private async getByQuery(
    query: FakeQuery,
  ): Promise<{ docs: { id: string; data: () => Doc; ref?: FakeDocRef }[]; size: number }> {
    const result = await query.get();

    for (const doc of result.docs) {
      this.reads.set(`${query.collectionName}/${doc.id}`, JSON.stringify(doc.data() ?? null));
    }

    // 🔴 Ο ανταγωνιστής χτυπά **εδώ** επίσης — ανάμεσα στην ανάγνωση και στο commit.
    this.letCompetitorStrike();

    return result;
  }

  /**
   * ⚠️ **ΤΟ `options` ΠΡΟΣΤΕΘΗΚΕ (ADR-853 Φ3)** — το `FakeDocRef.set` το τιμούσε ήδη, η
   * **συναλλαγή** όχι: κάθε `tx.set(ref, doc, { merge: true })` **αντικαθιστούσε**
   * σιωπηλά. Είναι ακριβώς η βλάβη που περιγράφει το {@link FakeDocRef.set}, μία στρώση
   * πιο μέσα — και ο γραφέας της ιδιότητας μέλους (`grantWorkspaceMembershipInTx`)
   * βασίζεται στο merge για να **μη σβήνει** τα `permissionSetIds` της κονσόλας ρόλων.
   */
  set(ref: FakeDocRef, doc: Doc, options?: { readonly merge?: boolean }): void {
    this.writes.push(() => ref.set(doc, options));
  }

  update(ref: FakeDocRef, patch: Doc): void {
    this.writes.push(() => ref.update(patch));
  }

  /**
   * ⚠️ **ΠΡΟΣΤΕΘΗΚΕ (ADR-862 Φ0 Β14)** — η γέννηση έργου και η ένταξη μέλους γράφουν με
   * `transaction.create`: σύγκρουση id ⇒ **αποτυχία**, ποτέ σιωπηλή αντικατάσταση. Ο πλαστός
   * μεταφέρει το `ALREADY_EXISTS` του {@link FakeDocRef.create} στο commit, όπως το αληθινό.
   */
  create(ref: FakeDocRef, doc: Doc): void {
    this.writes.push(() => ref.create(doc));
  }

  /**
   * ⚠️ **ΠΡΟΣΤΕΘΗΚΕ (ADR-841 §7 Α21.16)** — η απόσυρση βιτρίνας σβήνει πλέον προφίλ **και**
   * κανάλια κάρτας **ατομικά**. Χωρίς αυτό, κάθε `tx.delete` έσκαγε μέσα στον `catch` του
   * γραφέα και η απόσυρση αναφερόταν `failed` — κόκκινο για λόγο άσχετο με ό,τι ρωτά η άγκυρα.
   */
  delete(ref: FakeDocRef): void {
    this.writes.push(() => ref.delete());
  }

  /** Είναι ακόμη αληθινό ό,τι διαβάσαμε; */
  readsAreStillValid(): boolean {
    for (const [key, seen] of this.reads) {
      // ⚠️ `lastIndexOf`, ΟΧΙ `split('/')` (ADR-862 Φ0 Β14): το κλειδί υποσυλλογής είναι
      //    `companies/c/projects/p/members/id`. Το `split` διάβαζε `companies/c` ⇒ «άλλαξε»
      //    σε ΚΑΘΕ συναλλαγή ⇒ ABORTED — κάθε ερώτημα μελών σε συναλλαγή ήταν αδοκίμαστο.
      const cut = key.lastIndexOf('/');
      const collection = key.slice(0, cut);
      const id = key.slice(cut + 1);
      if (this.db.snapshotOf(collection, id) !== seen) return false;
    }
    return true;
  }

  /**
   * 🔴 **ΠΕΡΙΜΕΝΕΙ ΚΑΙ ΜΕΤΑΦΕΡΕΙ ΤΗΝ ΑΠΟΤΥΧΙΑ** (ADR-841 §7 Α22, Boy Scout).
   *
   * Ήταν `forEach(apply)` πάνω σε γραφές `void ref.delete()`: μια γραφή που **απέρριπτε**
   * γινόταν **ανεπεξέργαστη απόρριψη** — ο γραφέας έβλεπε επιτυχία, και ο jest worker
   * **κατέρρεε** (`organization-capability.test.ts`, «4 child process exceptions») από τη
   * στιγμή που η απόσυρση βιτρίνας μπήκε σε συναλλαγή (Α21.16). Στο αληθινό SDK μια
   * αποτυχία commit **απορρίπτει** το `runTransaction`· εδώ πλέον το ίδιο.
   *
   * ⚠️ **Δηλωμένο όριο**: σειριακή εφαρμογή, όχι ατομική — γραφές **πριν** την αποτυχημένη
   * έχουν ήδη εφαρμοστεί. Αρκεί για το ερώτημα των αγκυρών *(«ο γραφέας μαθαίνει ότι
   * απέτυχε;»)*· δεν αποδεικνύει ατομικότητα.
   */
  async flush(): Promise<void> {
    for (const apply of this.writes) await apply();
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
      // Ο gRPC κωδικός 6, όπως το πραγματικό SDK — ώστε ο γραφέας που κρίνει «υπάρχει ήδη» να δοκιμάζεται (ADR-864 §20).
      throw Object.assign(new Error(`ALREADY_EXISTS: ${this.id}`), { code: 6 });
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
    const existing = this.bucket.get(this.id) ?? {};
    const next = options?.merge === true
      ? { ...existing, ...applyIncrements(existing, doc) }
      : applyIncrements({}, doc);
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
      // ⚠️ `FieldValue.delete()` **σβήνει** το κλειδί, όπως στο αληθινό — αλλιώς ο πλαστός θα έγραφε το
      //    σύμβολο ως τιμή και μια άγκυρα «το πεδίο έφυγε» θα ήταν πράσινη για λάθος λόγο (ADR-867 Ε9).
      if (isFieldDelete(value)) delete node[leaf];
      else node[leaf] = value;
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

  /**
   * 🔴 **ΕΛΕΙΠΕ — ΚΑΙ ΕΙΝΑΙ Η ΕΝΑΤΗ ΕΜΦΑΝΙΣΗ ΤΟΥ ΣΧΗΜΑΤΟΣ** «ο πλαστός δεν είχε τη
   * μέθοδο που μετράει» (ADR-862 Φ0 Β7).
   *
   * Ο αναγνώστης μέλους έργου ζει σε **ένθετη** διαδρομή —
   * `companies/{W}/projects/{P}/members` — δηλαδή κάνει `.doc().collection()`. Ο
   * πλαστός σταματούσε στο `FakeDocRef`, οπότε η κλήση έσκαγε με *«ref.collection
   * is not a function»*.
   *
   * 🔑 **ΓΙΑΤΙ ΑΥΤΟ ΔΕΝ ΕΙΝΑΙ ΕΥΚΟΛΙΑ ΑΛΛΑ ΠΡΟΫΠΟΘΕΣΗ ΤΗΣ ΑΓΚΥΡΑΣ**: χωρίς αυτόν
   * τον κλάδο, η άγκυρα του Β7 θα **έπλαθε** την αναζήτηση — και τότε η μετάλλαξη
   * *«γύρνα το κλειδί σε `.doc(uid)`»* θα έμενε **ΠΡΑΣΙΝΗ**, δηλαδή η άγκυρα δεν
   * θα μπορούσε να πιάσει **ακριβώς** το σφάλμα που γέννησε τον θεματοφύλακα.
   * Πλαστός που δεν φτάνει στο ερώτημα είναι πράσινο που σημαίνει «δεν κοίταξα».
   *
   * ⚠️ **Προσθετικό, μηδέν ακτίνα** — μετρημένο: **κανένας** υπάρχων καταναλωτής
   * δεν καλεί `.collection()` σε αναφορά εγγράφου, άρα καμία σουίτα δεν αλλάζει
   * διαδρομή (ο ίδιος κανόνας με το `batch.delete`: σε **κοινό** εργαλείο «πιο
   * σωστό» δεν αρκεί — μετράει και **ποιον ξυπνά**).
   */
  collection(name: string): FakeCollection {
    const fullPath = `${this.collectionName}/${this.id}/${name}`;
    return new FakeCollection(this.db, this.db.pathBucket(fullPath), fullPath);
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
    /**
     * 🔑 **Η συλλογή ταξιδεύει και με το ΕΡΩΤΗΜΑ, όχι μόνο με την αναφορά** (ADR-853 Φ2).
     *
     * Ο ίδιος λόγος με το {@link FakeDocRef.collectionName}: η συναλλαγή χρειάζεται
     * **σταθερό κλειδί** για να θυμάται τι διάβασε. Ένα ερώτημα μέσα σε συναλλαγή
     * επιστρέφει **πολλά** έγγραφα, και το καθένα πρέπει να καταγραφεί χωριστά —
     * αλλιώς ο έλεγχος φρεσκάδας δεν έχει τι να συγκρίνει.
     */
    public readonly collectionName: string = '',
    /**
     * 🔑 **`doc.ref` σε κάθε αποτέλεσμα ερωτήματος** (ADR-862 Φ0 Β14) — το Admin SDK το
     * εκθέτει, και ο γραφέας μελών αλλάζει/σβήνει **το έγγραφο που βρήκε το ερώτημα**.
     * Χωρίς αυτό, ο πλαστός ανάγκαζε τον κώδικα να ξαναχτίσει την αναφορά **μόνο στο test**.
     */
    private readonly refOf?: (id: string) => FakeDocRef,
    /**
     * 🔑 **`orderBy` ΠΡΙΝ το `limit`** (ADR-835 §23.7) — όπως στη Firestore. Ο σαρωτής λήξης
     * ταξινομεί κατά `hold.expiresAt` ώστε, όταν κόβεται, να φεύγουν **πρώτα οι παλαιότερες**
     * λήξεις· χωρίς ταξινόμηση στο πλαστό, η περικοπή θα ήταν «όποια έτυχε» και η άγκυρα τυφλή.
     */
    private readonly order: string | null = null,
    /**
     * 🔑 **Η ΦΟΡΑ ΕΛΕΙΠΕ** (ADR-867 Ε10): ο πλαστός ταξινομούσε **μόνο** αύξουσα, οπότε ένα
     * `orderBy('createdAt', 'desc').limit(20)` επέστρεφε τα **παλαιότερα** 20 — δηλαδή ο επανυπολογισμός
     * «ποιο είναι τώρα το τελευταίο ζωντανό μήνυμα» θα δοκιμαζόταν πάνω σε λάθος σελίδα.
     */
    private readonly direction: 'asc' | 'desc' = 'asc',
    /**
     * 🔑 **Δρομέας εγγράφου** (`startAfter(snapshot)`, ADR-867 Ε10) — η σελιδοποίηση που **δεν** χάνει έγγραφα με
     * ίδια τιμή ταξινόμησης στο όριο της σελίδας. Κρίνεται στη **θέση** του εγγράφου μέσα στην ίδια ταξινόμηση.
     */
    private readonly afterId: string | null = null,
  ) {}

  where(field: string, op: WhereClause['op'], value: unknown): FakeQuery {
    return new FakeQuery(
      this.bucket,
      [...this.clauses, { field, op, value }],
      this.cap,
      this.failing,
      this.collectionName,
      this.refOf,
      this.order,
      this.direction,
      this.afterId,
    );
  }

  limit(n: number): FakeQuery {
    return new FakeQuery(this.bucket, this.clauses, n, this.failing, this.collectionName, this.refOf, this.order, this.direction, this.afterId);
  }

  /** Ταξινόμηση — ίδια σύγκριση με το `matches` (ISO σε UTC ⇒ αλφαβητική = χρονολογική). Προεπιλογή: αύξουσα. */
  orderBy(field: string, direction: 'asc' | 'desc' = 'asc'): FakeQuery {
    return new FakeQuery(this.bucket, this.clauses, this.cap, this.failing, this.collectionName, this.refOf, field, direction, this.afterId);
  }

  /** Συνέχεια **μετά** από ένα έγγραφο της προηγούμενης σελίδας (όπως το `startAfter(DocumentSnapshot)`). */
  startAfter(snapshot: { readonly id: string }): FakeQuery {
    return new FakeQuery(this.bucket, this.clauses, this.cap, this.failing, this.collectionName, this.refOf, this.order, this.direction, snapshot.id);
  }

  /**
   * 🔴 **Τα `id` ταξιδεύουν** (§8.34) — γι' αυτό διασχίζονται `entries()` και όχι
   * `values()`. Ένας κατάλογος που χτίζει γραμμές από ερώτημα χρειάζεται το κλειδί
   * κάθε εγγράφου για να τις ξεχωρίσει και να στείλει πράξη στη σωστή· χωρίς αυτό,
   * κάθε γραμμή θα είχε `undefined` κλειδί και το test θα ήταν πράσινο.
   */
  async get(): Promise<{ docs: { id: string; data: () => Doc; ref?: FakeDocRef }[]; size: number }> {
    if (this.failing()) throw new Error('FAKE_FIRESTORE_UNAVAILABLE');

    const order = this.order;
    const filtered = [...this.bucket.entries()]
      .filter(([, doc]) => this.clauses.every((clause) => matches(doc, clause)));
    const sorted = order === null ? filtered : [...filtered].sort(([, a], [, b]) => {
      const left = readPath(a, order) as string | number;
      const right = readPath(b, order) as string | number;
      const ascending = left < right ? -1 : left > right ? 1 : 0;
      return this.direction === 'desc' ? -ascending : ascending;
    });
    const start = this.afterId === null ? 0 : sorted.findIndex(([id]) => id === this.afterId) + 1;
    const hits = sorted.slice(start, start + this.cap);

    return {
      docs: hits.map(([id, doc]) => ({ id, data: () => doc, ref: this.refOf?.(id) })),
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
    super(docs, [], undefined, () => db.failReads, name, (id) => new FakeDocRef(db, docs, id, name));
  }

  doc(id: string): FakeDocRef {
    return new FakeDocRef(this.db, this.docs, id, this.name);
  }
}

export class FakeBatch {
  private readonly pending: { ref: FakeDocRef; doc: Doc }[] = [];
  private readonly pendingUpdates: { ref: FakeDocRef; patch: Doc }[] = [];
  private readonly pendingSets: { ref: FakeDocRef; doc: Doc; merge: boolean }[] = [];
  private readonly pendingDeletes: FakeDocRef[] = [];

  constructor(private readonly db: FakeFirestore) {}

  create(ref: FakeDocRef, doc: Doc): void {
    this.pending.push({ ref, doc });
  }

  /**
   * **`set` μέσα σε δέσμη** (ADR-777 §8.72 — σημάδι + μετρητής σε ένα batch · σύνοψη + διαγραφή shards).
   *
   * 🔑 **Καμία προϋπόθεση**, όπως το αληθινό· αλλά εφαρμόζεται **μόνο αν** περάσουν οι έλεγχοι των
   * `create`/`update` — αλλιώς ο πλαστός θα αύξανε τον μετρητή ενώ το σημάδι «υπήρχε ήδη», δηλαδή
   * ακριβώς τη διπλομέτρηση που το batch υπάρχει για να αποκλείει.
   */
  set(ref: FakeDocRef, doc: Doc, options?: { readonly merge?: boolean }): void {
    this.pendingSets.push({ ref, doc, merge: options?.merge === true });
  }

  /**
   * **Ενημέρωση μέσα σε δέσμη** (ADR-844).
   *
   * ⚠️ **Η ΠΡΟΫΠΟΘΕΣΗ ΕΙΝΑΙ Η ΑΝΤΙΣΤΡΟΦΗ ΤΟΥ `create`, ΚΑΙ ΜΟΝΤΕΛΟΠΟΙΕΙΤΑΙ**: το
   * πραγματικό `batch.update()` **αποτυγχάνει** αν το έγγραφο **δεν** υπάρχει,
   * ενώ το `create()` αποτυγχάνει αν **υπάρχει**. Ένας πλαστός που δεχόταν
   * σιωπηλά update σε ανύπαρκτο έγγραφο θα άφηνε τον γραφέα να «πετύχει» εδώ και
   * να σκάσει στην παραγωγή — ακριβώς η κλάση σφάλματος που αυτό το αρχείο
   * υπάρχει για να πιάνει.
   */
  update(ref: FakeDocRef, patch: Doc): void {
    this.pendingUpdates.push({ ref, patch });
  }

  /**
   * **Διαγραφή μέσα σε δέσμη** (ADR-844 Β6 — ο σαρωτής λήξης των προσκλήσεων).
   *
   * 🔑 **ΚΑΜΙΑ ΠΡΟΫΠΟΘΕΣΗ, ΚΑΙ ΕΙΝΑΙ ΤΟ ΣΥΜΒΟΛΑΙΟ — ΟΧΙ ΧΑΛΑΡΩΣΗ.** Σε αντίθεση με το
   * `create` *(αποτυγχάνει αν υπάρχει)* και το `update` *(αποτυγχάνει αν δεν υπάρχει)*,
   * το πραγματικό `batch.delete()` σε **ανύπαρκτο** έγγραφο είναι **αθόρυβα επιτυχές**.
   * Ένας πλαστός που πετούσε εδώ θα έκανε τον σαρωτή να φαίνεται μη-ιδεμποτος ενώ
   * **είναι**, και θα κοκκίνιζε άγκυρα για συμπεριφορά που η παραγωγή δέχεται.
   *
   * ⚠️ **Προσθετικό, μηδέν ακτίνα σε υπάρχοντα καταναλωτή** — ο ίδιος κανόνας που
   * ανάγκασε την αναίρεση του `.ref` στις 2026-09-05: σε **κοινό** εργαλείο, «πιο
   * σωστό» δεν αρκεί· μετράει και **ποιον ξυπνά**. Καμία υπάρχουσα σουίτα δεν καλεί
   * `batch.delete`, άρα καμία δεν αλλάζει διαδρομή.
   */
  delete(ref: FakeDocRef): void {
    this.pendingDeletes.push(ref);
  }

  async commit(): Promise<void> {
    // ⚠️ **Ατομικότητα**: όλα ή τίποτα. Ο γραφέας βασίζεται σε αυτό ώστε να μη
    // γεννηθεί ποτέ κτίριο χωρίς τη γη του — και ένας πλαστός που έγραφε ένα-ένα θα
    // έκρυβε ακριβώς αυτό το σφάλμα.
    for (const { ref } of this.pending) {
      const snapshot = await ref.get();
      // Ο gRPC κωδικός 6 και εδώ, όπως στο `create()` και στο πραγματικό SDK (ADR-866 Φ1.1: η επανάληψη γέννησης φακέλου).
      if (snapshot.data() !== undefined) throw Object.assign(new Error(`ALREADY_EXISTS: ${ref.id}`), { code: 6 });
    }
    for (const { ref } of this.pendingUpdates) {
      const snapshot = await ref.get();
      if (snapshot.data() === undefined) throw new Error(`NOT_FOUND: ${ref.id}`);
    }
    for (const { ref, doc } of this.pending) await ref.create(doc);
    for (const { ref, patch } of this.pendingUpdates) await ref.update(patch);
    for (const { ref, doc, merge } of this.pendingSets) await ref.set(doc, { merge });
    // ⚠️ **Οι διαγραφές ΤΕΛΕΥΤΑΙΕΣ και ΧΩΡΙΣ προέλεγχο** — δες {@link FakeBatch.delete}:
    //    η διαγραφή ανύπαρκτου εγγράφου είναι αθόρυβα επιτυχής στο πραγματικό Firestore.
    for (const ref of this.pendingDeletes) await ref.delete();
    this.db.countWrite();
  }
}
