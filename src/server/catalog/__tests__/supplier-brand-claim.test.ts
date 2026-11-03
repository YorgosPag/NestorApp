/**
 * Η κατοχή μάρκας (ADR-923 §16): αίτηση, απόφαση, λήξη, ανάκληση, ένας κατασκευαστής.
 */

import type { Firestore } from 'firebase-admin/firestore';

import { activeBrandGrant, brandKeyOf, publicBrandsOf, validUntilOfDate } from '@/subapps/catalog/public/supplier-brand-claim-rules';
import type { SupplierBrandClaimRecord, SupplierBrandRelation } from '@/subapps/catalog/types/supplier-brand-claim';
import { FakeFirestore } from '@/test-utils/fake-firestore/fake-firestore';
import { decideSupplierBrand, listSupplierBrandClaims, readActiveSupplierBrands, readBrandClaim, requestSupplierBrand, revokeSupplierBrand } from '../supplier-brand-claim.server';
import { evidenceAccepted, readSupplierStandingOutcome } from '../supplier-review.server';
import { revalidatePublicCompany } from '../public/public-model-revalidate.server';
import { EntityAuditService } from '@/services/entity-audit.service';

jest.mock('../supplier-review.server', () => ({ LIVE_DEPS: {}, evidenceAccepted: jest.fn(), readSupplierStandingOutcome: jest.fn() }));
jest.mock('../public/public-model-revalidate.server', () => ({ revalidatePublicCompany: jest.fn() }));
jest.mock('@/services/entity-audit.service', () => ({ EntityAuditService: { recordChange: jest.fn(async () => 'audit-id') } }));

const accepted = evidenceAccepted as jest.Mock;
const standing = readSupplierStandingOutcome as jest.Mock;
const VERIFIED = { kind: 'known', standing: { kind: 'verified', basis: 'registry' } };
const NOW = '2026-11-02T10:00:00.000Z';
const NOW_MS = Date.parse(NOW);
const LATER = '2027-11-02T23:59:59.000Z';

let db: Firestore;

const request = (companyId: string, relation: SupplierBrandRelation = 'manufacturer', brandName = 'Toshiba') =>
  requestSupplierBrand(db, { companyId, actorUid: 'u', brandName, relation, evidenceFileId: 'file-1', nowIso: NOW });
const idOf = async (companyId: string) => (await db.collection('supplier_brand_claims').where('companyId', '==', companyId).get()).docs[0].id;
const decide = (claimId: string, decision: 'approve' | 'reject' = 'approve', validUntil: string | null = LATER, nowIso = NOW) =>
  decideSupplierBrand(db, { claimId, decision, reviewerUid: 'admin', note: null, validUntil, nowIso });
const approved = async (companyId: string, relation: SupplierBrandRelation = 'manufacturer', validUntil = LATER) => {
  await request(companyId, relation);
  const id = await idOf(companyId);
  await decide(id, 'approve', validUntil);
  return id;
};

beforeEach(() => {
  db = new FakeFirestore() as unknown as Firestore;
  accepted.mockReset().mockResolvedValue(true);
  standing.mockReset().mockResolvedValue(VERIFIED);
  (revalidatePublicCompany as jest.Mock).mockClear();
  (EntityAuditService.recordChange as jest.Mock).mockClear();
});

