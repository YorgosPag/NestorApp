/**
 * ADR-813 — **ΜΙΑ ΑΝΑΚΛΗΣΗ ΠΟΥ ΔΕΝ ΦΤΑΝΕΙ ΔΕΝ ΕΙΝΑΙ ΑΝΑΚΛΗΣΗ**.
 *
 * 🔴 **Το γεγονός** (μετρημένο 2026-08-26): το `src/lib/auth/set-claims-with-mirror.ts`
 * γράφει **κατά λέξη** *«ALL server code paths that mutate custom claims MUST go
 * through this helper»* — και **4 από τα 6** ops scripts που καλούσαν
 * `setCustomUserClaims` **δεν** στάμπαραν `claimsUpdatedAt`. Ανάμεσά τους **και
 * οι δύο διαδρομές ΑΝΑΚΛΗΣΗΣ** (`downgrade-super-admin` · `clear-permissions`)
 * ⇒ ο υποβιβασμένος διαχειριστής κρατούσε τα προνόμιά του **έως μία ώρα**.
 *
 * *«Ένα anchor χωρίς gate είναι σχόλιο»* (CHECK 3.36) — εδώ το σχόλιο ήταν το
 * ίδιο το συμβόλαιο.
 *
 * ⚠️ **ΤΡΕΙΣ ΑΝΕΞΑΡΤΗΤΕΣ ΕΡΩΤΗΣΕΙΣ, ΠΟΤΕ ΜΙΑ ΜΕ «Ή»** — έχουν άλλη θεραπεία:
 *   **Ι.** συμφωνούν οι **δύο** υλοποιήσεις;      ⇒ *διόρθωσε το όνομα πεδίου*
 *   **Σ.** πάει **κάθε** ops script από τον ΕΝΑ;   ⇒ *μετανάστευσε τον καλούντα*
 *   **Κ.** κάνει ο ΕΝΑΣ τη δουλειά του σωστά;      ⇒ *διόρθωσε τον helper*
 *
 * @jest-environment node
 */

const fs = require('node:fs');
const path = require('node:path');

const {
  setClaimsWithMirror,
  CLAIMS_UPDATED_AT_FIELD,
  USERS_COLLECTION,
} = require('../_shared/setClaimsWithMirror');

const REPO = path.join(__dirname, '..', '..');
const SCRIPTS = path.join(REPO, 'scripts');
const HELPER_CJS = path.join(SCRIPTS, '_shared', 'setClaimsWithMirror.js');
const HELPER_TS = path.join(REPO, 'src', 'lib', 'auth', 'set-claims-with-mirror.ts');

/**
 * ⚠️ **ΔΗΛΩΜΕΝΗ ΕΞΑΙΡΕΣΗ, ΜΕ ΛΟΓΟ** — κλειστό σύνολο. Νέα εγγραφή εδώ πρέπει να
 * τη δει άνθρωπος· χωρίς τον κανόνα `Σ2` («ορφανή δήλωση») το σύνολο θα σάπιζε
 * σιωπηλά, όπως κάθε χειρόγραφη λίστα σε αυτό το repo (3.34 · 3.37 · 3.49 · 3.57).
 */
const DECLARED_EXCEPTIONS = {
  'lib/emulator/identity.ts':
    'Σπορά emulator: στάμπαρει ΗΔΗ claimsUpdatedAt και στα claims και στον καθρέφτη, ' +
    'και γράφει το ΠΛΗΡΕΣ προφίλ (occupation ADR-798) στην ΙΔΙΑ πράξη — η εξαγωγή ' +
    'του καθρέφτη θα έσπαγε μία ατομική εγγραφή σε δύο. Κανένας ζωντανός πελάτης ' +
    'δεν ακούει κατά τη σπορά.',
};

// ============================================================================
// Ι — ΟΙ ΔΥΟ ΥΛΟΠΟΙΗΣΕΙΣ ΣΥΜΦΩΝΟΥΝ
// ============================================================================

