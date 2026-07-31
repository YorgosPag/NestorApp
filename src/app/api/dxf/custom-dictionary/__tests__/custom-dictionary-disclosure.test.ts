/**
 * ADR-742 Φάση Β — **η μεταμφίεση πρέπει να είναι πανομοιότυπη** (λεξικό ορθογραφίας).
 *
 * Αδελφός του `text-templates-disclosure.test.ts`. Δύο αρχεία και όχι ένα
 * παραμετροποιημένο, **επίτηδες**: τα δύο `_helpers` είναι ανεξάρτητα modules με
 * δικό τους σύνολο σφαλμάτων (το λεξικό έχει επιπλέον `Duplicate` → 409). Ένα
 * κοινό test θα έκρυβε ακριβώς την απόκλιση που πρέπει να πιάνει.
 *
 * @see ADR-742 §3.3 · §3.4
 */

jest.mock('firebase-admin/firestore', () => ({ Timestamp: class {} }));
jest.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      body,
    }),
  },
}));

import { mapServiceError } from '../_helpers';
import {
  CustomDictionaryCrossTenantError,
  CustomDictionaryDuplicateError,
  CustomDictionaryNotFoundError,
} from '@/subapps/dxf-viewer/text-engine/spell/custom-dictionary.types';

const ENTRY_ID = 'dict_01K9ZQ7X8N4M2P';
const CALLER_COMPANY = 'comp_kalonta';
const OWNER_COMPANY = 'comp_allou';

const NORMAL_USER = { globalRole: 'internal_user' } as const;
const SUPER_ADMIN = { globalRole: 'super_admin' } as const;

const crossTenant = () =>
  new CustomDictionaryCrossTenantError(ENTRY_ID, CALLER_COMPANY, OWNER_COMPANY);

describe('ADR-742 §3.4 — μεταμφιεσμένο 404 για το λεξικό ορθογραφίας', () => {
  it('🔴 είναι ΙΣΟ, όχι απλώς παρόμοιο, με το γνήσιο «δεν βρέθηκε»', () => {
    const foreign = mapServiceError(crossTenant(), NORMAL_USER);
    const missing = mapServiceError(new CustomDictionaryNotFoundError(ENTRY_ID), NORMAL_USER);

    expect(foreign).toEqual(missing);
  });

  it('δεν μαρτυρά τίποτα για την πραγματική εταιρεία-ιδιοκτήτη', () => {
    const { status, body } = mapServiceError(crossTenant(), NORMAL_USER);

    expect(status).toBe(404);
    expect(body.code).toBe('CUSTOM_DICTIONARY_NOT_FOUND');
    expect(body.error).not.toContain(OWNER_COMPANY);
    expect(body.error).not.toContain(CALLER_COMPANY);
    expect(body.error.toLowerCase()).not.toContain('forbidden');
  });

  it('το κείμενο είναι αυτό του ίδιου constructor — όχι χειρόγραφο string', () => {
    const { body } = mapServiceError(crossTenant(), NORMAL_USER);

    expect(body.error).toBe(new CustomDictionaryNotFoundError(ENTRY_ID).message);
  });
});

describe('ADR-742 §3.3 — η εξαίρεση του bypass ρόλου', () => {
  it('ο super-admin παίρνει ειλικρινές 403 με τη διάγνωση', () => {
    const { status, body } = mapServiceError(crossTenant(), SUPER_ADMIN);

    expect(status).toBe(403);
    expect(body.code).toBe('CUSTOM_DICTIONARY_CROSS_TENANT');
    expect(body.error).toContain(OWNER_COMPANY);
    expect(body.error).toContain(CALLER_COMPANY);
  });

  it('οι δύο ρόλοι παίρνουν ΔΙΑΦΟΡΕΤΙΚΗ απάντηση για το ίδιο σφάλμα', () => {
    expect(mapServiceError(crossTenant(), SUPER_ADMIN)).not.toEqual(
      mapServiceError(crossTenant(), NORMAL_USER),
    );
  });
});

describe('τα υπόλοιπα σφάλματα δεν άλλαξαν συμπεριφορά', () => {
  it('duplicate → 409, ίδιο και για τους δύο ρόλους (δεν μεταμφιέζεται)', () => {
    const err = new CustomDictionaryDuplicateError('οπτοπλινθοδομή', 'el', CALLER_COMPANY);

    const asUser = mapServiceError(err, NORMAL_USER);

    expect(asUser.status).toBe(409);
    expect(asUser.body.code).toBe('CUSTOM_DICTIONARY_DUPLICATE');
    // Ο όρος υπάρχει **στο δικό σου** λεξικό — δεν είναι μυστικό άλλου πελάτη.
    expect(mapServiceError(err, SUPER_ADMIN)).toEqual(asUser);
  });

  it('άγνωστο σφάλμα → 500 INTERNAL, χωρίς μεταμφίεση', () => {
    expect(mapServiceError(new Error('boom'), NORMAL_USER)).toEqual({
      status: 500,
      body: { success: false, error: 'boom', code: 'INTERNAL' },
    });
  });
});
