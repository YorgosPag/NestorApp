/**
 * `lib/workspace/alias-registry` — η ΑΤΟΜΙΚΟΤΗΤΑ, και το «άγνωστο ≠ κενό»
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΤΙ ΦΥΛΑΕΙ (ADR-787 §5.3 δ)
 * ─────────────────────────────────────────────────────────────────────────────
 * 1. **Ο Ψ1 επιβάλλεται από το `create()`**, όχι από «έλεγξε μετά γράψε». Το
 *    ψεύτικο Firestore μιμείται την **πραγματική** σημασιολογία: `create()` σε
 *    υπάρχον έγγραφο **πετά**. Χωρίς αυτή τη μίμηση η άγκυρα θα ήταν ταυτολογία.
 * 2. **`unknown` ≠ `not-found`.** Ένα 404 για γραφείο που **υπάρχει** επειδή η
 *    βάση δεν απάντησε είναι χειρότερο από σφάλμα: είναι **ψέμα** (N.12).
 * 3. **Η αναζήτηση γίνεται με ΣΚΕΛΕΤΟ**, άρα σύνδεσμος με ελληνικό `ο` βρίσκει
 *    το γραφείο που καταχωρήθηκε με λατινικό `o`.
 * 4. **Καμία απαρίθμηση**: η απόρριψη δεν λέει ποιο γραφείο κρατά το όνομα.
 */

// ─── Ελεγχόμενη «βάση» ───────────────────────────────────────────────────────
// Κλειδί: η πλήρης διαδρομή. Το `create()` πετά αν υπάρχει ήδη — **αυτή** είναι
// η σημασιολογία πάνω στην οποία στέκεται ολόκληρος ο Ψ1.
const store = new Map<string, Record<string, unknown>>();
const reads: string[] = [];
let failReads = false;
let failCreate = false;
let adminAvailable = true;

function docRef(path: string) {
  return {
    get: async () => {
      reads.push(path);
      if (failReads) throw new Error('ECONNRESET (προσομοίωση)');
      const data = store.get(path);
      return { exists: data !== undefined, data: () => data };
    },
    create: async (value: Record<string, unknown>) => {
      if (failCreate) throw new Error('UNAVAILABLE (προσομοίωση)');
      if (store.has(path)) throw new Error('ALREADY_EXISTS (πραγματική σημασιολογία του create)');
      store.set(path, value);
    },
  };
}

jest.mock('@/lib/firebaseAdmin', () => ({
  isFirebaseAdminAvailable: () => adminAvailable,
  getAdminFirestore: () => ({
    collection: (name: string) => ({ doc: (id: string) => docRef(`${name}/${id}`) }),
  }),
}));

jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() }),
}));

import { resolveAlias, claimAlias, aliasKey } from '../alias-registry';
import { PERSONAL_WORKSPACE_ALIAS } from '@/types/workspace-alias';

const COMPANY_A = 'comp_aaaaaaaa-0000-0000-0000-000000000001';
const COMPANY_B = 'comp_bbbbbbbb-0000-0000-0000-000000000002';
const GREEK_OMICRON = 'ο';

beforeEach(() => {
  store.clear();
  reads.length = 0;
  failReads = false;
  failCreate = false;
  adminAvailable = true;
});

// =============================================================================
// Α — Η ΔΕΣΜΕΥΣΗ ΚΑΙ Ο Ψ1
// =============================================================================

