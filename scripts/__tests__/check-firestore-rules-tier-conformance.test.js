/**
 * CHECK 3.16 — BIM tier-conformance validator (ADR-657) Jest suite.
 *
 * Google-level presubmit-grade tests for the tier ratchet added to
 * scripts/check-firestore-rules-test-coverage.js. Follows the conventions of
 * scripts/__tests__/check-ssot-discover-ratchet.test.js — pure functions and
 * validators are tested directly against in-memory fixtures, and a final
 * integration leg re-proves the REAL deployed firestore.rules against the REAL
 * bim-tiers.ts (the same thing `--all` does at pre-commit time).
 *
 * The validator consumes RuleBlock[] from the shared parser, so fixtures are
 * built by running the real parser over synthesized rule text — never by
 * hand-mocking block internals, which would let the parser and validator drift.
 */

'use strict';

const path = require('node:path');

const SCRIPT_UNDER_TEST = path.resolve(
  __dirname,
  '..',
  'check-firestore-rules-test-coverage.js',
);
const PARSER = path.resolve(__dirname, '..', '_shared', 'firestore-rules-parser.js');

const {
  parseBimTiers,
  validateBimTierConformance,
  extractAllowExpr,
  extractCreateKeys,
  keyListsEqual,
  isBimFloorplanBlock,
  tierOf,
} = require(SCRIPT_UNDER_TEST);

const { parseFirestoreRules } = require(PARSER);

// ---------------------------------------------------------------------------
// Fixture builders — synthesize rule text, then parse it for real.
// ---------------------------------------------------------------------------

/**
 * @param {string} collection
 * @param {{ read: string, create: string, update: string, del: string }} legs
 */
function block(collection, legs) {
  return [
    `    match /${collection}/{id} {`,
    `      allow read: if isAuthenticated() && ${legs.read};`,
    `      allow create: if isAuthenticated() && ${legs.create};`,
    `      allow update: if isAuthenticated() && ${legs.update};`,
    `      allow delete: if isAuthenticated() && ${legs.del};`,
    `    }`,
    ``,
  ].join('\n');
}

function buildFixture(...blockTexts) {
  const rules = blockTexts.join('\n');
  return { rules, rulesLines: rules.split('\n'), blocks: parseFirestoreRules(rules) };
}

function runValidator(tiers, ...blockTexts) {
  const { rulesLines, blocks } = buildFixture(...blockTexts);
  return validateBimTierConformance(blocks, tiers, rulesLines);
}

// A small but representative tier SSoT covering all three categories.
const TIERS = {
  authoring: [
    {
      collection: 'floorplan_roofs',
      requiredKeys: ['companyId', 'projectId', 'floorplanId', 'kind', 'params'],
    },
    { collection: 'floorplan_grid_guides', requiredKeys: ['companyId', 'projectId', 'floorplanId', 'guides'] },
    { collection: 'floorplan_topo_surfaces', requiredKeys: ['companyId', 'projectId', 'floorplanId'] },
  ],
  presentation: [
    {
      collection: 'floorplan_walls',
      requiredKeys: ['companyId', 'projectId', 'floorplanId', 'kind', 'params'],
    },
    { collection: 'floorplan_backgrounds', requiredKeys: null },
    { collection: 'floorplans', requiredKeys: null },
  ],
  legacy: ['floorplans'],
};

