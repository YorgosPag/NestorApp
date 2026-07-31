/**
 * ADR-742 — ο SSoT «δικαιούμαι να γράψω σε ΑΥΤΟ το υπόβαθρο;».
 *
 * ΓΙΑΤΙ ΥΠΑΡΧΕΙ: μέχρι το ADR-742 η ίδια τετράδα γραμμών (διάβασε → «υπάρχει;»
 * → «ανήκει;» → ρίξε) ήταν γραμμένη σε **δύο** υπηρεσίες με **διαφορετικό τύπο
 * σφάλματος** στο τέλος — η μία `CrossTenantAccessError`, η άλλη σκέτο
 * `Error('Cross-tenant scale write denied')`. Το route της δεύτερης διάβαζε
 * **κείμενο μηνύματος** για να πάρει απόφαση ασφαλείας: μια αθώα αλλαγή
 * διατύπωσης θα μετέτρεπε σιωπηλά το `403` σε `500`.
 *
 * Εδώ κατοχυρώνεται ότι ο έλεγχος είναι **ένας** και ότι το σφάλμα φτάνει στο
 * route **τυποποιημένο**, με τα δομημένα πεδία που χρειάζεται η μεταμφίεση.
 */

import {
  BackgroundLockedError,
  BackgroundNotFoundError,
  assertBackgroundOwned,
  txReadOwnedRow,
} from '../background-ownership';
import { CrossTenantAccessError } from '@/lib/auth/tenant-ownership';

const BG_ID = 'bg_01K9ZQ7X8N4M2P';
const CALLER_COMPANY = 'comp_kalonta';
const OWNER_COMPANY = 'comp_allou';

type Row = Record<string, unknown>;

/** Ελάχιστη συναλλαγή: μας ενδιαφέρει μόνο τι επιστρέφει το `tx.get`. */
function fakeTx(snap: { exists: boolean; data?: Row }) {
  return {
    get: jest.fn().mockResolvedValue({
      exists: snap.exists,
      data: () => snap.data ?? {},
    }),
  } as unknown as FirebaseFirestore.Transaction;
}

const fakeRef = {} as FirebaseFirestore.DocumentReference;

describe('assertBackgroundOwned', () => {
  it('περνά σιωπηλά όταν το υπόβαθρο ανήκει στον καλούντα', () => {
    expect(() =>
      assertBackgroundOwned({ companyId: CALLER_COMPANY }, CALLER_COMPANY, BG_ID, 'denied'),
    ).not.toThrow();
  });

  it('ρίχνει ΤΥΠΟΠΟΙΗΜΕΝΟ σφάλμα — όχι σκέτο Error', () => {
    expect(() =>
      assertBackgroundOwned({ companyId: OWNER_COMPANY }, CALLER_COMPANY, BG_ID, 'denied'),
    ).toThrow(CrossTenantAccessError);
  });

  it('κουβαλά τα δομημένα πεδία που χρειάζεται η μεταμφίεση του route', () => {
    let caught: unknown;
    try {
      assertBackgroundOwned(
        { companyId: OWNER_COMPANY },
        CALLER_COMPANY,
        BG_ID,
        'Cross-tenant patch denied',
      );
    } catch (err) {
      caught = err;
    }

    // 🔴 Το `resourceId` **είναι** ο λόγος που το route μπορεί να παράξει
    // πανομοιότυπο 404 χωρίς να ξαναδιαβάσει τη βάση.
    expect(caught).toBeInstanceOf(CrossTenantAccessError);
    const err = caught as CrossTenantAccessError;
    expect(err.resourceId).toBe(BG_ID);
    expect(err.resource).toBe('Floorplan background');
    expect(err.expectedCompanyId).toBe(CALLER_COMPANY);
    expect(err.actualCompanyId).toBe(OWNER_COMPANY);
    expect(err.name).toBe('FloorplanBackgroundCrossTenantError');
    expect(err.message).toBe('Cross-tenant patch denied');
  });

  it('υπόβαθρο ΧΩΡΙΣ companyId δεν ανήκει σε κανέναν — ούτε σε κενό καλούντα', () => {
    // Η παγίδα του κενού (ADR-742 §4): `'' === ''` θα «ταίριαζε» σε αφελή σύγκριση.
    expect(() => assertBackgroundOwned({ companyId: '' }, '', BG_ID, 'denied')).toThrow(
      CrossTenantAccessError,
    );
  });
});

