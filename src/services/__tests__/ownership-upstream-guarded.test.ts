/**
 * @jest-environment node
 *
 * ⚠️ **Node, όχι jsdom** — και δεν είναι προτίμηση. Το `next/server` αγγίζει τα
 * καθολικά `Request`/`Response`/`ReadableStream` τη στιγμή της εισαγωγής· το
 * jsdom του Jest δεν τα έχει και η σουίτα πέθαινε **πριν** από την πρώτη
 * δήλωση. Η διαδρομή που δοκιμάζεται είναι ούτως ή άλλως **server-only**.
 */

/**
 * 🔴 ADR-742 §7terdecies.2 — **τα τρία σημεία που ΔΕΝ μπορούν να αποδειχθούν**
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΤΟ ΕΥΡΗΜΑ (μετρημένο 2026-08-01)
 * ─────────────────────────────────────────────────────────────────────────────
 * Ο `isPayloadOwnedByCompany` διαφέρει από το σκέτο `===` **σε μία και μόνη
 * είσοδο**: ιδιοκτήτης `''` **και** καλών `''`. Σε τρία από τα δεκατέσσερα
 * σημεία της Φάσης Γ αυτή η είσοδος είναι **απρόσιτη**, γιατί φύλακας
 * **ανάντη** απορρίπτει ήδη τον κενό μισθωτή:
 *
 * ⚠️ Οι διαδρομές γράφονται **πλήρεις και σχετικές με το `src/`** επίτηδες: ο
 * anchor `ownership-callsite-coverage-anchor.test.ts` απαιτεί να τις βρει
 * αυτούσιες εδώ, ώστε η **αφαίρεση** γραμμής να κοκκινίζει (μάθημα #7).
 *
 * | σημείο | ο ανάντη φύλακας |
 * |---|---|
 * | `services/communications-triage-actions.ts` | `if (!companyId \|\| !adminUid)` στην ίδια συνάρτηση |
 * | `services/showcase-core/api/create-unified-public-pdf-route.ts` | `lookupPublicShowcaseShare`: `if (!entityId \|\| !companyId \|\| !expiresAt) return null` |
 * | `app/api/showcase/[token]/pdf/route.ts` | `resolveShare` **και** `loadEntityHeader`: `if (!companyId) return null` |
 *
 * ⇒ Για κάθε **προσιτή** είσοδο ο SSoT είναι εκεί **αποδεδειγμένα ισοδύναμος**
 * με το `===`. Καμία μετάλλαξη του SSoT δεν μπορεί να τα κοκκινίσει — και αυτό
 * **δεν** είναι κενό κάλυψης· είναι ιδιότητα του κώδικα.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΤΟΤΕ ΥΠΑΡΧΕΙ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ
 * ─────────────────────────────────────────────────────────────────────────────
 * Επειδή η ισοδυναμία **εξαρτάται από τον άλλον**. Είναι ακριβώς το μάθημα #5
 * του ADR-742 σε δεύτερο επίπεδο: *fail closed που εξαρτάται από την άλλη
 * πλευρά δεν είναι fail closed* — εδώ, **αποδειξιμότητα** που εξαρτάται από την
 * άλλη πλευρά δεν είναι αποδειξιμότητα. Τη στιγμή που κάποιος «απλοποιήσει» τον
 * ανάντη φύλακα, το ζεύγος κενό/κενό γίνεται προσιτό και ο SSoT ξαναγίνεται
 * **φέρων**, χωρίς κανένα σήμα.
 *
 * Άρα εδώ δεν φυλάμε τον SSoT· φυλάμε **την προϋπόθεση** που τον κάνει
 * περιττό. Αν αυτά τα tests κοκκινίσουν, η σωστή αντίδραση **δεν** είναι να
 * τα διορθώσεις: είναι να μετακινήσεις τα σημεία στον πίνακα του
 * `ownership-empty-pair-*` και να γράψεις εκεί το ζεύγος κενό/κενό.
 *
 * @module services/__tests__/ownership-upstream-guarded
 * @see adrs/ADR-742 §7terdecies.2
 */

// ── Mocks ─────────────────────────────────────────────────────────────

jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminFirestore: jest.fn(),
}));

jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({
    info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
  }),
}));

jest.mock('@/lib/telemetry/Logger', () => ({
  createModuleLogger: () => ({
    info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
  }),
}));

jest.mock('@/app/api/showcase/shared-pdf-proxy-helpers', () => ({
  jsonError: (status: number, message: string) =>
    new (require('next/server').NextResponse)(JSON.stringify({ error: message }), { status }),
  streamPdfFromStorage: jest.fn(async () => ({
    stream: new ReadableStream<Uint8Array>(),
    size: 4,
  })),
}));

import { NextRequest } from 'next/server';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { createMockFirestore, type MockFirestoreKit } from '@/test-utils/mock-firestore';
import { streamPdfFromStorage } from '@/app/api/showcase/shared-pdf-proxy-helpers';
import { approveCommunication, rejectCommunication } from '@/services/communications-triage-actions';
import { createUnifiedPublicShowcasePdfRoute } from '@/services/showcase-core/api/create-unified-public-pdf-route';

