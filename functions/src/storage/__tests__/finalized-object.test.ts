/**
 * ADR-895 Α7 · Φ2 — ο ΕΝΑΣ προσαρμογέας γεγονότος: δύο σχήματα (gen1 / gen2) ⇒ ένα, με θέση κάδου.
 */

import { finalizedObjectOf } from '../finalized-object';

const NAMES = { 'legacy-default': 'default-bucket', 'eu-originals': 'eu-bucket' } as const;

describe('finalizedObjectOf', () => {
  it('gen1 (size συμβολοσειρά) στον κανονικό ⇒ legacy, size αριθμός', () => {
    expect(finalizedObjectOf({ bucket: 'default-bucket', name: 'companies/a', contentType: 'x/y', size: '42' }, NAMES)).toEqual({
      bucket: 'default-bucket',
      placement: 'legacy-default',
      name: 'companies/a',
      contentType: 'x/y',
      size: 42,
      generation: null,
      metadata: {},
    });
  });

  it('gen2 (size αριθμός) στον ΕΕ ⇒ eu-originals', () => {
    expect(finalizedObjectOf({ bucket: 'eu-bucket', name: 'companies/a', size: 7 }, NAMES)).toEqual({
      bucket: 'eu-bucket',
      placement: 'eu-originals',
      name: 'companies/a',
      contentType: null,
      size: 7,
      generation: null,
      metadata: {},
    });
  });

  it('⛔ αδήλωτος κάδος ⇒ null (καμία μαντεψιά)', () => {
    expect(finalizedObjectOf({ bucket: 'stranger', name: 'companies/a' }, NAMES)).toBeNull();
  });

  it('size απόν ή μη αριθμητικό ⇒ null', () => {
    expect(finalizedObjectOf({ bucket: 'eu-bucket' }, NAMES)?.size).toBeNull();
    expect(finalizedObjectOf({ bucket: 'eu-bucket', size: 'abc' }, NAMES)?.size).toBeNull();
  });

  it('🔴 ADR-899 §3.7 γενιά ως STRING (19 ψηφία > 2^53) · custom metadata αυτούσιο', () => {
    const object = finalizedObjectOf(
      { bucket: 'eu-bucket', name: 'companies/a', generation: '1727000000123456789', metadata: { imageWidth: '1200' } },
      NAMES,
    );
    expect(object?.generation).toBe('1727000000123456789');
    expect(object?.metadata).toEqual({ imageWidth: '1200' });
  });
});
