/**
 * 🔴 ADR-742 §7terdecies — **η παγίδα του κενού στις υπηρεσίες**
 *
 * Επτά σημεία σε πέντε αρχεία που καλούν `isPayloadOwnedByCompany` και **έως
 * τις 2026-08-01 δεν τα έβλεπε καμία σουίτα**: μετάλλαξη του ίδιου του SSoT
 * (σβήσιμο των τριών φρουρών κενού) άφηνε 215 από 224 σουίτες πράσινες.
 *
 * Το σχήμα των τριών tests ανά σημείο — και **γιατί** ο θετικός μάρτυρας είναι
 * υποχρεωτικός — ζει στον harness. Εδώ ζει **μόνο** το στήσιμο κάθε διαδρομής.
 *
 * @module services/__tests__/ownership-empty-pair-services
 * @see lib/auth/__tests__/_harness/ownership-callsite-contract
 * @see adrs/ADR-742 §4, §7terdecies
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

jest.mock('@/services/company/company-branding-resolver', () => ({
  resolveShowcaseCompanyBranding: jest.fn(async () => ({ companyName: 'Δοκιμή' })),
}));

jest.mock('@/services/property-showcase/snapshot-builder', () => ({
  loadShowcaseRelations: jest.fn(async () => ({})),
  buildPropertyShowcaseSnapshot: jest.fn(() => ({})),
}));

jest.mock('@/services/property-showcase/labels', () => ({
  loadShowcasePdfLabels: jest.fn(() => ({})),
}));

jest.mock('@/services/property-showcase/telegram-text-digest', () => ({
  buildTelegramTextDigest: jest.fn(() => ['κομμάτι-1']),
}));

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { createMockFirestore, type MockFirestoreKit } from '@/test-utils/mock-firestore';
import {
  describeOwnershipCallSites,
  downstreamCallProbe,
  withOwner,
  writeJournalProbe,
  type OwnerFixture,
  type OwnershipCallSiteSpec,
} from '@/lib/auth/__tests__/_harness/ownership-callsite-contract';

import { resolveShowcaseCompanyBranding } from '@/services/company/company-branding-resolver';
import { getProjectPolicyAdmin } from '@/services/assignment/AssignmentPolicyRepository';
import { OpportunitiesServerService } from '@/services/opportunities-server.service';
import { BrokerageServerService } from '@/services/brokerage-server.service';
import { loadShowcaseTextDigest } from '@/services/property-showcase/load-text-digest';
import { fetchOwnedBoqItem } from '@/services/agent-capability/capabilities/boq/boq-tenant-guard';
import { loadFileRows, loadFloorProjectId } from '@/services/floorplan-background/floor-wipe-queries';
import type { BOQItem } from '@/types/boq';
import type { IBOQReadService } from '@/services/measurements/boq-read-contract';
import type { Firestore } from '@/lib/firebaseAdmin';

// ── Κοινό στήσιμο ─────────────────────────────────────────────────────

const DOC_ID = 'doc_target_001';

let kit: MockFirestoreKit;

beforeEach(() => {
  jest.clearAllMocks();
  kit = createMockFirestore();
  (getAdminFirestore as jest.Mock).mockReturnValue(kit.instance);
});

/**
 * Σπέρνει **ένα** έγγραφο στη συλλογή και επιστρέφει τον ανιχνευτή του
 * ημερολογίου. Το `clearWrites()` είναι ουσιώδες: το ίδιο το σπέρμα δεν είναι
 * παρενέργεια της υπό δοκιμή διαδρομής.
 */
function seedOne(
  collection: string,
  owner: OwnerFixture,
  extra: Record<string, unknown> = {},
): ReturnType<typeof writeJournalProbe> {
  kit.seedCollection(collection, {
    [DOC_ID]: withOwner({ id: DOC_ID, companyId: 'placeholder', ...extra }, owner),
  });
  kit.clearWrites();
  return writeJournalProbe(() => kit.writes());
}

/** Το λεξιλόγιο άρνησης «σχήμα αποτελέσματος με `success: false`». */
function refusedBySuccessFlag(result: unknown): boolean {
  return (result as { success?: boolean } | null)?.success === false;
}

// ── Ο πίνακας των σημείων ─────────────────────────────────────────────

