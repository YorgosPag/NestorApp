/**
 * Άγκυρες — Η ΠΥΛΗ ΓΡΑΦΗΣ των ΔΙΑΘΕΣΕΩΝ (ADR-777 Α20).
 *
 * Ερώτημα: *«μπορεί κάποιος να γράψει το `commercialStatus` απευθείας, τώρα που
 * είναι ΠΑΡΑΓΟΜΕΝΟ;»*
 *
 * 🔴 **Γιατί υπάρχει αυτό το αρχείο.** Το `property-mutation-gateway` δηλωνόταν
 * *«η ΜΟΝΗ πύλη γραφής commercialStatus»* — και η μέτρηση (2026-08-09) βρήκε ότι
 * ο ισχυρισμός ήταν **αληθής αλλά αφύλακτος**: το module **απουσιάζει** από το
 * `.ssot-registry.json`, και δίπλα του το `property-field-locking.ts:43` ζητά
 * *«keep both in sync»* — δηλαδή **χειρόγραφος καθρέφτης**, το σχήμα που στο
 * CHECK 3.34 είχε αποκλίνει κατά **63**. *Μια σύμβαση σε σχόλιο δεν είναι πύλη.*
 *
 * ⚠️ Ελέγχεται η **συμπεριφορά χρόνου εκτέλεσης**. Η compile-time άμυνα
 * (`PropertyOffersUpdate` με `?: never`) **δεν** ελέγχεται εδώ — δεν τρέχουμε
 * `tsc` (N.17), και ένα test που «περνά» δεν αποδεικνύει τύπο. Την αποδεικνύει
 * το pre-commit hook του Giorgio.
 */

jest.mock('@/services/properties.service', () => ({
  createProperty: jest.fn(),
  deleteProperty: jest.fn(),
  updateProperty: jest.fn(),
  updatePropertyCoverage: jest.fn(),
  updateMultiplePropertiesOwner: jest.fn(),
}));

jest.mock('@/services/filesystem/file-mutation-gateway', () => ({
  propagateEntityLabelRenameWithPolicy: jest.fn(),
}));

jest.mock('@/lib/safe-fire-and-forget', () => ({
  safeFireAndForget: jest.fn(),
}));

jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({
    info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
  }),
}));

import {
  ConflictingLiveOffersError,
  DerivedFieldWriteError,
  updatePropertyWithPolicy,
} from '../property-mutation-gateway';
import { updateProperty as updatePropertyRecord } from '@/services/properties.service';
import type { PropertyOffer } from '@/types/property-offers';

const mockedUpdateProperty = updatePropertyRecord as jest.MockedFunction<
  typeof updatePropertyRecord
>;

const PROPERTY_ID = 'prop_a0000001-7777-4aaa-8aaa-000000000001';
const CURRENT = { name: 'Διαμέρισμα Α1' };

function sellOffer(lifecycle: PropertyOffer['lifecycle'] = 'active'): PropertyOffer {
  return { id: 'offr_sell_1', kind: 'sell', lifecycle, askingPrice: 250000 };
}

function leaseOffer(lifecycle: PropertyOffer['lifecycle'] = 'active'): PropertyOffer {
  return { id: 'offr_lease_1', kind: 'leaseOut', lifecycle, rentPrice: 700 };
}

/** Το payload που ΠΡΑΓΜΑΤΙΚΑ έφτασε στη βάση. */
function persistedPayload(): Record<string, unknown> {
  return mockedUpdateProperty.mock.calls[0]?.[1] as Record<string, unknown>;
}

beforeEach(() => {
  mockedUpdateProperty.mockReset();
  mockedUpdateProperty.mockResolvedValue({ success: true });
});

// =============================================================================
// Κ1 — Η ΠΑΡΑΓΩΓΗ ΣΥΜΒΑΙΝΕΙ, ΚΑΙ ΦΤΑΝΕΙ ΣΤΗ ΒΑΣΗ
// =============================================================================

describe('Κ1 — το gateway ΠΑΡΑΓΕΙ τα δύο πεδία', () => {
  test('offers → γράφεται commercialStatus ΚΑΙ offerKinds', async () => {
    await updatePropertyWithPolicy({
      propertyId: PROPERTY_ID,
      currentProperty: CURRENT,
      updates: { offers: [sellOffer(), leaseOffer()] },
    });

    const payload = persistedPayload();
    expect(payload.commercialStatus).toBe('for-sale-and-rent');
    expect(payload.offerKinds).toEqual(['leaseOut', 'sell']);
  });

  test('🔑 η αντιπαροχή φτάνει στο offerKinds, ΟΧΙ στο commercialStatus', async () => {
    await updatePropertyWithPolicy({
      propertyId: PROPERTY_ID,
      currentProperty: CURRENT,
      updates: {
        offers: [{ id: 'offr_x', kind: 'exchange', lifecycle: 'active', percentage: 35 }],
      },
    });

    const payload = persistedPayload();
    // Το παλιό λεξιλόγιο δεν έχει τη λέξη — και λέει την αλήθεια γι' αυτό.
    expect(payload.commercialStatus).toBe('unavailable');
    // Ο νέος άξονας την κουβαλά ακέραιη.
    expect(payload.offerKinds).toEqual(['exchange']);
  });

  test('offers: null → φεύγει από την αγορά, με κενό offerKinds', async () => {
    await updatePropertyWithPolicy({
      propertyId: PROPERTY_ID,
      currentProperty: CURRENT,
      updates: { offers: null },
    });

    const payload = persistedPayload();
    expect(payload.commercialStatus).toBe('unavailable');
    expect(payload.offerKinds).toEqual([]);
  });
});

