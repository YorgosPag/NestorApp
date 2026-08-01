/**
 * `contact_links` — production service code against live `firestore.rules`
 * on a real emulator (ADR-745 §4 G3).
 *
 * ## What had never been executed
 *
 * `contact_links` holds **0 documents**. The flow has never run — not in
 * production, not in a test. Both halves were green and never met:
 *
 *   | suite                              | converter | rules | verdict            |
 *   |------------------------------------|-----------|-------|--------------------|
 *   | `tests/firestore-rules/suites/…`   | ✗ seeded  | ✓     | rules are correct  |
 *   | `src/**\/__tests__/…`              | ✓         | ✗ mock| service is correct |
 *   | **this**                           | ✓         | ✓     | ← the join         |
 *
 * "The converter emits bytes the rules accept" is a claim about the *join*.
 * Φ3 (`TitleBlockBinding`) is being built on this mechanism, so the claim has
 * to be an artifact that re-runs, not an observation someone made once.
 *
 * ## Organised by invariant, not by file
 *
 * ADR-745 Φάση Α found a gap that survived precisely because tests were
 * written per-module: each module's own test sat next to code that was
 * already right. A `describe` here names a property of the *flow*, so a future
 * writer or reader gets caught by it regardless of which file they touch.
 *
 * ## Reading assertions go through `readRaw` (rules disabled)
 *
 * Verifying a write by reading it back through the same authenticated path
 * proves nothing about tenancy: a document written under the wrong
 * `companyId` is also *found* under the wrong `companyId`. Only a
 * rules-disabled read can answer "did it land in the right tenant".
 *
 * @see tests/service-integration/_harness/firestore-seam.ts (the single seam)
 * @see ADR-745 §2.6 (the scenario these cases encode)
 */

import { assertFails } from '@firebase/rules-unit-testing';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

import { initEmulator, teardownEmulator, resetData } from '../../firestore-rules/_harness/emulator';
import {
  PERSONA_CLAIMS,
  SAME_TENANT_COMPANY_ID,
  CROSS_TENANT_COMPANY_ID,
} from '../../firestore-rules/_registry/personas';
import { withPersona, readRaw } from '../_harness/firestore-seam';
import { recordedFetches } from '../_harness/setup-after-env';

// The single seam: production code keeps its own import of `@/lib/firebase`,
// but the handle it receives is the emulator client bound to the acting
// persona. See firestore-seam.ts for why this is a getter and not a value.
jest.mock('@/lib/firebase', () => require('../_harness/firestore-seam').firebaseSeam);

// Imported AFTER the mock declaration purely for reader clarity — `jest.mock`
// is hoisted above imports either way.
import {
  linkContactToEntity,
  listContactLinks,
  unlinkContact,
  buildContactLinkId,
  getContactLinkById,
} from '@/services/contact-link.service';
import { API_ROUTES } from '@/config/domain-constants';
import { REALTIME_EVENTS } from '@/services/realtime';
import type { CreateContactLinkInput } from '@/types/associations';

const CREATOR = PERSONA_CLAIMS.same_tenant_user.uid;
const PROJECT_ID = 'proj_alpha';
const CONTACT_ID = 'cont_kostas';
const ROLE = 'worker';

/** The exact payload `useEntityContactLinks.addLink` builds (hooks/useEntityAssociations.ts). */
function workerLinkInput(overrides: Partial<CreateContactLinkInput> = {}): CreateContactLinkInput {
  return {
    companyId: SAME_TENANT_COMPANY_ID,
    // Not the tenant — a legacy free-form label (ADR-745 §7, open debt).
    sourceWorkspaceId: 'default',
    sourceContactId: CONTACT_ID,
    targetEntityType: 'project',
    targetEntityId: PROJECT_ID,
    role: ROLE,
    createdBy: CREATOR,
    ...overrides,
  };
}

const EXPECTED_LINK_ID = buildContactLinkId(CONTACT_ID, 'project', PROJECT_ID, ROLE);

