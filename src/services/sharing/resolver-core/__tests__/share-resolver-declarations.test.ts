/**
 * Share resolver primitives + declaration anchor (ADR-699).
 *
 * The load-bearing tests here are the two that a future edit is most likely to
 * break silently:
 *
 *   1. **Projection leakage** — the hand-written resolvers each published one
 *      meta bag and omitted the other two by writing them out by hand.
 *      `buildSafePublicProjection` takes the bag as a parameter, so a wrong
 *      argument (or a spread "simplification") would put a contact's included
 *      fields on a file share. Pinned per surface.
 *
 *   2. **Declared key set** — the factory attaches `idField`/`titleField` with a
 *      computed key, which TypeScript cannot type without an assertion. These
 *      tests are what actually proves the assertion, by running the resolver.
 */

import fs from 'fs';
import path from 'path';

// ADR-884 Φ0.12: resolvers are pure projections now — no Firestore mock needed.
// The entity read and `canShare` moved to the server
// (`server/sharing/__tests__/share-entity-access.test.ts`).

// ---------------------------------------------------------------------------
// SUT
// ---------------------------------------------------------------------------

import { COLLECTIONS } from '@/config/firestore-collections';
import { ShareEntityRegistry } from '@/services/sharing/share-entity-registry';
import '@/services/sharing/resolvers';
import {
  buildingShowcaseShareResolver,
  parkingShowcaseShareResolver,
  projectShowcaseShareResolver,
  propertyShowcaseShareResolver,
  storageShowcaseShareResolver,
} from '@/services/sharing/resolvers/showcase-surfaces.resolvers';
import {
  buildSafePublicProjection,
  normalizeRegenTimestamp,
  pickFirstStringField,
  validateShareBaseInput,
} from '../share-resolver-primitives';
import type { CreateShareInput, ShareRecord } from '@/types/sharing';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const FULL_SHARE: ShareRecord = {
  id: 'share_1',
  entityType: 'property_showcase',
  entityId: 'prop_1',
  companyId: 'comp_1',
  createdBy: 'usr_1',
  createdAt: '2026-01-01T00:00:00.000Z',
  expiresAt: '2099-01-01T00:00:00.000Z',
  isActive: true,
  requiresPassword: false,
  maxAccesses: 10,
  accessCount: 3,
  note: 'hello',
  showcaseMeta: { pdfStoragePath: 'companies/comp_1/x.pdf', pdfRegeneratedAt: null },
  contactMeta: { includedFields: ['emails', 'phones'] },
  fileMeta: { mimeType: 'application/pdf', sizeBytes: 42 },
};

const BASE_INPUT: CreateShareInput = {
  entityType: 'property_showcase',
  entityId: 'prop_1',
  companyId: 'comp_1',
  createdBy: 'usr_1',
  showcaseMeta: { pdfStoragePath: 'companies/comp_1/x.pdf', pdfRegeneratedAt: null },
};

/**
 * A stored document carries more than `ShareRecord` admits (`tokenHash`,
 * `passwordHash`, legacy `token`) — the projection must not echo any of it.
 */
const LEAKY_SHARE = {
  ...FULL_SHARE,
  token: 'tok_1',
  tokenHash: 'HASHED-TOKEN',
  passwordHash: 'HASHED-SECRET',
};

// ===========================================================================
// buildSafePublicProjection
// ===========================================================================

