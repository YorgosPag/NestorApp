/**
 * @fileoverview **Η κλίμακα των προεπισκοπήσεων** (ADR-899 §2).
 *
 * Μεταλλάξεις που πρέπει να πιάσει:
 * - Λ1: ο αναλυτής δέχεται ό,τι μοιάζει με αριθμό (`640.0`, `+640`, ` 640`) ⇒ πολλά κλειδιά για ένα παράγωγο.
 * - Λ2: η κλίμακα χάνει τη συμφωνία με το δημόσιο ράφι (640/1280/2560).
 * - Λ3: svg/gif γίνονται «προεπισκοπήσιμα».
 */

import {
  FILE_PREVIEW_ENCODING,
  FILE_PREVIEW_FALLBACK_WIDTH,
  filePreviewWidthOf,
  isPreviewableContentType,
} from '../file-preview-ladder';

describe('file-preview-ladder', () => {
  it('🔴 Λ1 μόνο ακριβή πλάτη της κλίμακας', () => {
    expect(FILE_PREVIEW_ENCODING.widths.map(String).map(filePreviewWidthOf)).toEqual([...FILE_PREVIEW_ENCODING.widths]);
    for (const raw of ['640.0', '+640', ' 640', '0640', '641', '', '1e3', '-320']) {
      expect(filePreviewWidthOf(raw)).toBeNull();
    }
  });

  it('🔴 Λ2 τα πλάτη του δημόσιου ραφιού περιέχονται, αύξουσα σειρά, εφεδρεία μέσα στην κλίμακα', () => {
    expect(FILE_PREVIEW_ENCODING.widths).toEqual(expect.arrayContaining([640, 1280, 2560]));
    expect([...FILE_PREVIEW_ENCODING.widths]).toEqual([...FILE_PREVIEW_ENCODING.widths].sort((a, b) => a - b));
    expect(FILE_PREVIEW_ENCODING.widths).toContain(FILE_PREVIEW_FALLBACK_WIDTH);
  });

  it('🔴 Λ3 τύποι', () => {
    expect(isPreviewableContentType('image/jpeg')).toBe(true);
    expect(isPreviewableContentType('Image/PNG; charset=binary')).toBe(true);
    for (const type of ['image/svg+xml', 'image/gif', 'image/heic', 'application/pdf', '', null, 42]) {
      expect(isPreviewableContentType(type)).toBe(false);
    }
  });
});
