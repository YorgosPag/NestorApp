/**
 * `lib/auth/tenant-isolation` — το συμβόλαιο των έξι φυλάκων, καρφωμένο
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΓΙΑΤΙ ΥΠΑΡΧΕΙ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ
 * ─────────────────────────────────────────────────────────────────────────────
 * Μέχρι το ADR-742 οι έξι `require*InTenant` — ο έλεγχος πρόσβασης που στέκεται
 * μπροστά σε **41 αρχεία** — δεν είχαν **καμία** άμεση δοκιμή. Το ADR-742 τις
 * ξαναέγραψε ως δηλώσεις πάνω σε έναν κοινό φύλακα· ένα refactor κώδικα
 * ασφαλείας χωρίς δίχτυ είναι στοίχημα, όχι μηχανική.
 *
 * Το βάρος πέφτει σε **ό,τι βλέπει ο καλών**: status, code, ακριβές μήνυμα και
 * η εγγραφή audit. Αυτά είναι δημόσιο συμβόλαιο — τα routes τα χαρτογραφούν σε
 * HTTP και τα greps των logs βασίζονται στα `reason` strings. Αν αλλάξει
 * χαρακτήρας, σπάει κάτι μακριά από εδώ.
 *
 * @module lib/auth/__tests__/tenant-isolation
 * @see adrs/ADR-742 — η ερώτηση ενοποιήθηκε
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import type { AuthContext } from '../types';

// ─── Ελεγχόμενη «βάση» ───────────────────────────────────────────────────────
// Κλειδί: `${collection}/${id}`. Απόν κλειδί ⇒ έγγραφο που δεν υπάρχει.
const store = new Map<string, Record<string, unknown>>();

jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminFirestore: () => ({
    collection: (collection: string) => ({
      doc: (id: string) => ({
        get: async () => {
          const data = store.get(`${collection}/${id}`);
          return {
            exists: data !== undefined,
            id,
            data: () => data,
          };
        },
      }),
    }),
  }),
}));

const logAuditEventMock = jest.fn(async () => undefined);
jest.mock('../audit', () => ({
  logAuditEvent: (...args: unknown[]) => logAuditEventMock(...(args as [])),
}));

import {
  TenantIsolationError,
  filterSnapshotsByTenant,
  requireBuildingInTenant,
  requireOpportunityInTenant,
  requireParkingInTenant,
  requireProjectInTenant,
  requirePropertyInTenantScope,
  requireStorageInTenant,
  requireUnitInTenant,
} from '../tenant-isolation';

const OWNER = 'co-owner';
const INTRUDER = 'co-intruder';
const PATH = '/api/δοκιμή';

function ctxFor(companyId: string, globalRole = 'company_admin'): AuthContext {
  return { companyId, globalRole } as AuthContext;
}

const CALLER = ctxFor(OWNER);
const SUPER_ADMIN = ctxFor(INTRUDER, 'super_admin');

/**
 * Οι έξι φύλακες ως **δεδομένα**: ό,τι δηλώνει ο καθένας πρέπει να ισχύει
 * αυτούσιο. Έτσι κάθε νέα οντότητα προστίθεται εδώ με μία γραμμή — ακριβώς
 * όπως προστίθεται και στον κώδικα (δήλωση, όχι αντίγραφο).
 */
const GUARDS = [
  {
    label: 'project',
    collection: COLLECTIONS.PROJECTS,
    targetType: 'project',
    notFound: 'Project not found',
    call: (ctx: AuthContext, id: string) => requireProjectInTenant({ ctx, projectId: id, path: PATH }),
  },
  {
    label: 'building',
    collection: COLLECTIONS.BUILDINGS,
    targetType: 'building',
    notFound: 'Building not found',
    call: (ctx: AuthContext, id: string) => requireBuildingInTenant({ ctx, buildingId: id, path: PATH }),
  },
  {
    label: 'property',
    collection: COLLECTIONS.PROPERTIES,
    targetType: 'property',
    notFound: 'Property not found',
    call: (ctx: AuthContext, id: string) =>
      requirePropertyInTenantScope({ ctx, propertyId: id, path: PATH }),
  },
  {
    label: 'storage',
    collection: COLLECTIONS.STORAGE,
    targetType: 'storage',
    notFound: 'Storage not found',
    call: (ctx: AuthContext, id: string) => requireStorageInTenant({ ctx, storageId: id, path: PATH }),
  },
  {
    label: 'parking',
    collection: COLLECTIONS.PARKING_SPACES,
    targetType: 'parking',
    notFound: 'Parking space not found',
    call: (ctx: AuthContext, id: string) => requireParkingInTenant({ ctx, parkingId: id, path: PATH }),
  },
  {
    label: 'opportunity',
    collection: COLLECTIONS.OPPORTUNITIES,
    targetType: 'opportunity',
    notFound: 'Opportunity not found',
    call: (ctx: AuthContext, id: string) =>
      requireOpportunityInTenant({ ctx, opportunityId: id, path: PATH }),
  },
] as const;