describe('καθαρές κρίσεις', () => {
  const claim = (validUntil: string) => ({ grant: { relation: 'manufacturer' as const, validUntil, grantedAt: NOW, grantedBy: 'a' } });

  it('ίδια μάρκα ανεξάρτητα από γράμματα, τόνους και κενά', () => {
    expect(brandKeyOf('  TOSHÍBA  Air ')).toBe(brandKeyOf('toshiba air'));
  });

  it('🔑 η λήξη είναι σύγκριση: την ίδια στιγμή του ορίου το δικαίωμα έχει ήδη πέσει', () => {
    expect(activeBrandGrant(claim(LATER), NOW_MS)).not.toBeNull();
    expect(activeBrandGrant(claim(NOW), NOW_MS)).toBeNull();
    expect(activeBrandGrant({ grant: null }, NOW_MS)).toBeNull();
  });

  it('τέλος της ημέρας · κενό ⇒ καμία ημερομηνία', () => {
    expect(validUntilOfDate('2027-12-31')).toBe('2027-12-31T23:59:59.000Z');
    expect(validUntilOfDate('')).toBeNull();
  });

  it('🔒 στο κοινό μόνο όνομα και σχέση, ταξινομημένα · ληγμένο έξω', () => {
    const record = (brandName: string, validUntil: string) => ({ ...claim(validUntil), brandName, evidenceFileId: 'secret', reviewNote: 'secret' }) as unknown as SupplierBrandClaimRecord;
    const brands = publicBrandsOf([record('Β', LATER), record('Α', LATER), record('Γ', NOW)], NOW_MS);
    expect(brands).toEqual([{ brandName: 'Α', relation: 'manufacturer' }, { brandName: 'Β', relation: 'manufacturer' }]);
    expect(JSON.stringify(brands)).not.toContain('secret');
  });
});

describe('αίτηση', () => {
  it('🔒 ξένη ή μη αποδεκτή απόδειξη απορρίπτεται, χωρίς εγγραφή', async () => {
    accepted.mockResolvedValue(false);
    await expect(request('comp-a')).resolves.toEqual({ kind: 'refused', reason: 'evidence-refused' });
    expect((await db.collection('supplier_brand_claims').get()).docs).toHaveLength(0);
  });

  it('εκκρεμής αίτηση, με ίχνος · ίδια μάρκα ξαναγράφει το ίδιο έγγραφο', async () => {
    await expect(request('comp-a')).resolves.toEqual({ kind: 'done', status: 'pending-review' });
    expect(EntityAuditService.recordChange).toHaveBeenCalledTimes(1);
    await request('comp-a', 'manufacturer', ' TOSHIBA ');
    expect((await db.collection('supplier_brand_claims').get()).docs).toHaveLength(1);
  });
});