describe('contact_links — production write path is accepted by live rules', () => {
  let env: RulesTestEnvironment;

  beforeAll(async () => { env = await initEmulator(); });
  afterAll(async () => { await teardownEmulator(env); });
  afterEach(async () => { await resetData(env); });

  it('creates a link through the real converter, under the real CREATE rule', async () => {
    const result = await withPersona(env, 'same_tenant_user', () =>
      linkContactToEntity(workerLinkInput()),
    );

    // Asserting on the message too: the service has a catch-all that turns any
    // throw into `{ success: false, errorCode: 'LINK_CONTACT_FAILED' }`, so a
    // bare `.success === false` check would hide *which* clause rejected.
    expect(result).toMatchObject({ success: true, linkId: EXPECTED_LINK_ID });
  });

  it('lands the document in the acting tenant, attributed to the real uid', async () => {
    await withPersona(env, 'same_tenant_user', () => linkContactToEntity(workerLinkInput()));

    const raw = await readRaw(env, 'contact_links', EXPECTED_LINK_ID);

    expect(raw).not.toBeNull();
    expect(raw).toMatchObject({
      companyId: SAME_TENANT_COMPANY_ID,
      createdBy: CREATOR,
      sourceContactId: CONTACT_ID,
      targetEntityType: 'project',
      targetEntityId: PROJECT_ID,
      role: ROLE,
      status: 'active',
    });
  });

  it('emits every field the CREATE rule requires by name', async () => {
    // The rule calls `keys().hasAll([...])`. A converter that stopped emitting
    // one of these would fail with a generic permission-denied, so this pins
    // the contract explicitly rather than relying on the happy path above.
    await withPersona(env, 'same_tenant_user', () => linkContactToEntity(workerLinkInput()));

    const raw = await readRaw(env, 'contact_links', EXPECTED_LINK_ID);

    for (const required of ['companyId', 'sourceContactId', 'status', 'createdBy']) {
      expect(Object.keys(raw ?? {})).toContain(required);
      expect(raw?.[required]).toEqual(expect.any(String));
    }
  });

  it('refuses to write a link into another tenant', async () => {
    // Belt: the service has no client-side check for this, so the deny comes
    // from the rule — which is the layer that must hold even if a caller lies.
    const result = await withPersona(env, 'same_tenant_user', () =>
      linkContactToEntity(workerLinkInput({ companyId: CROSS_TENANT_COMPANY_ID })),
    );

    expect(result.success).toBe(false);
    expect(await readRaw(env, 'contact_links', EXPECTED_LINK_ID)).toBeNull();
  });

  it('refuses to write a link attributed to someone else', async () => {
    const result = await withPersona(env, 'same_tenant_user', () =>
      linkContactToEntity(workerLinkInput({ createdBy: PERSONA_CLAIMS.same_tenant_admin.uid })),
    );

    expect(result.success).toBe(false);
    expect(await readRaw(env, 'contact_links', EXPECTED_LINK_ID)).toBeNull();
  });
});

describe('contact_links — converter round-trip survives Firestore', () => {
  let env: RulesTestEnvironment;

  beforeAll(async () => { env = await initEmulator(); });
  afterAll(async () => { await teardownEmulator(env); });
  afterEach(async () => { await resetData(env); });

  it('reads back through fromFirestore what toFirestore wrote', async () => {
    await withPersona(env, 'same_tenant_user', () => linkContactToEntity(workerLinkInput()));

    const link = await withPersona(env, 'same_tenant_user', () =>
      getContactLinkById(EXPECTED_LINK_ID),
    );

    expect(link).toMatchObject({
      id: EXPECTED_LINK_ID,
      companyId: SAME_TENANT_COMPANY_ID,
      sourceWorkspaceId: 'default',
      sourceContactId: CONTACT_ID,
      targetEntityType: 'project',
      targetEntityId: PROJECT_ID,
      role: ROLE,
      status: 'active',
      createdBy: CREATOR,
    });
  });

  it('returns createdAt as an ISO string, not a Timestamp', async () => {
    // `toFirestore` converts the ISO string to a `Date`, Firestore stores a
    // `Timestamp`, `fromFirestore` normalises back. Every consumer treats
    // `createdAt` as a string (`typeof link.createdAt === 'string'` guards in
    // useEntityAssociations); a Timestamp leaking through renders as ''.
    await withPersona(env, 'same_tenant_user', () => linkContactToEntity(workerLinkInput()));

    const link = await withPersona(env, 'same_tenant_user', () =>
      getContactLinkById(EXPECTED_LINK_ID),
    );

    expect(typeof link?.createdAt).toBe('string');
    expect(Number.isNaN(Date.parse(link!.createdAt as string))).toBe(false);
  });

  it('round-trips a link with every optional field omitted', async () => {
    // The optional fields are written as explicit `null` by the converter.
    // A `null` that came back as the string "null", or that made
    // `fromFirestore` throw, would only show up on a sparse link like this.
    const sparse = workerLinkInput({ role: undefined, targetWorkspaceId: undefined, reason: undefined });
    const sparseId = buildContactLinkId(CONTACT_ID, 'project', PROJECT_ID, undefined);

    const result = await withPersona(env, 'same_tenant_user', () => linkContactToEntity(sparse));
    expect(result).toMatchObject({ success: true, linkId: sparseId });

    const link = await withPersona(env, 'same_tenant_user', () => getContactLinkById(sparseId));
    expect(link?.role).toBeNull();
    expect(link?.reason).toBeNull();
    expect(link?.status).toBe('active');
  });
});

