/**
 * @fileoverview **ΟΙ ΑΓΚΥΡΕΣ ΤΟΥ ΣΤΑΔΙΟΥ Α.2** — η πόρτα άνοιξε, και το προσχέδιο επιβιώνει.
 * @related ADR-660 §5.10 · owner-property-draft-memory.ts · useOwnerPropertyDraftMemory.ts
 *
 * **Ν** — η μνήμη: τι επαναφέρεται, και **τι αρνείται** να επαναφερθεί.
 * **Ρ** — ο κύκλος ζωής στη φόρμα (ποτέ στην επεξεργασία).
 * **Σ** — **Η ΠΟΡΤΑ**: δομικές άγκυρες που κλειδώνουν τη μετακίνηση της διαδρομής.
 *
 * 🔑 **Το `Σ` κρίνει ΑΡΧΕΙΑ και ΔΗΛΩΣΕΙΣ, όχι απόδοση** — και είναι το σωστό επίπεδο:
 * το «ποιος φρουρός τυλίγει αυτή τη σελίδα» **δεν** είναι ερώτηση χρόνου εκτέλεσης
 * στο Next App Router, είναι ερώτηση **θέσης στο δέντρο**. Η ίδια ερώτηση που ρωτά η
 * CHECK 3.52, από τη μεριά του χαρακτηριστικού.
 */

import { existsSync, readFileSync } from 'node:fs';

import { renderHook, act } from '@testing-library/react';

import {
  forgetOwnerPropertyDraft,
  recallOwnerPropertyDraft,
  rememberOwnerPropertyDraft,
} from '../owner-property-draft-memory';
import {
  EMPTY_OWNER_PROPERTY_FORM,
  type OwnerPropertyFormValues,
} from '../owner-property-form-values';
import { STORAGE_KEYS } from '@/lib/storage';
import { useOwnerPropertyDraftMemory } from '@/hooks/owner-property/useOwnerPropertyDraftMemory';

const DRAFT_ID = 'ownp_bc548607-c39e-4926-92f8-69ab833d59a2';

function someValues(): OwnerPropertyFormValues {
  return {
    ...EMPTY_OWNER_PROPERTY_FORM,
    title: 'Μονοκατοικία στη Σταυρούπολη',
    type: 'detached_house',
    areaSqm: 140,
    offerKinds: ['sell'],
    askingPrice: 185_000,
    placeAnswer: 'declined',
  };
}

/** Γράφει **ωμά** στη θέση της μνήμης — για να δοκιμαστεί ό,τι ΔΕΝ γράψαμε εμείς. */
function writeRaw(payload: unknown): void {
  localStorage.setItem(STORAGE_KEYS.OWNER_PROPERTY_DRAFT, JSON.stringify(payload));
}

beforeEach(() => localStorage.clear());

// =============================================================================
// Ν — Η ΜΝΗΜΗ
// =============================================================================