describe('Α — δέσμευση ψευδωνύμου (Ψ1)', () => {
  it('Α1: το πρώτο γραφείο παίρνει το όνομα', async () => {
    const verdict = await claimAlias(COMPANY_A, 'pagonis');
    expect(verdict.ok).toBe(true);
  });

  it('Α2: 🔴 δεύτερο γραφείο με ΤΟ ΙΔΙΟ όνομα ⇒ already-taken', async () => {
    await claimAlias(COMPANY_A, 'pagonis');
    const verdict = await claimAlias(COMPANY_B, 'pagonis');
    expect(verdict.ok).toBe(false);
    if (verdict.ok) throw new Error('αδύνατο');
    expect(verdict.reason).toBe('already-taken');
  });

  it('Α3: 🔴🔴 δεύτερο γραφείο με ΟΠΤΙΚΑ ΤΑΥΤΟΣΗΜΟ όνομα ⇒ look-alike-taken', async () => {
    // Αυτό είναι ολόκληρος ο λόγος ύπαρξης του σκελετού: το δεύτερο όνομα είναι
    // ΔΙΑΦΟΡΕΤΙΚΗ συμβολοσειρά, με διαφορετικά bytes — και ταυτόσημο σχήμα.
    //
    // ⚠️ Το παράδειγμα είναι «nestor» vs «nest0r» (ΜΗΔΕΝ), ΟΧΙ «pagonis» με
    //    ελληνικό ο — και ο λόγος είναι το εύρημα του Α3β παρακάτω.
    await claimAlias(COMPANY_A, 'nestor');
    const verdict = await claimAlias(COMPANY_B, 'nest0r');
    expect(verdict.ok).toBe(false);
    if (verdict.ok) throw new Error('αδύνατο');
    expect(verdict.reason).toBe('look-alike-taken');
  });

  it('Α3β: 🔑 Ο Ψ2 ΠΙΑΝΕΙ ΤΗ ΜΙΞΗ ΠΡΙΝ ΦΤΑΣΕΙ ΣΤΟΝ Ψ1 — άλλη επίθεση, άλλος κανόνας', async () => {
    // Το «pagοnis» (με ελληνικό ο) απορρίπτεται ως ΜΙΚΤΟ ΣΕΝΑΡΙΟ, ακόμα και σε
    // ΑΔΕΙΟ μητρώο. Δηλαδή δεν χρειάζεται να υπάρχει το «pagonis» για να πέσει.
    //
    // 🔑 Οι δύο κανόνες ΔΕΝ επικαλύπτονται:
    //    Ψ2 → μίξη αλφαβήτων  (ελληνικό ο μέσα σε λατινική λέξη)
    //    Ψ1 → οπτικά δίδυμα ΜΕΣΑ στο ίδιο αλφάβητο (0/o, rn/m, 1/l)
    //    Ένας κανόνας με «ή» θα έκρυβε ότι το ένα σκέλος δεν ασκείται ποτέ.
    const verdict = await claimAlias(COMPANY_B, `pag${GREEK_OMICRON}nis`);
    expect(verdict.ok).toBe(false);
    if (verdict.ok) throw new Error('αδύνατο');
    expect(verdict.reason).toBe('mixed-script');
  });

  it('Α3γ: ο Ψ1 δουλεύει και ΜΕΣΑ στα ελληνικά (rn/m δεν είναι μόνο λατινικό φαινόμενο)', async () => {
    await claimAlias(COMPANY_A, 'rn-tech');
    const verdict = await claimAlias(COMPANY_B, 'm-tech');
    expect(verdict.ok).toBe(false);
    if (verdict.ok) throw new Error('αδύνατο');
    expect(verdict.reason).toBe('look-alike-taken');
  });

  it('Α4: 🔴 Η ΑΠΟΡΡΙΨΗ ΔΕΝ ΑΠΑΡΙΘΜΕΙ — δεν λέει ποιο γραφείο κρατά το όνομα', async () => {
    await claimAlias(COMPANY_A, 'nestor');
    const verdict = await claimAlias(COMPANY_B, 'nest0r');
    if (verdict.ok) throw new Error('αδύνατο');
    const message = `${verdict.reason} ${verdict.detail ?? ''}`;
    expect(message).not.toContain(COMPANY_A);
    expect(message).not.toContain('nestor');
  });

  it('Α5: ο ΙΔΙΟΣ χώρος ξαναζητά το ΙΔΙΟ όνομα ⇒ επιτυχία (idempotent)', async () => {
    await claimAlias(COMPANY_A, 'pagonis');
    const again = await claimAlias(COMPANY_A, 'pagonis');
    expect(again.ok).toBe(true);
  });

  it('Α6: το δεσμευμένο «me» δεν παραχωρείται σε γραφείο', async () => {
    const verdict = await claimAlias(COMPANY_A, PERSONAL_WORKSPACE_ALIAS);
    expect(verdict.ok).toBe(false);
    if (verdict.ok) throw new Error('αδύνατο');
    expect(verdict.reason).toBe('reserved');
  });

  it('Α7: 🔴 FAIL-CLOSED — αν η διάγνωση σύγκρουσης αποτύχει, ΑΠΟΡΡΙΠΤΕΙ', async () => {
    await claimAlias(COMPANY_A, 'pagonis');
    failReads = true; // η δεύτερη ανάγνωση (διάγνωση) σκάει
    const verdict = await claimAlias(COMPANY_B, 'pagonis');
    expect(verdict.ok).toBe(false);
  });

  it('Α8: χωρίς Admin, η δέσμευση ΠΕΤΑ — δεν επιστρέφει σιωπηλή επιτυχία', async () => {
    adminAvailable = false;
    await expect(claimAlias(COMPANY_A, 'pagonis')).rejects.toThrow(/ALIAS_REGISTRY_UNAVAILABLE/);
  });
});

// =============================================================================
// Β — Η ΑΝΑΓΝΩΣΗ: «άγνωστο ≠ κενό»
// =============================================================================

