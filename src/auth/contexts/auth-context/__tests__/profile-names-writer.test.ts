/**
 * ADR-834 §6.2 — ΑΓΚΥΡΕΣ για τη γραφή που **δεν υπήρχε**: το όνομα στο `users/{uid}`.
 *
 * 🔴 **ΤΟ ΕΛΑΤΤΩΜΑ, ΜΕΤΡΗΜΕΝΟ ΣΤΗ ΖΩΝΤΑΝΗ ΒΑΣΗ (2026-08-30)**: τα `givenName` /
 * `familyName` του `users/{uid}` ήταν πεδία **που κανείς δεν έγραφε**. Το `/profile`,
 * το «complete profile» του Google και η εγγραφή έγραφαν **Firebase Auth +
 * `localStorage`**· ο μόνος γραφέας του εγγράφου (`/api/admin/ensure-user-profile`)
 * **δεν καλείται από πουθενά**. Αποτέλεσμα: `givenName: null` σε λογαριασμό με
 * `displayName: "Georgios Pagonis"`.
 *
 * ⚠️ **Γιατί έγινε ΠΡΙΝ τον κριτή ταυτότητας**: ο κριτής διαβάζει **το έγγραφο** και
 * στέλνει τον άνθρωπο στο `/profile`. Χωρίς αυτή τη γραφή, η άρνηση θα ήταν
 * **αδιέξοδο** — διορθώνει, και τίποτα δεν αλλάζει.
 *
 *   Κ-1  🔴 Ο κριτής: **και τα δύο κενά** ⇒ μη-εντολή (η θεραπεία της 2026-08-24)
 *   Κ-2  Μερική συμπλήρωση **είναι** δήλωση — αλλιώς δεν σβήνεις μόνο το επώνυμο
 *   Γ-1  Ο γραφέας βάζει τα δύο πεδία στο **σωστό έγγραφο**
 *   Γ-2  Το `displayName` είναι **ΠΑΡΑΓΩΓΟ**, ποτέ τέταρτη δήλωση
 *   Γ-3  Κόβει τα κενά — «Γιώργος » και «Γιώργος» είναι ο ίδιος άνθρωπος
 *   Γ-4  ⛔ **ΚΑΝΕΝΑ `deleteField`**: εδώ το κενό δεν είναι ανάκληση (≠ επάγγελμα)
 *   Ρ-1  🔶 Η ΡΑΦΗ (δηλωμένο όριο: κρίνει **πηγή**) — και οι **δύο** καλούντες φρουρούν
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

import type { Firestore } from 'firebase/firestore';

import { composedDisplayName, isNameDeclaration } from '@/auth/utils/profile-names';
import { saveProfileNames } from '../auth-context-profile';

/** Δείκτης-φρουρός: ό,τι φέρει αυτό, ζητήθηκε **διαγραφή** πεδίου. */
const DELETE = Symbol('deleteField');

const writes: Array<Record<string, unknown>> = [];

jest.mock('firebase/firestore', () => ({
  doc: (_db: unknown, collection: string, id: string) => ({ path: `${collection}/${id}` }),
  deleteField: () => DELETE,
  setDoc: (ref: { path: string }, payload: Record<string, unknown>, options: unknown) => {
    writes.push({ ...payload, __path: ref.path, __options: options });
    return Promise.resolve();
  },
  getDoc: jest.fn(),
  increment: jest.fn(),
}));

jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
}));

const db = {} as Firestore;

function lastWrite(): Record<string, unknown> {
  const payload = writes[writes.length - 1];
  expect(payload).toBeDefined();
  return payload;
}

function repoFile(relative: string): string {
  return readFileSync(path.join(process.cwd(), relative), 'utf8');
}

beforeEach(() => {
  writes.length = 0;
});

// ============================================================================
describe('Κ — ο ΕΝΑΣ κριτής της κενής φόρμας', () => {
  it('Κ-1 🔴 και τα δύο κενά ⇒ ΔΕΝ είναι δήλωση (μετρημένη απώλεια δεδομένων 24/08)', () => {
    expect(isNameDeclaration({ givenName: '', familyName: '' })).toBe(false);
    expect(isNameDeclaration({ givenName: '   ', familyName: ' ' })).toBe(false);
  });

  it('Κ-2 μερική συμπλήρωση ΕΙΝΑΙ δήλωση — αλλιώς δεν αφαιρείς μόνο το επώνυμο', () => {
    expect(isNameDeclaration({ givenName: 'Γεώργιος', familyName: '' })).toBe(true);
    expect(isNameDeclaration({ givenName: '', familyName: 'Παγώνης' })).toBe(true);
  });
});

