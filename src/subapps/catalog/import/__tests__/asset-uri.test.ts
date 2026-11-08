/**
 * Κανονικό URI μέσου (ADR-934 §5.2 Μ5): το ίδιο αρχείο ⇒ η ίδια συμβολοσειρά, διαφορετικό αρχείο ⇒ διαφορετική.
 */

import { canonicalAssetUri } from '../asset-uri';

describe('canonicalAssetUri', () => {
  it.each([
    ['HTTPS://Cdn.Example.COM/a.pdf', 'https://cdn.example.com/a.pdf'],
    ['https://cdn.example.com:443/a.pdf', 'https://cdn.example.com/a.pdf'],
    ['http://cdn.example.com:80/a.pdf', 'http://cdn.example.com/a.pdf'],
    ['  https://cdn.example.com/a.pdf#page=3  ', 'https://cdn.example.com/a.pdf'],
    ['https://bücher.example/a.pdf', 'https://xn--bcher-kva.example/a.pdf'],
  ])('ίδιο αρχείο: %s ⇒ %s', (raw, expected) => {
    expect(canonicalAssetUri(raw)).toBe(expected);
  });

  it('το query ΜΕΝΕΙ αυτούσιο: σε υπογεγραμμένο URL το query είναι το αρχείο', () => {
    const signed = 'https://bucket.s3.example.com/a.pdf?X-Amz-Signature=AbC&X-Amz-Expires=60';
    expect(canonicalAssetUri(signed)).toBe(signed);
    expect(canonicalAssetUri('https://x.example/a.pdf?v=1')).not.toBe(canonicalAssetUri('https://x.example/a.pdf?v=2'));
  });

  it('η διαδρομή κρατά πεζά/κεφαλαία: στους περισσότερους servers είναι άλλο αρχείο', () => {
    expect(canonicalAssetUri('https://x.example/A.pdf')).not.toBe(canonicalAssetUri('https://x.example/a.pdf'));
  });

  it.each([[''], ['   '], ['datasheets/a.pdf'], ['ftp://x.example/a.pdf'], ['file:///c:/a.pdf'], ['mailto:a@x.example'], ['https://']])(
    'δεν κατεβαίνει ⇒ null: %s',
    (raw) => {
      expect(canonicalAssetUri(raw)).toBeNull();
    },
  );
});