const COMM_ID = 'msg_target_001';
const TOKEN = 'tok_public_001';
const ENTITY_ID = 'bld_target_001';
const FUTURE = new Date(Date.now() + 86_400_000).toISOString();

let kit: MockFirestoreKit;

beforeEach(() => {
  jest.clearAllMocks();
  kit = createMockFirestore();
  (getAdminFirestore as jest.Mock).mockReturnValue(kit.instance);
});

// =============================================================================
// 1. communications-triage-actions — ο ανάντη φύλακας είναι στην ίδια συνάρτηση
// =============================================================================

describe('ADR-742 — ανάντη φύλακας: communications-triage-actions', () => {
  const actions = [
    { name: 'approveCommunication', fn: (companyId: string) => approveCommunication(COMM_ID, 'admin_A', companyId) },
    { name: 'rejectCommunication', fn: (companyId: string) => rejectCommunication(COMM_ID, 'admin_A', companyId) },
  ];

  test.each(actions)(
    '🔴 $name απορρίπτει ΚΕΝΟ μισθωτή πριν καν διαβάσει το έγγραφο',
    async ({ fn }) => {
      kit.seedCollection(COLLECTIONS.MESSAGES, {
        [COMM_ID]: { id: COMM_ID, companyId: '', status: 'pending' },
      });
      kit.clearWrites();

      const result = await fn('');

      // `invalid_context`, ΟΧΙ `tenant_mismatch`: η άρνηση γεννιέται ανάντη.
      expect(result).toMatchObject({ ok: false, code: 'invalid_context' });
      expect(kit.writes()).toEqual([]);
    },
  );

  test.each(actions)(
    '🔴 $name εξακολουθεί να αρνείται ξένο μισθωτή (tenant_mismatch — ο φύλακας ιδιοκτησίας ζει)',
    async ({ fn }) => {
      kit.seedCollection(COLLECTIONS.MESSAGES, {
        [COMM_ID]: { id: COMM_ID, companyId: 'comp_OWNER', status: 'pending' },
      });
      kit.clearWrites();

      const result = await fn('comp_INTRUDER');

      expect(result).toMatchObject({ ok: false, code: 'tenant_mismatch' });
      expect(kit.writes()).toEqual([]);
    },
  );
});

// =============================================================================
// 2. Οι δύο δημόσιες διαδρομές PDF — ο ανάντη φύλακας είναι η ανάλυση του share
// =============================================================================

describe('ADR-742 — ανάντη φύλακας: δημόσια διαδρομή PDF (ανώνυμος καλών)', () => {
  const route = createUnifiedPublicShowcasePdfRoute({
    shareEntityType: 'building_showcase',
    entityCollection: COLLECTIONS.BUILDINGS,
    loggerName: 'TestBuildingShowcasePdfProxy',
    shareNotFoundMessage: 'Building showcase link not found or deactivated',
    entityNotFoundMessage: 'Building not found',
    filenameFallback: 'building-showcase',
  });

  const request = () => new NextRequest('https://nestorconstruct.gr/api/x/pdf');

  function seedShare(shareCompanyId: string | undefined, entityCompanyId: string | undefined): void {
    kit.seedCollection(COLLECTIONS.SHARES, {
      shr_1: {
        token: TOKEN,
        isActive: true,
        entityType: 'building_showcase',
        entityId: ENTITY_ID,
        ...(shareCompanyId === undefined ? {} : { companyId: shareCompanyId }),
        expiresAt: FUTURE,
        showcaseMeta: { pdfStoragePath: 'showcases/x.pdf' },
      },
    });
    kit.seedCollection(COLLECTIONS.BUILDINGS, {
      [ENTITY_ID]: {
        name: 'Κτίριο Άλφα',
        ...(entityCompanyId === undefined ? {} : { companyId: entityCompanyId }),
      },
    });
    kit.clearWrites();
  }

  test('🔴 share με ΚΕΝΟ μισθωτή → 404 στην ανάλυση, το PDF δεν ρέει ΠΟΤΕ', async () => {
    seedShare('', '');

    const response = await route.handle(request(), TOKEN);

    expect(response.status).toBe(404);
    expect(streamPdfFromStorage).not.toHaveBeenCalled();
  });

  test('🔴 share ΧΩΡΙΣ πεδίο μισθωτή → 404, το PDF δεν ρέει ΠΟΤΕ', async () => {
    seedShare(undefined, undefined);

    const response = await route.handle(request(), TOKEN);

    expect(response.status).toBe(404);
    expect(streamPdfFromStorage).not.toHaveBeenCalled();
  });

  test('🔴 οντότητα ΧΩΡΙΣ μισθωτή απέναντι σε κανονικό share → 403, το PDF δεν ρέει', async () => {
    seedShare('comp_001', undefined);

    const response = await route.handle(request(), TOKEN);

    expect(response.status).toBe(403);
    expect(streamPdfFromStorage).not.toHaveBeenCalled();
  });

  test('✅ μάρτυρας: ταιριαστός μισθωτής και στις δύο πλευρές → 200, το PDF ρέει', async () => {
    seedShare('comp_001', 'comp_001');

    const response = await route.handle(request(), TOKEN);

    expect(response.status).toBe(200);
    expect(streamPdfFromStorage).toHaveBeenCalledTimes(1);
  });
});
