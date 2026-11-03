/**
 * Το δημόσιο προφίλ και η επικύρωσή του (ADR-923 §22 Υ8): καθαρές συναρτήσεις.
 */

import { emptyProject, withAsset, withoutAsset, withoutProject, withProject, yearOfInput } from '@/components/catalog/settings/supplier-profile-draft';
import { CATALOG_ISSUE_CODES } from '../../schema/catalog-issues';
import { validateSupplierProfile } from '../../schema/validate-supplier-profile';
import { supplierProfileSchema } from '../../schema/zod/supplier-profile.schema';
import { MAX_PORTFOLIO_PROJECT_IMAGES, MAX_PORTFOLIO_PROJECTS, type CatalogPortfolioProject } from '../../types/supplier-profile';
import type { PublicCatalogMedia } from '../public-catalog-schema';
import { projectPublicProfile, publicSupplierProfileFromDocument, publicSupplierProfileSchema, PUBLIC_SUPPLIER_PROFILE_SCHEMA_VERSION } from '../public-supplier-profile';

const IMAGE: PublicCatalogMedia = { assetId: 'a1', url: 'https://s/a1.webp', labels: {} };
const MEDIA = new Map([['a1', IMAGE]]);
const project = (over: Partial<CatalogPortfolioProject> = {}): CatalogPortfolioProject => ({ id: 'p1', title: { el: 'Έργο' }, description: {}, year: 2024, assetIds: ['a1'], ...over });
const project2 = (id: string) => project({ id });
const projected = (projects: readonly CatalogPortfolioProject[], description = {}) => projectPublicProfile({ companyId: 'c', definition: { description, projects }, media: MEDIA });

describe('projectPublicProfile', () => {
  it('πεδία έργου και κλειστό σχήμα', () => {
    const document = projected([project()]);
    expect(document).toEqual({ schemaVersion: PUBLIC_SUPPLIER_PROFILE_SCHEMA_VERSION, companyId: 'c', description: {}, projects: [{ projectId: 'p1', title: { el: 'Έργο' }, description: {}, year: 2024, images: [IMAGE] }] });
    expect(publicSupplierProfileSchema.safeParse(document).success).toBe(true);
  });

  it('🔒 μέσο που δεν επιτρέπεται λείπει · έργο χωρίς καμία εικόνα δεν βγαίνει', () => {
    expect(projected([project({ assetIds: ['gone', 'a1'] })])?.projects[0].images).toEqual([IMAGE]);
    expect(projected([project({ assetIds: ['gone'] })], { el: 'Κείμενο' })?.projects).toEqual([]);
  });

  it('κενό προφίλ ⇒ `null`', () => {
    expect(projected([])).toBeNull();
    expect(projected([project({ assetIds: ['gone'] })])).toBeNull();
    expect(projected([], { el: 'Κείμενο' })).not.toBeNull();
  });
});

describe('publicSupplierProfileFromDocument', () => {
  const VALID = { schemaVersion: PUBLIC_SUPPLIER_PROFILE_SCHEMA_VERSION, companyId: 'c', description: {}, projects: [] };

  it('δέχεται έγκυρο · απορρίπτει ξένο χώρο, άγνωστο πεδίο και ποσό', () => {
    expect(publicSupplierProfileFromDocument(VALID, 'c')).toEqual(VALID);
    expect(publicSupplierProfileFromDocument(VALID, 'other')).toBeNull();
    expect(publicSupplierProfileFromDocument({ ...VALID, taxId: '1' }, 'c')).toBeNull();
    expect(publicSupplierProfileFromDocument({ ...VALID, projects: [{ projectId: 'p', title: {}, description: {}, year: null, images: [IMAGE], amount: 5 }] }, 'c')).toBeNull();
    expect(publicSupplierProfileFromDocument(undefined, 'c')).toBeNull();
  });

  it('🔒 έργο χωρίς εικόνα δεν περνά το σύνορο', () => {
    expect(publicSupplierProfileFromDocument({ ...VALID, projects: [{ projectId: 'p', title: {}, description: {}, year: null, images: [] }] }, 'c')).toBeNull();
  });
});

describe('validateSupplierProfile', () => {
  const codes = (projects: readonly CatalogPortfolioProject[]) => validateSupplierProfile({ description: {}, projects }).map((issue) => issue.code);

  it('έγκυρο ⇒ κανένα εύρημα · ο νέος κωδικός είναι δηλωμένος', () => {
    expect(codes([project()])).toEqual([]);
    expect(CATALOG_ISSUE_CODES).toContain('portfolioProjectImagesRequired');
  });

  it('χωρίς τίτλο · χωρίς εικόνα · διπλή εικόνα · διπλό έργο', () => {
    expect(codes([project({ title: {} })])).toEqual(['labelRequired']);
    expect(codes([project({ assetIds: [] })])).toEqual(['portfolioProjectImagesRequired']);
    expect(codes([project({ assetIds: ['a', 'a'] })])).toHaveLength(1);
    expect(codes([project2('x'), project2('x')])).toHaveLength(1);
  });

  it('όρια πλήθους', () => {
    expect(codes(Array.from({ length: MAX_PORTFOLIO_PROJECTS }, (_, index) => project2(`p${index}`)))).toEqual([]);
    expect(codes(Array.from({ length: MAX_PORTFOLIO_PROJECTS + 1 }, (_, index) => project2(`p${index}`)))).toContain('tooMany');
    expect(codes([project({ assetIds: Array.from({ length: MAX_PORTFOLIO_PROJECT_IMAGES + 1 }, (_, index) => `a${index}`) })])).toContain('tooMany');
  });
});

describe('το σύρμα', () => {
  it('🔒 το έργο δεν δέχεται τόπο ή πελάτη: κλειστό σχήμα', () => {
    expect(supplierProfileSchema.safeParse({ description: {}, projects: [{ ...project(), address: 'Οδός 1' }] }).success).toBe(false);
    expect(supplierProfileSchema.safeParse({ description: {}, projects: [project({ year: 1800 })] }).success).toBe(false);
    expect(supplierProfileSchema.safeParse({ description: {}, projects: [project()] }).success).toBe(true);
  });
});

describe('το πρόχειρο της οθόνης', () => {
  const profile = { description: {}, projects: [project()] };

  it('προσθήκη και αφαίρεση έργου και εικόνας, χωρίς διπλότυπο', () => {
    expect(emptyProject('n')).toEqual({ id: 'n', title: {}, description: {}, year: null, assetIds: [] });
    expect(withProject(profile, project({ year: 2020 })).projects[0].year).toBe(2020);
    expect(withoutProject(profile, 'p1').projects).toEqual([]);
    expect(withAsset(project(), 'a1').assetIds).toEqual(['a1']);
    expect(withAsset(project(), 'a2').assetIds).toEqual(['a1', 'a2']);
    expect(withoutAsset(project(), 'a1').assetIds).toEqual([]);
  });

  it.each([['2024', 2024], ['', null], ['abc', null], ['1800', null], ['2024.5', null]])('έτος %j ⇒ %j', (raw, year) => {
    expect(yearOfInput(raw)).toBe(year);
  });
});
