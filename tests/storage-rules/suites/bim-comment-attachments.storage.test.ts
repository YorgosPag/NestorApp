/**
 * Storage Rules — συνημμένα εικόνων σε σχόλια BIM (ADR-366 Φ9/C.2)
 *
 * Pattern: company_scoped_with_project
 *
 * Path: /companies/{companyId}/bim-comment-attachments/{commentId}/{fileName}
 *
 * Rule: read   — isAuthenticated() && (belongsToCompany(companyId) || isSuperAdmin())
 *       write  — isAuthenticated() && (belongsToCompany(companyId) || isSuperAdmin())
 *                && size < 5 MB && contentType matches image/(png|jpe?g)
 *       delete — isAuthenticated() && (belongsToCompany(companyId) || isSuperAdmin())
 *
 * Το συμβόλαιο που φυλάει αυτό το suite: **ο απλός μηχανικός επισυνάπτει εικόνα**. Ο
 * σχολιασμός του μοντέλου είναι καθημερινή ενέργεια όποιου το βλέπει, όχι διαχείριση
 * καταλόγου — αν κάποιος ευθυγραμμίσει αυτό το path με τα curated δέντρα δίπλα
 * (`/bim-mesh-library/`, write μόνο από super_admin), τα ανεβάσματα σταματούν **σιωπηλά**:
 * η φόρμα θα δείξει σφάλμα ανεβάσματος και το σχόλιο απλώς δεν θα αποκτήσει ποτέ συνημμένο.
 * Η γραμμή `same_tenant_user × write → allow` είναι ακριβώς αυτός ο φύλακας.
 *
 * Το δεύτερο τμήμα του path είναι το `commentId` — ο ιδιοκτήτης του αρχείου είναι το
 * σχόλιο, όχι το έργο. Το tenant isolation μένει στο `{companyId}` και ελέγχεται και στα
 * τρία σκέλη: cross-tenant → cross_tenant, anonymous → missing_claim.
 *
 * @since 2026-07-26 (ADR-366 Φ9/C.2 — ζωντάνεμα των συνημμένων)
 */

import {
  initStorageEmulator,
  teardownStorageEmulator,
  resetStorageData,
} from '../_harness/emulator';
import { getStorageContext } from '../_harness/auth-contexts';
import {
  assertStorageCell,
  expectStorageAllow,
  expectStorageDeny,
  type AssertStorageTarget,
} from '../_harness/assertions';
import { seedStorageFile } from '../_harness/seed-helpers';
import { STORAGE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { SAME_TENANT_COMPANY_ID } from '../_registry/personas';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

export const COVERAGE = STORAGE_RULES_COVERAGE.find(
  (c) => c.pathId === 'bim_comment_attachments',
)!;

const COMPANY_ID = SAME_TENANT_COMPANY_ID;
const COMMENT_ID = 'cmt_bim_test0001';
/** Το πλήρες object· η μικρογραφία (`…-thumb.jpg`) ζει στον ίδιο φάκελο, ίδια rules. */
const FILE_NAME = 'att_test0001.png';

const TEST_PATH =
  `companies/${COMPANY_ID}/bim-comment-attachments/${COMMENT_ID}/${FILE_NAME}`;

/**
 * Content type των allow cells. **Απαραίτητο**: το default του harness είναι
 * `application/octet-stream`, που αυτό το path το απορρίπτει επίτηδες — χωρίς αυτό
 * τα δύο `write → allow` cells κοκκινίζουν για λάθος λόγο.
 */
const ATTACHMENT_CONTENT_TYPE = 'image/png';

/** 3 bytes — πάντα κάτω από το όριο των 5 MB. */
const TINY_PAYLOAD = new Uint8Array([0x89, 0x50, 0x4e]);

describe('bim-comment-attachments.storage — company_scoped_with_project (ADR-366 Φ9/C.2)', () => {
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
        // Χωρίς προϋπάρχον αρχείο, getMetadata()/delete() γυρίζουν `object-not-found`
        // αντί για `unauthorized` — ένα deny cell θα περνούσε για λάθος λόγο.
        if (cell.operation === 'read' || cell.operation === 'delete') {
          await seedStorageFile(env, TEST_PATH);
        }

        const ctx = getStorageContext(env, cell.persona);
        const target: AssertStorageTarget = {
          path: TEST_PATH,
          contentType: ATTACHMENT_CONTENT_TYPE,
        };

        await assertStorageCell(ctx, cell, target);
      });
    });
  }
});

/**
 * Ο κανόνας γράφει `image/(png|jpe?g)` και **ΟΧΙ** `image/.*` (ADR-366 §12). Η διαφορά
 * είναι ολόκληρη η άμυνα απέναντι σε stored-XSS: ένα `image/svg+xml` σερβίρεται από το
 * download URL ως εκτελέσιμο έγγραφο. Το `image/.*` θα το δεχόταν σιωπηλά — και η
 * αλλαγή είναι ένας χαρακτήρας, οπότε χρειάζεται pin.
 */
describe('bim-comment-attachments.storage — content-type guard (ADR-366 Φ9/C.2)', () => {
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

  const putAs = (ctx: ReturnType<typeof getStorageContext>, suffix: string, contentType: string) =>
    ctx.storage().ref(`${TEST_PATH}--${suffix}`).put(TINY_PAYLOAD, { contentType });

  it('δέχεται JPEG — το δεύτερο σκέλος του `jpe?g` είναι ζωντανό', async () => {
    const ctx = getStorageContext(env, 'same_tenant_user');
    await expectStorageAllow(putAs(ctx, 'jpeg', 'image/jpeg'));
  });

  it('απορρίπτει SVG — ο φορέας του stored-XSS', async () => {
    const ctx = getStorageContext(env, 'same_tenant_user');
    await expectStorageDeny(putAs(ctx, 'svg', 'image/svg+xml'));
  });

  it('απορρίπτει WebP — client `ALLOWED_EXTS` και rules συμφωνούν', async () => {
    const ctx = getStorageContext(env, 'same_tenant_user');
    await expectStorageDeny(putAs(ctx, 'webp', 'image/webp'));
  });

  it('απορρίπτει octet-stream — τίποτα αδιαφανές σε αυτό το path', async () => {
    const ctx = getStorageContext(env, 'same_tenant_user');
    await expectStorageDeny(putAs(ctx, 'octet', 'application/octet-stream'));
  });
});