describe('buildSafePublicProjection', () => {
  it.each([
    ['showcaseMeta', 'contactMeta', 'fileMeta'],
    ['contactMeta', 'showcaseMeta', 'fileMeta'],
    ['fileMeta', 'showcaseMeta', 'contactMeta'],
  ] as const)(
    'publishes %s and withholds the other two bags',
    (published, withheldA, withheldB) => {
      const projection = buildSafePublicProjection(FULL_SHARE, published);

      expect(projection[published]).toEqual(FULL_SHARE[published]);
      expect(withheldA in projection).toBe(false);
      expect(withheldB in projection).toBe(false);
    },
  );

  it('never carries tenant identity, the token or any hash', () => {
    const projection = buildSafePublicProjection(LEAKY_SHARE, 'showcaseMeta');

    for (const field of ['companyId', 'createdBy', 'passwordHash', 'tokenHash', 'token', 'id']) {
      expect(field in projection).toBe(false);
    }
    // The storage path is published on purpose (the PDF proxy needs it) and it
    // embeds the company id — so assert on keys, not on the serialised blob.
    expect(JSON.stringify(projection)).not.toContain('HASHED-SECRET');
    expect(JSON.stringify(projection)).not.toContain('HASHED-TOKEN');
    expect(JSON.stringify(projection)).not.toContain('usr_1');
  });

  it('emits exactly the key set the hand-written resolvers emitted', () => {
    const projection = buildSafePublicProjection(FULL_SHARE, 'fileMeta');

    expect(Object.keys(projection).sort()).toEqual([
      'accessCount', 'entityId', 'entityType', 'expiresAt', 'fileMeta',
      'isActive', 'maxAccesses', 'note', 'requiresPassword',
    ]);
  });

  it('normalises an absent bag and an absent note to null', () => {
    const bare = { ...FULL_SHARE, note: undefined, fileMeta: undefined };

    const projection = buildSafePublicProjection(bare, 'fileMeta');

    expect(projection.note).toBeNull();
    expect(projection.fileMeta).toBeNull();
  });
});

// ===========================================================================
// validateShareBaseInput
// ===========================================================================

describe('validateShareBaseInput', () => {
  const rules = { entityType: 'property_showcase', entityIdLabel: 'propertyId' } as const;

  it('accepts a complete input', () => {
    expect(validateShareBaseInput(BASE_INPUT, rules)).toEqual({ valid: true });
  });

  it('rejects an input addressed to another resolver', () => {
    expect(validateShareBaseInput({ ...BASE_INPUT, entityType: 'file' }, rules)).toEqual({
      valid: false,
      reason: 'Wrong resolver — expected entityType=property_showcase',
    });
  });

  it('names the entity in the id-required message', () => {
    expect(validateShareBaseInput({ ...BASE_INPUT, entityId: '   ' }, rules).reason)
      .toBe('propertyId required');
  });

  it.each([
    ['companyId', 'companyId required'],
    ['createdBy', 'createdBy required'],
  ] as const)('requires %s', (field, reason) => {
    expect(validateShareBaseInput({ ...BASE_INPUT, [field]: '' }, rules))
      .toEqual({ valid: false, reason });
  });

  it('reports the FIRST failure — messages reach the share dialog verbatim', () => {
    const broken = { ...BASE_INPUT, entityId: '', companyId: '', createdBy: '' };

    expect(validateShareBaseInput(broken, rules).reason).toBe('propertyId required');
  });
});

// ===========================================================================
// pickFirstStringField / normalizeRegenTimestamp
// ===========================================================================

describe('pickFirstStringField', () => {
  it('returns the first field present, in declaration order', () => {
    expect(pickFirstStringField({ name: 'N', title: 'T' }, ['title', 'name'])).toBe('T');
    expect(pickFirstStringField({ name: 'N', title: 'T' }, ['name', 'title'])).toBe('N');
  });

  it('skips a blank value instead of publishing an empty title', () => {
    expect(pickFirstStringField({ title: '   ', name: 'N' }, ['title', 'name'])).toBe('N');
  });

  it('returns null for a missing document or no matching field', () => {
    expect(pickFirstStringField(null, ['title'])).toBeNull();
    expect(pickFirstStringField({ code: 'C' }, ['title', 'name'])).toBeNull();
  });

  it('ignores a non-string value rather than coercing it', () => {
    expect(pickFirstStringField({ number: 7, code: 'C' }, ['number', 'code'])).toBe('C');
  });
});

