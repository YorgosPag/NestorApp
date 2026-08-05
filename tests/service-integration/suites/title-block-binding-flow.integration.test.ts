/**
 * ΤΟ ΚΛΙΚ — `approveTitleBlockProposal` against live `firestore.rules` on a real
 * emulator (ADR-745 §0, the acceptance criterion of Φ3β).
 *
 * ## What this suite exists to answer
 *
 * Φ3β shipped 27 files and **688 green tests**, and `title_block_bindings` held
 * **0 documents**. That is not a contradiction — it is the ADR's own recurring
 * failure, recorded five times: every one of those tests mocks Firestore, so
 * "the approval writes a binding" had been asserted by nobody. The sibling
 * suite (`contact-links-flow`) was built for exactly this reason one phase
 * earlier, and it found that the flow was not merely unexercised but
 * **structurally impossible** (§9.4). Φ3β is built on top of that flow.
 *
 * So the criterion is a **row in the database**, produced by production code,
 * under real rules, by a real `company_admin` — and it has to be an artifact
 * that re-runs, because a human clicking once proves the state of one
 * afternoon.
 *
 * ## Why `same_tenant_admin` and never `super_admin`
 *
 * The CREATE rule has a `isSuperAdminOnly()` leg that bypasses the tenant
 * check. Approving as super_admin would exercise the bypass and report success
 * for a path no ordinary user can walk — the §3 step-1 warning ("**ποτέ
 * super_admin**: αυτό ήταν όλο το νόημα") turned into an executable constraint.
 *
 * ## Why the fixture names carry a slash
 *
 * «ΜΑΥΡΟΜΙΧΑΛΗΣ ΚΩΝ/ΝΟΣ» is verbatim from the real `G753_ergasia F.dxf` sample,
 * and `/` is **illegal in a Firestore document id**. The name is not decoration:
 * it is the only reason `encodeKeySegment` exists, and a suite that used a tidy
 * ASCII name would leave that guard unwitnessed.
 *
 * @see tests/service-integration/_harness/firestore-seam.ts (the single seam)
 * @see ADR-745 §0, §3 (the scenario), §6.2 (the deterministic key)
 */

import { assertFails } from '@firebase/rules-unit-testing';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

import { initEmulator, teardownEmulator, resetData } from '../../firestore-rules/_harness/emulator';
import {
  PERSONA_CLAIMS,
  SAME_TENANT_COMPANY_ID,
  CROSS_TENANT_COMPANY_ID,
} from '../../firestore-rules/_registry/personas';
import { withPersona, readRaw, listRaw } from '../_harness/firestore-seam';

// The single seam: production code keeps its own import of `@/lib/firebase`,
// but the handle it receives is the emulator client bound to the acting persona.
jest.mock('@/lib/firebase', () => require('../_harness/firestore-seam').firebaseSeam);

import { approveTitleBlockProposal } from '@/services/title-block-apply';
import {
  listTitleBlockBindings,
  getTitleBlockBindingById,
} from '@/services/title-block-binding.service';
import { buildTitleBlockBindingKey } from '@/lib/title-block-binding-id';
import { buildContactLinkId } from '@/services/contact-link.service';
import { COLLECTIONS } from '@/config/firestore-collections';
import type {
  BindingProposal,
  BindingTarget,
  TitleBlockBinding,
} from '@/types/title-block-binding';
import type { ProjectRole } from '@/types/entity-associations';

const BINDINGS = COLLECTIONS.TITLE_BLOCK_BINDINGS;
const LINKS = COLLECTIONS.CONTACT_LINKS;

/** The human who clicks. A company admin — the §0 criterion names the role. */
const ADMIN = PERSONA_CLAIMS.same_tenant_admin.uid;
const COLLEAGUE = PERSONA_CLAIMS.same_tenant_user.uid;

const FILE_RECORD_ID = 'file_g753';
const LEVEL_ID = 'level_ground';
const LAYER = 'PINAKAKI 500';
const PROJECT_ID = 'proj_g753';

/** Verbatim from the sample — the slash is the point (see file header). */
const SURVEYOR_NAME = 'ΜΑΥΡΟΜΙΧΑΛΗΣ ΚΩΝ/ΝΟΣ';
const ENGINEER_NAME = 'ΝΙΚΟΛΑΟΥ ΕΥ. ΙΩΑΝΝΗΣ';

