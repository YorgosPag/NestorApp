/**
 * Snapshot-builder surface anchors (ADR-701).
 *
 * ADR-701 moved the project showcase off 46 lines of hand-written
 * orchestration onto `createShowcaseSnapshotBuilder`. Two things could have
 * broken silently and neither shows up in a type error:
 *
 *   1. **Branding.** The hand-written version resolved branding from the
 *      project's *own* id; the factory default reads a `raw.projectId`
 *      foreign key that a project document does not carry. Getting this wrong
 *      swaps the developer brand for a blank one on every project PDF.
 *   2. **Error identity.** The old classes extended `Error` directly, so
 *      `instanceof ShowcaseEntityNotFoundError` was false for exactly one of
 *      the five surfaces.
 *
 * The label-catalog reader is pinned here too: it now feeds all five loaders,
 * so a regression in it is a five-surface regression.
 */

const brandingCalls: Array<Record<string, unknown>> = [];

jest.mock('@/services/company/company-branding-resolver', () => ({
  resolveShowcaseCompanyBranding: jest.fn(async (params: Record<string, unknown>) => {
    brandingCalls.push(params);
    return { companyName: 'Nestor', logoUrl: null };
  }),
}));

import type { Firestore } from 'firebase-admin/firestore';
import {
  ShowcaseEntityNotFoundError,
  ShowcaseTenantMismatchError,
} from '../snapshot-builder-factory';
import {
  createEnumLabelTranslator,
  readShowcaseCatalogSections,
  resolveShowcaseMediaTitles,
} from '../labels-catalog';
import {
  buildProjectShowcaseSnapshot,
  ProjectNotFoundError,
  TenantMismatchError,
} from '@/services/project-showcase/snapshot-builder';
import { loadProjectShowcasePdfLabels } from '@/services/project-showcase/labels';
import { loadBuildingShowcasePdfLabels } from '@/services/building-showcase/labels';

const COMPANY_ID = 'company-1';

function fakeDb(docs: Record<string, Record<string, unknown>>): Firestore {
  return {
    collection: () => ({
      doc: (id: string) => ({
        get: async () => ({
          exists: docs[id] !== undefined,
          data: () => docs[id],
        }),
      }),
    }),
  } as unknown as Firestore;
}

beforeEach(() => {
  brandingCalls.length = 0;
});

// ============================================================================
// Project showcase — the migrated surface
// ============================================================================

describe('project showcase snapshot (ADR-701 migration)', () => {
  const db = () =>
    fakeDb({
      'P-1': {
        companyId: COMPANY_ID,
        name: '  Έργο Άλφα  ',
        projectCode: 'PRJ-1',
        progress: 40,
        totalArea: 800,
        client: 'Πελάτης',
      },
    });

  it('brands from the project\'s OWN id, not from a raw.projectId foreign key', async () => {
    await buildProjectShowcaseSnapshot('P-1', 'el', db(), COMPANY_ID);

    expect(brandingCalls).toHaveLength(1);
    expect(brandingCalls[0]).toMatchObject({
      propertyData: { projectId: 'P-1' },
      companyId: COMPANY_ID,
      brandingSource: 'tenant',
    });
  });

  it('produces the legacy payload shape', async () => {
    const snapshot = await buildProjectShowcaseSnapshot('P-1', 'el', db(), COMPANY_ID);

    expect(Object.keys(snapshot)).toEqual(['project', 'company']);
    expect(snapshot.project).toMatchObject({
      id: 'P-1',
      projectCode: 'PRJ-1',
      name: 'Έργο Άλφα',
      progress: 40,
      totalArea: 800,
      client: 'Πελάτης',
    });
    // Absent fields serialise as explicit null on this surface, not omitted.
    expect(snapshot.project.description).toBeNull();
    expect(snapshot.project.city).toBeNull();
  });

  it('falls back name → title → id', async () => {
    const withTitle = fakeDb({
      'P-2': { companyId: COMPANY_ID, title: 'Μόνο τίτλος' },
    });
    const named = await buildProjectShowcaseSnapshot('P-2', 'el', withTitle, COMPANY_ID);
    expect(named.project.name).toBe('Μόνο τίτλος');

    const bare = fakeDb({ 'P-3': { companyId: COMPANY_ID } });
    const unnamed = await buildProjectShowcaseSnapshot('P-3', 'el', bare, COMPANY_ID);
    expect(unnamed.project.name).toBe('P-3');
  });

  it('throws a core-descended not-found error with the legacy message', async () => {
    const empty = fakeDb({});
    await expect(
      buildProjectShowcaseSnapshot('MISSING', 'el', empty, COMPANY_ID),
    ).rejects.toThrow('Project not found: MISSING');

    await buildProjectShowcaseSnapshot('MISSING', 'el', empty, COMPANY_ID).catch(
      (err: Error) => {
        expect(err).toBeInstanceOf(ShowcaseEntityNotFoundError);
        expect(err.name).toBe('ProjectNotFoundError');
      },
    );
  });

  it('enforces tenant isolation with a core-descended error', async () => {
    const foreign = fakeDb({ 'P-9': { companyId: 'other-company' } });

    await buildProjectShowcaseSnapshot('P-9', 'el', foreign, COMPANY_ID).catch(
      (err: Error) => {
        expect(err).toBeInstanceOf(ShowcaseTenantMismatchError);
        expect(err.name).toBe('TenantMismatchError');
        expect(err.message).toBe('Tenant isolation violation for project: P-9');
      },
    );
    expect.assertions(3);
  });

  it('does not resolve branding when the tenant check fails', async () => {
    const foreign = fakeDb({ 'P-9': { companyId: 'other-company' } });
    await buildProjectShowcaseSnapshot('P-9', 'el', foreign, COMPANY_ID).catch(() => undefined);
    expect(brandingCalls).toHaveLength(0);
  });

  it('keeps the legacy error aliases constructible and core-descended', () => {
    expect(new ProjectNotFoundError('X')).toBeInstanceOf(ShowcaseEntityNotFoundError);
    expect(new TenantMismatchError('X')).toBeInstanceOf(ShowcaseTenantMismatchError);
  });
});

