/**
 * @fileoverview **Ο ΑΓΩΝΑΣ ΔΡΟΜΟΥ ΤΗΣ ΤΑΥΤΟΤΗΤΑΣ — «δεν ξέρω ακόμη» ≠ «δεν υπάρχει».**
 * @related lib/api/enterprise-api-client.ts · lib/firebase.ts (waitForAuthReady)
 *
 * ΙΣΤΟΡΙΚΟ ΤΟΥ BUG: ο `getIdToken` διάβαζε `auth.currentUser` **τη στιγμή της κλήσης** και,
 * αν το Firebase δεν είχε προλάβει να αποκαταστήσει τη συνεδρία, πετούσε **συγχρόνως** 401.
 * Το `onAuthStateChanged` του constructor **απλώς κατέγραφε** τον χρήστη αργότερα — δεν
 * ξαναζητούσε τίποτα. Μετρημένο ζωντανά: **0 από 251** αιτήματα έφτασαν στο δίκτυο σε μια
 * φόρτωση σελίδας. Το «Δοκιμάστε ξανά» δούλευε **πάντα**, γιατί ως τότε η ταυτότητα είχε λυθεί.
 *
 * ⛔ **ΔΕΝ δοκιμάζει το `waitForAuthReady`** — εκείνο έχει δικό του τομέα και **τρεις** άλλους
 * καλούντες. Εδώ κρίνεται **τι κάνει ο πελάτης με την απάντησή του**: περιμένει όταν δεν ξέρει,
 * **δεν** περιμένει όταν ξέρει, δεν κρεμάει ποτέ, και δεν πληρώνει την αναμονή δύο φορές.
 *
 * 🔴 **Ο ΠΑΡΟΝΟΜΑΣΤΗΣ ΕΙΝΑΙ Η ΨΥΧΗ ΑΥΤΟΥ ΤΟΥ ΑΡΧΕΙΟΥ**: μια «διόρθωση» που κάνει **κάθε**
 * αίτημα να περιμένει για πάντα περνά κάθε δοκιμή που ρωτά *«δεν έσκασε;»*. Γι' αυτό η **Α2**
 * και η **Α5** μετρούν ότι ο **αποσυνδεδεμένος** παίρνει την άρνησή του **και τελειώνει**.
 */

// ── Το διπλό της ταυτότητας: `currentUser` **μεταβλητό**, ώστε να μπορεί να «φτάσει αργά»
//    ακριβώς όπως στην πραγματικότητα (το SDK το γράφει πριν ειδοποιήσει τους παρατηρητές).
jest.mock('@/lib/firebase', () => ({
  auth: { currentUser: null, onAuthStateChanged: jest.fn() },
  waitForAuthReady: jest.fn(),
}));

jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

jest.mock('@/services/enterprise-id.service', () => ({
  generateRequestId: () => 'req_readiness_1',
}));

jest.mock('@/lib/async-utils', () => ({
  ...jest.requireActual('@/lib/async-utils'),
  sleep: () => Promise.resolve(),
}));

import { apiClient } from '@/lib/api/enterprise-api-client';
import { auth, waitForAuthReady } from '@/lib/firebase';

// ---------------------------------------------------------------------------
// Πρόσβαση στην κατάσταση του singleton, **χωρίς `any`**
// ---------------------------------------------------------------------------

/** Το singleton ζει μεταξύ δοκιμών· η απομνημονευμένη ετοιμότητα πρέπει να μηδενίζεται. */
interface ClientState {
  tokenCache: unknown;
  authReady: unknown;
  currentUser: unknown;
}

/** Το `auth` του διπλού είναι εγγράψιμο, σε αντίθεση με το `readonly currentUser` του SDK. */
interface MutableAuth {
  currentUser: { uid: string; getIdToken: jest.Mock<Promise<string>, [boolean?]> } | null;
}

const mutableAuth = auth as unknown as MutableAuth;
const clientState = apiClient as unknown as ClientState;
const waitForAuthReadyMock = waitForAuthReady as jest.Mock<Promise<boolean>, []>;

function makeUser(): NonNullable<MutableAuth['currentUser']> {
  return { uid: 'u1', getIdToken: jest.fn(async () => 'token-1') };
}

function okResponse(): Response {
  return {
    status: 200,
    statusText: '',
    ok: true,
    headers: { get: (n: string) => (n.toLowerCase() === 'content-type' ? 'application/json' : null) },
    json: async () => ({ success: true, data: { ok: true } }),
    text: async () => '{"success":true,"data":{"ok":true}}',
  } as unknown as Response;
}