const SURVEYOR_CONTACT = 'cont_mavromichalis';
const ENGINEER_CONTACT = 'cont_nikolaou';

/**
 * The `designers` cell of the sample — **one** cell that yields **two** people.
 *
 * Both proposals therefore share `sourceHandle` and `at`; only `personName`
 * differs. That is not a convenience of the fixture, it is the shape that made
 * cell-scoped supersede a data-loss bug (§2 defect α) — encoded here so a
 * future narrowing of the slot axis fails loudly.
 */
function designerProposal(personName: string): BindingProposal {
  return {
    fieldKey: 'designers',
    titleBlockIndex: 0,
    sourceHandle: 'mtext_7',
    labelHandle: 'mtext_6',
    at: { x: 1234.567, y: -89.001 },
    snapshotValue: `${SURVEYOR_NAME} / ${ENGINEER_NAME}`,
    personName,
    candidates: [],
  };
}

function contactTarget(contactId: string, role: ProjectRole): BindingTarget {
  return { kind: 'contact', contactId, role, projectId: PROJECT_ID };
}

const SURVEYOR = {
  proposal: designerProposal(SURVEYOR_NAME),
  target: contactTarget(SURVEYOR_CONTACT, 'surveyor'),
} as const;

const ENGINEER = {
  proposal: designerProposal(ENGINEER_NAME),
  target: contactTarget(ENGINEER_CONTACT, 'structural_engineer'),
} as const;

/**
 * Ο.Τ. → `Project.buildingBlock` — the one writable target that reaches the binding write
 * without a Firestore guard of its own in front of it.
 *
 * `applyProjectFieldTarget` PATCHes over HTTP and takes no snapshot read, so in this
 * process it always succeeds. That makes it the only vehicle for asking questions about
 * the `title_block_bindings` rules **through the real dispatcher** — every contact-shaped
 * target is refused upstream by `contact_links`' own rules before the binding is attempted.
 */
const BUILDING_BLOCK = {
  proposal: {
    fieldKey: 'location',
    titleBlockIndex: 0,
    sourceHandle: 'mtext_4',
    labelHandle: 'mtext_3',
    at: { x: 900.25, y: -42.5 },
    snapshotValue: 'Ο.Τ. 42',
    candidates: [],
  } satisfies BindingProposal,
  target: {
    kind: 'project-field',
    projectId: PROJECT_ID,
    field: 'buildingBlock',
    value: 'Ο.Τ. 42',
  } satisfies BindingTarget,
} as const;

/** The payload `useTitleBlockApproval` builds when the human clicks Approve. */
function approvalInput(
  which: { proposal: BindingProposal; target: BindingTarget },
  overrides: {
    userId?: string;
    companyId?: string;
    existingBindings?: Parameters<typeof approveTitleBlockProposal>[0]['existingBindings'];
  } = {},
) {
  return {
    proposal: which.proposal,
    target: which.target,
    fileRecordId: FILE_RECORD_ID,
    levelId: LEVEL_ID,
    layerName: LAYER,
    ctx: {
      userId: overrides.userId ?? ADMIN,
      companyId: overrides.companyId ?? SAME_TENANT_COMPANY_ID,
      snapshotValue: which.proposal.personName ?? '',
    },
    existingBindings: overrides.existingBindings ?? [],
  };
}

const keyOf = (which: { proposal: BindingProposal; target: BindingTarget }) =>
  buildTitleBlockBindingKey({
    fileRecordId: FILE_RECORD_ID,
    levelId: LEVEL_ID,
    proposal: which.proposal,
    target: which.target,
  });

// ─────────────────────────────────────────────────────────────────────────────