const SITES: readonly OwnershipCallSiteSpec[] = [
  {
    file: 'services/assignment/AssignmentPolicyRepository.ts',
    name: 'getProjectPolicyAdmin — δεύτερη ζώνη πάνω από tenant-scoped ερώτημα',
    arrange: owner =>
      seedOne(COLLECTIONS.ASSIGNMENT_POLICIES, owner, {
        projectId: 'proj_1',
        status: 'active',
      }),
    act: callerCompanyId => getProjectPolicyAdmin(callerCompanyId, 'proj_1'),
    refused: result => result === null,
  },
  {
    file: 'services/opportunities-server.service.ts',
    name: 'OpportunitiesServerService.update — κοινός loadOwnedOpportunity',
    arrange: owner => seedOne(COLLECTIONS.OPPORTUNITIES, owner, { name: 'Ευκαιρία' }),
    act: callerCompanyId =>
      OpportunitiesServerService.update(
        DOC_ID,
        { name: 'Μετονομασμένη' },
        callerCompanyId,
        'user_A',
      ),
    refused: refusedBySuccessFlag,
  },
  {
    file: 'services/brokerage-server.service.ts',
    name: 'BrokerageServerService.terminateAgreement — κοινός loadOwnedAgreement',
    arrange: owner =>
      seedOne(COLLECTIONS.BROKERAGE_AGREEMENTS, owner, { status: 'active' }),
    act: callerCompanyId =>
      BrokerageServerService.terminateAgreement(DOC_ID, callerCompanyId, 'user_A'),
    refused: refusedBySuccessFlag,
  },
  {
    file: 'services/brokerage-server.service.ts',
    name: 'BrokerageServerService.updateCommissionPayment — ξεχωριστός φύλακας προμήθειας',
    arrange: owner =>
      seedOne(COLLECTIONS.COMMISSION_RECORDS, owner, { paymentStatus: 'pending' }),
    act: callerCompanyId =>
      BrokerageServerService.updateCommissionPayment(DOC_ID, 'paid', callerCompanyId),
    refused: refusedBySuccessFlag,
  },
  {
    /**
     * Διαδρομή **ανάγνωσης**: δεν γράφει τίποτα, άρα το ημερολόγιο εγγραφών θα
     * ήταν κενό ακόμη κι αν ο φύλακας άνοιγε. Το πραγματικό παρατηρήσιμο είναι
     * ότι ο **κατάντη** κώδικας δεν έτρεξε πάνω σε ξένο ακίνητο.
     */
    file: 'services/property-showcase/load-text-digest.ts',
    name: 'loadShowcaseTextDigest — σιωπηλή πολιτική ([]), κατάντη δεν τρέχει',
    arrange: owner => {
      seedOne(COLLECTIONS.PROPERTIES, owner, { name: 'Ακίνητο' });
      return downstreamCallProbe(resolveShowcaseCompanyBranding as jest.Mock);
    },
    act: callerCompanyId =>
      loadShowcaseTextDigest({ propertyId: DOC_ID, companyId: callerCompanyId }),
    refused: result => Array.isArray(result) && result.length === 0,
  },
  {
    /**
     * Ο `boq` περνιέται ως εξάρτηση, οπότε ο ψεύτης παίζει τον ρόλο μιας
     * υλοποίησης που **αγνοεί** το `companyId` της υπογραφής — ακριβώς η
     * περίπτωση για την οποία υπάρχει η δεύτερη ζώνη (ADR-734 §7).
     */
    file: 'services/agent-capability/capabilities/boq/boq-tenant-guard.ts',
    name: 'fetchOwnedBoqItem — δεύτερη ζώνη απέναντι σε υλοποίηση που αγνοεί τον μισθωτή',
    arrange: owner => {
      boqItemFixture = withOwner({ id: DOC_ID, companyId: 'placeholder' }, owner) as unknown as BOQItem;
      return downstreamCallProbe();
    },
    act: callerCompanyId =>
      fetchOwnedBoqItem(disloyalBoqService, DOC_ID, callerCompanyId, 'req_1'),
    refused: result => (result as { ok: boolean }).ok === false,
  },
  {
    file: 'services/floorplan-background/floor-wipe-queries.ts',
    name: 'loadFileRows — σε wipe, fail-open σημαίνει ΔΙΑΓΡΑΦΗ ξένου αρχείου',
    arrange: owner => seedOne(COLLECTIONS.FILES, owner, { storagePath: 'p/x.pdf' }),
    act: callerCompanyId =>
      loadFileRows(kit.instance as unknown as Firestore, callerCompanyId, [DOC_ID]),
    refused: result => Array.isArray(result) && result.length === 0,
  },
  {
    file: 'services/floorplan-background/floor-wipe-queries.ts',
    name: 'loadFloorProjectId — διαρροή projectId ξένου ορόφου',
    arrange: owner => seedOne(COLLECTIONS.FLOORS, owner, { projectId: 'proj_secret' }),
    act: callerCompanyId =>
      loadFloorProjectId(kit.instance as unknown as Firestore, callerCompanyId, DOC_ID),
    refused: result => result === null,
  },
];

/** Το BOQ item που θα επιστρέψει ο άπιστος ψεύτης στην τρέχουσα περίπτωση. */
let boqItemFixture: BOQItem;

/**
 * Υλοποίηση `IBOQReadService` που **αγνοεί** το `companyId` — δηλαδή ακριβώς το
 * σενάριο που η δεύτερη ζώνη οφείλει να πιάσει.
 */
const disloyalBoqService: IBOQReadService = {
  getById: async () => boqItemFixture,
} as unknown as IBOQReadService;

describeOwnershipCallSites('ADR-742 — σημεία ιδιοκτησίας υπηρεσιών', SITES);