/**
 * 🔑 **Ο ΡΗΤΟΣ ΠΑΡΟΝΟΜΑΣΤΗΣ**: «τελείωσε» δεν σημαίνει «δεν πέταξε» — σημαίνει
 * **«απάντησε μέσα σε φραγμένο χρόνο»**. Χωρίς αυτόν τον αγώνα, μια υλοποίηση που κρεμάει
 * για πάντα θα έμενε πράσινη ώσπου να λήξει η ίδια η δοκιμή, με μήνυμα που δεν λέει γιατί.
 */
async function settlesWithin<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const bound = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`ΚΡΕΜΑΣΕ: δεν απάντησε μέσα σε ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([promise, bound]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

let fetchMock: jest.Mock<Promise<Response>, [RequestInfo, RequestInit?]>;

beforeEach(() => {
  clientState.tokenCache = null;
  clientState.authReady = null;
  clientState.currentUser = null;
  mutableAuth.currentUser = null;
  waitForAuthReadyMock.mockReset();
  fetchMock = jest.fn(async () => okResponse());
  global.fetch = fetchMock as unknown as typeof fetch;
});

describe('EnterpriseApiClient — ετοιμότητα ταυτότητας', () => {
  /**
   * **Α1 — η ταυτότητα φτάνει ΑΡΓΑ και το αίτημα ΠΕΤΥΧΑΙΝΕΙ.**
   * Αυτό είναι το ίδιο το ελάττωμα: ο συνδεδεμένος άνθρωπος έπαιρνε 401 στη φόρτωση και
   * χρειαζόταν **χειροκίνητο** «Δοκιμάστε ξανά».
   *
   * ⛔ ΜΕΤΑΛΛΑΞΗ: σβήσε το `await this.authReady` ⇒ 401, κόκκινο.
   */
  it('Α1 — ταυτότητα που φτάνει ΑΡΓΑ: το αίτημα πετυχαίνει χωρίς χειροκίνητο retry', async () => {
    waitForAuthReadyMock.mockImplementation(async () => {
      // 🔴 **ΤΟ `await` ΕΔΩ ΕΙΝΑΙ ΟΡΘΟΤΗΤΑ, ΟΧΙ ΣΤΥΛ.** Χωρίς αυτό, το διπλό έδινε την
      // ταυτότητα **συγχρόνως με την κλήση**, οπότε η δοκιμή έμενε πράσινη ακόμη και με
      // σβησμένο το `await` — δηλαδή **δεν αποδείκνυε την αναμονή**. Το έπιασε μόνο
      // ο έλεγχος μεταλλάξεων (M1 επέζησε). Η ταυτότητα φτάνει σε ΑΛΛΟ μικροκαθήκον.
      await Promise.resolve();
      mutableAuth.currentUser = makeUser();
      return true;
    });

    const result = await settlesWithin(apiClient.get('/api/reports/sales'), 2000);

    expect(result).toEqual({ ok: true });
    expect(waitForAuthReadyMock).toHaveBeenCalledTimes(1);
    // **Ένα** ταξίδι: η αναμονή αντικατέστησε το retry, δεν προστέθηκε σε αυτό.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  /**
   * **Α2 — ο ΑΠΟΣΥΝΔΕΔΕΜΕΝΟΣ παίρνει 401 και ο έλεγχος ΤΕΛΕΙΩΝΕΙ.**
   * «Περίμενε να **μάθεις**» ≠ «περίμενε να **συνδεθεί**». Χωρίς αυτή την άγκυρα, μια
   * υλοποίηση που περιμένει σύνδεση που δεν θα έρθει ποτέ θα περνούσε την Α1.
   *
   * ⛔ ΜΕΤΑΛΛΑΞΗ: κάνε την αναμονή να μην επιλύεται ποτέ ⇒ ο αγώνας του `settlesWithin` κερδίζει.
   */
  it('Α2 — αποσυνδεδεμένος: 401 ΓΡΗΓΟΡΑ, χωρίς να φύγει αίτημα στο δίκτυο', async () => {
    waitForAuthReadyMock.mockResolvedValue(false); // έμαθε — και δεν είναι κανείς

    await expect(
      settlesWithin(apiClient.get('/api/reports/sales'), 2000),
    ).rejects.toMatchObject({ statusCode: 401, errorCode: 'AUTHENTICATION_REQUIRED' });

    expect(waitForAuthReadyMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  /**
   * **Α3 — η ΘΕΡΜΗ διαδρομή δεν πληρώνει τίποτα.**
   * Αν ξέρουμε ήδη ποιος ρωτά, δεν υπάρχει τίποτα να περιμένουμε: ούτε `await`, ούτε promise.
   * Ίδιο ιδίωμα με το `requireAuthContext`.
   *
   * ⛔ ΜΕΤΑΛΛΑΞΗ: σβήσε το `if (!auth.currentUser)` ⇒ η αναμονή καλείται, κόκκινο.
   */
  it('Α3 — ήδη συνδεδεμένος: ΜΗΔΕΝ αναμονή', async () => {
    mutableAuth.currentUser = makeUser();
    waitForAuthReadyMock.mockResolvedValue(true);

    const result = await settlesWithin(apiClient.get('/api/reports/sales'), 2000);

    expect(result).toEqual({ ok: true });
    expect(waitForAuthReadyMock).not.toHaveBeenCalled();
  });

  /**
   * **Α4 — Ν ταυτόχρονα αιτήματα, ΜΙΑ αναμονή.**
   * Το `buildHeaders` καλείται **μέσα** στον βρόχο επαναλήψεων· χωρίς απομνημόνευση η
   * αναμονή πληρωνόταν πολλαπλά, και κάθε καλών θα άνοιγε δική του συνδρομή.
   *
   * ⛔ ΜΕΤΑΛΛΑΞΗ: `??=` → `=` ⇒ τρεις κλήσεις, κόκκινο.
   */
  it('Α4 — η αναμονή απομνημονεύεται: 3 ταυτόχρονα αιτήματα ⇒ 1 αναμονή', async () => {
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    waitForAuthReadyMock.mockImplementation(async () => {
      await gate;
      mutableAuth.currentUser = makeUser();
      return true;
    });

    const inFlight = Promise.all([
      apiClient.get('/api/a'),
      apiClient.get('/api/b'),
      apiClient.get('/api/c'),
    ]);
    release?.();

    await settlesWithin(inFlight, 2000);

    expect(waitForAuthReadyMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  /**
   * **Α5 — ΤΟ ΦΡΑΓΜΑ: κολλημένη ετοιμότητα ⇒ πέφτουμε στη ΣΗΜΕΡΙΝΗ συμπεριφορά.**
   * Το SDK φράζει το **δίκτυό** του (30s), αλλά **όχι** κολλημένο persistence. Χωρίς δικό
   * μας φράγμα, εκεί η οθόνη γυρίζει για πάντα — και επειδή τα hooks ζωγραφίζουν το
   * «Δοκιμάστε ξανά» **από τον κλάδο σφάλματος**, ο άνθρωπος θα έχανε και την παράκαμψη.
   *
   * ⛔ ΜΕΤΑΛΛΑΞΗ: αφαίρεσε το `withTimeout` ⇒ δεν επιλύεται ποτέ, κόκκινο.
   */
  it('Α5 — ετοιμότητα που ΔΕΝ έρχεται ποτέ: το φράγμα λήγει και απαντά 401', async () => {
    jest.useFakeTimers();
    try {
      waitForAuthReadyMock.mockImplementation(() => new Promise<boolean>(() => undefined));

      const pending = apiClient.get('/api/reports/sales');
      const assertion = expect(pending).rejects.toMatchObject({ statusCode: 401 });

      // Ακριβώς το φράγμα του πελάτη (35s = 30s φράγμα SDK + περιθώριο).
      await jest.advanceTimersByTimeAsync(35_000);
      await assertion;

      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  /**
   * **Α6 — 401 που ΔΕΝ ΕΦΥΓΕ ΠΟΤΕ δεν ενεργοποιεί ανάκτηση μπαγιάτικου token.**
   * Ο κλάδος ανάκτησης υπάρχει για *«ο διακομιστής απέρριψε το token μου»*. Ένα σφάλμα που
   * γεννήθηκε **πριν** από κάθε δίκτυο δεν έχει τι να ανακτήσει: η ανανέωση ξαναπετά αμέσως
   * και καίει επανάληψη. Ο `ApiClientError` κρατά `response` **μόνο** όταν προήλθε από
   * απάντηση — η ίδια η δομή του σφάλματος ξεχωρίζει τα δύο.
   *
   * ⛔ ΜΕΤΑΛΛΑΞΗ: σβήσε το `error.response !== undefined` ⇒ δεύτερη κλήση `getIdToken`, κόκκινο.
   */
  it('Α6 — αποτυχία λήψης token: ΜΙΑ προσπάθεια, καμία άσκοπη ανανέωση', async () => {
    const user = makeUser();
    user.getIdToken.mockRejectedValue(new Error('token backend down'));
    mutableAuth.currentUser = user;

    await expect(
      settlesWithin(apiClient.get('/api/reports/sales'), 2000),
    ).rejects.toMatchObject({ statusCode: 401, errorCode: 'TOKEN_RETRIEVAL_FAILED' });

    expect(user.getIdToken).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