describe('Ι — ο αδελφός της εφαρμογής και ο αδελφός των ops', () => {
  const cjs = fs.readFileSync(HELPER_CJS, 'utf8');
  const ts = fs.readFileSync(HELPER_TS, 'utf8');

  test('Ι1 — ΙΔΙΟ όνομα πεδίου-σήματος και στα δύο', () => {
    // Χωρίς αυτό, μια μετονομασία στη μία πλευρά αφήνει την άλλη να στέλνει
    // σήμα **που κανείς δεν ακούει** — σιωπηλή επιστροφή στο ελάττωμα.
    expect(CLAIMS_UPDATED_AT_FIELD).toBe('claimsUpdatedAt');
    expect(ts).toContain('claimsUpdatedAt');
    expect(cjs).toContain("CLAIMS_UPDATED_AT_FIELD = 'claimsUpdatedAt'");
  });

  test('Ι2 — ΙΔΙΑ συλλογή καθρέφτη', () => {
    expect(USERS_COLLECTION).toBe('users');
    // Ο αδελφός τη ζητά από το SSoT των συλλογών· εδώ αρκεί να συμφωνεί η τιμή.
    expect(ts).toContain('COLLECTIONS.USERS');
  });

  test('Ι3 — ΚΑΝΕΝΑ λεξιλόγιο ρόλων/permissions στον ops γραφέα', () => {
    // ⛔ Τη στιγμή που αυτό το αρχείο αποφασίσει **τι** claims πρέπει να μπουν,
    //    γίνεται δεύτερος κριτής (CHECK 3.68) — και τότε είναι ADR-749 στα
    //    αλήθεια. Ο έλεγχος κοιτά τον **κώδικα**, χωρίς σχόλια: το docblock
    //    αναφέρει τις λέξεις ως τεκμηρίωση (σχήμα `Κ7β` του CHECK 3.50).
    const code = cjs.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
    for (const word of ['super_admin', 'company_admin', 'admin_access', 'globalRole']) {
      expect(code).not.toContain(word);
    }
  });
});

// ============================================================================
// Σ — ΚΑΘΕ OPS SCRIPT ΠΑΕΙ ΑΠΟ ΤΟΝ ΕΝΑ
// ============================================================================

describe('Σ — το συμβόλαιο έγινε μηχανικό', () => {
  /** Κάθε αρχείο κώδικα κάτω από `scripts/`, εκτός του ίδιου του helper. */
  function scriptFiles() {
    const out = [];
    (function walk(dir) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name !== 'node_modules' && entry.name !== '__tests__') walk(p);
          continue;
        }
        if (/\.(js|cjs|mjs|ts)$/.test(entry.name)) out.push(p);
      }
    })(SCRIPTS);
    return out.filter((p) => p !== HELPER_CJS);
  }

  const offenders = scriptFiles()
    .filter((p) => fs.readFileSync(p, 'utf8').includes('setCustomUserClaims'))
    .map((p) => path.relative(SCRIPTS, p).split(path.sep).join('/'));

  test('Σ0 — ΠΑΡΟΝΟΜΑΣΤΗΣ: ο σαρωτής όντως βλέπει αρχεία', () => {
    // Χωρίς αυτό, ένα «0 παραβάτες» θα σήμαινε «δεν κοίταξα» — το σχήμα που
    // κυνηγά όλο το repo.
    expect(scriptFiles().length).toBeGreaterThan(50);
    expect(scriptFiles().some((p) => p.endsWith('set-super-admin.js'))).toBe(true);
  });

  test('Σ1 — κανένα ops script δεν καλεί setCustomUserClaims απευθείας', () => {
    const undeclared = offenders.filter((f) => !(f in DECLARED_EXCEPTIONS));
    expect(undeclared).toEqual([]);
  });

  test('Σ2 — καμία ΟΡΦΑΝΗ δήλωση εξαίρεσης', () => {
    // Δήλωση που δεν αντιστοιχεί σε πραγματικό καλούντα = λίστα που σαπίζει.
    const orphans = Object.keys(DECLARED_EXCEPTIONS).filter((f) => !offenders.includes(f));
    expect(orphans).toEqual([]);
  });

  test('Σ3 — κάθε δήλωση φέρει ΟΥΣΙΑΣΤΙΚΟ λόγο', () => {
    for (const [file, reason] of Object.entries(DECLARED_EXCEPTIONS)) {
      expect(`${file}: ${reason}`.length).toBeGreaterThan(80);
    }
  });

  test('Σ4 — οι ΔΥΟ διαδρομές ΑΝΑΚΛΗΣΗΣ περνούν από τον ΕΝΑ', () => {
    // Ονομαστικά, γιατί αυτές ήταν η πραγματική βλάβη.
    for (const f of ['downgrade-super-admin.js', 'clear-permissions.js']) {
      const src = fs.readFileSync(path.join(SCRIPTS, f), 'utf8');
      expect(src).toContain('setClaimsWithMirror(admin,');
      expect(src).toContain("require('./_shared/setClaimsWithMirror')");
    }
  });
});

// ============================================================================
// Κ — Ο ΕΝΑΣ ΚΑΝΕΙ ΤΗ ΔΟΥΛΕΙΑ ΤΟΥ
// ============================================================================

