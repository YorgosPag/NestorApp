/**
 * **Ο ΚΡΙΚΟΣ ΠΟΥ ΕΛΕΙΠΕ** — άγκυρες της διαδρομής *διεύθυνση → θέση → επαναπροβολή*.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΙ ΦΥΛΑΝΕ, ΚΑΙ ΓΙΑΤΙ ΔΕΝ ΤΟ ΦΥΛΑΓΕ ΤΙΠΟΤΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Μετρημένο 2026-08-25, πριν από αυτό το αρχείο:
 *
 *   - `grep -rn "republish" src/app/api/projects/` → **0 ευρήματα**. Το
 *     `republishListingsForProject` γράφτηκε για να αποτρέψει ακριβώς αυτό το
 *     ελάττωμα και **δεν το καλούσε κανείς** (ADR-749 §5: αδρανής φρουρός).
 *   - `grep -c "addresses"` στη μοναδική άγκυρα του `handleUpdateProject` → **0**.
 *     Δηλαδή η διαδρομή που κουβαλά **όλη τη θέση** δεν ασκούνταν από καμία άγκυρα.
 *
 * ⚠️ Η **Χ3** είναι ο παρονομαστής: αποδεικνύει ότι η επαναπροβολή **ΔΕΝ** τρέχει σε
 * άσχετη αποθήκευση. Χωρίς αυτήν, ένα «τρέχει πάντα» θα ήταν εξίσου πράσινο — και θα
 * κόστιζε N αναγνώσεις+γραφές σε **κάθε** μετονομασία έργου.
 */

jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
}));

var storedProject: Record<string, unknown> | null = null;
var written: Record<string, unknown> | null = null;
var sequence: string[] = [];
var republishedFor: string[] = [];
var geocoderCalls: Array<Record<string, unknown>> = [];
var geocoderVerdict: unknown = null;

jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminFirestore: () => ({
    collection: () => ({
      doc: () => ({
        get: async () => ({
          exists: storedProject !== null,
          id: 'prj_42',
          data: () => storedProject ?? undefined,
        }),
      }),
    }),
  }),
}));

jest.mock('firebase-admin/firestore', () => ({ FieldValue: { serverTimestamp: () => 'ts' } }));
jest.mock('@/lib/auth', () => ({ logAuditEvent: async () => undefined }));

jest.mock('@/lib/firestore/version-check', () => ({
  withVersionCheck: async ({ updates }: { updates: Record<string, unknown> }) => {
    sequence.push('write');
    written = updates;
    return { newVersion: 2 };
  },
  ConflictError: class ConflictError extends Error {},
}));

jest.mock('@/lib/firestore/soft-delete-engine', () => ({ softDelete: async () => undefined }));
jest.mock('@/lib/firestore/deletion-guard', () => ({
  checkDeletionDependencies: async () => ({ allowed: true, dependencies: [] }),
}));
jest.mock('@/lib/firestore/entity-linking.service', () => ({ linkEntity: async () => undefined }));
jest.mock('@/lib/cache/enterprise-api-cache', () => ({
  EnterpriseAPICache: { getInstance: () => ({ delete: () => undefined }) },
}));
jest.mock('@/services/entity-audit.service', () => ({
  EntityAuditService: { diffFieldsWithResolution: async () => [], recordChange: async () => undefined },
  resolveUserDisplayName: async () => 'Χρήστης',
}));

/** Η **μηχανή**, ενθυλακωμένη: καταγράφει τι ρωτήθηκε και απαντά ό,τι ορίσει το test. */
jest.mock('@/app/api/geocoding/geocoding-engine', () => ({
  geocodeWithVerdict: async (query: Record<string, unknown>) => {
    geocoderCalls.push(query);
    return geocoderVerdict;
  },
}));

