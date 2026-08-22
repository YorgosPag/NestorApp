/**
 * @fileoverview **ΟΙ ΑΓΚΥΡΕΣ ΤΟΥ ΣΤΑΔΙΟΥ Α.1** — «η φόρμα δεν προϋποθέτει πρόσωπο».
 * @related ADR-660 §5.9 · lib/forms/draft-identity.ts · lib/forms/draft-validation.ts
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ΤΙ ΚΛΕΙΔΩΝΕΙ, ΚΑΙ ΓΙΑΤΙ ΤΟ ΚΑΘΕΝΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * **Κ** — ο **ΕΝΑΣ** κριτής ταυτότητας: δύο σχήματα (λίστα · κατηγόρημα), **μία**
 *         απάντηση. Αν αποκλίνουν, το `Κ4` κοκκινίζει.
 * **Λ** — η συγχώνευση εμποδίων· το `Λ1` είναι η άγκυρα του **σιωπηλού αδιεξόδου**.
 * **Φ** — **ο ΠΑΡΟΝΟΜΑΣΤΗΣ**: η ίδια πλήρης φόρμα βγαίνει `ready` **με** ταυτότητα
 *         και `incomplete` **χωρίς**. Χωρίς το πρώτο σκέλος, το δεύτερο θα μπορούσε
 *         να είναι πράσινο επειδή το fixture ήταν άκυρο για **άλλο** λόγο.
 * **Μ** — **ΣΥΜΠΕΡΙΦΟΡΑ** του ανεβάσματος (όχι κείμενο): χωρίς ταυτότητα η κατάσταση
 *         είναι `accountRequired`, **ποτέ** `failed`.
 * **Π** — **ΒΑΘΜΟΝΟΜΗΣΗ ΣΕ ΠΡΑΓΜΑΤΙΚΟ ΙΣΤΟΡΙΚΟ** (`git show f8607fa4:`), ώστε να
 *         αποδεικνύεται ότι το ελάττωμα **υπήρξε** — αλλιώς «σήμερα είναι σωστό»
 *         μπορεί να σημαίνει «δεν υπήρξε ποτέ βλάβη».
 *
 * ⚠️ **ΚΑΡΦΩΜΕΝΟ commit, ΠΟΤΕ `HEAD`**: το `HEAD` μετακινείται και οι άγκυρες `Π` θα
 * αυτοακυρώνονταν σιωπηλά (μάθημα CHECK 3.41).
 *
 * 🔶 **ΔΗΛΩΜΕΝΟ ΟΡΙΟ**: το `Π3` κρίνει **πηγή**, όχι απόδοση — το
 * `OwnerPropertyFormContent` σέρνει `useAuth`, δρομολογητή και δυναμική εισαγωγή,
 * και δεν αποδίδεται φθηνά. Κλειδώνει τη **ραφή** (ότι η φόρμα καλεί τον SSoT), ενώ
 * τη **λογική** την κλειδώνουν τα `Λ`. Δεν ισχυρίζεται περισσότερα.
 */

import { execFileSync } from 'node:child_process';

import { renderHook, act } from '@testing-library/react';

import { draftIdentityBlockers, hasDraftIdentity } from '../draft-identity';
import { withExtraBlockers, type DraftFormValidation } from '../draft-validation';
import {
  EMPTY_OWNER_PROPERTY_FORM,
  type OwnerPropertyFormValues,
} from '@/lib/owner-property/owner-property-form-values';
import { validateOwnerPropertyForm } from '@/lib/owner-property/owner-property-form-validation';
import { useOwnerPropertyMedia } from '@/hooks/owner-property/useOwnerPropertyMedia';

jest.mock('@/lib/firebase', () => ({ storage: { __mockStorage: true } }));
jest.mock('firebase/storage', () => ({
  ref: jest.fn(),
  uploadBytesResumable: jest.fn(),
  getDownloadURL: jest.fn(),
}));

/** Το **καρφωμένο** commit — η τελευταία κατάσταση **πριν** το Στάδιο Α.1. */
const PINNED = 'f8607fa4';

/**
 * ⚠️ **Σκάει σε κενή απάντηση, και είναι απαίτηση**: αν το `git show` δεν βρει το
 * blob (μετονομασία, διαγραφή, ρηχό clone), ένα σιωπηλό `''` θα έκανε **κάθε**
 * άγκυρα `Π` πράσινη — απόδειξη πάνω σε κείμενο που δεν υπάρχει.
 */