describe('απόφαση', () => {
  it('🔒 έγκριση θέλει λήξη στο μέλλον', async () => {
    await request('comp-a');
    const id = await idOf('comp-a');
    await expect(decide(id, 'approve', null)).resolves.toEqual({ kind: 'refused', reason: 'expiry-required' });
    await expect(decide(id, 'approve', NOW)).resolves.toEqual({ kind: 'refused', reason: 'expiry-required' });
    await expect(decide(id)).resolves.toEqual({ kind: 'done', status: 'approved' });
    expect((await readBrandClaim(db, id))?.grant).toMatchObject({ validUntil: LATER, grantedBy: 'admin', relation: 'manufacturer' });
    expect(revalidatePublicCompany).toHaveBeenCalledWith('comp-a');
  });

  it('🔒 το τρίτο στάδιο πατά στο δεύτερο · βλάβη αρνείται, δεν εγκρίνει', async () => {
    await request('comp-a');
    const id = await idOf('comp-a');
    standing.mockResolvedValue({ kind: 'known', standing: { kind: 'unverified' } });
    await expect(decide(id)).resolves.toEqual({ kind: 'refused', reason: 'not-verified' });
    standing.mockResolvedValue({ kind: 'unknown' });
    await expect(decide(id)).resolves.toEqual({ kind: 'refused', reason: 'unavailable' });
  });

  it('🔒 κατασκευαστής ένας ανά μάρκα · ληγμένος δεν εμποδίζει', async () => {
    await approved('comp-a');
    await request('comp-b');
    const other = await idOf('comp-b');
    await expect(decide(other)).resolves.toEqual({ kind: 'refused', reason: 'brand-held' });
    await expect(decide(other, 'approve', '2028-01-01T00:00:00.000Z', '2027-12-01T00:00:00.000Z')).resolves.toEqual({ kind: 'done', status: 'approved' });
  });

  it('🔑 ο ίδιος κατασκευαστής ανανεώνει τη μάρκα του: το δικό του δικαίωμα δεν τον εμποδίζει', async () => {
    const id = await approved('comp-a');
    await request('comp-a');
    await expect(decide(id)).resolves.toEqual({ kind: 'done', status: 'approved' });
  });

  it('κάθε απόφαση γράφει ίχνος με την κατάσταση και τη λήξη', async () => {
    await request('comp-a');
    const id = await idOf('comp-a');
    (EntityAuditService.recordChange as jest.Mock).mockClear();
    await decide(id);
    expect(EntityAuditService.recordChange).toHaveBeenCalledWith(expect.objectContaining({
      entityId: id,
      companyId: 'comp-a',
      changes: [{ field: 'status', oldValue: 'pending-review', newValue: 'approved' }, { field: 'validUntil', oldValue: null, newValue: LATER }],
    }));
  });

  it('αντιπρόσωποι πολλοί, και μαζί με κατασκευαστή', async () => {
    await approved('comp-a');
    await request('comp-b', 'authorized-representative');
    await expect(decide(await idOf('comp-b'))).resolves.toEqual({ kind: 'done', status: 'approved' });
  });

  it('🔑 ανανέωση σε εξέλιξη και απορριφθείσα ανανέωση αφήνουν τη μάρκα σε ισχύ', async () => {
    const id = await approved('comp-a');
    await request('comp-a');
    await expect(readActiveSupplierBrands(db, 'comp-a', NOW_MS)).resolves.toHaveLength(1);
    await decide(id, 'reject');
    expect((await readBrandClaim(db, id))?.status).toBe('rejected');
    await expect(readActiveSupplierBrands(db, 'comp-a', NOW_MS)).resolves.toHaveLength(1);
  });

  it('ανύπαρκτη αίτηση · όχι εκκρεμής', async () => {
    await expect(decide('none')).resolves.toEqual({ kind: 'refused', reason: 'not-found' });
    const id = await approved('comp-a');
    await expect(decide(id)).resolves.toEqual({ kind: 'refused', reason: 'not-pending' });
  });
});

describe('λήξη και ανάκληση', () => {
  it('🔑 η λήξη πέφτει μόνη της, χωρίς εγγραφή', async () => {
    await approved('comp-a');
    await expect(readActiveSupplierBrands(db, 'comp-a', NOW_MS)).resolves.toEqual([{ brandName: 'Toshiba', relation: 'manufacturer' }]);
    await expect(readActiveSupplierBrands(db, 'comp-a', Date.parse(LATER) + 1)).resolves.toEqual([]);
  });

  it('η ανάκληση σβήνει το δικαίωμα αμέσως, ακυρώνει τη μνήμη και γράφει ίχνος', async () => {
    const id = await approved('comp-a');
    (revalidatePublicCompany as jest.Mock).mockClear();
    await expect(revokeSupplierBrand(db, { claimId: id, reviewerUid: 'admin', note: 'x', nowIso: NOW })).resolves.toEqual({ kind: 'done', status: 'revoked' });
    await expect(readActiveSupplierBrands(db, 'comp-a', NOW_MS)).resolves.toEqual([]);
    expect(revalidatePublicCompany).toHaveBeenCalledWith('comp-a');
  });

  it('χωρίς δικαίωμα δεν υπάρχει τι να ανακληθεί', async () => {
    await request('comp-a');
    await expect(revokeSupplierBrand(db, { claimId: await idOf('comp-a'), reviewerUid: 'admin', note: null, nowIso: NOW })).resolves.toEqual({ kind: 'refused', reason: 'not-active' });
  });

  it('η ουρά: παλαιότερο πρώτο, ανά κατάσταση', async () => {
    await request('comp-a');
    await approved('comp-b');
    expect((await listSupplierBrandClaims(db, 'pending-review')).map((claim) => claim.companyId)).toEqual(['comp-a']);
    expect((await listSupplierBrandClaims(db, 'approved')).map((claim) => claim.companyId)).toEqual(['comp-b']);
  });
});
