/**
 * Storage Rules — topographic survey blobs (ADR-650, re-tiered by ADR-657)
 *
 * Pattern: company_scoped_authoring
 *
 * Path: /topo-surfaces/{companyId}/{topoFile=**}
 *
 * Rule: read   — isInternalUserOfCompany(companyId)
 *       write  — isInternalUserOfCompany(companyId)
 *                && size < 100 MB && contentType == 'application/json'
 *       delete — isInternalUserOfCompany(companyId)
 *
 * ADR-657: a topo surface is authoring geometry, so all three legs go through
 * `isInternalUserOfCompany` — a same-tenant `external_user` (valid companyId
 * claim, non-internal role) is denied all three (insufficient_role), while
 * cross-tenant is cross_tenant and anonymous is missing_claim. The matrix that
 * encodes this lives in the coverage manifest (topoSurfacesAuthoringMatrix).
 *
 * The blob holds the point cloud when it outgrows the 1 MB Firestore doc limit;
 * the metadata + `pointsStoragePath` stay in `floorplan_topo_surfaces`. Tenant
 * isolation is therefore enforced twice — once per store — and both suites must
 * hold for the offload path to be safe.
 *
 * @since 2026-07-14 (ADR-650 — topo persistence)
 * @since 2026-07-15 (ADR-657 — authoring tier: external_user denied)
 */

import {
  initStorageEmulator,
  teardownStorageEmulator,
  resetStorageData,
} from '../_harness/emulator';
import { getStorageContext } from '../_harness/auth-contexts';
import {
  assertStorageCell,
  expectStorageDeny,
  type AssertStorageTarget,
} from '../_harness/assertions';
import { seedStorageFile } from '../_harness/seed-helpers';
import { STORAGE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { SAME_TENANT_COMPANY_ID } from '../_registry/personas';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

export const COVERAGE = STORAGE_RULES_COVERAGE.find(
  (c) => c.pathId === 'topo_surfaces',
)!;

/** The rule pins the blob to JSON — the harness default (octet-stream) is denied. */
const TOPO_CONTENT_TYPE = 'application/json';

const TEST_PATH = `topo-surfaces/${SAME_TENANT_COMPANY_ID}/proj-test/topo-doc.json`;

describe('topo-surfaces.storage — company_scoped_no_project (ADR-650)', () => {
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
        // Without a pre-existing object, getMetadata()/delete() fail with
        // `object-not-found` rather than `unauthorized` — a deny cell would then
        // pass for the wrong reason.
        if (cell.operation === 'read' || cell.operation === 'delete') {
          await seedStorageFile(env, TEST_PATH);
        }

        const ctx = getStorageContext(env, cell.persona);
        const target: AssertStorageTarget = {
          path: TEST_PATH,
          contentType: TOPO_CONTENT_TYPE,
        };

        await assertStorageCell(ctx, cell, target);
      });
    });
  }
});

describe('topo-surfaces.storage — content-type guard (ADR-650)', () => {
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

  // The size leg (< 100 MB) is not exercised here: uploading a 100 MB payload to
  // the emulator to assert one boolean is not worth the runtime. The content-type
  // leg is the one that actually gates what can be smuggled into this path.

  it('denies a same-tenant write with a non-JSON content type', async () => {
    const ctx = getStorageContext(env, 'same_tenant_user');
    await expectStorageDeny(
      ctx
        .storage()
        .ref(`${TEST_PATH}--octet`)
        .put(new Uint8Array([0x01, 0x02, 0x03]), {
          contentType: 'application/octet-stream',
        }),
    );
  });

  it('denies a same-tenant write of an executable disguised in the topo path', async () => {
    const ctx = getStorageContext(env, 'same_tenant_user');
    await expectStorageDeny(
      ctx
        .storage()
        .ref(`${TEST_PATH}--html`)
        .put(new Uint8Array([0x3c, 0x21]), { contentType: 'text/html' }),
    );
  });
});
