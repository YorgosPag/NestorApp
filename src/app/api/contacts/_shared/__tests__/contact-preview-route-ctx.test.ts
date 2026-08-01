/**
 * Ο εκτελεστής παραδίδει τον **σωστό καλούντα** — ADR-742 §7octies
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 ΜΟΝΑΔΙΚΗ ΔΟΥΛΕΙΑ ΑΥΤΗΣ ΤΗΣ ΣΟΥΙΤΑΣ
 * ─────────────────────────────────────────────────────────────────────────────
 * Όλη η απόφαση ιδιοκτησίας των **έξι** διαδρομών προεπισκόπησης επαφής
 * κρέμεται από **μία** μεταβλητή: το `ctx` που ο εκτελεστής παραδίδει στον
 * φύλακα **και** στη μηχανή. Καρφωμένο `'super_admin'` ή καρφωμένο `companyId`
 * εδώ θα άνοιγε έξι διαδρομές μαζί, με **κάθε άλλο test πράσινο**.
 *
 * 🔴 **Εδώ ελέγχεται και κάτι που το πρότυπο των έργων δεν είχε**: ότι ο tenant
 * φτάνει **στην ίδια τη μηχανή επιπτώσεων**. Στις επαφές αυτό ήταν το
 * πραγματικό κενό — ο φύλακας έλειπε από τέσσερις διαδρομές, αλλά ακόμη και
 * όπου υπήρχε, το `companyId` **δεν περνιόταν** στον υπολογισμό (§7octies).
 *
 * @module app/api/contacts/_shared/__tests__/contact-preview-route-ctx
 */

jest.mock('next/server', () => {
  class MockNextResponse {
    static json(body: unknown, init?: { status?: number }) {
      return { status: init?.status ?? 200, json: async () => body };
    }
  }
  return { NextResponse: MockNextResponse, NextRequest: class {} };
});

/** Ο ρόλος που φοράει ο «συνδεδεμένος» χρήστης σε κάθε test. */
var currentRole = 'company_admin';
/** Ο tenant του καλούντα — ξεχωριστά, ώστε να πιάνεται και καρφωμένο `companyId`. */
var currentCompanyId = 'co_alpha';
/** Τα δικαιώματα που ζητήθηκαν — το κενό των τεσσάρων διαδρομών ήταν ακριβώς εδώ. */
var requestedPermissions: unknown[] = [];

jest.mock('@/lib/auth', () => ({
  withAuth: (
    callback: (...args: unknown[]) => Promise<unknown>,
    options?: { permissions?: unknown },
  ) => {
    requestedPermissions.push(options?.permissions);
    return async (request: unknown) =>
      callback(
        request,
        { uid: 'u_1', email: 'a@alpha.gr', companyId: currentCompanyId, globalRole: currentRole },
        { cache: true },
      );
  },
}));

/** Ο ρυθμιστής ρυθμού καταγράφεται αντί να εκτελεστεί — μας ενδιαφέρει ΟΤΙ μπήκε. */
var rateLimited: unknown[] = [];
jest.mock('@/lib/middleware/with-rate-limit', () => ({
  withStandardRateLimit: (handler: unknown) => {
    rateLimited.push(handler);
    return handler;
  },
}));

/** Τι «υπάρχει» στη βάση σε κάθε test. */
var storedContact: { companyId?: string | null; type?: string } | null = null;

jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminFirestore: () => ({
    collection: () => ({
      doc: () => ({
        get: async () => ({
          exists: storedContact !== null,
          id: 'contact_42',
          data: () => storedContact ?? undefined,
        }),
      }),
    }),
  }),
}));

import { z } from 'zod';
import type { NextRequest } from 'next/server';
import { ApiError } from '@/lib/api/api-error-types';
import { contactPreviewRoute, contactPreviewRouteWithBody } from '../contact-preview-route';

const segment = { params: Promise.resolve({ contactId: 'contact_42' }) };
const req = () => ({ json: async () => ({ changes: [] }) }) as unknown as NextRequest;

beforeEach(() => {
  currentRole = 'company_admin';
  currentCompanyId = 'co_alpha';
  storedContact = { companyId: 'co_alpha', type: 'individual' };
  requestedPermissions = [];
  rateLimited = [];
});

/** Τι είδε ο υπολογισμός της προεπισκόπησης — ή `null` αν δεν έτρεξε ποτέ. */
interface Seen {
  companyId: string;
  role: string;
  contactId: string;
  contactType: string;
}

function makeGetRoute() {
  let seen: Seen | null = null;
  const route = contactPreviewRoute<{ ok: true }>({
    action: 'test-preview',
    preview: async ({ companyId, ctx, contactId, contactType }) => {
      seen = { companyId, role: ctx.globalRole, contactId, contactType };
      return { ok: true };
    },
  });
  return { route, peek: () => seen };
}

