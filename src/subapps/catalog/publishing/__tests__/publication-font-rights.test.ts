/**
 * ADR-923 §5.6.1 — η κρίση γραμματοσειράς προμηθευτή: τα bits του OpenType `fsType` και οι όψεις μιας συνταγής.
 */
import type { CatalogFontFacts } from '../../types/asset';
import { fontEmbeddingOf, isPublicationFont, publicationFontFamilies, publicationFontRefusal, type PublicationFontCandidate } from '../publication-font-rights';

const facts = (patch: Partial<CatalogFontFacts> = {}): CatalogFontFacts => ({
  family: 'Acme', weight: 400, italic: false, embedding: 'installable', coversLatin: true, coversGreek: true, copyright: null, license: null, licenseUrl: null, sha256: 'a', ...patch,
});
const face = (patch: Partial<CatalogFontFacts> = {}): PublicationFontCandidate => ({ role: 'font', fileId: 'f', font: facts(patch) });

describe('fontEmbeddingOf — OS/2 fsType', () => {
  it.each([
    [0x0000, 'installable'],
    [0x0004, 'previewPrint'],
    [0x0008, 'editable'],
    ['🔴 παλιό αρχείο με πολλά bits: το λιγότερο περιοριστικό', 0x000c, 'editable'],
    ['🔴 το Restricted δεν μετρά όταν δεν είναι μόνο του', 0x0006, 'previewPrint'],
  ].map((row) => (row.length === 2 ? [`0x${Number(row[0]).toString(16)}`, row[0], row[1]] : row)))('%s', (_name, fsType, expected) => {
    expect(fontEmbeddingOf(fsType as number)).toBe(expected);
  });

  it.each([
    ['Restricted', 0x0002],
    ['🔴 χωρίς subsetting: το Typst ενσωματώνει πάντα υποσύνολο', 0x0100],
    ['bitmap μόνο', 0x0200],
    ['bitmap μαζί με επιτρεπτό επίπεδο', 0x0208],
  ])('απαγορεύεται: %s', (_name, fsType) => {
    expect(fontEmbeddingOf(fsType)).toBeNull();
  });
});

describe('publicationFontRefusal', () => {
  it('μία οικογένεια με κανονική όψη περνά', () => {
    expect(publicationFontRefusal([face(), face({ weight: 700 }), face({ italic: true })], 'el')).toBeNull();
  });

  it.each([
    ['καμία όψη', []],
    ['🔴 χωρίς κανονική όψη', [face({ weight: 700 })]],
    ['🔴 δύο οικογένειες', [face(), face({ family: 'Other' })]],
    ['μέσο χωρίς μετρημένα γεγονότα', [face(), { role: 'font', fileId: 'f' } as PublicationFontCandidate]],
    ['μέσο με άλλο ρόλο', [{ ...face(), role: 'logo' } as PublicationFontCandidate]],
    ['μέσο χωρίς αρχείο', [{ ...face(), fileId: null }]],
  ])('αρνείται: %s', (_name, assets) => {
    expect(publicationFontRefusal(assets, 'el')).toBe('publicationFontFamilyInvalid');
  });

  it('🔴 ελληνική έκδοση χωρίς ελληνικά αρνείται· αγγλική όχι', () => {
    const latin = [face({ coversGreek: false })];
    expect(publicationFontRefusal(latin, 'el')).toBe('publicationFontNoGreek');
    expect(publicationFontRefusal(latin, 'en')).toBeNull();
  });
});

describe('publicationFontFamilies', () => {
  it('ομαδοποιεί ανά οικογένεια, με σταθερή σειρά, και αφήνει απέξω ό,τι δεν κρίθηκε', () => {
    const assets = [{ id: 'z', ...face({ family: 'Zeta' }) }, { id: 'a1', ...face() }, { id: 'a2', ...face({ weight: 700 }) }, { id: 'x', role: 'font' as const, fileId: 'f' }];
    const families = publicationFontFamilies(assets);
    expect([...families.keys()]).toEqual(['Acme', 'Zeta']);
    expect(families.get('Acme')?.map((asset) => asset.id)).toEqual(['a1', 'a2']);
    expect(isPublicationFont(assets[3])).toBe(false);
  });
});
