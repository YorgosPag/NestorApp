/**
 * @fileoverview **Ο ΨΕΥΤΙΚΟΣ ΚΑΔΟΣ ΤΩΝ ΑΓΚΥΡΩΝ ΤΟΥ ΡΑΦΙΟΥ** — bytes σε `Map`, όπως ο
 *   αληθινός κρατά objects.
 * @related ADR-841 §7 Α21 · N.18 (CHECK 3.28) · services/listings/public-shelf.service
 * @module services/upload/__fixtures__/fake-shelf-bucket
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ — ΗΤΑΝ ΗΔΗ **ΔΥΟ** ΑΝΤΙΓΡΑΦΑ, ΚΑΙ Η ΦΑΣΗ 2 ΘΑ ΤΑ ΕΚΑΝΕ ΤΡΙΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η ίδια κλάση ζούσε **αυτούσια** σε `public-shelf-service.test.ts` και σε
 * `showcase-mark-publication.test.ts` — ~60 γραμμές, πολύ πάνω από το κατώφλι των **50
 * tokens** του `.jscpdrc.json`. Είναι κυριολεκτικά το σχήμα που ο **N.18** ονομάζει:
 * *«κεντρικοποιείς το Α, γράφεις Β+Γ ως δίδυμα»* — και ο **N.0.2** (Boy Scout) απαιτεί
 * να διορθωθεί **τη στιγμή που ανακαλύπτεται**, όχι όταν ρωτήσει κάποιος.
 *
 * 🔑 **Και το κόστος του ήταν ήδη ορατό**: το ένα αντίγραφο είχε μετρητές
 * (`saveCalls`/`deleteCalls`/`downloadCalls`) και `cacheControl`, το άλλο **όχι**. Δύο
 * απαντήσεις στο *«τι θυμάται ο κάδος;»* — και η δεύτερη σουίτα **δεν μπορούσε καν να
 * ρωτήσει** πόσες φορές κατέβηκε το πρωτότυπο, δηλαδή η μισή διαδρομή
 * επαναχρησιμοποίησης της Α2.3 ήταν αόρατη σε αυτήν. Εδώ είναι η **ένωση**.
 *
 * ⚠️ **Είναι δείγμα δοκιμών, ΟΧΙ κώδικας προϊόντος.** ⛔ Μην το εισαγάγεις έξω από
 * `__tests__`: ο μόνος κάδος της παραγωγής είναι εκείνος του `firebaseAdmin`.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΠΩΣ ΧΡΗΣΙΜΟΠΟΙΕΙΤΑΙ — Η ΣΕΙΡΑ ΕΙΝΑΙ ΑΝΑΓΚΑΣΤΙΚΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το `jest.mock` **ανυψώνεται** πάνω από κάθε `import`, οπότε ο κάδος πρέπει να υπάρχει
 * πριν φορτωθεί ο κώδικας που τον ζητά — γι' αυτό οι σουίτες φορτώνουν τη μονάδα υπό
 * δοκιμή με `require` **μετά** το mock:
 *
 * ```
 * const shelf = new FakeShelfBucket();
 * const privateBucket = new FakeShelfBucket();
 * jest.mock('@/lib/firebaseAdmin', () => ({
 *   getAdminStorage: () => ({ bucket: () => shelf }),
 *   getAdminBucket: () => privateBucket,
 * }));
 * ```
 */

/** Ένα αντικείμενο του κάδου — ό,τι θυμάται ο αληθινός, και **τίποτα παραπάνω**. */
export interface SavedObject {
  readonly bytes: Buffer;
  readonly contentType?: string;
  readonly cacheControl?: string;
  /**
   * 🔴 **Ο ψεύτικος κάδος έχει μεταδεδομένα γιατί ο αληθινός ΤΑ ΧΡΗΣΙΜΟΠΟΙΕΙ**
   * (ADR-841 §7 Α2.3): η επαναχρησιμοποίηση παραγώγων ρωτά *«ίδια πηγή; ίδια
   * συνταγή;»* πάνω στα custom metadata. Ένας κάδος χωρίς αυτά θα έκανε τη σουίτα να
   * μετρά **άλλη** διαδρομή από αυτήν που τρέχει στην παραγωγή.
   */
  readonly custom?: Record<string, string>;
  /** Η **γενιά** — αλλάζει σε κάθε επανεγγραφή, όπως στο GCS. */
  readonly generation: number;
}