/** Ο **προβολέας**, ενθυλακωμένος: καταγράφει ποιο έργο ξαναπροβλήθηκε και **πότε**. */
jest.mock('@/services/listings/publish-public-listing', () => ({
  republishListingsForProject: async (_db: unknown, projectId: string) => {
    sequence.push('republish');
    republishedFor.push(projectId);
    return { published: 6, withdrawn: 0, failed: 0 };
  },
}));

import type { NextRequest } from 'next/server';
import type { AuthContext } from '@/lib/auth/types';
import { handleUpdateProject } from '../project-mutations.service';

const HIT = {
  kind: 'hit',
  result: {
    lat: 40.6401,
    lng: 22.9444,
    accuracy: 'exact',
    confidence: 0.93,
    source: { provider: 'nominatim', variantUsed: 2, osmType: 'house' },
  },
};

const caller = (): AuthContext =>
  ({
    uid: 'u_1',
    email: 'a@alpha.gr',
    companyId: 'co_alpha',
    globalRole: 'company_admin',
    mfaEnrolled: true,
    isAuthenticated: true,
  }) as AuthContext;

const body = (payload: unknown) => ({ json: async () => payload }) as unknown as NextRequest;

/**
 * ⚠️ Τα `postalCode`/`country` είναι **υποχρεωτικά** στο `projectAddressSchema` — και το
 * ότι η πρώτη γραφή αυτού του fixture τα ξέχασε και **κοκκίνισε** είναι η απόδειξη ότι η
 * άγκυρα περνά από το **πραγματικό** σχήμα, όχι από παράκαμψη.
 */
const ADDRESS = (over: Record<string, unknown> = {}) => ({
  id: 'addr_1',
  street: 'Εγνατίας',
  number: '147',
  city: 'Θεσσαλονίκη',
  postalCode: '54635',
  country: 'Ελλάδα',
  type: 'site',
  isPrimary: true,
  ...over,
});

beforeEach(() => {
  storedProject = { companyId: 'co_alpha', name: 'Έργο Α' };
  written = null;
  sequence = [];
  republishedFor = [];
  geocoderCalls = [];
  geocoderVerdict = HIT;
});