function gitShow(path: string): string {
  const out = execFileSync('git', ['show', `${PINNED}:${path}`], {
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  if (out.trim() === '') throw new Error(`κενό blob: ${PINNED}:${path}`);
  return out;
}

/**
 * Οι **εκτελέσιμες** γραμμές ενός αρχείου.
 *
 * 🔴 **Η τεκμηρίωση της βλάβης ΔΕΝ είναι βλάβη** (`Κ7β` της CHECK 3.50): το σχόλιο
 * που εξηγεί γιατί έφυγε ο `|| user === null` **περιέχει** τη συμβολοσειρά. Μια
 * άγκυρα που ψάχνει κείμενο χωρίς αυτό το φίλτρο κοκκινίζει πάνω στη **θεραπεία**.
 *
 * 🔶 **Δηλωμένο όριο**: κόβει σχόλια **γραμμής** (`//`) και σώματα JSDoc (`*`) — όχι
 * `/* … *\/` σε μία γραμμή. Αρκεί για ό,τι κρίνει, και δεν προσποιείται τον πλήρη
 * αναλυτή που θα ήταν **πέμπτο** αντίγραφο του `stripComments` στα `__tests__`.
 */
function executableLines(source: string): string {
  return source
    .split('\n')
    .filter((line) => {
      const trimmed = line.trim();
      return !trimmed.startsWith('//') && !trimmed.startsWith('*') && !trimmed.startsWith('/*');
    })
    .join('\n');
}

/** Μια πλήρης φόρμα που **περνά** — η βάση των `Φ`. */
function completeForm(): OwnerPropertyFormValues {
  return {
    ...EMPTY_OWNER_PROPERTY_FORM,
    title: 'Διαμέρισμα 92 τ.μ.',
    type: 'apartment',
    areaSqm: 92,
    offerKinds: ['sell'],
    askingPrice: 210_000,
    placeAnswer: 'declared',
    placeQuery: 'Εγνατίας 147, Θεσσαλονίκη',
    placePoint: { lat: 40.63, lng: 22.95 },
    placeAccuracy: 'exact',
  };
}

function validateForm(values: OwnerPropertyFormValues) {
  let minted = 0;
  return validateOwnerPropertyForm(values, {
    previous: [],
    mintOfferId: () => `offr_test_${(minted += 1)}`,
  });
}

/** Η **ίδια** σύνθεση που κάνει η φόρμα: κριτής + εμπόδια περιβάλλοντος. */
function validateAsScreen(values: OwnerPropertyFormValues, uid: string | null) {
  return withExtraBlockers<unknown, string, string>(
    validateForm(values),
    draftIdentityBlockers(uid),
  );
}

// =============================================================================
// Κ — Ο ΕΝΑΣ ΚΡΙΤΗΣ ΤΑΥΤΟΤΗΤΑΣ
// =============================================================================

describe('Κ — ο ΕΝΑΣ κριτής ταυτότητας', () => {
  it('Κ1 — απουσία χρήστη ⇒ εμπόδιο `account-required`', () => {
    expect(draftIdentityBlockers(null)).toEqual(['account-required']);
  });

  it('Κ2 — ΚΕΝΗ συμβολοσειρά μετράει ως απουσία (θα έφτιαχνε διαδρομή με λάθος τμήματα)', () => {
    expect(draftIdentityBlockers('')).toEqual(['account-required']);
  });

  it('Κ3 — υπαρκτό uid ⇒ κανένα εμπόδιο', () => {
    expect(draftIdentityBlockers('WKBWEg3DSfcdSbLNJfzGEW3vkct1')).toEqual([]);
  });

  it('Κ4 — λίστα και κατηγόρημα ΔΕΝ μπορούν να αποκλίνουν', () => {
    for (const uid of [null, '', ' ', 'uid-1']) {
      expect(hasDraftIdentity(uid)).toBe(draftIdentityBlockers(uid).length === 0);
    }
  });
});

// =============================================================================
// Λ — Η ΣΥΓΧΩΝΕΥΣΗ, ΚΑΙ ΤΟ ΣΙΩΠΗΛΟ ΑΔΙΕΞΟΔΟ
// =============================================================================

const READY: DraftFormValidation<{ ok: true }, string, string> = {
  kind: 'ready',
  draft: { ok: true },
};

const INCOMPLETE: DraftFormValidation<{ ok: true }, string, string> = {
  kind: 'incomplete',
  malformed: ['areaSqm'],
  blockers: ['place-unresolved'],
  violations: ['offer-empty'],
};

describe('Λ — withExtraBlockers', () => {
  it('Λ1 — 🔴 `ready` + εξωτερικό εμπόδιο ⇒ ΠΑΥΕΙ να είναι `ready` (η άγκυρα του σιωπηλού αδιεξόδου)', () => {
    const merged = withExtraBlockers(READY, ['account-required']);
    expect(merged.kind).toBe('incomplete');
    if (merged.kind === 'incomplete') {
      expect(merged.blockers).toEqual(['account-required']);
    }
  });

  it('Λ2 — τα εμπόδια της φόρμας μπαίνουν ΠΡΩΤΑ, τα εξωτερικά ΜΕΤΑ (σειρά-συμβόλαιο)', () => {
    const merged = withExtraBlockers(INCOMPLETE, ['account-required']);
    expect(merged.kind).toBe('incomplete');
    if (merged.kind === 'incomplete') {
      expect(merged.blockers).toEqual(['place-unresolved', 'account-required']);
    }
  });

  it('Λ3 — κενή λίστα ⇒ ΤΟ ΙΔΙΟ αντικείμενο (αλλιώς ακυρώνεται κάθε useMemo από κάτω)', () => {
    expect(withExtraBlockers(INCOMPLETE, [])).toBe(INCOMPLETE);
    expect(withExtraBlockers(READY, [])).toBe(READY);
  });

  it('Λ4 — οι αντιφάσεις και τα δυσανάγνωστα πεδία ΔΕΝ χάνονται στη συγχώνευση', () => {
    const merged = withExtraBlockers(INCOMPLETE, ['account-required']);
    if (merged.kind !== 'incomplete') throw new Error('αναμενόταν incomplete');
    expect(merged.violations).toEqual(['offer-empty']);
    expect(merged.malformed).toEqual(['areaSqm']);
  });
});

// =============================================================================
// Φ — Ο ΠΑΡΟΝΟΜΑΣΤΗΣ: Η ΙΔΙΑ ΦΟΡΜΑ, ΜΕ ΚΑΙ ΧΩΡΙΣ ΤΑΥΤΟΤΗΤΑ
// =============================================================================

describe('Φ — η πλήρης φόρμα του ιδιώτη', () => {
  it('Φ1 — ΠΑΡΟΝΟΜΑΣΤΗΣ: με ταυτότητα, η ίδια φόρμα είναι `ready`', () => {
    expect(validateAsScreen(completeForm(), 'uid-1').kind).toBe('ready');
  });

  it('Φ2 — χωρίς ταυτότητα, η ΙΔΙΑ φόρμα είναι `incomplete` με ΟΡΑΤΟ εμπόδιο', () => {
    const result = validateAsScreen(completeForm(), null);
    expect(result.kind).toBe('incomplete');
    if (result.kind === 'incomplete') {
      expect(result.blockers).toContain('account-required');
    }
  });

  it('Φ3 — καμία ΑΛΛΗ ενότητα δεν ζητά ταυτότητα: το μόνο εμπόδιο είναι ο λογαριασμός', () => {
    const result = validateAsScreen(completeForm(), null);
    if (result.kind !== 'incomplete') throw new Error('αναμενόταν incomplete');
    expect(result.blockers).toEqual(['account-required']);
    expect(result.violations).toEqual([]);
    expect(result.malformed).toEqual([]);
  });
});

// =============================================================================
// Μ — ΤΟ ΑΝΕΒΑΣΜΑ ΛΕΕΙ ΤΗΝ ΑΛΗΘΕΙΑ (ΣΥΜΠΕΡΙΦΟΡΑ)
// =============================================================================

describe('Μ — useOwnerPropertyMedia χωρίς ταυτότητα', () => {
  it('Μ1 — 🔴 κατάσταση `accountRequired`, ΠΟΤΕ `failed`', async () => {
    const { result } = renderHook(() => useOwnerPropertyMedia(null, 'ownp_x'));

    await act(async () => {
      const uploaded = await result.current.upload(
        new File(['x'], 'katopsi.pdf', { type: 'application/pdf' }),
      );
      expect(uploaded).toBeNull();
    });

    expect(result.current.state.state).toBe('accountRequired');
  });

  it('Μ2 — η κατάσταση ΔΕΝ κατονομάζει αρχείο (το εμπόδιο αφορά ΟΛΑ, όχι εκείνο)', async () => {
    const { result } = renderHook(() => useOwnerPropertyMedia('', 'ownp_x'));

    await act(async () => {
      await result.current.upload(new File(['x'], 'foto.jpg', { type: 'image/jpeg' }));
    });

    expect(result.current.state).toEqual({ state: 'accountRequired' });
  });
});

// =============================================================================
// Π — ΒΑΘΜΟΝΟΜΗΣΗ ΣΕ ΠΡΑΓΜΑΤΙΚΟ ΙΣΤΟΡΙΚΟ
// =============================================================================

describe(`Π — βαθμονόμηση στο ${PINNED}`, () => {
  it('Π1 — ΤΟ ΕΛΑΤΤΩΜΑ ΥΠΗΡΞΕ: η απουσία ταυτότητας αναφερόταν ως αποτυχία ΑΡΧΕΙΟΥ', () => {
    const before = gitShow('src/hooks/owner-property/useOwnerPropertyMedia.ts');
    expect(before).toContain("message: 'NO_IDENTITY'");
    expect(before).not.toContain('accountRequired');
  });

  it('Π2 — ΤΟ ΕΛΑΤΤΩΜΑ ΥΠΗΡΞΕ: η υποβολή σιωπούσε σε δεύτερο, αόρατο φρουρό', () => {
    const before = executableLines(
      gitShow('src/components/owner-property/OwnerPropertyFormContent.tsx'),
    );
    expect(before).toContain("if (validation.kind !== 'ready' || user === null) return;");
  });

  it('Π3 — ΣΗΜΕΡΑ: η φόρμα καλεί τον SSoT, και ο δεύτερος φρουρός έφυγε από τον κώδικα', () => {
    const now = executableLines(
      require('node:fs').readFileSync(
        'src/components/owner-property/OwnerPropertyFormContent.tsx',
        'utf8',
      ),
    );
    expect(now).toContain('draftIdentityBlockers(');
    expect(now).toContain('withExtraBlockers<');
    expect(now).not.toContain("|| user === null) return;");
  });
});