/**
 * Μονότονος μετρητής γενιάς, **κοινός για όλους τους κάδους μιας σουίτας**.
 *
 * ⚠️ Δεν μηδενίζεται στο {@link FakeShelfBucket.reset}, **επίτηδες**: στο GCS η γενιά
 * είναι μονότονη για όλη τη ζωή του κάδου, και μια άγκυρα που περίμενε συγκεκριμένο
 * αριθμό θα δοκίμαζε τον μετρητή αντί για τη λογική.
 */
let generationCounter = 0;

/**
 * **Ο κάδος** — γράφει, διαβάζει, σβήνει και απαριθμεί κατά πρόθεμα.
 *
 * 🔑 Οι τρεις μετρητές δεν είναι διακόσμηση: απαντούν *«κατέβηκε ξανά το πρωτότυπο;»* —
 * το **μόνο** ερώτημα που ξεχωρίζει την επαναχρησιμοποίηση παραγώγου από τη σιωπηλή
 * επανάληψη της δουλειάς.
 */
export class FakeShelfBucket {
  readonly objects = new Map<string, SavedObject>();
  saveCalls = 0;
  deleteCalls = 0;
  downloadCalls = 0;
  metadataCalls = 0;

  /** Γράφει ωμά, όπως ένα `gsutil cp` — **χωρίς** να περάσει από τον γραφέα μας. */
  put(name: string, bytes: Buffer): void {
    generationCounter += 1;
    this.objects.set(name, { bytes, generation: generationCounter });
  }

  file(name: string) {
    const bucket = this;
    return {
      name,
      get metadata() {
        const found = bucket.objects.get(name);
        return { generation: String(found?.generation ?? ''), metadata: found?.custom };
      },
      getMetadata: async () => {
        const found = bucket.objects.get(name);
        if (!found) throw new Error(`no such object: ${name}`);
        return [{ generation: String(found.generation) }];
      },
      save: async (
        bytes: Buffer,
        options?: {
          contentType?: string;
          metadata?: { cacheControl?: string; metadata?: Record<string, string> };
        },
      ) => {
        bucket.saveCalls += 1;
        generationCounter += 1;
        bucket.objects.set(name, {
          bytes,
          contentType: options?.contentType,
          cacheControl: options?.metadata?.cacheControl,
          custom: options?.metadata?.metadata,
          generation: generationCounter,
        });
      },
      delete: async () => {
        bucket.deleteCalls += 1;
        bucket.objects.delete(name);
      },
      // ADR-880 — ίδια σημασιολογία με το GCS: τα προσαρμοσμένα κλειδιά **συγχωνεύονται**.
      setMetadata: async (patch: { metadata?: Record<string, string> }) => {
        bucket.metadataCalls += 1;
        const found = bucket.objects.get(name);
        if (!found) throw new Error(`no such object: ${name}`);
        bucket.objects.set(name, { ...found, custom: { ...found.custom, ...patch.metadata } });
      },
      download: async (): Promise<[Buffer]> => {
        bucket.downloadCalls += 1;
        const found = bucket.objects.get(name);
        if (!found) throw new Error(`no such object: ${name}`);
        return [found.bytes];
      },
    };
  }

  async getFiles({ prefix }: { prefix: string }) {
    const names = [...this.objects.keys()].filter((name) => name.startsWith(prefix));
    return [names.map((name) => this.file(name))];
  }

  /** Τα ονόματα, **ταξινομημένα** — η σειρά του `Map` δεν είναι συμβόλαιο. */
  keys(): string[] {
    return [...this.objects.keys()].sort();
  }

  /**
   * **Άδειασέ τον** — περιεχόμενο **και** μετρητές.
   *
   * ⚠️ Και τα δύο μαζί: ένα `beforeEach` που καθάριζε μόνο τα αντικείμενα άφηνε τους
   * μετρητές να **συσσωρεύονται**, δηλαδή κάθε άγκυρα μετά την πρώτη μετρούσε τη
   * δουλειά **όλων των προηγούμενων**.
   */
  reset(): void {
    this.objects.clear();
    this.saveCalls = 0;
    this.deleteCalls = 0;
    this.downloadCalls = 0;
    this.metadataCalls = 0;
  }
}