const MISMATCH_REASON = 'Tenant isolation violation - companyId mismatch';

beforeEach(() => {
  store.clear();
  logAuditEventMock.mockClear();
});

describe.each(GUARDS)('require*InTenant — $label', (guard) => {
  const ID = `${guard.label}-1`;
  const key = `${guard.collection}/${ID}`;

  it('δικό μας έγγραφο ⇒ επιστρέφεται, χωρίς audit', async () => {
    store.set(key, { companyId: OWNER, name: 'Δικό μας' });

    await expect(guard.call(CALLER, ID)).resolves.toEqual({ companyId: OWNER, name: 'Δικό μας' });
    expect(logAuditEventMock).not.toHaveBeenCalled();
  });

  it('ανύπαρκτο ⇒ 404 NOT_FOUND με το μήνυμα της οντότητας + audit', async () => {
    await expect(guard.call(CALLER, ID)).rejects.toThrow(TenantIsolationError);

    try {
      await guard.call(CALLER, ID);
      throw new Error('έπρεπε να ρίξει');
    } catch (err) {
      const e = err as TenantIsolationError;
      expect(e.status).toBe(404);
      expect(e.code).toBe('NOT_FOUND');
      expect(e.message).toBe(guard.notFound);
    }
  });

  it('ξένο έγγραφο ⇒ 403 FORBIDDEN «Access denied»', async () => {
    store.set(key, { companyId: INTRUDER });

    try {
      await guard.call(CALLER, ID);
      throw new Error('έπρεπε να ρίξει');
    } catch (err) {
      const e = err as TenantIsolationError;
      expect(e.status).toBe(403);
      expect(e.code).toBe('FORBIDDEN');
      expect(e.message).toBe('Access denied');
    }
  });

  it('🔴 έγγραφο ΧΩΡΙΣ companyId ⇒ άρνηση στον κανονικό χρήστη (ADR-232)', async () => {
    store.set(key, { name: 'Φτιαγμένο από υπεργραφείο' });

    await expect(guard.call(CALLER, ID)).rejects.toMatchObject({ status: 403 });
  });

  it('bypass ρόλος ⇒ περνά σε ξένο έγγραφο, χωρίς audit άρνησης', async () => {
    store.set(key, { companyId: OWNER });

    await expect(guard.call(SUPER_ADMIN, ID)).resolves.toEqual({ companyId: OWNER });
    expect(logAuditEventMock).not.toHaveBeenCalled();
  });

  it('η άρνηση καταγράφεται με το ΣΩΣΤΟ targetType και reason', async () => {
    store.set(key, { companyId: INTRUDER });

    await expect(guard.call(CALLER, ID)).rejects.toThrow();

    expect(logAuditEventMock).toHaveBeenCalledTimes(1);
    const [ctx, action, targetId, targetType, options] = logAuditEventMock.mock.calls[0] as [
      AuthContext,
      string,
      string,
      string,
      { metadata: { path: string; reason: string } },
    ];
    expect(ctx).toBe(CALLER);
    expect(action).toBe('access_denied');
    expect(targetId).toBe(ID);
    expect(targetType).toBe(guard.targetType);
    expect(options.metadata).toEqual({ path: PATH, reason: MISMATCH_REASON });
  });

  it('η άρνηση «δεν υπάρχει» καταγράφεται με reason = το μήνυμα', async () => {
    await expect(guard.call(CALLER, ID)).rejects.toThrow();

    const [, , , , options] = logAuditEventMock.mock.calls[0] as [
      unknown,
      unknown,
      unknown,
      unknown,
      { metadata: { reason: string } },
    ];
    expect(options.metadata.reason).toBe(guard.notFound);
  });
});

