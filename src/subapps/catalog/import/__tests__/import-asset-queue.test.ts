/**
 * @fileoverview ADR-934 §5.2.2 Μ-β4 — η ουρά μέσων της παρτίδας (καθαρή): ποιες διευθύνσεις, με ποιους ρόλους, σε ποια κατάσταση,
 *   και τι κάνει μια αίτηση λήψης.
 */

import type { ExtractedAsset, ExtractedGroup, ImportProposalDefinition } from '../../types/catalog-import';
import type { ImportAssetFetchDefinition } from '../../types/catalog-media';
import { ASSET_FETCH_LEASE_MS } from '../../vocabulary/asset-fetch';
import { importAssetClaimOf, importAssetRequestsOf, importAssetViewOf } from '../import-asset-queue';

const asset = (uri: string, role: ExtractedAsset['role'], filename: string | null = null): ExtractedAsset => ({
  uri, role, order: null, filename, languages: [], issuedOn: null, expiresOn: null, atx: null,
});

const group = (groupAssets: readonly ExtractedAsset[], rowAssets: readonly ExtractedAsset[] = []): ExtractedGroup => ({
  groupKey: 'g', modelCode: null, sharedCells: [], pages: [], assets: groupAssets,
  rows: [{ rowKey: 'r1', cells: [], assets: rowAssets }],
});

type Proposal = Pick<ImportProposalDefinition, 'status' | 'extracted'>;
const proposal = (status: Proposal['status'], extracted: ExtractedGroup): Proposal => ({ status, extracted });

const NOW = 1_000_000;
const URI_A = 'https://cdn.example.com/a.pdf';
const URI_B = 'https://cdn.example.com/b.jpg';

const stored = (overrides: Partial<ImportAssetFetchDefinition> = {}): ImportAssetFetchDefinition => ({
  companyId: 'comp_1', batchId: 'cibat_1', uri: URI_A, roles: ['datasheet'], status: 'ready', leaseUntil: null, attempts: 1,
  failure: null, verdict: 'new', content: null, transport: 'secure', updatedAt: '2026-11-09T10:00:00.000Z', updatedBy: 'user_1',
  ...overrides,
});

describe('importAssetRequestsOf — η ουρά είναι οι ζωντανές προτάσεις, όχι αποθηκευμένη λίστα', () => {
  it('μέσα ομάδας ΚΑΙ γραμμών· μία γραμμή ανά διεύθυνση, ταξινομημένη', () => {
    const requests = importAssetRequestsOf([proposal('pending', group([asset(URI_B, 'photo')], [asset(URI_A, 'datasheet', 'fc.pdf')]))]);
    expect(requests).toEqual([
      { uri: URI_A, roles: ['datasheet'], filename: 'fc.pdf' },
      { uri: URI_B, roles: ['photo'], filename: null },
    ]);
  });

  it('🔑 ίδια διεύθυνση με δύο ρόλους, σε δύο προτάσεις ⇒ ΜΙΑ λήψη, ρόλοι σε σειρά λεξιλογίου', () => {
    const requests = importAssetRequestsOf([
      proposal('pending', group([asset(URI_A, 'certificate')])),
      proposal('applied', group([asset(URI_A, 'datasheet', 'x.pdf')])),
    ]);
    expect(requests).toEqual([{ uri: URI_A, roles: ['datasheet', 'certificate'], filename: 'x.pdf' }]);
  });

  it('η απορριφθείσα πρόταση δεν ζητά μέσα', () => {
    expect(importAssetRequestsOf([proposal('rejected', group([asset(URI_A, 'photo')]))])).toEqual([]);
  });

  it('πρόταση χωρίς μέσα ⇒ κενή ουρά', () => {
    expect(importAssetRequestsOf([proposal('pending', { ...group([]), assets: undefined, rows: [] })])).toEqual([]);
  });
});

describe('importAssetViewOf', () => {
  const request = { uri: URI_A, roles: ['datasheet'] as const, filename: null };

  it('χωρίς έγγραφο ⇒ `queued`, καμία προσπάθεια', () => {
    expect(importAssetViewOf(request, null, NOW)).toMatchObject({ status: 'queued', attempts: 0, failure: null, content: null });
  });

  it('ζωντανή μίσθωση ⇒ `fetching`· ληγμένη ⇒ ξανά `queued` (ο κάτοχός της δεν υπάρχει πια)', () => {
    expect(importAssetViewOf(request, stored({ status: 'fetching', leaseUntil: NOW + 1 }), NOW).status).toBe('fetching');
    expect(importAssetViewOf(request, stored({ status: 'fetching', leaseUntil: NOW - 1 }), NOW).status).toBe('queued');
  });

  it('οι ρόλοι της όψης είναι της ΤΩΡΙΝΗΣ παρτίδας, όχι της στιγμής της λήψης', () => {
    expect(importAssetViewOf({ ...request, roles: ['datasheet', 'manual'] }, stored(), NOW).roles).toEqual(['datasheet', 'manual']);
  });
});

describe('importAssetClaimOf — τι κάνει μια αίτηση λήψης', () => {
  it.each([
    ['καμία λήψη', null, false, 'claim'],
    ['έτοιμη ⇒ ως έχει (ιδεμπότητο)', stored(), false, 'settled'],
    ['έτοιμη + «Ξαναδοκιμή» ⇒ ως έχει: δεν ξανακατεβάζεται ό,τι υπάρχει', stored(), true, 'settled'],
    ['αποτυχημένη χωρίς «Ξαναδοκιμή» ⇒ ως έχει (όχι βρόχος)', stored({ status: 'failed' }), false, 'settled'],
    ['αποτυχημένη + «Ξαναδοκιμή» ⇒ νέα προσπάθεια', stored({ status: 'failed' }), true, 'claim'],
    ['κατεβαίνει (ζωντανή μίσθωση) ⇒ καμία δεύτερη λήψη', stored({ status: 'fetching', leaseUntil: NOW + ASSET_FETCH_LEASE_MS }), true, 'inFlight'],
    ['ληγμένη μίσθωση ⇒ ξαναδιεκδικείται', stored({ status: 'fetching', leaseUntil: NOW - 1 }), false, 'claim'],
  ] as const)('%s', (_name, current, retry, expected) => {
    expect(importAssetClaimOf(current, NOW, retry)).toBe(expected);
  });
});
