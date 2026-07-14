/**
 * ADR-654 — descriptor completeness για τα left-palette entourage image πεδία +
 * ο pure `imageSourceLabel` helper. Mirror του `hatch-property-fields.test.ts`.
 *
 * Guards ότι κάθε field στοχεύει έναν ΠΡΑΓΜΑΤΙΚΟ `IMAGE_PROPERTY_KEYS` (ώστε read/write
 * να μη no-op σιωπηλά), ότι τα labels είναι `imageAdvancedPanel.fields.*`, και ότι τα
 * control types + numeric configs είναι συνεπή.
 */

// Το `useImagePropertyBridge` (πηγή του `imageSourceLabel`) φορτώνει το layer-field wiring,
// που στην αλυσίδα import μπορεί να αγγίξει firebase auth — stub το πριν τα imports.
jest.mock('firebase/auth', () => ({
  __esModule: true,
  getAuth: () => ({ currentUser: null }),
  onAuthStateChanged: (_a: unknown, cb: (u: null) => void) => {
    cb(null);
    return () => {};
  },
  signInAnonymously: jest.fn(),
}));

import { IMAGE_PROPERTY_GROUPS } from '../image-property-fields';
import { IMAGE_PROPERTY_KEYS } from '../../ribbon/hooks/bridge/image-command-keys';
import { imageSourceLabel } from '../useImagePropertyBridge';

const allFields = IMAGE_PROPERTY_GROUPS.flatMap((g) => g.fields);
const validKeys = new Set<string>(Object.values(IMAGE_PROPERTY_KEYS));
const byKey = (k: string) => allFields.find((f) => f.commandKey === k);

describe('IMAGE_PROPERTY_GROUPS descriptor', () => {
  it('targets only valid bridge command keys', () => {
    for (const f of allFields) {
      expect(validKeys.has(f.commandKey)).toBe(true);
    }
  });

  it('labels every field with imageAdvancedPanel.fields.*', () => {
    for (const f of allFields) {
      expect(f.labelKey.startsWith('imageAdvancedPanel.fields.')).toBe(true);
    }
  });

  it('routes each field to the matching palette control', () => {
    expect(byKey(IMAGE_PROPERTY_KEYS.source)?.control).toBe('readout');
    expect(byKey(IMAGE_PROPERTY_KEYS.layer)?.control).toBe('select');
    expect(byKey(IMAGE_PROPERTY_KEYS.posX)?.control).toBe('numeric');
    expect(byKey(IMAGE_PROPERTY_KEYS.posY)?.control).toBe('numeric');
    expect(byKey(IMAGE_PROPERTY_KEYS.width)?.control).toBe('numeric');
    expect(byKey(IMAGE_PROPERTY_KEYS.height)?.control).toBe('numeric');
    expect(byKey(IMAGE_PROPERTY_KEYS.rotation)?.control).toBe('numeric');
  });

  it('gives every numeric field an editable numericInput config', () => {
    for (const f of allFields) {
      if (f.control === 'numeric') {
        expect(f.numericInput?.editable).toBe(true);
      }
    }
  });

  it('constrains width/height to strictly positive (no degenerate frame)', () => {
    expect(byKey(IMAGE_PROPERTY_KEYS.width)?.numericInput?.min).toBeGreaterThan(0);
    expect(byKey(IMAGE_PROPERTY_KEYS.height)?.numericInput?.min).toBeGreaterThan(0);
  });

  it('allows negative coordinates + rotation (signed)', () => {
    expect(byKey(IMAGE_PROPERTY_KEYS.posX)?.numericInput?.allowNegative).toBe(true);
    expect(byKey(IMAGE_PROPERTY_KEYS.posY)?.numericInput?.allowNegative).toBe(true);
    expect(byKey(IMAGE_PROPERTY_KEYS.rotation)?.numericInput?.allowNegative).toBe(true);
  });

  it('exposes exactly the 2 canonical sections (general + geometry)', () => {
    expect(IMAGE_PROPERTY_GROUPS.map((g) => g.id)).toEqual(['general', 'geometry']);
  });
});

describe('imageSourceLabel', () => {
  it('extracts the filename from a Firebase Storage download URL (strips query)', () => {
    expect(
      imageSourceLabel('https://firebasestorage.googleapis.com/v0/b/x/o/sofa_1.webp?alt=media&token=abc'),
    ).toBe('sofa_1.webp');
  });

  it('decodes percent-encoded path segments', () => {
    expect(imageSourceLabel('https://host/o/tree%201.webp')).toBe('tree 1.webp');
  });

  it('returns the last segment for a plain path', () => {
    expect(imageSourceLabel('/assets/entourage/car_2.webp')).toBe('car_2.webp');
  });

  it('falls back to the raw string when there is no path', () => {
    expect(imageSourceLabel('person_3')).toBe('person_3');
  });

  it('returns empty string for empty url', () => {
    expect(imageSourceLabel('')).toBe('');
  });
});