describe('🔴 συμβόλαιο που ΔΕΝ επιτρέπεται να μετακινηθεί', () => {
  it('κάθε φύλακας διαβάζει τη ΔΙΚΗ του συλλογή — καμία διασταύρωση', async () => {
    // Ένα λάθος `collection:` σε μία δήλωση θα έδινε φύλακα που ελέγχει άλλη
    // οντότητα: θα περνούσε άδεια για έργο βλέποντας κτίριο. Οι δηλώσεις είναι
    // πλέον έξι σχεδόν ταυτόσημες γραμμές — ακριβώς εκεί που το μάτι γλιστράει.
    for (const guard of GUARDS) {
      store.clear();
      store.set(`${guard.collection}/x`, { companyId: OWNER, marker: guard.label });

      await expect(guard.call(CALLER, 'x')).resolves.toMatchObject({ marker: guard.label });
    }
  });

  it('ανύπαρκτο και ξένο δίνουν ΔΙΑΦΟΡΕΤΙΚΟ κωδικό — τεκμηριωμένη ανταλλαγή', async () => {
    // Αυτή η διαφορά μαρτυρά ύπαρξη id: «403» σημαίνει «υπάρχει αλλά δεν είναι
    // δικό σου». Είναι **συνειδητή** επιλογή του ADR-255 για ταυτοποιημένους
    // καλούντες σε εσωτερικές οθόνες, και το ADR-742 ΔΕΝ την άλλαξε εδώ.
    // Καρφώνεται ώστε να μην «διορθωθεί» παρεμπιπτόντως: η αλλαγή της είναι
    // αλλαγή δόγματος και θέλει ρητή απόφαση, όχι refactor.
    store.set(`${COLLECTIONS.PROJECTS}/ksenό`, { companyId: INTRUDER });

    const foreign = await requireProjectInTenant({ ctx: CALLER, projectId: 'ksenό', path: PATH }).catch(
      (e: TenantIsolationError) => e,
    );
    const absent = await requireProjectInTenant({ ctx: CALLER, projectId: 'apon', path: PATH }).catch(
      (e: TenantIsolationError) => e,
    );

    expect(foreign.status).toBe(403);
    expect(absent.status).toBe(404);
  });

  it('requireUnitInTenant (@deprecated) εξακολουθεί να δείχνει στα properties', async () => {
    store.set(`${COLLECTIONS.PROPERTIES}/u1`, { companyId: OWNER, name: 'Ακίνητο' });

    await expect(requireUnitInTenant({ ctx: CALLER, unitId: 'u1', path: PATH })).resolves.toMatchObject({
      name: 'Ακίνητο',
    });
  });
});

describe('filterSnapshotsByTenant — η ίδια ερώτηση, μαζικά', () => {
  function snap(id: string, data: Record<string, unknown> | undefined) {
    return { id, exists: data !== undefined, data: () => data } as unknown as Parameters<
      typeof filterSnapshotsByTenant
    >[0][number];
  }

  it('κρατά τα δικά μας, απορρίπτει τα ξένα και τα χωρίς tenant', async () => {
    const result = await filterSnapshotsByTenant(
      [
        snap('mine', { companyId: OWNER }),
        snap('theirs', { companyId: INTRUDER }),
        snap('orphan', {}),
        snap('gone', undefined),
      ],
      CALLER,
      PATH,
    );

    expect(result.allowed.map((s) => s.id)).toEqual(['mine']);
    expect(result.denied).toEqual(['theirs', 'orphan']);
  });

  it('🔴 συμφωνεί με τον φύλακα ενός εγγράφου — μία ερώτηση, δύο μονοπάτια', async () => {
    // Αν το μαζικό φίλτρο και ο φύλακας διαφωνούσαν, το ίδιο έγγραφο θα ήταν
    // ορατό μέσω `batch-resolve` και κρυφό μέσω `GET /[id]`.
    store.set(`${COLLECTIONS.PROPERTIES}/orphan`, {});

    const batch = await filterSnapshotsByTenant([snap('orphan', {})], CALLER, PATH);
    const single = await requirePropertyInTenantScope({
      ctx: CALLER,
      propertyId: 'orphan',
      path: PATH,
    }).then(
      () => 'allowed',
      () => 'denied',
    );

    expect(batch.allowed).toHaveLength(0);
    expect(single).toBe('denied');
  });

  it('bypass ρόλος περνά τα πάντα', async () => {
    const result = await filterSnapshotsByTenant(
      [snap('a', { companyId: OWNER }), snap('b', { companyId: 'co-3' })],
      SUPER_ADMIN,
      PATH,
    );

    expect(result.allowed).toHaveLength(2);
    expect(result.denied).toEqual([]);
  });

  it('οι αρνήσεις καταγράφονται σε ΕΝΑ audit event, όχι ένα ανά έγγραφο', async () => {
    await filterSnapshotsByTenant(
      [snap('x', { companyId: INTRUDER }), snap('y', { companyId: INTRUDER })],
      CALLER,
      PATH,
    );

    expect(logAuditEventMock).toHaveBeenCalledTimes(1);
    expect(logAuditEventMock.mock.calls[0][2]).toBe('x,y');
  });

  it('καμία άρνηση ⇒ κανένα audit', async () => {
    await filterSnapshotsByTenant([snap('a', { companyId: OWNER })], CALLER, PATH);
    expect(logAuditEventMock).not.toHaveBeenCalled();
  });
});