describe('Ν — η μνήμη του προσχεδίου', () => {
  it('Ν1 — ό,τι θυμήθηκε επιστρέφει αυτούσιο, ΜΑΖΙ με την ταυτότητα', () => {
    rememberOwnerPropertyDraft(DRAFT_ID, someValues());
    const recalled = recallOwnerPropertyDraft();

    expect(recalled).not.toBeNull();
    // 🔴 Η ταυτότητα είναι η ΜΙΣΗ ουσία: νέο `draftId` στην επαναφορά θα έστελνε τα
    // αρχεία σε άλλον φάκελο από αυτόν που δηλώνει η αγγελία (§5.9).
    expect(recalled?.draftId).toBe(DRAFT_ID);
    expect(recalled?.values.title).toBe('Μονοκατοικία στη Σταυρούπολη');
    expect(recalled?.values.askingPrice).toBe(185_000);
  });

  it('Ν2 — άδεια μνήμη ⇒ `null`, όχι άδειο προσχέδιο', () => {
    expect(recallOwnerPropertyDraft()).toBeNull();
  });

  it('Ν3 — μετά τη λήθη δεν επιστρέφει τίποτα (η υποβολή που πέτυχε δεν αφήνει «ημιτελές»)', () => {
    rememberOwnerPropertyDraft(DRAFT_ID, someValues());
    forgetOwnerPropertyDraft();
    expect(recallOwnerPropertyDraft()).toBeNull();
  });

  it('Ν4 — ΑΛΛΗ έκδοση σχήματος αποθήκευσης ⇒ απορρίπτεται', () => {
    writeRaw({ version: 999, draftId: DRAFT_ID, values: someValues() });
    expect(recallOwnerPropertyDraft()).toBeNull();
  });

  it('Ν5 — ΔΟΜΙΚΗ φθορά ⇒ απορρίπτεται (ο ένας κριτής, στο σωστό βάθος)', () => {
    // `offerKinds` που δεν είναι πίνακας, και `placeAnswer` εκτός κλειστού συνόλου:
    // κανένα από τα δύο δεν μπορεί να προέλθει από άνθρωπο που πληκτρολογεί.
    writeRaw({ version: 1, draftId: DRAFT_ID, values: { ...someValues(), offerKinds: 'sell' } });
    expect(recallOwnerPropertyDraft()).toBeNull();

    writeRaw({ version: 1, draftId: DRAFT_ID, values: { ...someValues(), placeAnswer: 'μπλα' } });
    expect(recallOwnerPropertyDraft()).toBeNull();

    const { title: _dropped, ...withoutTitle } = someValues();
    writeRaw({ version: 1, draftId: DRAFT_ID, values: withoutTitle });
    expect(recallOwnerPropertyDraft()).toBeNull();
  });

  it('Ν5β — 🔑 Η ΕΠΑΝΑΦΟΡΑ ΔΕΝ ΕΙΝΑΙ ΑΥΣΤΗΡΟΤΕΡΗ ΑΠΟ ΤΗΝ ΠΛΗΚΤΡΟΛΟΓΗΣΗ', () => {
    // Το `optionalNumberSchema` δέχεται `string` **επίτηδες** — αυτό παραδίδει ένα
    // `<input type="number">`. Μια επαναφορά που το απέρριπτε θα πετούσε ολόκληρη τη
    // μισοσυμπληρωμένη φόρμα επειδή **ένα** πεδίο ήταν μισογραμμένο τη στιγμή που ο
    // άνθρωπος έφυγε να συνδεθεί. Το «έγκυρη αγγελία;» το απαντούν οι blockers.
    writeRaw({ version: 1, draftId: DRAFT_ID, values: { ...someValues(), areaSqm: '14' } });

    const recalled = recallOwnerPropertyDraft();
    expect(recalled).not.toBeNull();
    // ⚠️ Ωμή τιμή, όχι `parsed.data`: η φόρμα κρατά το `z.input`, όχι το `z.output`.
    expect(recalled?.values.areaSqm).toBe('14');
  });

  it('Ν6 — 🔴 ΑΣΦΑΛΕΙΑ: ταυτότητα με διαδρομή μέσα της ΔΕΝ επαναφέρεται', () => {
    // Το `localStorage` είναι επεξεργάσιμο από τον χρήστη, και το `draftId` καταλήγει
    // σε διαδρομή `owner_properties/{uid}/{draftId}/…`.
    for (const evil of ['../../etc/passwd', 'ownp_../..', 'dmnd_bc548607-c39e-4926-92f8-69ab833d59a2', '']) {
      writeRaw({ version: 1, draftId: evil, values: someValues() });
      expect(recallOwnerPropertyDraft()).toBeNull();
    }
  });

  it('Ν7 — σκουπίδια στη θέση της μνήμης ⇒ `null`, ποτέ εξαίρεση', () => {
    localStorage.setItem(STORAGE_KEYS.OWNER_PROPERTY_DRAFT, 'δεν είναι json');
    expect(recallOwnerPropertyDraft()).toBeNull();
  });
});

// =============================================================================
// Ρ — Ο ΚΥΚΛΟΣ ΖΩΗΣ ΣΤΗ ΦΟΡΜΑ
// =============================================================================

describe('Ρ — useOwnerPropertyDraftMemory', () => {
  it('Ρ1 — δημιουργία: επαναφέρει, και ΤΟ ΛΕΕΙ (η επαναφορά δεν είναι σιωπηλή)', () => {
    rememberOwnerPropertyDraft(DRAFT_ID, someValues());
    const { result } = renderHook(() => useOwnerPropertyDraftMemory(null));

    expect(result.current.restored?.draftId).toBe(DRAFT_ID);
    expect(result.current.noticeVisible).toBe(true);
  });

  it('Ρ2 — 🔴 ΕΠΕΞΕΡΓΑΣΙΑ: ΠΟΤΕ δεν επαναφέρει (θα έγραφε ημιτελή πάνω σε δημοσιευμένη)', () => {
    rememberOwnerPropertyDraft(DRAFT_ID, someValues());
    const { result } = renderHook(() => useOwnerPropertyDraftMemory('ownp_άλλη'));

    expect(result.current.restored).toBeNull();
    expect(result.current.noticeVisible).toBe(false);
  });

  it('Ρ3 — «κράτα το» κρύβει την ειδοποίηση ΧΩΡΙΣ να σβήσει τη μνήμη', () => {
    rememberOwnerPropertyDraft(DRAFT_ID, someValues());
    const { result } = renderHook(() => useOwnerPropertyDraftMemory(null));

    act(() => result.current.acknowledge());

    expect(result.current.noticeVisible).toBe(false);
    expect(recallOwnerPropertyDraft()).not.toBeNull();
  });

  it('Ρ5 — 🔴 Η ΛΗΘΗ ΕΙΝΑΙ ΤΕΛΙΚΗ: το προσχέδιο ΔΕΝ ανασταίνεται από επόμενη απόδοση', () => {
    // Το `forget()` αλλάζει κατάσταση ⇒ νέα απόδοση ⇒ το effect αποθήκευσης
    // ξανατρέχει. Χωρίς σφραγίδα, η επιτυχής υποβολή θα άφηνε πίσω της «ημιτελές»
    // πάνω σε αγγελία που δημοσιεύτηκε.
    const { result } = renderHook(() => useOwnerPropertyDraftMemory(null));

    act(() => result.current.forget());
    act(() => result.current.remember(DRAFT_ID, someValues()));

    expect(recallOwnerPropertyDraft()).toBeNull();
  });

  it('Ρ4 — «ξεκίνα από την αρχή» ΣΒΗΝΕΙ (αλλιώς θα επανερχόταν στην επόμενη επίσκεψη)', () => {
    rememberOwnerPropertyDraft(DRAFT_ID, someValues());
    const { result } = renderHook(() => useOwnerPropertyDraftMemory(null));

    act(() => result.current.forget());

    expect(result.current.noticeVisible).toBe(false);
    expect(recallOwnerPropertyDraft()).toBeNull();
  });
});