describe('ΤΟ ΚΛΙΚ — the approval writes a binding, and the target it claims', () => {
  let env: RulesTestEnvironment;

  beforeAll(async () => { env = await initEmulator(); });
  afterAll(async () => { await teardownEmulator(env); });
  afterEach(async () => { await resetData(env); });

  it('takes title_block_bindings from 0 to 1 as a real company_admin', async () => {
    // The criterion of ADR-745 §0, stated as the count and not as the id: see
    // `listRaw` for why the difference is load-bearing.
    expect(await listRaw(env, BINDINGS)).toHaveLength(0);

    const result = await withPersona(env, 'same_tenant_admin', () =>
      approveTitleBlockProposal(approvalInput(SURVEYOR)),
    );

    // Asserting the shape rather than `.success === true`: the dispatcher has a
    // typed failure branch per stage, so a bare boolean would hide *which*
    // stage refused — the mistake the sibling suite documents at line 102.
    expect(result).toMatchObject({ success: true, bindingId: keyOf(SURVEYOR), supersededIds: [] });
    expect(await listRaw(env, BINDINGS)).toHaveLength(1);
  });

  it('lands the binding in the acting tenant, attributed to the human who clicked', async () => {
    await withPersona(env, 'same_tenant_admin', () =>
      approveTitleBlockProposal(approvalInput(SURVEYOR)),
    );

    const raw = await readRaw(env, BINDINGS, keyOf(SURVEYOR));

    expect(raw).toMatchObject({
      companyId: SAME_TENANT_COMPANY_ID,
      projectId: PROJECT_ID,
      fileRecordId: FILE_RECORD_ID,
      levelId: LEVEL_ID,
      layerName: LAYER,
      fieldKey: 'designers',
      status: 'active',
      confirmedBy: ADMIN,
    });
  });

  it('emits every field the CREATE rule names, as the type the rule asserts', async () => {
    // The rule calls `keys().hasAll([...])` and then `is string` on five of
    // them. A converter that dropped one would fail with a generic
    // permission-denied, so the contract is pinned explicitly.
    await withPersona(env, 'same_tenant_admin', () =>
      approveTitleBlockProposal(approvalInput(SURVEYOR)),
    );

    const raw = await readRaw(env, BINDINGS, keyOf(SURVEYOR));

    for (const required of [
      'companyId', 'projectId', 'fileRecordId', 'levelId', 'fieldKey', 'slot', 'status', 'confirmedBy',
    ]) {
      expect(Object.keys(raw ?? {})).toContain(required);
      expect(raw?.[required]).toEqual(expect.any(String));
    }
  });

  it('writes the TARGET too — a binding without its contact_link is a lie', async () => {
    // Γ9 in the database: the provenance document asserts that the target was
    // written. If only the binding existed, the collection would be evidence of
    // something that never happened — carrying a human's name.
    await withPersona(env, 'same_tenant_admin', () =>
      approveTitleBlockProposal(approvalInput(SURVEYOR)),
    );

    const linkId = buildContactLinkId(SURVEYOR_CONTACT, 'project', PROJECT_ID, 'surveyor');

    expect(await readRaw(env, LINKS, linkId)).toMatchObject({
      companyId: SAME_TENANT_COMPANY_ID,
      sourceContactId: SURVEYOR_CONTACT,
      targetEntityId: PROJECT_ID,
      role: 'surveyor',
      status: 'active',
      createdBy: ADMIN,
    });
  });

  it('survives the slash in the real name — key encoding is reversible', async () => {
    // «ΚΩΝ/ΝΟΣ» is an illegal Firestore id character. Without `encodeKeySegment`
    // the write throws inside the SDK; with a *lossy* normaliser it would
    // silently collide with «ΚΩΝ ΝΟΣ». Both failure modes are excluded by the
    // document simply existing under a key derived from the raw name.
    const result = await withPersona(env, 'same_tenant_admin', () =>
      approveTitleBlockProposal(approvalInput(SURVEYOR)),
    );

    expect(result).toMatchObject({ success: true });
    expect((result as { bindingId: string }).bindingId).not.toContain('/');
    expect(await readRaw(env, BINDINGS, keyOf(SURVEYOR))).not.toBeNull();
  });
});

