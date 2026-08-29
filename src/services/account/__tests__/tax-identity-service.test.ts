/**
 * @fileoverview **ΟΙ ΑΓΚΥΡΕΣ ΤΟΥ ΑΦΜ** (ADR-827 §9.20 · Φ1).
 *
 * Ομάδες:
 * - **Ψ** — ο **ελεγκτής ψηφίου**: ό,τι δεν πιάνεται από μορφή.
 * - **Γ** — ο **γραφέας**: τι γράφεται, τι **δεν** γράφεται, τι σβήνεται.
 * - **Μ** — η **συγχώνευση**: το προφίλ δεν ισοπεδώνεται.
 *
 * ⚠️ Οι αριθμοί ΑΦΜ εδώ είναι **συνθετικοί**, παραγμένοι ώστε να ικανοποιούν (ή να
 * παραβιάζουν) τον mod-11 — δεν αντιστοιχούν σε πρόσωπο.
 */

import { FakeFirestore } from '@/services/places/__tests__/fake-firestore';
import { COLLECTIONS } from '@/config/firestore-collections';
import { isValidGreekVat } from '@/lib/validation/vat-validation';
import {
  judgeVatNumber,
  setOwnVatNumber,
  TAX_IDENTITY_REJECTIONS,
} from '../tax-identity.service';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- ο πλαστός μιμείται το Admin SDK· η μετάφραση γίνεται ΜΙΑ φορά, εδώ.
const asAdmin = (fake: FakeFirestore) => fake as unknown as Parameters<typeof setOwnVatNumber>[0];

const UID = 'user_abc';

/**
 * **Ο παρονομαστής των fixtures**: βρίσκει έναν αριθμό που ο ΚΑΝΟΝΙΚΟΣ επικυρωτής
 * δέχεται, αντί να τον καρφώσουμε.
 *
 * 🔴 Καρφωμένος «έγκυρος» αριθμός που στην πραγματικότητα **δεν** περνά τον mod-11 θα
 * έκανε κάθε θετική άγκυρα να ελέγχει τον **λάθος κλάδο** — και θα ήταν αόρατο.
 */
function firstValidVat(): string {
  for (let n = 100_000_000; n < 100_001_000; n++) {
    const candidate = String(n);
    if (isValidGreekVat(candidate)) return candidate;
  }
  throw new Error('κανένα έγκυρο ΑΦΜ στο εύρος αναζήτησης — ο επικυρωτής άλλαξε');
}

const VALID = firstValidVat();

/** Ο ίδιος αριθμός με **δύο ψηφία αντεστραμμένα** — μορφή σωστή, ψηφίο ελέγχου λάθος. */
function transposed(vat: string): string {
  const chars = [...vat];
  [chars[0], chars[1]] = [chars[1], chars[0]];
  return chars.join('');
}

function seededProfile(): FakeFirestore {
  const fake = new FakeFirestore();
  fake.seed(COLLECTIONS.USERS, UID, {
    uid: UID,
    email: 'a@b.gr',
    displayName: 'Δοκιμή Δοκιμίου',
    companyId: null,
    globalRole: null,
  });
  return fake;
}

const readProfile = (fake: FakeFirestore): Record<string, unknown> =>
  fake.all<Record<string, unknown>>(COLLECTIONS.USERS)[0];

// ============================================================================
describe('Ψ — ο ελεγκτής ψηφίου', () => {
  it('Ψ0 — ΠΑΡΟΝΟΜΑΣΤΗΣ: το κλειστό σύνολο έχει ακριβώς δύο λόγους', () => {
    expect([...TAX_IDENTITY_REJECTIONS]).toEqual(['vat-format-invalid', 'vat-check-digit-invalid']);
  });

  it('Ψ1 — έγκυρο ΑΦΜ γίνεται δεκτό και επιστρέφεται κανονικοποιημένο', () => {
    expect(judgeVatNumber(VALID)).toEqual({ ok: true, value: VALID });
  });

  it('Ψ2 — τα κενά αφαιρούνται: ο άνθρωπος που γράφει με διαστήματα εννοεί τον ΙΔΙΟ αριθμό', () => {
    const spaced = `${VALID.slice(0, 3)} ${VALID.slice(3, 6)} ${VALID.slice(6)}`;
    expect(judgeVatNumber(spaced)).toEqual({ ok: true, value: VALID });
  });

  it.each([
    ['οκτώ ψηφία', VALID.slice(0, 8)],
    ['δέκα ψηφία', `${VALID}0`],
    ['γράμματα', 'ΑΒΓΔΕΖΗΘΙ'],
    ['κενό μετά το trim του καλούντος', '   '],
  ])('Ψ3 — «%s» ⇒ vat-format-invalid, ΠΟΤΕ ψηφίο ελέγχου', (_label, input) => {
    expect(judgeVatNumber(input)).toEqual({ ok: false, reason: 'vat-format-invalid' });
  });

  it('🔴 Ψ4 — Η ΑΓΚΥΡΑ ΠΟΥ ΔΙΚΑΙΟΛΟΓΕΙ ΤΟ ΑΡΧΕΙΟ: δύο ψηφία αντεστραμμένα', () => {
    const typo = transposed(VALID);

    // Το τυπογραφικό λάθος περνά **κάθε** έλεγχο μορφής...
    expect(/^\d{9}$/.test(typo)).toBe(true);
    expect(typo).not.toBe(VALID);

    // ...και κόβεται **μόνο** από τον mod-11. Χωρίς αυτόν, θα κατέληγε σε σύμβαση.
    expect(judgeVatNumber(typo)).toEqual({ ok: false, reason: 'vat-check-digit-invalid' });
  });

  it('Ψ5 — το 000000000 απορρίπτεται αν και είναι εννιά ψηφία', () => {
    expect(judgeVatNumber('000000000').ok).toBe(false);
  });
});