// =============================================================================
// Σ — Η ΠΟΡΤΑ
// =============================================================================

const PUBLIC_PAGE = 'src/app/(light)/offers/new/page.tsx';
const GUARDED_PAGE = 'src/app/(me)/offers/new/page.tsx';

describe('Σ — η πόρτα της καταχώρισης', () => {
  it('Σ1 — 🔴 η φόρμα ΔΕΝ ζει πια κάτω από τον φρουρό ταυτότητας', () => {
    expect(existsSync(PUBLIC_PAGE)).toBe(true);
    // Ο `(me)/layout.tsx` τυλίγει σε `PrivateSpaceShell` → `ProtectedRoute`: όσο η
    // σελίδα ζούσε εκεί, ο ανώνυμος ανακατευθυνόταν ΠΡΙΝ δει ένα πεδίο.
    expect(existsSync(GUARDED_PAGE)).toBe(false);
  });

  it('Σ2 — η διεύθυνση ΔΕΝ άλλαξε: το route group είναι φάκελος', () => {
    // Αν το URL είχε αλλάξει, θα είχαν σπάσει `NEW_OFFER_ROUTE`, το route slice
    // `offers__new.el.json`, και κάθε σελιδοδείκτης.
    expect(PUBLIC_PAGE).toContain('/offers/new/page.tsx');
    const routes = readFileSync('src/lib/owner-property/owner-property-routes.ts', 'utf8');
    expect(routes).toContain("'/offers/new'");
  });

  it('Σ3 — 🔴 το `noindex` ΔΕΝ χάθηκε στη μετακόμιση', () => {
    // Βγαίνοντας από το `(me)` (που το δηλώνει σε επίπεδο group) η σελίδα θα γινόταν
    // ευρετηριάσιμη ως **παρενέργεια**. Δηλώνεται ρητά, με δικό της λόγο.
    const page = readFileSync(PUBLIC_PAGE, 'utf8');
    expect(page).toContain('export const metadata');
    expect(page).toMatch(/robots:\s*\{\s*index:\s*false/);
  });

  it('Σ4 — το κλειστό σύνολο του CHECK 3.52 ονομάζει το νέο σπίτι', () => {
    const boundary = JSON.parse(readFileSync('.shell-boundary.json', 'utf8'));
    expect(boundary.groups['(light)'].wearsShell).toBe(false);
    expect(boundary.groups['(light)'].why).toContain('/offers/new');
  });

  it('Σ5 — το μητρώο route slices δείχνει στη ΝΕΑ ρίζα', () => {
    // Ο generator απέτυχε ΚΛΕΙΣΤΑ («shell root not found») όταν έλειπε αυτό — η
    // άγκυρα κρατά την ευθυγράμμιση χωρίς να χρειάζεται να ξανασπάσει.
    const registry = readFileSync('.i18n-shell-slice.json', 'utf8');
    expect(registry).toContain(PUBLIC_PAGE);
    expect(registry).not.toContain(GUARDED_PAGE);
  });

  it('Σ6 — 🔶 Η ΔΗΛΩΜΕΝΗ ΑΣΥΜΜΕΤΡΙΑ: το `/demands/new` ΜΕΝΕΙ φρουρημένο', () => {
    // Το μετρημένο κενό της idealista (§5.8) είναι η ΠΡΟΣΦΟΡΑ. Η συμμετρία θα ήταν
    // αντιγραφή χωρίς μέτρηση — και αν γίνει, πρέπει να γίνει ΣΥΝΕΙΔΗΤΑ, σβήνοντας
    // αυτή την άγκυρα.
    expect(existsSync('src/app/(me)/demands/new/page.tsx')).toBe(true);
    expect(existsSync('src/app/(light)/demands/new/page.tsx')).toBe(false);
  });
});