describe('⚓ ο εκτελεστής προεπισκόπησης επαφής — ποιον καλούντα παραδίδει', () => {
  it('🔴 ο tenant που φτάνει στη μηχανή είναι ΤΟΥ ΚΑΛΟΥΝΤΑ, όχι καρφωμένος', async () => {
    currentCompanyId = 'co_beta';
    storedContact = { companyId: 'co_beta', type: 'company' };

    const { route, peek } = makeGetRoute();
    await route(req(), segment);

    expect(peek()).not.toBeNull();
    expect(peek()!.companyId).toBe('co_beta');
  });

  it('🔴 ο ρόλος που φτάνει στον φύλακα είναι ΤΟΥ ΚΑΛΟΥΝΤΑ, όχι καρφωμένος', async () => {
    const { route, peek } = makeGetRoute();
    await route(req(), segment);

    expect(peek()!.role).toBe('company_admin');
  });

  it('🔴 ΞΕΝΗ επαφή ⇒ 404, και η προεπισκόπηση ΔΕΝ ΤΡΕΧΕΙ ΚΑΘΟΛΟΥ', async () => {
    // Η σειρά **είναι** το ζητούμενο: ο υπολογισμός διαβάζει σχέσεις ολόκληρης
    // της επαφής. Αν έτρεχε πριν τον φύλακα, θα διέρρεε *περιεχόμενο*.
    storedContact = { companyId: 'co_ksena', type: 'individual' };

    const { route, peek } = makeGetRoute();
    let thrown: unknown;
    try {
      await route(req(), segment);
    } catch (e) {
      thrown = e;
    }

    expect((thrown as ApiError).statusCode).toBe(404);
    expect((thrown as ApiError).message).toBe('Contact not found');
    expect(peek()).toBeNull();
  });

  it('🔴 ΑΝΥΠΑΡΚΤΗ επαφή ⇒ ΤΟ ΙΔΙΟ 404 (μάθημα #8: ο έλεγχος ύπαρξης δεν είναι πλεονασμός)', async () => {
    storedContact = null;

    const { route, peek } = makeGetRoute();
    let thrown: unknown;
    try {
      await route(req(), segment);
    } catch (e) {
      thrown = e;
    }

    expect((thrown as ApiError).statusCode).toBe(404);
    expect((thrown as ApiError).message).toBe('Contact not found');
    expect(peek()).toBeNull();
  });

  it('🔴 υπεργραφέας σε ΑΝΥΠΑΡΚΤΗ επαφή δεν κατεβάζει φάντασμα εγγράφου', async () => {
    // Ο φύλακας του λέει «πέρνα»· **μόνο** ο έλεγχος ύπαρξης τον σταματά.
    currentRole = 'super_admin';
    storedContact = null;

    const { route, peek } = makeGetRoute();
    await expect(route(req(), segment)).rejects.toMatchObject({ statusCode: 404 });
    expect(peek()).toBeNull();
  });

  it('υπεργραφέας σε ξένη επαφή περνά (δηλωμένο χρέος §7ter.3)', async () => {
    currentRole = 'super_admin';
    currentCompanyId = 'co_alpha';
    storedContact = { companyId: 'co_ksena', type: 'individual' };

    const { route, peek } = makeGetRoute();
    await route(req(), segment);

    expect(peek()).not.toBeNull();
    // …και ακόμη κι εκεί, ο tenant που πάει στη μηχανή είναι **του καλούντα**.
    expect(peek()!.companyId).toBe('co_alpha');
  });
});

describe('⚓ τι είναι καρφωμένο επίτηδες', () => {
  it('🔴 ΚΑΘΕ διαδρομή ζητά δικαίωμα — τέσσερις δεν ζητούσαν ΚΑΝΕΝΑ', async () => {
    const { route } = makeGetRoute();
    await route(req(), segment);

    expect(requestedPermissions).toEqual(['crm:contacts:update']);
    expect(requestedPermissions).not.toContain(undefined);
  });

  it('🔴 ΚΑΘΕ διαδρομή περνά από ρυθμιστή ρυθμού', () => {
    makeGetRoute();
    expect(rateLimited.length).toBe(1);
  });

  it('το ίδιο ισχύει για την οικογένεια με σώμα', async () => {
    requestedPermissions = [];
    const route = contactPreviewRouteWithBody({
      schema: z.object({ changes: z.array(z.unknown()) }),
      action: 'test-body',
      preview: async () => ({ ok: true }),
    });
    await route(req(), segment);

    expect(requestedPermissions).toEqual(['crm:contacts:update']);
  });
});

describe('⚓ ο έλεγχος τύπου επαφής τρέχει ΜΕΤΑ τον φύλακα', () => {
  it('ξένη επαφή λάθος τύπου ⇒ 404, ΟΧΙ 400', async () => {
    // Αλλιώς το ίδιο το 400 θα μαρτυρούσε ότι το id υπάρχει **και** τι είναι.
    storedContact = { companyId: 'co_ksena', type: 'company' };

    const route = contactPreviewRouteWithBody({
      schema: z.object({ changes: z.array(z.unknown()) }),
      action: 'test-type',
      requireType: 'individual',
      wrongTypeMessage: 'only individual',
      preview: async () => ({ ok: true }),
    });

    await expect(route(req(), segment)).rejects.toMatchObject({
      statusCode: 404,
      message: 'Contact not found',
    });
  });

  it('δική μου επαφή λάθος τύπου ⇒ 400 με το μήνυμα της διαδρομής', async () => {
    storedContact = { companyId: 'co_alpha', type: 'company' };

    const route = contactPreviewRouteWithBody({
      schema: z.object({ changes: z.array(z.unknown()) }),
      action: 'test-type',
      requireType: 'individual',
      wrongTypeMessage: 'only individual',
      preview: async () => ({ ok: true }),
    });

    await expect(route(req(), segment)).rejects.toMatchObject({
      statusCode: 400,
      message: 'only individual',
    });
  });
});