// Conformant legs per category.
const ROOFS_OK = block('floorplan_roofs', {
  read: 'canReadBimAuthoring(resource.data.companyId)',
  create: "canCreateBimEntity(['companyId', 'projectId', 'floorplanId', 'kind', 'params'])",
  update: 'canUpdateBimEntity()',
  del: 'canDeleteBimEntity()',
});
const WALLS_OK = block('floorplan_walls', {
  read: 'canReadBimPresentation(resource.data.companyId)',
  create: "canCreateBimEntity(['companyId', 'projectId', 'floorplanId', 'kind', 'params'])",
  update: 'canUpdateBimEntity()',
  del: 'canDeleteBimEntity()',
});
const BACKGROUNDS_OK = block('floorplan_backgrounds', {
  read: 'canReadBimPresentation(resource.data.companyId)',
  // bespoke inline create with the LEGITIMATE self-attribution form.
  create:
    '( isSuperAdminOnly() || ( isInternalUser() && request.resource.data.companyId == getUserCompanyId() && request.resource.data.createdBy == request.auth.uid ) )',
  // update with the LEGITIMATE immutability form (createdBy == resource.data.createdBy).
  update:
    'isBimWriter(resource.data.companyId) && request.resource.data.createdBy == resource.data.createdBy',
  del: 'isBimWriter(resource.data.companyId)',
});
const FLOORPLANS_OK = block('floorplans', {
  read: 'canReadLegacyFloorplan()',
  create: 'canCreateLegacyFloorplan()',
  update: 'canWriteLegacyFloorplan()',
  del: 'isBimWriter(resource.data.companyId)',
});