describe('normalizeRegenTimestamp', () => {
  it('converts a Firestore Timestamp to ISO', () => {
    const ts = { toDate: () => new Date('2026-05-05T10:00:00.000Z') };

    expect(normalizeRegenTimestamp(ts)).toBe('2026-05-05T10:00:00.000Z');
  });

  it('passes an ISO string through', () => {
    expect(normalizeRegenTimestamp('2026-05-05T10:00:00.000Z')).toBe('2026-05-05T10:00:00.000Z');
  });

  it('returns null for absent values and for a toDate that throws', () => {
    expect(normalizeRegenTimestamp(null)).toBeNull();
    expect(normalizeRegenTimestamp(undefined)).toBeNull();
    expect(normalizeRegenTimestamp({ toDate: () => { throw new Error('bad'); } })).toBeNull();
  });
});

// ===========================================================================
// Showcase surfaces — live behaviour of the declarations
// ===========================================================================

const SURFACES = [
  {
    name: 'property',
    resolver: propertyShowcaseShareResolver,
    entityType: 'property_showcase',
    collection: COLLECTIONS.PROPERTIES,
    idField: 'propertyId',
    titleField: 'propertyTitle',
    titleDoc: { title: 'From title', name: 'From name' },
    expectedTitle: 'From title',
    requiresPdfPath: true,
  },
  {
    name: 'project',
    resolver: projectShowcaseShareResolver,
    entityType: 'project_showcase',
    collection: COLLECTIONS.PROJECTS,
    idField: 'projectId',
    titleField: 'projectTitle',
    titleDoc: { title: 'From title', name: 'From name' },
    expectedTitle: 'From name',
    requiresPdfPath: true,
  },
  {
    name: 'building',
    resolver: buildingShowcaseShareResolver,
    entityType: 'building_showcase',
    collection: COLLECTIONS.BUILDINGS,
    idField: 'buildingId',
    titleField: 'buildingTitle',
    titleDoc: { title: 'From title', name: 'From name' },
    expectedTitle: 'From name',
    requiresPdfPath: true,
  },
  {
    name: 'storage',
    resolver: storageShowcaseShareResolver,
    entityType: 'storage_showcase',
    collection: COLLECTIONS.STORAGE,
    idField: 'storageId',
    titleField: 'storageTitle',
    titleDoc: { code: 'From code', name: 'From name' },
    expectedTitle: 'From name',
    requiresPdfPath: false,
  },
  {
    name: 'parking',
    resolver: parkingShowcaseShareResolver,
    entityType: 'parking_showcase',
    collection: COLLECTIONS.PARKING_SPACES,
    idField: 'parkingId',
    titleField: 'parkingTitle',
    titleDoc: { code: 'From code', number: 'From number' },
    expectedTitle: 'From number',
    requiresPdfPath: false,
  },
] as const;

describe.each(SURFACES)('$name showcase resolver', (surface) => {
  const share: ShareRecord = {
    ...FULL_SHARE,
    entityType: surface.entityType,
    entityId: 'ent_1',
  };

  const project = (entity: Record<string, unknown> | null) =>
    surface.resolver.project({ share, entity, token: 'tok_visitor' }) as Record<string, unknown>;

  it('declares the collection its entity lives in (the server reads it)', () => {
    expect(surface.resolver.entityCollection).toBe(surface.collection);
  });

  it('projects exactly the five shared facts plus its two declared keys', () => {
    const resolved = project(surface.titleDoc);

    expect(Object.keys(resolved).sort()).toEqual(
      [
        'note', 'pdfRegeneratedAt', 'pdfStoragePath', 'shareId', 'token',
        surface.idField, surface.titleField,
      ].sort(),
    );
    expect(resolved[surface.idField]).toBe('ent_1');
  });

  it('echoes the token the VISITOR presented — the database no longer holds one', () => {
    expect(project(surface.titleDoc).token).toBe('tok_visitor');
  });

  it('reads its title from its own document fields, in its own order', () => {
    expect(project(surface.titleDoc)[surface.titleField]).toBe(surface.expectedTitle);
  });

  it('survives a share whose entity was deleted', () => {
    const resolved = project(null);

    expect(resolved[surface.titleField]).toBeNull();
    expect(resolved[surface.idField]).toBe('ent_1');
  });

  it('publishes showcaseMeta only — never the contact or file bag', () => {
    const projection = surface.resolver.safePublicProjection(share);

    expect(projection.showcaseMeta).toEqual(share.showcaseMeta);
    expect('contactMeta' in projection).toBe(false);
    expect('fileMeta' in projection).toBe(false);
  });

  it('refuses a create-input addressed to a different surface', () => {
    const result = surface.resolver.validateCreateInput({
      ...BASE_INPUT,
      entityType: 'file',
    });

    expect(result.valid).toBe(false);
  });

  it(`${surface.requiresPdfPath ? 'requires' : 'does not require'} a PDF path`, () => {
    const withoutPdf: CreateShareInput = {
      ...BASE_INPUT,
      entityType: surface.entityType,
      showcaseMeta: undefined,
    };

    expect(surface.resolver.validateCreateInput(withoutPdf)).toEqual(
      surface.requiresPdfPath
        ? { valid: false, reason: 'showcaseMeta.pdfStoragePath required' }
        : { valid: true },
    );
  });

});