// ============================================================================
describe('Γ — ο γραφέας', () => {
  it('Γ1 — έγκυρο ΑΦΜ γράφεται κανονικοποιημένο', async () => {
    const fake = seededProfile();
    const result = await setOwnVatNumber(asAdmin(fake), UID, ` ${VALID} `);

    expect(result).toEqual({ kind: 'saved', vatNumber: VALID });
    expect(readProfile(fake).vatNumber).toBe(VALID);
  });

  it('🔴 Γ2 — ΑΚΥΡΟ ΑΦΜ ΔΕΝ ΑΓΓΙΖΕΙ ΤΗ ΒΑΣΗ (μηδέν εγγραφές)', async () => {
    const fake = seededProfile();
    const before = fake.writes;

    const result = await setOwnVatNumber(asAdmin(fake), UID, transposed(VALID));

    expect(result).toEqual({ kind: 'rejected', reason: 'vat-check-digit-invalid' });
    // Η κρίση προηγείται της γραφής — αλλιώς το άκυρο θα ζούσε μια στιγμή στη βάση.
    expect(fake.writes).toBe(before);
    expect(readProfile(fake).vatNumber).toBeUndefined();
  });

  it('Γ3 — κενό = ΑΝΑΚΛΗΣΗ, γράφει null (δικαίωμα του ανθρώπου, GDPR 5§1ε)', async () => {
    const fake = seededProfile();
    await setOwnVatNumber(asAdmin(fake), UID, VALID);

    const result = await setOwnVatNumber(asAdmin(fake), UID, '   ');

    expect(result).toEqual({ kind: 'cleared' });
    expect(readProfile(fake).vatNumber).toBeNull();
  });

  it('Γ4 — ιδεμπόταντο: δεύτερη ίδια γραφή δίνει το ίδιο αποτέλεσμα', async () => {
    const fake = seededProfile();
    const first = await setOwnVatNumber(asAdmin(fake), UID, VALID);
    const second = await setOwnVatNumber(asAdmin(fake), UID, VALID);

    expect(second).toEqual(first);
    expect(readProfile(fake).vatNumber).toBe(VALID);
  });

  it('🔴 Γ5 — Η ΒΛΑΒΗ ΔΕΝ ΕΙΝΑΙ ΑΡΝΗΣΗ (N.12): «δεν έγραψα» ≠ «λάθος ΑΦΜ»', async () => {
    // Η βάση σπάει στη γραφή· ο καλών ΔΕΝ επιτρέπεται να μάθει «άκυρο».
    const broken = {
      collection: () => ({ doc: () => ({ set: () => Promise.reject(new Error('boom')) }) }),
    } as unknown as Parameters<typeof setOwnVatNumber>[0];

    const result = await setOwnVatNumber(broken, UID, VALID);

    expect(result).toEqual({ kind: 'failed' });
  });
});

// ============================================================================
describe('Μ — η συγχώνευση', () => {
  it('🔴 Μ1 — ΤΟ ΠΡΟΦΙΛ ΔΕΝ ΙΣΟΠΕΔΩΝΕΤΑΙ: όνομα και εταιρεία επιβιώνουν', async () => {
    const fake = seededProfile();
    await setOwnVatNumber(asAdmin(fake), UID, VALID);

    const profile = readProfile(fake);
    // Χωρίς `{ merge: true }` αυτά θα είχαν εξαφανιστεί — και ο άνθρωπος θα έχανε
    // ταυτότητα επειδή δήλωσε ΑΦΜ.
    expect(profile.displayName).toBe('Δοκιμή Δοκιμίου');
    expect(profile.email).toBe('a@b.gr');
    expect(profile.uid).toBe(UID);
  });

  it('Μ2 — και στην ανάκληση: το κενό σβήνει ΜΟΝΟ το ΑΦΜ', async () => {
    const fake = seededProfile();
    await setOwnVatNumber(asAdmin(fake), UID, VALID);
    await setOwnVatNumber(asAdmin(fake), UID, '');

    const profile = readProfile(fake);
    expect(profile.vatNumber).toBeNull();
    expect(profile.displayName).toBe('Δοκιμή Δοκιμίου');
  });

  it('Μ3 — κάθε γραφή αφήνει χρονοσήμανση ενημέρωσης', async () => {
    const fake = seededProfile();
    await setOwnVatNumber(asAdmin(fake), UID, VALID);
    expect(readProfile(fake).updatedAt).toBeInstanceOf(Date);
  });
});