// ============================================================================
describe('Γ — ο γραφέας που έλειπε', () => {
  it('Γ-1 τα δύο πεδία φτάνουν στο `users/{uid}`', async () => {
    await saveProfileNames(db, 'u1', { givenName: 'Γεώργιος', familyName: 'Παγώνης' });

    const payload = lastWrite();
    // 🔑 ΚΥΡΙΟΛΕΞΙΑ: η διαδρομή είναι υπόσχεση προς τον κριτή που θα διαβάσει.
    //    Σύγκριση με `COLLECTIONS.USERS` θα σύγκρινε τη σταθερά με τον εαυτό της.
    expect(payload.__path).toBe('users/u1');
    expect(payload.givenName).toBe('Γεώργιος');
    expect(payload.familyName).toBe('Παγώνης');
    expect(payload.__options).toEqual({ merge: true });
  });

  it('Γ-2 🔴 το `displayName` είναι ΠΑΡΑΓΩΓΟ των δύο, ποτέ τρίτη δήλωση', async () => {
    await saveProfileNames(db, 'u1', { givenName: 'Γεώργιος', familyName: 'Παγώνης' });

    expect(lastWrite().displayName).toBe('Γεώργιος Παγώνης');
    // Και η παραγωγή είναι η **ίδια** συνάρτηση που ζητά το Firebase Auth.
    expect(composedDisplayName({ givenName: 'Γεώργιος', familyName: 'Παγώνης' }))
      .toBe('Γεώργιος Παγώνης');
  });

  it('Γ-3 κόβει τα κενά — «Γιώργος » και «Γιώργος» είναι ο ίδιος άνθρωπος', async () => {
    await saveProfileNames(db, 'u1', { givenName: '  Γεώργιος ', familyName: ' Παγώνης  ' });

    const payload = lastWrite();
    expect(payload.givenName).toBe('Γεώργιος');
    expect(payload.familyName).toBe('Παγώνης');
    expect(payload.displayName).toBe('Γεώργιος Παγώνης');
  });

  it('Γ-4 ⛔ ΚΑΝΕΝΑ `deleteField` — εδώ το κενό ΔΕΝ είναι ανάκληση (≠ επάγγελμα)', async () => {
    await saveProfileNames(db, 'u1', { givenName: 'Γεώργιος', familyName: '' });

    // Το «σβήσ᾽ το» του επαγγέλματος είναι **ρητή** πράξη του ανθρώπου· εδώ ένα
    // `deleteField` θα ήταν ακριβώς το περιστατικό της 24/08 με άλλο όνομα.
    for (const value of Object.values(lastWrite())) {
      expect(value).not.toBe(DELETE);
    }
    expect(lastWrite().familyName).toBe('');
  });
});

// ============================================================================
describe('Ρ — η ραφή: κανένας καλών δεν γράφει το «καμία αλλαγή»', () => {
  /**
   * 🔶 **ΔΗΛΩΜΕΝΟ ΟΡΙΟ**: αυτό κρίνει **πηγή**, όχι απόδοση — το `AuthContext`
   * σέρνει Firebase Auth, δρομολογητή και ολόκληρο τον κύκλο συνεδρίας, και δεν
   * αποδίδεται φθηνά. Τη **συμπεριφορά** την κλειδώνουν τα `Κ`/`Γ`· αυτό φυλά ότι
   * ο φρουρός **δεν αφαιρέθηκε** από καμία από τις δύο διαδρομές.
   *
   * ⚠️ Και οι **δύο** μετρούν: η δεύτερη (`completeProfile`) είναι η διαδρομή του
   * χρήστη **Google**, δηλαδή ακριβώς εκείνου που είχε `givenName: null`.
   */
  it('Ρ-1 και οι ΔΥΟ καλούντες γράφουν ΜΟΝΟ σε `declared`', () => {
    const context = repoFile('src/auth/contexts/AuthContext.tsx');

    expect(context).toContain('await actions.updateUserProfile(givenName, familyName)');
    expect(context).toContain('await actions.completeProfile(givenName, familyName)');
    // Δύο κλήσεις, δύο φρουροί, δύο γραφές — ποτέ γραφή χωρίς φρουρό.
    expect(context.split("outcome.kind === 'declared'")).toHaveLength(3);
    expect(context.split('await saveProfileNames(db, outcome.uid, outcome.names)')).toHaveLength(3);
  });
});