describe('Χ — διεύθυνση → θέση → επαναπροβολή', () => {
  it('Χ1 — νέα διεύθυνση ⇒ αποθηκεύεται ΣΗΜΕΙΟ **ΚΑΙ** ΑΚΡΙΒΕΙΑ', async () => {
    await handleUpdateProject(body({ addresses: [ADDRESS()] }), caller(), 'prj_42');

    const saved = (written?.addresses as Array<Record<string, unknown>>)[0]!;
    expect(saved.coordinates).toEqual({ lat: 40.6401, lng: 22.9444 });
    // 🔴 Το πεδίο που μέχρι σήμερα είχε **12 αναγνώστες και 0 γραφείς**.
    expect(saved.geocodingMetadata).toEqual({
      confidence: 0.93,
      accuracy: 'exact',
      variantUsed: 2,
      osmType: 'house',
    });
    expect(saved.source).toBe('geocoded');
  });

  it('Χ2 — μετά τη γραφή, οι αγγελίες του έργου ξαναπροβάλλονται', async () => {
    await handleUpdateProject(body({ addresses: [ADDRESS()] }), caller(), 'prj_42');
    expect(republishedFor).toEqual(['prj_42']);
  });

  it('Χ3 — ΠΑΡΟΝΟΜΑΣΤΗΣ: αποθήκευση ΧΩΡΙΣ διευθύνσεις ⇒ ΚΑΜΙΑ επαναπροβολή, ΚΑΜΙΑ κλήση', async () => {
    await handleUpdateProject(body({ name: 'Άλλο όνομα' }), caller(), 'prj_42');
    expect(republishedFor).toEqual([]);
    expect(geocoderCalls).toEqual([]);
  });

  it('Χ4 — Η ΣΕΙΡΑ ΕΙΝΑΙ ΣΥΜΒΟΛΑΙΟ: πρώτα η γραφή, μετά η επαναπροβολή', async () => {
    await handleUpdateProject(body({ addresses: [ADDRESS()] }), caller(), 'prj_42');
    // Ανάποδα, ο προβολέας θα διάβαζε την **παλιά** διεύθυνση από τη βάση.
    expect(sequence).toEqual(['write', 'republish']);
  });

  it('Χ5 — ΤΙΠΟΤΑ δεν άλλαξε στη διεύθυνση ⇒ ΚΑΜΙΑ κλήση στη μηχανή (πολιτική Nominatim)', async () => {
    const existing = ADDRESS({
      coordinates: { lat: 40.6401, lng: 22.9444 },
      geocodingMetadata: { confidence: 0.93, accuracy: 'exact', variantUsed: 2 },
    });
    storedProject = { companyId: 'co_alpha', name: 'Έργο Α', addresses: [existing] };

    await handleUpdateProject(body({ addresses: [{ ...existing, label: 'Είσοδος' }] }), caller(), 'prj_42');

    expect(geocoderCalls).toEqual([]);
    const saved = (written?.addresses as Array<Record<string, unknown>>)[0]!;
    // Τα μεταδεδομένα **επιβιώνουν** — αλλιώς κάθε άσχετη αποθήκευση θα ξαναβάφτιζε
    // τη γεωκωδικοποιημένη διεύθυνση σε «ανθρώπινη πινέζα».
    expect(saved.geocodingMetadata).toEqual({ confidence: 0.93, accuracy: 'exact', variantUsed: 2 });
  });

  it('Χ6 — ο γεωκωδικοποιητής ΔΕΝ ΑΠΑΝΤΗΣΕ ⇒ η αποθηκευμένη θέση ΕΠΙΒΙΩΝΕΙ', async () => {
    storedProject = {
      companyId: 'co_alpha',
      addresses: [ADDRESS({ coordinates: { lat: 40.60, lng: 22.90 } })],
    };
    geocoderVerdict = { kind: 'unavailable' };

    await handleUpdateProject(body({ addresses: [ADDRESS({ street: 'Τσιμισκή' })] }), caller(), 'prj_42');

    const saved = (written?.addresses as Array<Record<string, unknown>>)[0]!;
    // 🔴 Μια διακοπή του Nominatim ΔΕΝ επιτρέπεται να σβήσει σωστές θέσεις.
    expect(saved.coordinates).toEqual({ lat: 40.60, lng: 22.90 });
    // Η επαναπροβολή τρέχει ούτως ή άλλως: η αποθήκευση **έγινε**.
    expect(republishedFor).toEqual(['prj_42']);
  });

  it('Χ7 — «δεν υπάρχει» ⇒ η θέση ΣΒΗΝΕΤΑΙ (η παλιά θα έδειχνε άλλο κτίριο)', async () => {
    storedProject = {
      companyId: 'co_alpha',
      addresses: [ADDRESS({ coordinates: { lat: 40.60, lng: 22.90 } })],
    };
    geocoderVerdict = { kind: 'absent' };

    await handleUpdateProject(body({ addresses: [ADDRESS({ street: 'Ανύπαρκτη' })] }), caller(), 'prj_42');

    const saved = (written?.addresses as Array<Record<string, unknown>>)[0]!;
    expect('coordinates' in saved).toBe(false);
    expect('geocodingMetadata' in saved).toBe(false);
  });

  it('Χ8 — η επαναπροβολή ΔΕΝ πετά ποτέ: η γραφή του χρήστη έγινε ήδη', async () => {
    const listings = jest.requireMock('@/services/listings/publish-public-listing') as {
      republishListingsForProject: unknown;
    };
    const original = listings.republishListingsForProject;
    listings.republishListingsForProject = async () => {
      throw new Error('Firestore down');
    };

    await expect(
      handleUpdateProject(body({ addresses: [ADDRESS()] }), caller(), 'prj_42'),
    ).resolves.toBeDefined();

    listings.republishListingsForProject = original;
  });
});