describe('contact_links — both production read shapes work end to end', () => {
  let env: RulesTestEnvironment;

  beforeAll(async () => { env = await initEmulator(); });
  afterAll(async () => { await teardownEmulator(env); });
  afterEach(async () => { await resetData(env); });

  /** Seed via the production write path — that is the point of the suite. */
  async function seedThroughService(input: Partial<CreateContactLinkInput> = {}): Promise<void> {
    const result = await withPersona(env, 'same_tenant_user', () =>
      linkContactToEntity(workerLinkInput(input)),
    );
    if (!result.success) {
      throw new Error(`seed failed: ${result.error ?? 'unknown'} (${result.errorCode ?? '-'})`);
    }
  }

  it('shape A — entity side: companyId + target + status, ordered by createdAt', async () => {
    // `useEntityContactLinks` → "which contacts are on this project?"
    await seedThroughService();

    const links = await withPersona(env, 'same_tenant_user', () =>
      listContactLinks({
        companyId: SAME_TENANT_COMPANY_ID,
        targetEntityType: 'project',
        targetEntityId: PROJECT_ID,
        status: 'active',
      }),
    );

    expect(links).toHaveLength(1);
    expect(links[0].sourceContactId).toBe(CONTACT_ID);
  });

  it('shape B — contact side: companyId + sourceContactId + status', async () => {
    // `useContactEntityLinks` → "which projects is this contact on?"
    await seedThroughService();

    const links = await withPersona(env, 'same_tenant_user', () =>
      listContactLinks({
        companyId: SAME_TENANT_COMPANY_ID,
        sourceContactId: CONTACT_ID,
        status: 'active',
      }),
    );

    expect(links).toHaveLength(1);
    expect(links[0].targetEntityId).toBe(PROJECT_ID);
  });

  it('neither shape needs a composite index the project does not declare', async () => {
    // ADR-745 §2.2 proved this statically by enumerating call sites. The
    // emulator is the dynamic witness: it raises FAILED_PRECONDITION for a
    // query with no index, so a green run here is the executable half of that
    // argument. Both shapes in one test — the claim is about the pair.
    await seedThroughService();

    await expect(
      withPersona(env, 'same_tenant_user', async () => {
        await listContactLinks({
          companyId: SAME_TENANT_COMPANY_ID,
          targetEntityType: 'project',
          targetEntityId: PROJECT_ID,
          status: 'active',
        });
        await listContactLinks({
          companyId: SAME_TENANT_COMPANY_ID,
          sourceContactId: CONTACT_ID,
          status: 'active',
        });
      }),
    ).resolves.not.toThrow();
  });

  it('refuses a list query that leaves the tenant unpinned', async () => {
    // The guard `listContactLinks` gained in G6. Rules are not filters: without
    // this, the rule rejects the *whole* query and the screen shows a load
    // error rather than an empty list.
    await expect(
      withPersona(env, 'same_tenant_user', () =>
        listContactLinks({ companyId: '', sourceContactId: CONTACT_ID }),
      ),
    ).rejects.toThrow(/companyId is required/);
  });
});

