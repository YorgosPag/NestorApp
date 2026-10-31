/**
 * Storage Rules — simplified enterprise path (no projectId)
 *
 * Pattern: company_scoped_no_project
 *
 * Path: /companies/{companyId}/entities/{entityType}/{entityId}/
 *       domains/{domain}/categories/{category}/files/{fileName}
 *
 * Rule: read requires `isAuthenticated() && (belongsToCompany(companyId) || isSuperAdmin())`
 *       write requires `isAuthenticated() && (belongsToCompany(companyId) || isSuperAdmin())
 *                       && (isValidFileSize() || isListingVideoUpload() || isCatalogAssetUpload() || isCatalogImportUpload())`
 *                       — ADR-907 §10 · ADR-923 §5.10.3 · §5.5.1
 *       delete requires `isAuthenticated() && (belongsToCompany(companyId) || isSuperAdmin())`
 *
 * Note: write rule here adds an explicit `isAuthenticated()` check at the top
 * that the with-project variant lacks (it is implied by `belongsToCompany`).
 * Both paths deny unauthenticated writes — the explicit check is redundant
 * but not incorrect.
 *
 * See ADR-301 §3.3.
 *
 * @since 2026-04-14 (ADR-301 Phase A)
 */

import {
  initStorageEmulator,
  teardownStorageEmulator,
  resetStorageData,
} from '../_harness/emulator';
import { getStorageContext } from '../_harness/auth-contexts';
import { assertStorageCell, type AssertStorageTarget } from '../_harness/assertions';
import { seedStorageFile } from '../_harness/seed-helpers';
import { STORAGE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { SAME_TENANT_COMPANY_ID, type StoragePersona } from '../_registry/personas';
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';

export const COVERAGE = STORAGE_RULES_COVERAGE.find(
  (c) => c.pathId === 'canonical_no_project',
)!;

/** Concrete path matching the simplified (no-project) match pattern. */
const COMPANY_ID = SAME_TENANT_COMPANY_ID;
const ENTITY_TYPE = 'contact';
const ENTITY_ID = 'ent-test-002';
const DOMAIN = 'profiles';
const CATEGORY = 'avatars';
const FILE_NAME = 'avatar.jpg';

const TEST_PATH =
  `companies/${COMPANY_ID}` +
  `/entities/${ENTITY_TYPE}/${ENTITY_ID}` +
  `/domains/${DOMAIN}/categories/${CATEGORY}/files/${FILE_NAME}`;

/** Ο δρόμος που παίρνει **μετρημένα** το αρχείο μονάδας (ADR-907 §10) — `domains/sales`. */
const unitPath = (entityType: string, category: string): string =>
  `companies/${COMPANY_ID}/entities/${entityType}/ent-test-video` +
  `/domains/sales/categories/${category}/files/clip.mp4`;

const VIDEO_PATH = unitPath('property', 'videos');

const MB = 1024 * 1024;
/** `isValidFileSize()`: αυστηρά κάτω από 50 MB. */
const GENERAL_CAP = 50 * MB;
/** `isListingVideoUpload()`: έως **και** 100 MB. */
const VIDEO_CAP = 100 * MB;
const OVER_GENERAL_CAP = GENERAL_CAP + 1;

/** Ένα buffer για όλη τη σουίτα· κάθε ανέβασμα παίρνει όψη του (`subarray`), όχι αντίγραφο. */
const PAYLOAD = new Uint8Array(VIDEO_CAP + 1);

// Ανεβάσματα 50–100 MB προς τον emulator δεν χωρούν στα 30s της προεπιλογής.
jest.setTimeout(180_000);

describe('canonical-path-no-project.storage — company_scoped_no_project pattern', () => {
  let env: RulesTestEnvironment;

  beforeAll(async () => {
    env = await initStorageEmulator();
  });

  afterAll(async () => {
    await teardownStorageEmulator(env);
  });

  afterEach(async () => {
    await resetStorageData(env);
  });

  for (const cell of COVERAGE.matrix) {
    describe(`${cell.persona} × ${cell.operation}`, () => {
      it(`should ${cell.outcome}${cell.reason ? ` (${cell.reason})` : ''}`, async () => {
        // Seed a file for read/delete tests — without a pre-existing file,
        // `getMetadata()` and `delete()` return `object-not-found` instead
        // of `unauthorized`, making deny tests pass for the wrong reason.
        if (cell.operation === 'read' || cell.operation === 'delete') {
          await seedStorageFile(env, TEST_PATH);
        }

        const ctx = getStorageContext(env, cell.persona);
        const target: AssertStorageTarget = { path: TEST_PATH };

        await assertStorageCell(ctx, cell, target);
      });
    });
  }

  // ADR-907 §10 (Φάση 4) — το βίντεο αγγελίας παίρνει μεγαλύτερο ταβάνι, ΠΡΟΣΘΕΤΙΚΑ.
  // Η μήτρα ανεβάζει 3 bytes, άρα δεν βλέπει ποτέ όριο μεγέθους· εδώ ανεβαίνουν πραγματικά bytes.
  describe('🔴 Β — ταβάνι μεγέθους και το σκέλος του βίντεο αγγελίας (ADR-907 §10)', () => {
    const upload = (path: string, size: number, contentType: string, persona: StoragePersona = 'same_tenant_user') =>
      getStorageContext(env, persona).storage().ref(path).put(PAYLOAD.subarray(0, size), { contentType });

    it('🔑 Β1 βίντεο μονάδας MP4 πάνω από 50 MB ανεβαίνει — ο λόγος ύπαρξης του σκέλους', async () => {
      await assertSucceeds(upload(VIDEO_PATH, OVER_GENERAL_CAP, 'video/mp4'));
    });

    it('Β2 ακριβώς 100 MB περνά· ένα byte παραπάνω όχι', async () => {
      await assertSucceeds(upload(`${VIDEO_PATH}--edge`, VIDEO_CAP, 'video/mp4'));
      await assertFails(upload(`${VIDEO_PATH}--over`, VIDEO_CAP + 1, 'video/mp4'));
    });

    it('Β3 το μεγάλο ταβάνι είναι ΜΟΝΟ για video/mp4 — webm πάνω από 50 MB κόβεται', async () => {
      await assertFails(upload(`${VIDEO_PATH}--webm`, OVER_GENERAL_CAP, 'video/webm'));
    });

    it('Β4 …ΜΟΝΟ στην κατηγορία videos — MP4 πάνω από 50 MB στις φωτογραφίες κόβεται', async () => {
      await assertFails(upload(unitPath('property', 'photos'), OVER_GENERAL_CAP, 'video/mp4'));
    });

    it('Β5 …ΜΟΝΟ για μονάδα — MP4 πάνω από 50 MB σε κτίριο κόβεται', async () => {
      await assertFails(upload(unitPath('building', 'videos'), OVER_GENERAL_CAP, 'video/mp4'));
    });

    it('Β6 το σκέλος ΔΕΝ ανοίγει ξένο χώρο ούτε ανώνυμο', async () => {
      await assertFails(upload(`${VIDEO_PATH}--x`, OVER_GENERAL_CAP, 'video/mp4', 'cross_tenant_user'));
      await assertFails(upload(`${VIDEO_PATH}--a`, OVER_GENERAL_CAP, 'video/mp4', 'anonymous'));
    });

    it('🔑 Β7 προσθετικό: ό,τι περνούσε περνά ακόμη — webm κάτω από 50 MB στα videos μονάδας', async () => {
      await assertSucceeds(upload(`${VIDEO_PATH}--small`, 1024, 'video/webm'));
    });

    it('Β8 το γενικό ταβάνι των 50 MB στέκει για κάθε άλλο αρχείο (ως σήμερα χωρίς άγκυρα)', async () => {
      await assertFails(upload(`${TEST_PATH}--big`, GENERAL_CAP, 'application/octet-stream'));
      await assertSucceeds(upload(`${TEST_PATH}--fits`, GENERAL_CAP - 1, 'application/octet-stream'));
    });
  });

  // ADR-923 §5.10.3 — τα μέσα καταλόγου παίρνουν μεγαλύτερο ταβάνι (`isCatalogAssetUpload`), ΠΡΟΣΘΕΤΙΚΑ.
  // ⚠️ Το ίδιο το ταβάνι (500 MB, `<=`) το φυλάει η άγκυρα κειμένου `catalog-asset-storage-ceiling.test.ts` απέναντι
  //    στο `CATALOG_ASSET_UPLOAD_CEILING_BYTES`: ένα πραγματικό ανέβασμα 500 MB + 1 θα ήταν 1 GB μεταφοράς ανά εκτέλεση.
  //    Εδώ αποδεικνύεται ότι το σκέλος είναι ΚΑΛΩΔΙΩΜΕΝΟ: περνά ό,τι το γενικό ταβάνι κόβει, και μόνο για `catalog_asset`.
  describe('🔴 Γ — ταβάνι μεγέθους των μέσων καταλόγου (ADR-923 §5.10.3)', () => {
    const catalogPath = (entityType: string, suffix: string): string =>
      `companies/${COMPANY_ID}/entities/${entityType}/casst_test` +
      `/domains/catalog/categories/models/files/file_${suffix}.rfa`;
    const upload = (path: string, size: number, persona: StoragePersona = 'same_tenant_user') =>
      getStorageContext(env, persona).storage().ref(path).put(PAYLOAD.subarray(0, size), { contentType: 'application/octet-stream' });

    it('🔑 Γ1 μέσο καταλόγου πάνω από 50 MB ανεβαίνει — ο λόγος ύπαρξης του σκέλους', async () => {
      await assertSucceeds(upload(catalogPath('catalog_asset', 'big'), OVER_GENERAL_CAP));
    });

    it('Γ2 …ΜΟΝΟ για `catalog_asset` — το ίδιο αρχείο σε άλλη οντότητα κόβεται', async () => {
      await assertFails(upload(catalogPath('material', 'big'), OVER_GENERAL_CAP));
    });

    it('Γ3 το σκέλος ΔΕΝ ανοίγει ξένο χώρο ούτε ανώνυμο', async () => {
      await assertFails(upload(catalogPath('catalog_asset', 'x'), OVER_GENERAL_CAP, 'cross_tenant_user'));
      await assertFails(upload(catalogPath('catalog_asset', 'a'), OVER_GENERAL_CAP, 'anonymous'));
    });
  });

  // ADR-923 §5.5.1 — το αρχείο-πηγή μιας εισαγωγής (`isCatalogImportUpload`), ΠΡΟΣΘΕΤΙΚΑ. Το ταβάνι των 200 MB το φυλάει
  // άγκυρα κειμένου απέναντι στο `IMPORT_MAX_FILE_BYTES` (`import-storage-ceiling.test.ts`): 400 MB μεταφοράς ανά τρέξιμο δεν αξίζουν.
  describe('🔴 Δ — ταβάνι μεγέθους του αρχείου εισαγωγής (ADR-923 §5.5.1)', () => {
    const importPath = (entityType: string, suffix: string): string =>
      `companies/${COMPANY_ID}/entities/${entityType}/cibat_test` +
      `/domains/catalog/categories/documents/files/file_${suffix}.pdf`;
    const upload = (path: string, size: number, persona: StoragePersona = 'same_tenant_user') =>
      getStorageContext(env, persona).storage().ref(path).put(PAYLOAD.subarray(0, size), { contentType: 'application/pdf' });

    it('🔑 Δ1 PDF πάνω από 50 MB ανεβαίνει — ο κατάλογος Aries είναι 138 MB', async () => {
      await assertSucceeds(upload(importPath('catalog_import_batch', 'big'), OVER_GENERAL_CAP));
    });

    it('Δ2 …ΜΟΝΟ για `catalog_import_batch` — το ίδιο αρχείο σε άλλη οντότητα κόβεται', async () => {
      await assertFails(upload(importPath('material', 'big'), OVER_GENERAL_CAP));
    });

    it('Δ3 το σκέλος ΔΕΝ ανοίγει ξένο χώρο ούτε ανώνυμο', async () => {
      await assertFails(upload(importPath('catalog_import_batch', 'x'), OVER_GENERAL_CAP, 'cross_tenant_user'));
      await assertFails(upload(importPath('catalog_import_batch', 'a'), OVER_GENERAL_CAP, 'anonymous'));
    });
  });
});
