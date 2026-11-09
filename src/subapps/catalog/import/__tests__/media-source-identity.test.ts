/**
 * ADR-934 §5.2 Μ5 · §5.2.2 Μ-β3 — η κρίση ταυτότητας μιας λήψης: δύο ταυτότητες (διεύθυνση · περιεχόμενο), ποτέ μία.
 */

import {
  mediaSourceFromDocument,
  mediaSourceVerdictOf,
  nextMediaSource,
  revalidatedMediaSource,
  type ObservedMediaContent,
} from '@/subapps/catalog/import/media-source-identity';
import { MEDIA_SOURCE_HISTORY_LIMIT, type CatalogMediaSourceDefinition } from '@/subapps/catalog/types/catalog-media';

const sha = (digit: string): string => digit.repeat(64);
const URI = 'https://cdn.example.com/datasheet.pdf';

const observed = (overrides: Partial<ObservedMediaContent> = {}): ObservedMediaContent => ({
  companyId: 'comp_1', uri: URI, etag: '"v1"', lastModified: null, contentSha256: sha('a'), contentFileId: 'file_a',
  transport: 'secure', checkedAt: '2026-11-09T10:00:00.000Z', contentAlreadyKept: false, ...overrides,
});

const stored = (overrides: Partial<CatalogMediaSourceDefinition> = {}): CatalogMediaSourceDefinition => ({
  companyId: 'comp_1', uri: URI, etag: '"v1"', lastModified: null, contentSha256: sha('a'), contentFileId: 'file_a',
  transport: 'secure', checkedAt: '2026-11-08T10:00:00.000Z', previousSha256: [], ...overrides,
});

describe('mediaSourceVerdictOf — οι τέσσερις κρίσεις', () => {
  it('άγνωστη διεύθυνση + άγνωστο περιεχόμενο ⇒ `new`', () => {
    expect(mediaSourceVerdictOf(null, sha('a'), false)).toBe('new');
  });

  it('🔑 άγνωστη διεύθυνση + ΓΝΩΣΤΟ περιεχόμενο ⇒ `sameContent` (ο Stibo, μόνο με URL, θα έλεγε «νέο»)', () => {
    expect(mediaSourceVerdictOf(null, sha('a'), true)).toBe('sameContent');
  });

  it('γνωστή διεύθυνση + ίδιο sha256 ⇒ `unchanged`, ό,τι κι αν λέει το αρχείο καραντίνας', () => {
    expect(mediaSourceVerdictOf(stored(), sha('a'), true)).toBe('unchanged');
    expect(mediaSourceVerdictOf(stored(), sha('a'), false)).toBe('unchanged');
  });

  it('🔑 γνωστή διεύθυνση + ΑΛΛΟ sha256 ⇒ `newVersion` (Μ5), ακόμη κι αν τα νέα bytes τα είχαμε ήδη', () => {
    expect(mediaSourceVerdictOf(stored(), sha('b'), false)).toBe('newVersion');
    expect(mediaSourceVerdictOf(stored(), sha('b'), true)).toBe('newVersion');
  });
});

describe('nextMediaSource — η νέα κατάσταση της διεύθυνσης', () => {
  it('πρώτη φορά ⇒ κενό ιστορικό, ό,τι μετρήθηκε', () => {
    const { source, verdict } = nextMediaSource(null, observed());
    expect(verdict).toBe('new');
    expect(source).toEqual(stored({ checkedAt: '2026-11-09T10:00:00.000Z' }));
  });

  it('νέα έκδοση ⇒ το παλιό sha256 μπαίνει ΠΡΩΤΟ στο ιστορικό', () => {
    const { source } = nextMediaSource(stored({ previousSha256: [sha('c')] }), observed({ contentSha256: sha('b'), contentFileId: 'file_b' }));
    expect(source.contentSha256).toBe(sha('b'));
    expect(source.previousSha256).toEqual([sha('a'), sha('c')]);
  });

  it('επιστροφή σε παλιά έκδοση ⇒ καμία διπλή εγγραφή στο ιστορικό', () => {
    const { source, verdict } = nextMediaSource(stored({ previousSha256: [sha('c')] }), observed({ contentSha256: sha('c') }));
    expect(verdict).toBe('newVersion');
    expect(source.previousSha256).toEqual([sha('a')]);
  });

  it(`το ιστορικό κόβεται στο όριο (${MEDIA_SOURCE_HISTORY_LIMIT})`, () => {
    const full = Array.from({ length: MEDIA_SOURCE_HISTORY_LIMIT }, (_, i) => i.toString(16).padStart(64, 'f'));
    const { source } = nextMediaSource(stored({ previousSha256: full }), observed({ contentSha256: sha('b') }));
    expect(source.previousSha256).toHaveLength(MEDIA_SOURCE_HISTORY_LIMIT);
    expect(source.previousSha256[0]).toBe(sha('a'));
  });

  it('ίδιο περιεχόμενο ⇒ ιστορικό αμετάβλητο, validators ανανεωμένα', () => {
    const { source, verdict } = nextMediaSource(stored({ previousSha256: [sha('c')] }), observed({ etag: '"v2"' }));
    expect(verdict).toBe('unchanged');
    expect(source.previousSha256).toEqual([sha('c')]);
    expect(source.etag).toBe('"v2"');
  });
});

describe('revalidatedMediaSource — απάντηση 304', () => {
  it('κρατά περιεχόμενο και validators όταν ο 304 δεν φέρνει νέα· ανανεώνει χρόνο και μεταφορά', () => {
    const next = revalidatedMediaSource(stored(), { etag: null, lastModified: null, transport: 'insecure', checkedAt: 'T2' });
    expect(next).toEqual(stored({ transport: 'insecure', checkedAt: 'T2' }));
  });

  it('ο 304 με νέο ETag το ανανεώνει (RFC 9110 §15.4.5)', () => {
    expect(revalidatedMediaSource(stored(), { etag: '"v9"', lastModified: null, transport: 'secure', checkedAt: 'T2' }).etag).toBe('"v9"');
  });
});

describe('mediaSourceFromDocument — ο αναγνώστης, ποτέ cast', () => {
  const expected = { companyId: 'comp_1', uri: URI };

  it('έγκυρο έγγραφο ⇒ ο ορισμός', () => {
    expect(mediaSourceFromDocument({ ...stored() }, expected)).toEqual(stored());
  });

  it('🔴 ξένος χώρος ή άλλη διεύθυνση ⇒ `null` (ξένο ≡ ανύπαρκτο)', () => {
    expect(mediaSourceFromDocument({ ...stored(), companyId: 'comp_2' }, expected)).toBeNull();
    expect(mediaSourceFromDocument({ ...stored(), uri: 'https://other.example/x.pdf' }, expected)).toBeNull();
  });

  it.each([
    ['sha256 που δεν είναι hex 64', { contentSha256: 'xyz' }],
    ['άγνωστη μεταφορά', { transport: 'plain' }],
    ['ETag που δεν είναι κείμενο', { etag: 42 }],
    ['κενό αρχείο', { contentFileId: '' }],
    ['ιστορικό που δεν είναι πίνακας', { previousSha256: 'a' }],
  ])('🔴 αλλοιωμένο πεδίο (%s) ⇒ `null`: η επόμενη λήψη χωρίς validators, ποτέ με ψεύτικα', (_, broken) => {
    expect(mediaSourceFromDocument({ ...stored(), ...broken }, expected)).toBeNull();
  });

  it('απόν έγγραφο ⇒ `null`', () => {
    expect(mediaSourceFromDocument(undefined, expected)).toBeNull();
  });
});