describe('contact_links — tenant isolation holds on the live read path', () => {
  let env: RulesTestEnvironment;

  beforeAll(async () => { env = await initEmulator(); });
  afterAll(async () => { await teardownEmulator(env); });
  afterEach(async () => { await resetData(env); });

  it('does not surface another tenant\'s link in either shape', async () => {
    // Written by the cross-tenant persona through the same production path, so
    // the document is as real as ours — the only difference is who owns it.
    await withPersona(env, 'cross_tenant_user', () =>
      linkContactToEntity(
        workerLinkInput({
          companyId: CROSS_TENANT_COMPANY_ID,
          createdBy: PERSONA_CLAIMS.cross_tenant_user.uid,
        }),
      ),
    );

    const ours = await withPersona(env, 'same_tenant_user', () =>
      listContactLinks({
        companyId: SAME_TENANT_COMPANY_ID,
        targetEntityType: 'project',
        targetEntityId: PROJECT_ID,
        status: 'active',
      }),
    );

    expect(ours).toHaveLength(0);
    // ...and the foreign document really does exist — otherwise the empty
    // result above would be vacuous.
    expect(await readRaw(env, 'contact_links', EXPECTED_LINK_ID)).toMatchObject({
      companyId: CROSS_TENANT_COMPANY_ID,
    });
  });

  // 🔴 The two cases below were ADDED after mutation M8 SURVIVED.
  //
  // M8 replaced the read gate with `|| true` — any authenticated caller may
  // read any link — and the suite stayed green. The test above could not see
  // it: it asserts on what a *correctly filtered query* returns, and a query
  // scoped to `company-a` omits `company-b` documents no matter what the rules
  // say. It was proving the filter, not the guard.
  //
  // This is "rules are not filters" read backwards, and it is the exact shape
  // of the ADR-745 Q2 mistake (a matrix that asserted the hole was expected
  // behaviour). A guard is only witnessed by a request that the *filter* would
  // happily serve and the *rule* must refuse — i.e. a caller who asks for
  // someone else's tenant on purpose.

  it('denies a point read of another tenant\'s link', async () => {
    await withPersona(env, 'cross_tenant_user', () =>
      linkContactToEntity(
        workerLinkInput({
          companyId: CROSS_TENANT_COMPANY_ID,
          createdBy: PERSONA_CLAIMS.cross_tenant_user.uid,
        }),
      ),
    );

    // The document exists and the id is deterministic, so nothing but the rule
    // stands between the caller and the data.
    //
    // `assertFails` rather than `.rejects.toThrow(/permission/)`: the emulator
    // puts the rules trace in `message` and the verdict in `code`, so matching
    // on message text passes for any failure at all — including the write above
    // never happening. `assertFails` checks `code === 'permission-denied'`.
    await assertFails(
      withPersona(env, 'same_tenant_user', () => getContactLinkById(EXPECTED_LINK_ID)),
    );
  });

  it('denies a list query that asks for another tenant outright', async () => {
    await withPersona(env, 'cross_tenant_user', () =>
      linkContactToEntity(
        workerLinkInput({
          companyId: CROSS_TENANT_COMPANY_ID,
          createdBy: PERSONA_CLAIMS.cross_tenant_user.uid,
        }),
      ),
    );

    // A well-formed query for a tenant the caller does not belong to. The
    // service-level guard only checks that `companyId` is non-empty, so this
    // reaches Firestore intact — the deny has to come from the rule.
    await assertFails(
      withPersona(env, 'same_tenant_user', () =>
        listContactLinks({
          companyId: CROSS_TENANT_COMPANY_ID,
          targetEntityType: 'project',
          targetEntityId: PROJECT_ID,
          status: 'active',
        }),
      ),
    );
  });
});