describe('ΤΟ ΚΛΙΚ — repeating it does not duplicate, in the database', () => {
  let env: RulesTestEnvironment;

  beforeAll(async () => { env = await initEmulator(); });
  afterAll(async () => { await teardownEmulator(env); });
  afterEach(async () => { await resetData(env); });

  it('approving the same proposal twice yields exactly one binding', async () => {
    // Idempotency was argued from the deterministic key. This is the argument's
    // executable half: the key is only deterministic if *every* segment is, and
    // one non-deterministic segment (a counter, a timestamp, a `?? ''`) turns
    // the second click into a second document that no `readRaw` would notice.
    await withPersona(env, 'same_tenant_admin', () =>
      approveTitleBlockProposal(approvalInput(SURVEYOR)),
    );
    const second = await withPersona(env, 'same_tenant_admin', () =>
      approveTitleBlockProposal(approvalInput(SURVEYOR)),
    );

    expect(second).toMatchObject({ success: true, bindingId: keyOf(SURVEYOR) });
    expect(await listRaw(env, BINDINGS)).toHaveLength(1);
    expect(await listRaw(env, LINKS)).toHaveLength(1);
  });

  it('refuses a key it cannot build rather than inventing one', async () => {
    // `?? ''` here would produce a key the next load never reconstructs — a
    // second document for the same connection, forever. The guard must fire
    // BEFORE the target is written, or the refusal leaves a contact_link behind.
    const result = await withPersona(env, 'same_tenant_admin', () =>
      approveTitleBlockProposal({ ...approvalInput(SURVEYOR), fileRecordId: '' }),
    );

    expect(result).toMatchObject({ success: false, errorCode: 'INVALID_BINDING_KEY' });
    expect(await listRaw(env, BINDINGS)).toHaveLength(0);
    expect(await listRaw(env, LINKS)).toHaveLength(0);
  });
});

describe('ΤΟ ΚΛΙΚ — supersede is scoped to the slot, not to the cell', () => {
  let env: RulesTestEnvironment;

  beforeAll(async () => { env = await initEmulator(); });
  afterAll(async () => { await teardownEmulator(env); });
  afterEach(async () => { await resetData(env); });

  /** Approve, then hand the caller the drawing's bindings — what the palette holds. */
  async function approveAndReload(
    which: { proposal: BindingProposal; target: BindingTarget },
    existing: readonly TitleBlockBinding[],
  ) {
    const result = await withPersona(env, 'same_tenant_admin', () =>
      approveTitleBlockProposal(approvalInput(which, { existingBindings: existing })),
    );
    if (!result.success) throw new Error(`approve failed: ${result.error} (${result.errorCode})`);

    const reloaded = await withPersona(env, 'same_tenant_admin', () =>
      listTitleBlockBindings({
        companyId: SAME_TENANT_COMPANY_ID,
        fileRecordId: FILE_RECORD_ID,
        levelId: LEVEL_ID,
      }),
    );
    return { result, reloaded };
  }

  it('keeps BOTH people from one cell active — the α defect, in the database', async () => {
    // 🔴 This is the case that would have reached production. The two designers
    // share `fieldKey`, `sourceHandle` and `at`; a supersede scoped to the cell
    // marks the surveyor `superseded` the moment the engineer is approved, and
    // the screen shows one name where the drawing shows two.
    const first = await approveAndReload(SURVEYOR, []);
    const second = await approveAndReload(ENGINEER, first.reloaded);

    expect(second.result).toMatchObject({ supersededIds: [] });

    const stored = await listRaw(env, BINDINGS);
    expect(stored).toHaveLength(2);
    expect(stored.every((b) => b.status === 'active')).toBe(true);
  });

  it('retires the previous occupant when the SAME slot points somewhere else', async () => {
    // The correction case: same person-slot, different contact. Here supersede
    // must fire — otherwise two active bindings claim the same cell position.
    const first = await approveAndReload(SURVEYOR, []);

    const corrected = {
      proposal: SURVEYOR.proposal,
      target: contactTarget('cont_mavromichalis_correct', 'surveyor'),
    };
    const second = await approveAndReload(corrected, first.reloaded);

    expect(second.result).toMatchObject({ supersededIds: [keyOf(SURVEYOR)] });
    expect(await readRaw(env, BINDINGS, keyOf(SURVEYOR))).toMatchObject({ status: 'superseded' });
    expect(await readRaw(env, BINDINGS, keyOf(corrected))).toMatchObject({ status: 'active' });
  });

  it('does not delete the retired binding — provenance is withdrawn, never erased', async () => {
    const first = await approveAndReload(SURVEYOR, []);
    const corrected = {
      proposal: SURVEYOR.proposal,
      target: contactTarget('cont_someone_else', 'surveyor'),
    };
    await approveAndReload(corrected, first.reloaded);

    // Both documents survive: the database must be able to explain why it once
    // said something else.
    expect(await listRaw(env, BINDINGS)).toHaveLength(2);
  });
});

