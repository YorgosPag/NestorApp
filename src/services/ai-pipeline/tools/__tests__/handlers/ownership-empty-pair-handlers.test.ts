/**
 * 🔴 ADR-742 §7terdecies — **η παγίδα του κενού στους χειριστές του πράκτορα**
 *
 * Τρία σημεία που καλούν `isPayloadOwnedByCompany` και **επέζησαν** της
 * μετάλλαξης του SSoT στις 2026-08-01, παρότι οι τρεις χειριστές **είχαν ήδη**
 * σουίτες: εκείνες έδιναν **υπαρκτό** ξένο μισθωτή, που δεν διακρίνει τίποτα.
 *
 * ⚠️ Ο καλών εδώ είναι **πράκτορας ΤΝ** (ADR-734 §7) — καλών που δοκιμάζει ids
 * μαζικά και χωρίς κούραση. Η διαρροή δεν είναι θεωρητική: το
 * `getContact` επέστρεφε `displayName`, δηλαδή **περιεχόμενο**, όχι απλώς ύπαρξη.
 *
 * Το σχήμα των τριών tests ζει στον harness· εδώ μόνο το στήσιμο.
 *
 * @module __tests__/handlers/ownership-empty-pair-handlers
 * @see lib/auth/__tests__/_harness/ownership-callsite-contract
 * @see adrs/ADR-742 §4, §7terdecies
 */

import '../setup';

jest.mock('@/services/procurement', () => ({
  createPO: jest.fn(),
  getPO: jest.fn(),
  listPOs: jest.fn(async () => []),
}));

jest.mock('firebase-admin/firestore', () => ({
  FieldValue: {
    serverTimestamp: jest.fn(() => 'SERVER_TIMESTAMP'),
    arrayUnion: jest.fn((...items: unknown[]) => ({ _arrayUnion: items })),
    increment: jest.fn((n: number) => ({ _increment: n })),
  },
}));

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { getPO } from '@/services/procurement';
import { COLLECTIONS } from '@/config/firestore-collections';
import { createMockFirestore, type MockFirestoreKit } from '@/test-utils/mock-firestore';
import { createAdminContext } from '../test-utils/context-factory';
import { AttachmentHandler } from '../../handlers/attachment-handler';
import { ProcurementHandler } from '../../handlers/procurement-handler';
import { verifyContactBelongsToTenant } from '../../handlers/org-structure-handler-utils';
import {
  describeOwnershipCallSites,
  downstreamCallProbe,
  withOwner,
  writeJournalProbe,
  type OwnerFixture,
  type OwnershipCallSiteSpec,
} from '@/lib/auth/__tests__/_harness/ownership-callsite-contract';
import type { PurchaseOrder } from '@/types/procurement';

const CONTACT_ID = 'cont_target_001';
const FILE_ID = 'file_target_001';
const PO_ID = 'po_target_001';

let kit: MockFirestoreKit;

beforeEach(() => {
  jest.clearAllMocks();
  kit = createMockFirestore();
  (getAdminFirestore as jest.Mock).mockReturnValue(kit.instance);
});

/** Σπέρνει την επαφή-στόχο με τον δοσμένο ιδιοκτήτη. */
function seedContact(owner: OwnerFixture): void {
  kit.seedCollection(COLLECTIONS.CONTACTS, {
    [CONTACT_ID]: withOwner(
      { id: CONTACT_ID, companyId: 'placeholder', displayName: 'Μυστικός Πελάτης' },
      owner,
    ),
  });
}

const SITES: readonly OwnershipCallSiteSpec[] = [
  {
    /**
     * Η άρνηση φαίνεται στο `success: false`, αλλά το κρίσιμο παρατηρήσιμο
     * είναι ότι **καμία εγγραφή** δεν έγινε: αν ο φύλακας ανοίξει, ο χειριστής
     * συνδέει το αρχείο σε **ξένη** επαφή.
     */
    file: 'services/ai-pipeline/tools/handlers/attachment-handler.ts',
    name: 'AttachmentHandler.attach_file_to_contact — getContact (διαρροή displayName)',
    arrange: owner => {
      seedContact(owner);
      kit.seedCollection(COLLECTIONS.FILES, {
        [FILE_ID]: {
          downloadUrl: 'https://storage.example.com/x.pdf',
          originalFilename: 'x.pdf',
          contentType: 'application/pdf',
        },
      });
      kit.clearWrites();
      return writeJournalProbe(() => kit.writes());
    },
    act: callerCompanyId =>
      new AttachmentHandler().execute(
        'attach_file_to_contact',
        { contactId: CONTACT_ID, fileRecordId: FILE_ID, purpose: 'document' },
        createAdminContext({ companyId: callerCompanyId }),
      ),
    refused: result => (result as { success: boolean }).success === false,
  },
  {
    /**
     * Η **θετική** μορφή της παγίδας: η συνάρτηση επιστρέφει `true/false`, άρα
     * με σκέτο `===` η «επαλήθευση μισθωτή» **επιβεβαίωνε** πρόσβαση που δεν
     * υπάρχει. Διαδρομή ανάγνωσης — δεν υπάρχει τίποτα να γραφτεί.
     */
    file: 'services/ai-pipeline/tools/handlers/org-structure-handler-utils.ts',
    name: 'verifyContactBelongsToTenant — η επαλήθευση που επιβεβαίωνε το ανύπαρκτο',
    arrange: owner => {
      seedContact(owner);
      return downstreamCallProbe();
    },
    act: callerCompanyId => verifyContactBelongsToTenant(CONTACT_ID, callerCompanyId),
    refused: result => result === false,
  },
  {
    /**
     * Το `getPO` δεν φέρνει μισθωτή στην υπογραφή του, οπότε ο ψεύτης
     * επιστρέφει **πάντα** την παραγγελία: ο φύλακας του `findPO` είναι η
     * μοναδική άμυνα. Το `listPOs` fallback επιστρέφει κενό, ώστε η άρνηση να
     * μη μεταμφιέζεται σε επιτυχία από άλλη διαδρομή.
     */
    file: 'services/ai-pipeline/tools/handlers/procurement-handler.ts',
    name: 'ProcurementHandler.get_purchase_order_status — findPO (παραγγελία χωρίς μισθωτή)',
    arrange: owner => {
      (getPO as jest.Mock).mockResolvedValue(
        withOwner(
          { id: PO_ID, poNumber: 'PO-0042', status: 'draft', isDeleted: false, items: [] },
          owner,
        ) as unknown as PurchaseOrder,
      );
      return downstreamCallProbe();
    },
    act: callerCompanyId =>
      new ProcurementHandler().execute(
        'get_purchase_order_status',
        { poId: PO_ID },
        createAdminContext({ companyId: callerCompanyId }),
      ),
    refused: result => (result as { success: boolean }).success === false,
  },
];

describeOwnershipCallSites('ADR-742 — σημεία ιδιοκτησίας χειριστών πράκτορα', SITES);