// =============================================================================
// Κ2 — ΤΟ ΠΑΡΑΓΟΜΕΝΟ ΔΕΝ ΓΡΑΦΕΤΑΙ ΑΠΕΥΘΕΙΑΣ
// =============================================================================

describe('Κ2 — DerivedFieldWriteError', () => {
  test('🔴 offers + commercialStatus μαζί ⇒ ΠΕΤΑΕΙ (δύο αλήθειες που διαφωνούν)', async () => {
    await expect(
      updatePropertyWithPolicy({
        propertyId: PROPERTY_ID,
        currentProperty: CURRENT,
        updates: { offers: [sellOffer()], commercialStatus: 'rented' },
      }),
    ).rejects.toThrow(DerivedFieldWriteError);

    expect(mockedUpdateProperty).not.toHaveBeenCalled();
  });

  test('🔴 offerKinds ΠΟΤΕ δεν γράφεται — ούτε καν χωρίς offers', async () => {
    await expect(
      updatePropertyWithPolicy({
        propertyId: PROPERTY_ID,
        currentProperty: CURRENT,
        updates: { offerKinds: ['sell'] },
      }),
    ).rejects.toThrow(DerivedFieldWriteError);
  });

  test('το μήνυμα ΟΝΟΜΑΖΕΙ τη θεραπεία, δεν λέει σκέτο «όχι»', async () => {
    await expect(
      updatePropertyWithPolicy({
        propertyId: PROPERTY_ID,
        currentProperty: CURRENT,
        updates: { offerKinds: [] },
      }),
    ).rejects.toThrow(/Write `offers` instead/);
  });
});

// =============================================================================
// Κ3 — 🔑 Ο ΠΑΛΙΟΣ ΔΡΟΜΟΣ ΔΕΝ ΕΣΠΑΣΕ (η απόδειξη μηδενικής παλινδρόμησης)
// =============================================================================

describe('Κ3 — σταδιακό: χωρίς offers, τίποτα δεν αλλάζει', () => {
  test('σκέτο commercialStatus (χωρίς offers) γράφεται όπως πάντα', async () => {
    await updatePropertyWithPolicy({
      propertyId: PROPERTY_ID,
      currentProperty: CURRENT,
      updates: { commercialStatus: 'for-sale' },
    });

    expect(persistedPayload().commercialStatus).toBe('for-sale');
  });

  test('🔑 η ελληνική κανονικοποίηση επιβιώνει (ADR-287)', async () => {
    await updatePropertyWithPolicy({
      propertyId: PROPERTY_ID,
      currentProperty: CURRENT,
      updates: { commercialStatus: 'πωλημένο' },
    });

    expect(persistedPayload().commercialStatus).toBe('sold');
  });

  test('payload χωρίς καμία σχέση με διαθέσεις ⇒ κανένα παραγόμενο πεδίο', async () => {
    await updatePropertyWithPolicy({
      propertyId: PROPERTY_ID,
      currentProperty: CURRENT,
      updates: { name: 'Νέο όνομα' },
    });

    const payload = persistedPayload();
    expect(payload).not.toHaveProperty('offerKinds');
    expect(payload).not.toHaveProperty('commercialStatus');
  });
});

// =============================================================================
// Κ4 — INVARIANT: δύο ζωντανές ίδιου είδους = δύο τιμές για ένα πράγμα
// =============================================================================

describe('Κ4 — ConflictingLiveOffersError', () => {
  test('δύο ζωντανές πωλήσεις ⇒ ΠΕΤΑΕΙ πριν τη γραφή', async () => {
    await expect(
      updatePropertyWithPolicy({
        propertyId: PROPERTY_ID,
        currentProperty: CURRENT,
        updates: {
          offers: [
            { id: 'offr_a', kind: 'sell', lifecycle: 'active', askingPrice: 250000 },
            { id: 'offr_b', kind: 'sell', lifecycle: 'reserved', askingPrice: 260000 },
          ],
        },
      }),
    ).rejects.toThrow(ConflictingLiveOffersError);

    expect(mockedUpdateProperty).not.toHaveBeenCalled();
  });

  test('μία ζωντανή + μία αποσυρμένη ίδιου είδους = νόμιμο (ιστορικό)', async () => {
    await updatePropertyWithPolicy({
      propertyId: PROPERTY_ID,
      currentProperty: CURRENT,
      updates: {
        offers: [
          sellOffer('active'),
          { id: 'offr_old', kind: 'sell', lifecycle: 'withdrawn', askingPrice: 300000 },
        ],
      },
    });

    expect(persistedPayload().commercialStatus).toBe('for-sale');
  });
});

// =============================================================================
// Κ5 — ΣΧΗΜΑ ΕΙΣΟΔΟΥ
// =============================================================================

describe('Κ5 — offers λάθος σχήματος', () => {
  test('μη-πίνακας ⇒ ΠΕΤΑΕΙ με ονομασμένο λόγο', async () => {
    await expect(
      updatePropertyWithPolicy({
        propertyId: PROPERTY_ID,
        currentProperty: CURRENT,
        updates: { offers: 'for-sale' },
      }),
    ).rejects.toThrow(/must be an array of PropertyOffer/);
  });
});