// ============================================================================
// Label catalog — feeds all five loaders
// ============================================================================

describe('label catalog reader', () => {
  it('reads a namespaced surface and defaults every missing section to {}', () => {
    const sections = readShowcaseCatalogSections('projectShowcase', 'el');
    expect(sections.specs).toBeDefined();
    expect(sections.email).toBeDefined();
    expect(sections.namespace).toBeDefined();
  });

  it('returns all-empty sections for an unknown namespace rather than throwing', () => {
    const sections = readShowcaseCatalogSections('doesNotExistShowcase', 'el');
    expect(sections.specs).toEqual({});
    expect(sections.email).toEqual({});
    expect(sections.floorplans).toEqual({});
    expect(sections.namespace).toEqual({});
  });

  it('falls back to the shared media titles when the surface omits them', () => {
    const sections = readShowcaseCatalogSections('doesNotExistShowcase', 'el');
    const media = resolveShowcaseMediaTitles(sections, 'el');
    expect(media.photos.title).toBe('Φωτογραφίες');
    expect(media.floorplans.title).toBe('Κατόψεις');

    const en = resolveShowcaseMediaTitles(
      readShowcaseCatalogSections('doesNotExistShowcase', 'en'),
      'en',
    );
    expect(en.photos.title).toBe('Photos');
    expect(en.floorplans.title).toBe('Floorplans');
  });
});

describe('createEnumLabelTranslator', () => {
  const translate = createEnumLabelTranslator({
    el: { active: 'Ενεργό', done: 'Ολοκληρωμένο' },
    en: { active: 'Active', done: 'Done' },
  });

  it('translates per locale', () => {
    expect(translate('active', 'el')).toBe('Ενεργό');
    expect(translate('active', 'en')).toBe('Active');
  });

  it('returns undefined for falsy input', () => {
    expect(translate(undefined, 'el')).toBeUndefined();
    expect(translate('', 'el')).toBeUndefined();
  });

  it('passes unmapped keys through so a new enum member still renders', () => {
    expect(translate('brand_new_status', 'el')).toBe('brand_new_status');
  });
});

// ============================================================================
// Loaders still produce complete label sets after the catalog swap
// ============================================================================

describe('label loaders after the ADR-701 catalog swap', () => {
  it('project loader fills specs, chrome, email and header contacts', () => {
    const labels = loadProjectShowcasePdfLabels('el');
    expect(labels.specs.title).toBeTruthy();
    // The catalog value must win over the 'm²' hard fallback — proof the
    // reader actually reached `projectShowcase.specs` and did not silently
    // degrade to all-fallbacks.
    expect(labels.specs.areaUnit).toBe('τ.μ.');
    expect(labels.chrome.poweredBy).toBe('Υλοποίηση από Nestor App');
    expect(labels.chrome.photosTitle).toBe(labels.photos.title);
    expect(labels.chrome.floorplansTitle).toBe(labels.floorplans.title);
    expect(labels.email.ctaLabel).toBeTruthy();
    expect(labels.header.subtitle).toBeTruthy();
    expect(labels.header.contacts.emailLabel).toBe('Email');
  });

  it('building loader keeps chrome titles tied to the media titles', () => {
    const labels = loadBuildingShowcasePdfLabels('en');
    expect(labels.chrome.photosTitle).toBe(labels.photos.title);
    expect(labels.chrome.floorplansTitle).toBe(labels.floorplans.title);
    expect(labels.header.contacts.addressLabel).toBe('Address');
  });
});