describe('contact_links — the link lifecycle closes', () => {
  let env: RulesTestEnvironment;

  beforeAll(async () => { env = await initEmulator(); });
  afterAll(async () => { await teardownEmulator(env); });
  afterEach(async () => { await resetData(env); });

  async function seedThroughService(): Promise<void> {
    const result = await withPersona(env, 'same_tenant_user', () =>
      linkContactToEntity(workerLinkInput()),
    );
    if (!result.success) throw new Error(`seed failed: ${result.error ?? 'unknown'}`);
  }

  it('soft-deletes to status inactive, verified in the database', async () => {
    await seedThroughService();

    const result = await withPersona(env, 'same_tenant_user', () =>
      unlinkContact(EXPECTED_LINK_ID, CREATOR),
    );

    expect(result.success).toBe(true);
    expect(await readRaw(env, 'contact_links', EXPECTED_LINK_ID)).toMatchObject({
      status: 'inactive',
      updatedBy: CREATOR,
    });
  });

  it('drops the link out of the active read shape once removed', async () => {
    await seedThroughService();
    await withPersona(env, 'same_tenant_user', () => unlinkContact(EXPECTED_LINK_ID, CREATOR));

    const links = await withPersona(env, 'same_tenant_user', () =>
      listContactLinks({
        companyId: SAME_TENANT_COMPANY_ID,
        targetEntityType: 'project',
        targetEntityId: PROJECT_ID,
        status: 'active',
      }),
    );

    expect(links).toHaveLength(0);
  });

  it('is idempotent — linking twice yields one document', async () => {
    await seedThroughService();
    const second = await withPersona(env, 'same_tenant_user', () =>
      linkContactToEntity(workerLinkInput()),
    );

    expect(second).toMatchObject({ success: true, linkId: EXPECTED_LINK_ID });

    const links = await withPersona(env, 'same_tenant_user', () =>
      listContactLinks({
        companyId: SAME_TENANT_COMPANY_ID,
        sourceContactId: CONTACT_ID,
        status: 'active',
      }),
    );
    expect(links).toHaveLength(1);
  });

  it('reactivates an inactive link rather than creating a duplicate', async () => {
    await seedThroughService();
    await withPersona(env, 'same_tenant_user', () => unlinkContact(EXPECTED_LINK_ID, CREATOR));

    const again = await withPersona(env, 'same_tenant_user', () =>
      linkContactToEntity(workerLinkInput()),
    );

    expect(again).toMatchObject({ success: true, linkId: EXPECTED_LINK_ID });
    expect(await readRaw(env, 'contact_links', EXPECTED_LINK_ID)).toMatchObject({
      status: 'active',
    });
  });

  it('does not let a colleague deactivate someone else\'s link', async () => {
    // The UPDATE rule is creator-bound. `removeLink` in the hook only checks
    // `user` is present, so this deny comes entirely from the rules layer.
    await seedThroughService();

    const result = await withPersona(env, 'same_tenant_admin', () =>
      unlinkContact(EXPECTED_LINK_ID, PERSONA_CLAIMS.same_tenant_admin.uid),
    );

    expect(result.success).toBe(false);
    expect(await readRaw(env, 'contact_links', EXPECTED_LINK_ID)).toMatchObject({
      status: 'active',
    });
  });
});

describe('contact_links — side effects fire on the real path', () => {
  let env: RulesTestEnvironment;

  beforeAll(async () => { env = await initEmulator(); });
  afterAll(async () => { await teardownEmulator(env); });
  afterEach(async () => { await resetData(env); });

  it('records an audit-trail entry naming the linked entity', async () => {
    await withPersona(env, 'same_tenant_user', () => linkContactToEntity(workerLinkInput()));

    const audit = recordedFetches().find((f) => f.url === API_ROUTES.AUDIT_TRAIL.RECORD);

    expect(audit).toBeDefined();
    expect(audit?.body).toMatchObject({
      entityType: 'project',
      entityId: PROJECT_ID,
      action: 'linked',
    });
  });

  it('dispatches CONTACT_LINK_CREATED so open screens refresh', async () => {
    // `useContactLinkRealtimeRefresh` subscribes to this event; it was
    // extracted during G6 with zero coverage. Listening on `window` directly
    // rather than through RealtimeService keeps the assertion on the wire
    // format both sides actually share.
    const seen: unknown[] = [];
    const onCreated = (e: Event) => seen.push((e as CustomEvent).detail);
    window.addEventListener(REALTIME_EVENTS.CONTACT_LINK_CREATED, onCreated);

    try {
      await withPersona(env, 'same_tenant_user', () => linkContactToEntity(workerLinkInput()));
    } finally {
      window.removeEventListener(REALTIME_EVENTS.CONTACT_LINK_CREATED, onCreated);
    }

    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({
      linkId: EXPECTED_LINK_ID,
      link: { sourceContactId: CONTACT_ID, targetEntityId: PROJECT_ID },
    });
  });
});