// ===========================================================================
// Exhaustiveness anchor
// ===========================================================================

describe('share resolvers ↔ ShareEntityType (anchor)', () => {
  const RESOLVERS_DIR = path.join(
    process.cwd(), 'src', 'services', 'sharing', 'resolvers',
  );

  /** Every member of the `ShareEntityType` union, read from the type SSoT. */
  function declaredEntityTypes(): string[] {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'src', 'types', 'sharing.ts'), 'utf8',
    );
    const union = source.match(/export type ShareEntityType =([\s\S]*?);/);
    if (!union) throw new Error('ShareEntityType union not found — anchor is vacuous');
    return [...union[1].matchAll(/'([a-z_]+)'/g)].map(m => m[1]);
  }

  /**
   * `vendor_rfq_invite` carries a pre-generated HMAC URL and never enters the
   * share-token lifecycle, so it has no resolver **on purpose**. Listing it here
   * is the difference between a decision and an omission.
   */
  const WITHOUT_RESOLVER = ['vendor_rfq_invite'];

  it('finds the whole union (guards against a vacuous anchor)', () => {
    expect(declaredEntityTypes()).toHaveLength(8);
  });

  it('registers a resolver for every share type that has a token lifecycle', () => {
    const missing = declaredEntityTypes()
      .filter(t => !WITHOUT_RESOLVER.includes(t))
      .filter(t => !ShareEntityRegistry.has(t as never));

    expect(missing).toEqual([]);
  });

  it('leaves the deliberately unresolved types unregistered', () => {
    for (const entityType of WITHOUT_RESOLVER) {
      expect(ShareEntityRegistry.has(entityType as never)).toBe(false);
    }
  });

  it('re-implements no primitive in a resolver file', () => {
    // Each pattern is a line the resolvers used to carry a copy of.
    const forbidden = [
      /entityType: share\.entityType/,          // hand-rolled public projection
      /=== user\.companyId/,                    // hand-rolled tenant ownership
      /Wrong resolver — expected entityType=/,  // hand-rolled base validation
      /snap\.exists\(\)/,                       // hand-rolled entity read
      /from 'firebase\/firestore'/,             // a resolver reading the DB again (ADR-884 Φ0.12)
    ];

    const files = fs.readdirSync(RESOLVERS_DIR).filter(f => f.endsWith('.ts'));
    expect(files.length).toBeGreaterThanOrEqual(4);

    for (const file of files) {
      const source = fs.readFileSync(path.join(RESOLVERS_DIR, file), 'utf8');
      for (const pattern of forbidden) {
        expect({ file, matches: pattern.test(source) }).toEqual({ file, matches: false });
      }
    }
  });

  it('routes every showcase surface through the factory', () => {
    const source = fs.readFileSync(
      path.join(RESOLVERS_DIR, 'showcase-surfaces.resolvers.ts'), 'utf8',
    );
    const calls = source.match(/createShowcaseShareResolver\(/g) ?? [];

    expect(calls).toHaveLength(
      declaredEntityTypes().filter(t => t.endsWith('_showcase')).length,
    );
  });
});