describe('txReadOwnedRow', () => {
  it('επιστρέφει τη γραμμή όταν υπάρχει και ανήκει στον καλούντα', async () => {
    const row = { companyId: CALLER_COMPANY, locked: false };

    await expect(
      txReadOwnedRow(fakeTx({ exists: true, data: row }), fakeRef, BG_ID, CALLER_COMPANY, 'denied'),
    ).resolves.toEqual(row);
  });

  it('ανύπαρκτο → BackgroundNotFoundError με το id στο μήνυμα', async () => {
    const promise = txReadOwnedRow(
      fakeTx({ exists: false }),
      fakeRef,
      BG_ID,
      CALLER_COMPANY,
      'denied',
    );

    await expect(promise).rejects.toBeInstanceOf(BackgroundNotFoundError);
    await expect(promise).rejects.toThrow(`Background not found: ${BG_ID}`);
  });

  it('ξένο → CrossTenantAccessError, ΟΧΙ «δεν βρέθηκε»', async () => {
    // Η υπηρεσία λέει πάντα την αλήθεια· τη σιωπή τη βάζει το σύνορο (§3.4).
    // Αν αυτό γίνει `BackgroundNotFoundError`, ο super-admin χάνει τη διάγνωση.
    const promise = txReadOwnedRow(
      fakeTx({ exists: true, data: { companyId: OWNER_COMPANY } }),
      fakeRef,
      BG_ID,
      CALLER_COMPANY,
      'Cross-tenant scale write denied',
    );

    await expect(promise).rejects.toBeInstanceOf(CrossTenantAccessError);
    await expect(promise).rejects.not.toBeInstanceOf(BackgroundNotFoundError);
  });

  it('ο έλεγχος γίνεται ΜΕΣΑ στη συναλλαγή — διαβάζει μέσω tx.get', async () => {
    // Εκτός συναλλαγής, ένα ταυτόχρονο delete ανάμεσα στην ανάγνωση και την
    // εγγραφή θα περνούσε. Το `tx.get` είναι το μόνο που το αποκλείει.
    const tx = fakeTx({ exists: true, data: { companyId: CALLER_COMPANY } });

    await txReadOwnedRow(tx, fakeRef, BG_ID, CALLER_COMPANY, 'denied');

    expect(tx.get).toHaveBeenCalledWith(fakeRef);
  });
});

describe('BackgroundNotFoundError / BackgroundLockedError', () => {
  it('το «δεν βρέθηκε» παράγει το μήνυμα σε ΕΝΑ σημείο', () => {
    // Αυτός ο constructor είναι η μοναδική πηγή του κειμένου — γνήσιου και
    // μεταμφιεσμένου. Χειρόγραφο string οπουδήποτε αλλού σπάει την ταυτότητα.
    const err = new BackgroundNotFoundError(BG_ID);

    expect(err.message).toBe(`Background not found: ${BG_ID}`);
    expect(err.code).toBe('NOT_FOUND');
    expect(err.backgroundId).toBe(BG_ID);
  });

  it('το «κλειδωμένο» είναι ΞΕΧΩΡΙΣΤΟΣ τύπος από το cross-tenant', () => {
    const locked = new BackgroundLockedError(BG_ID);

    expect(locked.code).toBe('LOCKED');
    expect(locked).not.toBeInstanceOf(CrossTenantAccessError);
    expect(locked).not.toBeInstanceOf(BackgroundNotFoundError);
  });
});