describe('ΤΟ ΚΛΙΚ — who may correct whom (the two deliberate rule deviations)', () => {
  let env: RulesTestEnvironment;

  beforeAll(async () => { env = await initEmulator(); });
  afterAll(async () => { await teardownEmulator(env); });
  afterEach(async () => { await resetData(env); });

  it('lets a colleague supersede a binding someone else confirmed', async () => {
    // Deviation 1 (§4): UPDATE is NOT creator-bound, unlike `contact_links`.
    // A binding is knowledge of the *company*; the creator-bound rule next door
    // is a recorded weakness (§9.1), not a template. Encoded so nobody
    // "harmonises" the two later without reading why.
    await withPersona(env, 'same_tenant_user', () =>
      approveTitleBlockProposal(approvalInput(SURVEYOR, { userId: COLLEAGUE })),
    );
    const existing = await withPersona(env, 'same_tenant_admin', () =>
      listTitleBlockBindings({
        companyId: SAME_TENANT_COMPANY_ID,
        fileRecordId: FILE_RECORD_ID,
        levelId: LEVEL_ID,
      }),
    );

    const corrected = {
      proposal: SURVEYOR.proposal,
      target: contactTarget('cont_corrected_by_admin', 'surveyor'),
    };
    const result = await withPersona(env, 'same_tenant_admin', () =>
      approveTitleBlockProposal(approvalInput(corrected, { existingBindings: existing })),
    );

    expect(result).toMatchObject({ success: true, supersededIds: [keyOf(SURVEYOR)] });
    expect(await readRaw(env, BINDINGS, keyOf(SURVEYOR))).toMatchObject({
      status: 'superseded',
      // What the deviation costs is bounded by this: the approver's name does
      // not move when a colleague retires the record.
      confirmedBy: COLLEAGUE,
    });
  });

  it('refuses a binding attributed to somebody else', async () => {
    // `confirmedBy == request.auth.uid` is the whole point of the collection: a
    // binding that cannot name its approver is worse than none, because it
    // looks like evidence. The service has no client-side check — the deny is
    // the rule's, and this is the only test that witnesses it.
    //
    // 🔴 It uses a `project-field` target, and that is NOT arbitrary. The first
    // version of this test used the contact target and PASSED WITH THE RULE
    // DELETED (mutation M4 survived): `applyContactTarget` runs first (Γ9) and
    // `contact_links` has its OWN creator-bound CREATE rule, so the flow died
    // one layer early and the binding write was never attempted. The test was
    // witnessing the neighbour's guard while claiming to witness this one —
    // the same "proving the filter, not the guard" shape that let M8 survive in
    // the sibling suite. A `project-field` target writes over HTTP, which this
    // process answers unconditionally, so execution actually reaches the
    // binding write and the rule is the only thing left to refuse it.
    const result = await withPersona(env, 'same_tenant_admin', () =>
      approveTitleBlockProposal(approvalInput(BUILDING_BLOCK, { userId: COLLEAGUE })),
    );

    expect(result).toMatchObject({ success: false });
    expect(await readRaw(env, BINDINGS, keyOf(BUILDING_BLOCK))).toBeNull();
  });

  it('never attempts a binding when the TARGET refuses first (Γ9, observable)', async () => {
    // The counterpart of the case above, kept because it is the reason that one
    // had to change: with a creator-bound target the refusal happens upstream,
    // and the ordering guarantees no provenance is written for a target that
    // was not. Asserting BOTH collections are empty is what makes "no ghost
    // provenance" a measurement rather than a comment.
    const result = await withPersona(env, 'same_tenant_admin', () =>
      approveTitleBlockProposal(approvalInput(SURVEYOR, { userId: COLLEAGUE })),
    );

    expect(result).toMatchObject({ success: false });
    expect(await listRaw(env, LINKS)).toHaveLength(0);
    expect(await listRaw(env, BINDINGS)).toHaveLength(0);
  });
});