describe('Β — ανάγνωση ψευδωνύμου', () => {
  it('Β1: υπαρκτό ψευδώνυμο ⇒ found + companyId', async () => {
    await claimAlias(COMPANY_A, 'pagonis');
    const res = await resolveAlias('pagonis');
    expect(res.outcome).toBe('found');
    if (res.outcome !== 'found') throw new Error('αδύνατο');
    expect(res.companyId).toBe(COMPANY_A);
    expect(res.current).toBe(true);
  });

  it('Β2: 🔴 σύνδεσμος με οπτικό δίδυμο ΜΕΣΑ στο ίδιο αλφάβητο ΒΡΙΣΚΕΙ το γραφείο', async () => {
    // Χωρίς αναζήτηση κατά σκελετό, ένας σύνδεσμος «nest0r» θα απαντούσε «δεν
    // υπάρχει» — και ο άνθρωπος δεν θα είχε τρόπο να δει τη διαφορά στην οθόνη.
    await claimAlias(COMPANY_A, 'nestor');
    expect((await resolveAlias('nest0r')).outcome).toBe('found');
  });

  it('Β2β: 🔴 σύνδεσμος με ΜΙΚΤΟ σενάριο ⇒ not-found, και είναι ΣΩΣΤΟ', async () => {
    // Το «pagοnis» δεν μπορεί να ΥΠΑΡΞΕΙ ως ψευδώνυμο (Ψ2), άρα ένας σύνδεσμος
    // προς αυτό δείχνει σε διεύθυνση που δεν υπάρχει — όχι σε κρυμμένο γραφείο.
    // ⚠️ Η άγκυρα υπάρχει ώστε ο επόμενος να μην «διορθώσει» τον resolver να
    //    δέχεται μικτά ονόματα: θα άνοιγε ακριβώς την πόρτα που κλείνει ο Ψ2.
    await claimAlias(COMPANY_A, 'pagonis');
    expect((await resolveAlias(`pag${GREEK_OMICRON}nis`)).outcome).toBe('not-found');
  });

  it('Β3: ανύπαρκτο ⇒ not-found', async () => {
    expect((await resolveAlias('kanenas')).outcome).toBe('not-found');
  });

  it('Β4: 🔴 αν η βάση ΔΕΝ ΑΠΑΝΤΗΣΕΙ ⇒ unknown, ΠΟΤΕ not-found', async () => {
    await claimAlias(COMPANY_A, 'pagonis');
    failReads = true;
    expect((await resolveAlias('pagonis')).outcome).toBe('unknown');
  });

  it('Β5: χωρίς Admin ⇒ unknown, ΠΟΤΕ not-found', async () => {
    adminAvailable = false;
    expect((await resolveAlias('pagonis')).outcome).toBe('unknown');
  });

  it('Β6: 🔴 εγγραφή ΧΩΡΙΣ companyId ⇒ unknown — αλλοίωση δεν κρύβεται πίσω από 404', async () => {
    store.set(`workspace_aliases/${aliasKey('pagonis')}`, { alias: 'pagonis', current: true });
    expect((await resolveAlias('pagonis')).outcome).toBe('unknown');
  });

  it('Β7: άκυρη μορφή ⇒ not-found ΧΩΡΙΣ να αγγίξει τη βάση', async () => {
    const res = await resolveAlias('!!!');
    expect(res.outcome).toBe('not-found');
    expect(reads).toHaveLength(0);
  });

  it('Β8: η ανάγνωση είναι ΣΗΜΕΙΑΚΗ — μία, κατά κλειδί', async () => {
    await claimAlias(COMPANY_A, 'pagonis');
    reads.length = 0;
    await resolveAlias('pagonis');
    expect(reads).toEqual([`workspace_aliases/${aliasKey('pagonis')}`]);
  });
});

// =============================================================================
// Γ — Ο ΠΑΡΟΝΟΜΑΣΤΗΣ ΤΗΣ ΑΤΟΜΙΚΟΤΗΤΑΣ
// =============================================================================

describe('Γ — η ατομικότητα είναι του Firestore, όχι δική μας', () => {
  it('Γ1: το ψεύτικο create() ΠΕΤΑ σε υπάρχον — αλλιώς το Α2/Α3 θα ήταν ταυτολογία', async () => {
    await claimAlias(COMPANY_A, 'pagonis');
    const key = `workspace_aliases/${aliasKey('pagonis')}`;
    await expect(docRef(key).create({ x: 1 })).rejects.toThrow(/ALREADY_EXISTS/);
  });

  it('Γ2: το κλειδί εγγράφου ΕΙΝΑΙ ο σκελετός — όχι τυχαίο id', async () => {
    await claimAlias(COMPANY_A, 'pagonis');
    expect(store.has(`workspace_aliases/${aliasKey('pagonis')}`)).toBe(true);
  });

  it('Γ3: δύο οπτικά ταυτόσημα ονόματα δίνουν ΤΟ ΙΔΙΟ κλειδί', () => {
    expect(aliasKey(`pag${GREEK_OMICRON}nis`)).toBe(aliasKey('pagonis'));
  });

  it('Γ4: δύο διαφορετικά ονόματα δίνουν ΔΙΑΦΟΡΕΤΙΚΑ κλειδιά', () => {
    expect(aliasKey('pagonis')).not.toBe(aliasKey('nestor'));
  });
});