function kindsOf(violations) {
  return violations.map((v) => v.kind);
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

describe('pure helpers', () => {
  test('isBimFloorplanBlock matches floorplan_* and *floorplans, rejects others', () => {
    expect(isBimFloorplanBlock('floorplan_roofs')).toBe(true);
    expect(isBimFloorplanBlock('floorplan_backgrounds')).toBe(true);
    expect(isBimFloorplanBlock('project_floorplans')).toBe(true);
    expect(isBimFloorplanBlock('floorplans')).toBe(true);
    expect(isBimFloorplanBlock('layers')).toBe(false);
    expect(isBimFloorplanBlock('entity_audit_trail')).toBe(false);
  });

  test('keyListsEqual is order-insensitive and length-sensitive', () => {
    expect(keyListsEqual(['a', 'b', 'c'], ['c', 'a', 'b'])).toBe(true);
    expect(keyListsEqual(['a', 'b'], ['a', 'b', 'c'])).toBe(false);
    expect(keyListsEqual(['a', 'b'], ['a', 'x'])).toBe(false);
  });

  test('extractCreateKeys parses the hasAll list; null when absent', () => {
    expect(
      extractCreateKeys("isAuthenticated() && canCreateBimEntity(['companyId', 'projectId', 'kind'])"),
    ).toEqual(['companyId', 'projectId', 'kind']);
    expect(extractCreateKeys('canCreateLegacyFloorplan()')).toBeNull();
  });

  test('extractAllowExpr pulls the requested op, comments stripped', () => {
    const body = [
      '    match /x/{id} {',
      '      // a comment with allow update: fake',
      '      allow read: if isAuthenticated() && canReadBimAuthoring(x);',
      '      allow update: if isAuthenticated() && canUpdateBimEntity();',
      '    }',
    ].join('\n');
    expect(extractAllowExpr(body, 'update')).toBe(
      'isAuthenticated() && canUpdateBimEntity()',
    );
    expect(extractAllowExpr(body, 'delete')).toBeNull();
  });

  test('tierOf resolves membership', () => {
    expect(tierOf('floorplan_roofs', TIERS)).toBe('authoring');
    expect(tierOf('floorplan_walls', TIERS)).toBe('presentation');
    expect(tierOf('floorplan_unknown', TIERS)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// validateBimTierConformance — the ratchet
// ---------------------------------------------------------------------------

describe('validateBimTierConformance', () => {
  test('correct fixture (all 3 categories) passes with zero violations', () => {
    const violations = runValidator(TIERS, ROOFS_OK, WALLS_OK, BACKGROUNDS_OK, FLOORPLANS_OK);
    expect(violations).toEqual([]);
  });

  test('non-BIM blocks are ignored entirely', () => {
    const layers = block('layers', {
      read: 'belongsToCompany(resource.data.companyId)',
      create: 'true',
      update: 'true',
      del: 'true',
    });
    expect(runValidator(TIERS, layers)).toEqual([]);
  });

  test('(a) untiered block fails with untiered_bim_block', () => {
    const orphan = block('floorplan_unknown', {
      read: 'canReadBimAuthoring(resource.data.companyId)',
      create: "canCreateBimEntity(['companyId'])",
      update: 'canUpdateBimEntity()',
      del: 'canDeleteBimEntity()',
    });
    const violations = runValidator(TIERS, orphan);
    expect(kindsOf(violations)).toEqual(['untiered_bim_block']);
  });

  test('(a) double-tiered block fails with double_tiered_bim_block', () => {
    const tiers = {
      authoring: [{ collection: 'floorplan_walls', requiredKeys: ['companyId'] }],
      presentation: [{ collection: 'floorplan_walls', requiredKeys: ['companyId'] }],
      legacy: [],
    };
    const violations = runValidator(tiers, WALLS_OK);
    expect(kindsOf(violations)).toContain('double_tiered_bim_block');
  });

  test('(b) wrong-tier read helper fails', () => {
    const roofsWrongRead = block('floorplan_roofs', {
      read: 'canReadBimPresentation(resource.data.companyId)', // should be authoring
      create: "canCreateBimEntity(['companyId', 'projectId', 'floorplanId', 'kind', 'params'])",
      update: 'canUpdateBimEntity()',
      del: 'canDeleteBimEntity()',
    });
    const violations = runValidator(TIERS, roofsWrongRead);
    expect(kindsOf(violations)).toContain('wrong_read_helper');
  });

  test('(c) drifted requiredKeys fails with drifted_create_keys', () => {
    const roofsDrift = block('floorplan_roofs', {
      read: 'canReadBimAuthoring(resource.data.companyId)',
      create: "canCreateBimEntity(['companyId', 'projectId', 'floorplanId', 'kind'])", // missing 'params'
      update: 'canUpdateBimEntity()',
      del: 'canDeleteBimEntity()',
    });
    const violations = runValidator(TIERS, roofsDrift);
    expect(kindsOf(violations)).toContain('drifted_create_keys');
  });

  test('(c) legacy container missing canCreateLegacyFloorplan fails', () => {
    const legacyWrong = block('floorplans', {
      read: 'canReadLegacyFloorplan()',
      create: "canCreateBimEntity(['companyId'])", // should be legacy helper
      update: 'canWriteLegacyFloorplan()',
      del: 'isBimWriter(resource.data.companyId)',
    });
    const violations = runValidator(TIERS, legacyWrong);
    expect(kindsOf(violations)).toContain('wrong_create_helper');
  });

  test('(d) ownership OR-leg in UPDATE fails with ownership_write_leg', () => {
    const roofsOwnership = block('floorplan_roofs', {
      read: 'canReadBimAuthoring(resource.data.companyId)',
      create: "canCreateBimEntity(['companyId', 'projectId', 'floorplanId', 'kind', 'params'])",
      update: 'canUpdateBimEntity() || resource.data.createdBy == request.auth.uid',
      del: 'canDeleteBimEntity()',
    });
    const violations = runValidator(TIERS, roofsOwnership);
    expect(kindsOf(violations)).toContain('ownership_write_leg');
  });

  test('(d) ownership OR-leg in DELETE fails with ownership_write_leg', () => {
    const roofsOwnershipDel = block('floorplan_roofs', {
      read: 'canReadBimAuthoring(resource.data.companyId)',
      create: "canCreateBimEntity(['companyId', 'projectId', 'floorplanId', 'kind', 'params'])",
      update: 'canUpdateBimEntity()',
      del: 'canDeleteBimEntity() || resource.data.createdBy == request.auth.uid',
    });
    const violations = runValidator(TIERS, roofsOwnershipDel);
    expect(kindsOf(violations)).toContain('ownership_write_leg');
  });

  test('(d) the two legitimate createdBy forms do NOT fire ownership_write_leg', () => {
    // BACKGROUNDS_OK carries BOTH legitimate forms:
    //   - create body: request.resource.data.createdBy == request.auth.uid (self-attribution, create-only)
    //   - update body: request.resource.data.createdBy == resource.data.createdBy (immutability)
    const violations = runValidator(TIERS, BACKGROUNDS_OK);
    expect(kindsOf(violations)).not.toContain('ownership_write_leg');
    expect(violations).toEqual([]);
  });

  test('(d) immutability form alone on an entity update does NOT fire', () => {
    const roofsImmutable = block('floorplan_roofs', {
      read: 'canReadBimAuthoring(resource.data.companyId)',
      create: "canCreateBimEntity(['companyId', 'projectId', 'floorplanId', 'kind', 'params'])",
      update: 'canUpdateBimEntity() && request.resource.data.createdBy == resource.data.createdBy',
      del: 'canDeleteBimEntity()',
    });
    const violations = runValidator(TIERS, roofsImmutable);
    expect(kindsOf(violations)).not.toContain('ownership_write_leg');
  });

  test('(e) wrong update write helper fails with wrong_write_helper', () => {
    const roofsWrongWrite = block('floorplan_roofs', {
      read: 'canReadBimAuthoring(resource.data.companyId)',
      create: "canCreateBimEntity(['companyId', 'projectId', 'floorplanId', 'kind', 'params'])",
      update: 'isBimWriter(resource.data.companyId)', // entity should use canUpdateBimEntity()
      del: 'canDeleteBimEntity()',
    });
    const violations = runValidator(TIERS, roofsWrongWrite);
    expect(kindsOf(violations)).toContain('wrong_write_helper');
  });
});

// ---------------------------------------------------------------------------
// parseBimTiers — against the REAL bim-tiers.ts
// ---------------------------------------------------------------------------

describe('parseBimTiers (real SSoT)', () => {
  const tiers = parseBimTiers();

  // ADR-683 Φ3β — 22→23 authoring: + floorplan_imported_meshes.
  // ADR-684 — 23→24 authoring: + floorplan_generic_solids.
  test('parses 24 authoring / 14 presentation / 5 legacy', () => {
    expect(tiers.authoring).toHaveLength(24);
    expect(tiers.presentation).toHaveLength(14);
    expect(tiers.legacy).toHaveLength(5);
  });

  test('requiredKeys shapes are captured (array vs null)', () => {
    const roofs = tiers.authoring.find((e) => e.collection === 'floorplan_roofs');
    expect(roofs.requiredKeys).toEqual(['companyId', 'projectId', 'floorplanId', 'kind', 'params']);
    const topo = tiers.authoring.find((e) => e.collection === 'floorplan_topo_surfaces');
    expect(topo.requiredKeys).toEqual(['companyId', 'projectId', 'floorplanId']);
    const backgrounds = tiers.presentation.find((e) => e.collection === 'floorplan_backgrounds');
    expect(backgrounds.requiredKeys).toBeNull();
    const floorplans = tiers.presentation.find((e) => e.collection === 'floorplans');
    expect(floorplans.requiredKeys).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Integration — REAL firestore.rules vs REAL bim-tiers.ts (mirrors --all)
// ---------------------------------------------------------------------------

describe('deployed rules integration', () => {
  const fs = require('node:fs');
  const RULES_FILE = path.resolve(__dirname, '..', '..', 'firestore.rules');

  // ADR-683 Φ3β — 36→37 blocks: + floorplan_imported_meshes.
  // ADR-684 — 37→38 blocks: + floorplan_generic_solids.
  test('all 38 deployed BIM blocks are tier-conformant', () => {
    const rulesContent = fs.readFileSync(RULES_FILE, 'utf8');
    const rulesLines = rulesContent.split('\n');
    const blocks = parseFirestoreRules(rulesContent);
    const tiers = parseBimTiers();

    const bimBlockCount = blocks.filter((b) => isBimFloorplanBlock(b.collection)).length;
    expect(bimBlockCount).toBe(38);

    const violations = validateBimTierConformance(blocks, tiers, rulesLines);
    if (violations.length > 0) {
      // Surface the details if this ever regresses.
      // eslint-disable-next-line no-console
      console.error(JSON.stringify(violations, null, 2));
    }
    expect(violations).toEqual([]);
  });
});