describe('ΤΟ ΚΛΙΚ — tenant isolation on the live write and read paths', () => {
  let env: RulesTestEnvironment;

  beforeAll(async () => { env = await initEmulator(); });
  afterAll(async () => { await teardownEmulator(env); });
  afterEach(async () => { await resetData(env); });

  it('refuses to write a binding into another tenant', async () => {
    const result = await withPersona(env, 'same_tenant_admin', () =>
      approveTitleBlockProposal(approvalInput(SURVEYOR, { companyId: CROSS_TENANT_COMPANY_ID })),
    );

    expect(result).toMatchObject({ success: false });
    expect(await readRaw(env, BINDINGS, keyOf(SURVEYOR))).toBeNull();
  });

  it('denies a point read of another tenant\'s binding', async () => {
    // The id is deterministic and the document exists, so nothing but the rule
    // stands between the caller and the data — the shape that let mutation M8
    // survive in the sibling suite (a filtered query proves the filter, not the
    // guard). `assertFails` checks the verdict, not the message text.
    await withPersona(env, 'cross_tenant_admin', () =>
      approveTitleBlockProposal(
        approvalInput(SURVEYOR, {
          companyId: CROSS_TENANT_COMPANY_ID,
          userId: PERSONA_CLAIMS.cross_tenant_admin.uid,
        }),
      ),
    );

    // ...and it really is there, otherwise the deny below would be vacuous.
    expect(await readRaw(env, BINDINGS, keyOf(SURVEYOR))).toMatchObject({
      companyId: CROSS_TENANT_COMPANY_ID,
    });

    await assertFails(
      withPersona(env, 'same_tenant_admin', () => getTitleBlockBindingById(keyOf(SURVEYOR))),
    );
  });

  it('denies a list query that asks for another tenant outright', async () => {
    await assertFails(
      withPersona(env, 'same_tenant_admin', () =>
        listTitleBlockBindings({
          companyId: CROSS_TENANT_COMPANY_ID,
          fileRecordId: FILE_RECORD_ID,
          levelId: LEVEL_ID,
        }),
      ),
    );
  });

  it('refuses a list that leaves the tenant unpinned, before Firestore sees it', async () => {
    // Rules are not filters: an unpinned query is rejected WHOLE, so the screen
    // would show a load error rather than an empty list. The service throws
    // first, naming the cause.
    await expect(
      withPersona(env, 'same_tenant_admin', () =>
        listTitleBlockBindings({ companyId: '', fileRecordId: FILE_RECORD_ID, levelId: LEVEL_ID }),
      ),
    ).rejects.toThrow(/companyId is required/);
  });
});

describe('ΤΟ ΚΛΙΚ — what is deliberately NOT writable stays not writable', () => {
  let env: RulesTestEnvironment;

  beforeAll(async () => { env = await initEmulator(); });
  afterAll(async () => { await teardownEmulator(env); });
  afterEach(async () => { await resetData(env); });

  it('refuses drawing-meta with a named reason and leaves nothing behind', async () => {
    // §7: `DxfLevelDocument` has no landing field and `UpdateDxfLevelSchema` is
    // `.passthrough()`, so a write here would land unvalidated. The UI offers no
    // button; this is the guard for the day someone calls it programmatically.
    const metaTarget: BindingTarget = {
      kind: 'drawing-meta',
      levelId: LEVEL_ID,
      field: 'scale',
      value: '1:500',
    };
    // Built explicitly rather than spread-and-override: `personName` must be
    // ABSENT, not `undefined`, because `bindingSlot` branches on its
    // truthiness — and a spread that carried a stale name would silently take
    // the person branch and pass for the wrong reason.
    const metaProposal: BindingProposal = {
      fieldKey: 'scale',
      titleBlockIndex: 0,
      sourceHandle: 'mtext_11',
      labelHandle: 'mtext_10',
      at: { x: 1300.5, y: -120.25 },
      snapshotValue: '1:500',
      candidates: [],
    };

    const result = await withPersona(env, 'same_tenant_admin', () =>
      approveTitleBlockProposal(approvalInput({ proposal: metaProposal, target: metaTarget })),
    );

    expect(result).toMatchObject({ success: false, errorCode: 'NOT_YET_WRITABLE' });
    expect(await listRaw(env, BINDINGS)).toHaveLength(0);
  });
});
