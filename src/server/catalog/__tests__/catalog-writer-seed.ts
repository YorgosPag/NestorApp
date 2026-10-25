/**
 * Ο **κοινός σπόρος** των tests των γραφέων του καταλόγου (ADR-923 §5.9 · §5.10): ο χώρος, η βιβλιοθήκη MFP
 * **μέσα από τους γραφείς** (όχι γραμμένη στο χέρι στη βάση), και η αντιστοίχιση των κωδικών του fixture στα
 * πραγματικά ids που έδωσαν οι γραφείς. Ένα σημείο για σχήμα και δεδομένα — τα δύο tests δεν κρατούν δίδυμα.
 *
 * ⚠️ Τα mocks (`firebaseAdmin`, ίχνος) τα δηλώνει **το ίδιο το test** πριν φορτώσει τους γραφείς· εδώ μόνο οι βοηθοί.
 */

import type { AuthContext } from '@/lib/auth';
import type { MediaRights } from '@/types/media-rights';
import type { CatalogFamilyDefinition } from '@/subapps/catalog/types/family';
import type { CatalogProductDefinition, CatalogProductModelDefinition, CatalogValueHolder, ProductValues } from '@/subapps/catalog/types/product';
import { MFP_ATTRIBUTES, MFP_FAMILY } from '@/subapps/catalog/__tests__/fixtures/mfp-fan-coil.fixture';
import { CatalogWriteError } from '../catalog-write-error';

export const ctxOf = (companyId: string): AuthContext => ({
  uid: `user-${companyId}`,
  email: `admin@${companyId}.gr`,
  companyId,
  globalRole: 'company_admin',
  mfaEnrolled: false,
  isAuthenticated: true,
});
export const ARIES = ctxOf('comp-aries');
export const RIVAL = ctxOf('comp-rival');

export async function rejectionOf(promise: Promise<unknown>): Promise<CatalogWriteError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof CatalogWriteError) return error;
    throw error;
  }
  throw new Error('expected a CatalogWriteError');
}

/** Δικαιώματα IPTC ενός μέσου — έγκυρα για το **υπάρχον** `MediaRightsSchema`. */
export const SEED_RIGHTS: MediaRights = {
  creator: { name: 'Aries', userId: null, url: null },
  licensors: [],
  copyrightNotice: '© Aries',
  webStatementOfRights: null,
  license: { purpose: 'unrestricted', term: { kind: 'perpetual' } },
};

/** Κωδικός fixture → πραγματικό id (ό,τι δεν είναι γνωστός κωδικός μένει ως έχει). */
export type IdMap = ReadonlyMap<string, string>;

const idIn = (ids: IdMap) => (code: string): string => ids.get(code) ?? code;

/** Αντικαθιστά **κάθε** συμβολοσειρά που είναι κωδικός ιδιότητας — για σχήματα/κανόνες/πίνακα, όπου είναι ασφαλές. */
function remapStrings<T>(value: T, ids: IdMap): T {
  return JSON.parse(JSON.stringify(value), (_key, item: unknown) => (typeof item === 'string' ? idIn(ids)(item) : item)) as T;
}

/** Η οικογένεια MFP του fixture με τα πραγματικά ids — **όλοι** οι κανόνες του fixture, όχι υποσύνολο. */
export function mfpFamilyWith(ids: IdMap): CatalogFamilyDefinition {
  const id = idIn(ids);
  return {
    ...MFP_FAMILY,
    attributes: MFP_FAMILY.attributes.map((binding) => ({ ...binding, attributeId: id(binding.attributeId) })),
    labelAttributeId: MFP_FAMILY.labelAttributeId && id(MFP_FAMILY.labelAttributeId),
    imageAttributeId: MFP_FAMILY.imageAttributeId && id(MFP_FAMILY.imageAttributeId),
    variantSchemes: remapStrings(MFP_FAMILY.variantSchemes, ids),
    tableSpec: remapStrings(MFP_FAMILY.tableSpec, ids),
    consistencyRules: remapStrings(MFP_FAMILY.consistencyRules, ids),
  };
}

function remapValues(values: ProductValues, ids: IdMap): ProductValues {
  return Object.fromEntries(
    Object.entries(values).map(([attributeCode, slots]) => [idIn(ids)(attributeCode), remapStrings(slots, ids)]),
  );
}

function remapHolder<T extends CatalogValueHolder>(holder: T, ids: IdMap): T {
  return {
    ...holder,
    values: remapValues(holder.values, ids),
    noValueReasons: Object.fromEntries(Object.entries(holder.noValueReasons).map(([code, reason]) => [idIn(ids)(code), reason])),
    categoryIds: holder.categoryIds.map(idIn(ids)),
  };
}

export const mfpModelWith = (model: CatalogProductModelDefinition, ids: IdMap): CatalogProductModelDefinition => ({
  ...remapHolder(model, ids),
  familyId: idIn(ids)(model.familyId),
});

export const mfpProductWith = (product: CatalogProductDefinition, ids: IdMap, modelId: string | null): CatalogProductDefinition => ({
  ...remapHolder(product, ids),
  familyId: idIn(ids)(product.familyId),
  modelId,
});

/** Οι κωδικοί των ομάδων του fixture (μία ανά ιδιότητα). */
export const MFP_GROUP_CODES = [...new Set(MFP_ATTRIBUTES.map((attribute) => attribute.groupId))];