describe('Κ — η συμπεριφορά του γραφέα', () => {
  function fakeAdmin({ mirrorThrows = false } = {}) {
    const calls = { claims: null, mirror: null };
    const docRef = {
      set: (data, opts) => {
        if (mirrorThrows) return Promise.reject(new Error('firestore down'));
        calls.mirror = { data, opts };
        return Promise.resolve();
      },
    };
    const admin = {
      auth: () => ({
        setCustomUserClaims: (uid, claims) => {
          calls.claims = { uid, claims };
          return Promise.resolve();
        },
      }),
      firestore: () => ({ collection: (c) => ({ doc: (d) => ({ ...docRef, _c: c, _d: d }) }) }),
    };
    admin.firestore.FieldValue = { serverTimestamp: () => '<serverTimestamp>' };
    return { admin, calls };
  }

  test('Κ1 — στάμπαρει το σήμα ΚΑΙ στα claims ΚΑΙ στον καθρέφτη, με ΤΗΝ ΙΔΙΑ τιμή', () => {
    const { admin, calls } = fakeAdmin();
    return setClaimsWithMirror(admin, 'uid-1', { globalRole: 'company_admin' }).then((r) => {
      expect(calls.claims.claims[CLAIMS_UPDATED_AT_FIELD]).toBe(r.claimsUpdatedAt);
      expect(calls.mirror.data[CLAIMS_UPDATED_AT_FIELD]).toBe(r.claimsUpdatedAt);
      expect(r.firestoreMirrorOk).toBe(true);
    });
  });

  test('Κ2 — το φορτίο του καλούντος περνά ΑΥΤΟΥΣΙΟ (καμία συγχώνευση, κανένας κριτής)', () => {
    const { admin, calls } = fakeAdmin();
    const payload = { companyId: 'comp_x', globalRole: 'external_user', permissions: ['admin_access'] };
    return setClaimsWithMirror(admin, 'uid-2', payload).then(() => {
      expect(calls.claims.claims).toMatchObject(payload);
    });
  });

  test('Κ3 — ο καθρέφτης γράφει με merge (ποτέ δεν σβήνει το έγγραφο)', () => {
    const { admin, calls } = fakeAdmin();
    return setClaimsWithMirror(admin, 'uid-3', {}).then(() => {
      expect(calls.mirror.opts).toEqual({ merge: true });
    });
  });

  test('Κ4 — αποτυχία ΚΑΘΡΕΦΤΗ δεν ακυρώνει τη γραφή, αλλά ΔΕΝ σιωπά', () => {
    const { admin, calls } = fakeAdmin({ mirrorThrows: true });
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    return setClaimsWithMirror(admin, 'uid-4', { globalRole: 'viewer' }).then((r) => {
      expect(calls.claims).not.toBeNull(); // η αυθεντία γράφτηκε
      expect(r.firestoreMirrorOk).toBe(false); // και ο καλών το μαθαίνει
      expect(warn).toHaveBeenCalled();
      warn.mockRestore();
    });
  });

  test('Κ5 — αποτυχία AUTH ανεβαίνει: ποτέ σιωπηλή μερική επιτυχία', () => {
    const admin = {
      auth: () => ({ setCustomUserClaims: () => Promise.reject(new Error('auth down')) }),
      firestore: () => ({ collection: () => ({ doc: () => ({ set: () => Promise.resolve() }) }) }),
    };
    admin.firestore.FieldValue = { serverTimestamp: () => '<ts>' };
    return expect(setClaimsWithMirror(admin, 'uid-5', {})).rejects.toThrow('auth down');
  });

  test('Κ6 — άκυρη είσοδος απορρίπτεται ΠΡΙΝ αγγίξει το Auth', async () => {
    // ⚠️ Η συνάρτηση είναι `async`: ένα `throw` μέσα της γίνεται **rejected
    //    promise**, όχι σύγχρονη εξαίρεση. Η πρώτη γραφή αυτής της άγκυρας
    //    χρησιμοποιούσε `expect(fn).toThrow()` και **έριχνε τον jest worker**
    //    με unhandled rejection — δηλαδή η σουίτα δεν έτρεχε ΚΑΘΟΛΟΥ, το
    //    χειρότερο είδος «πράσινου».
    const { admin, calls } = fakeAdmin();
    await expect(setClaimsWithMirror(admin, '', { a: 1 })).rejects.toThrow(/uid/);
    await expect(setClaimsWithMirror(admin, 'u', null)).rejects.toThrow(/claims/);
    expect(calls.claims).toBeNull();
  });
});
