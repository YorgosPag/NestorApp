/**
 * @fileoverview **ΤΑ ΚΑΘΟΛΙΚΑ ΤΗΣ ΠΛΑΤΦΟΡΜΑΣ ΜΕΣΑ ΣΤΟ jsdom** — οι άγκυρες του
 * `jest.setup.js`.
 * @related jest.setup.js · ADR-783 (ένα test που δεν ΦΟΡΤΩΝΕΙ δεν κοκκινίζει τίποτα)
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το `jest.setup.js` δανείζεται από τον Node **τέσσερις** οικογένειες καθολικών που το
 * jsdom δεν εκθέτει *(TextEncoder · Compression/DecompressionStream · μέθοδοι `Blob` ·
 * και από 2026-09-02 `fetch`/`Request`/`Response`)*. Οι τρεις πρώτες γράφτηκαν
 * **χωρίς καμία άγκυρα**: αν κάποιος τις έσβηνε, θα το μάθαινε από **ένα τυχαίο
 * κόκκινο κάπου αλλού**, με μήνυμα που δεν λέει τη ρίζα.
 *
 * 🔑 **Και το `fetch` έχει ΔΕΥΤΕΡΟ κανόνα, που χωρίς άγκυρα δεν είναι κανόνας**: δεν
 * είναι ο αληθινός του Node — **αρνείται**. Αυτό είναι απόφαση *(«τα unit tests δεν
 * βγαίνουν στο δίκτυο»)*, και μια απόφαση που κανείς δεν δοκιμάζει είναι σχόλιο.
 */

describe('Π — το jsdom έχει τα καθολικά που υπόσχεται η πλατφόρμα', () => {
  it('Π1 — fetch · Request · Response υπάρχουν', () => {
    expect(typeof fetch).toBe('function');
    expect(typeof Request).toBe('function');
    expect(typeof Response).toBe('function');
  });

  /**
   * ⚠️ Το `Headers` **υπάρχει ήδη** στο jsdom και **δεν** αντικαταστάθηκε. Είναι το
   * μάθημα του `Blob` λίγες γραμμές πιο πάνω στο `jest.setup.js`: κλάση του Node στη
   * θέση κλάσης του jsdom σπάει τους brand-checks του jsdom (μετρημένο τότε: **19**
   * κόκκινα σε GLTFExporter/three).
   */
  it('Π2 — το Headers του jsdom ΔΕΝ αντικαταστάθηκε', () => {
    expect(new Headers({ a: 'b' }).get('a')).toBe('b');
  });

  it('Π3 — τα άλλα τρία δάνεια του setup είναι στη θέση τους', () => {
    expect(typeof TextEncoder).toBe('function');
    expect(typeof DecompressionStream).toBe('function');
    expect(typeof Blob.prototype.arrayBuffer).toBe('function');
  });
});

describe('Ρ — το δίκτυο είναι ΚΛΕΙΣΤΟ στα unit tests, εξ ορισμού', () => {
  /**
   * 🏆 **ΠΟΥ ΞΕΠΕΡΝΑΜΕ ΤΗ ΣΥΝΗΘΗ ΠΡΑΚΤΙΚΗ.** Η βιομηχανία λύνει το «λείπει fetch στο
   * jsdom» με **αληθινό** polyfill (`cross-fetch` · `whatwg-fetch`) και μετά πολεμά τα
   * αληθινά αιτήματα με **MSW** — που απαιτεί κάθε suite να θυμηθεί να το στήσει.
   * Εδώ η προεπιλογή είναι **άρνηση**: το `fetch` ικανοποιεί κάθε έλεγχο δυνατότητας,
   * αλλά η **κλήση** του δεν φεύγει ποτέ από το μηχάνημα.
   */
  it('Ρ1 — η ΚΛΗΣΗ του fetch πετά, δεν κάνει αίτημα', () => {
    expect(() => fetch('https://example.invalid/x')).toThrow(/ΠΡΑΓΜΑΤΙΚΟ δικτυακό αίτημα/);
  });

  it('Ρ2 — το μήνυμα λέει ΤΙ ΝΑ ΚΑΝΕΙΣ, όχι μόνο τι πήγε στραβά', () => {
    expect(() => fetch('https://example.invalid/x')).toThrow(/global\.fetch = jest\.fn\(\)/);
  });

  it('Ρ3 — και ονομάζει τον ΣΤΟΧΟ, ώστε να ξέρεις ποιος κώδικας το ζήτησε', () => {
    expect(() => fetch('https://example.invalid/needle')).toThrow(/needle/);
  });

  it('Ρ4 — μια suite που χρειάζεται δίκτυο ΥΠΕΡΙΣΧΥΕΙ ορίζοντας το δικό της', async () => {
    const original = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({ ok: true });
    try {
      await expect(fetch('https://example.invalid/x')).resolves.toEqual({ ok: true });
    } finally {
      global.fetch = original;
    }
  });
});

describe('Σ — ΑΠΟΔΕΙΞΗ ΖΩΗΣ: ο λόγος που γράφτηκε το δάνειο', () => {
  /**
   * 🔴 **Η ΜΟΝΗ ΑΓΚΥΡΑ ΠΟΥ ΜΕΤΡΑΕΙ ΠΡΑΓΜΑΤΙΚΑ.** Τα Π1-Π3 λένε *«η μεταβλητή
   * υπάρχει»*· αυτό λέει *«**το πρόβλημα λύθηκε**»*.
   *
   * Το **node** build του `@firebase/auth` εκτελεί στο ανώτατο επίπεδο του module
   * `FetchProvider.initialize(fetch, Headers, Response)` — γυμνά αναγνωριστικά, τη
   * στιγμή της εισαγωγής. Χωρίς το δάνειο, **κάθε** suite που εισάγει έστω μεταβατικά
   * το `AuthContext` πεθαίνει με `ReferenceError: fetch is not defined` **πριν** τρέξει
   * οποιοδήποτε `jest.mock` — δηλαδή δεν είναι «κόκκινο test», είναι
   * **«suite που δεν υπάρχει»**.
   *
   * ⚠️ Γι' αυτό η άγκυρα κάνει **αληθινό `require`** και όχι έλεγχο σε μεταβλητή: αν
   * αύριο αλλάξει η επίλυση του build ή ο τρόπος αρχικοποίησης του firebase, **εδώ**
   * θα φανεί, με το όνομα της ρίζας.
   */
  it('Σ1 — το `firebase/auth` ΕΙΣΑΓΕΤΑΙ χωρίς να πεθάνει η suite', () => {
    expect(() => require('firebase/auth')).not.toThrow();
    expect(typeof require('firebase/auth').onAuthStateChanged).toBe('function');
  });
});
