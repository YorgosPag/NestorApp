/**
 * @fileoverview **Η κλίμακα των προεπισκοπήσεων** (ADR-899 §3.1).
 *
 * Μεταλλάξεις που πρέπει να πιάσει:
 * - Λ1: ο αναλυτής δέχεται ό,τι μοιάζει με αριθμό (`640.0`, `+640`, ` 640`) ⇒ πολλά κλειδιά για ένα παράγωγο.
 * - Λ2: η κλίμακα χάνει τη συμφωνία με το δημόσιο ράφι (640/1280/2560).
 * - Λ3: svg/gif γίνονται «προεπισκοπήσιμα».
 * - Λ4: η επιλογή βαθμίδας δίνει τη μεγαλύτερη (σπατάλη) ή μικρότερη (θόλωμα) από την ελάχιστη επαρκή.
 * - Λ5 (ADR-899 §3.7, Π2): η κλίμακα του αρχείου δεν κόβεται στην πρώτη επαρκή βαθμίδα, ή κόβεται **κάτω** από αυτήν
 *   (θόλωμα)· το κανονικό πλάτος του server διαφωνεί με την κλίμακα του client.
 * - Λ6: zoom πάνω από το πρωτότυπο ζητά παράγωγο (ξανασυμπίεση χωρίς κανένα νέο pixel).
 */

import {
  FILE_PREVIEW_ENCODING,
  FILE_PREVIEW_FALLBACK_WIDTH,
  effectivePreviewWidth,
  filePreviewWidthFor,
  filePreviewWidthOf,
  isPreviewableContentType,
  previewWidthsFor,
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

  it('🔴 Λ4 η ΜΙΚΡΟΤΕΡΗ επαρκής βαθμίδα · πάνω από την κορυφή ⇒ πρωτότυπο', () => {
    expect(filePreviewWidthFor(1)).toBe(320);
    expect(filePreviewWidthFor(320)).toBe(320);
    expect(filePreviewWidthFor(321)).toBe(640);
    expect(filePreviewWidthFor(1281)).toBe(2560);
    expect(filePreviewWidthFor(2560)).toBe(2560);
    expect(filePreviewWidthFor(2561)).toBe('original');
    expect(filePreviewWidthFor(Number.NaN)).toBe('original');
  });

  it('🔴 Λ5 κλίμακα αρχείου ως την ΠΡΩΤΗ επαρκή βαθμίδα · ίδια απάντηση client/server', () => {
    expect(previewWidthsFor(null)).toEqual(FILE_PREVIEW_ENCODING.widths);
    expect(previewWidthsFor(undefined)).toEqual(FILE_PREVIEW_ENCODING.widths);
    expect(previewWidthsFor(0)).toEqual(FILE_PREVIEW_ENCODING.widths);
    expect(previewWidthsFor(200)).toEqual([320]);
    expect(previewWidthsFor(320)).toEqual([320]);
    expect(previewWidthsFor(1183)).toEqual([320, 640, 1280]);
    expect(previewWidthsFor(1280)).toEqual([320, 640, 1280]);
    expect(previewWidthsFor(1281)).toEqual([320, 640, 1280, 2560]);
    expect(previewWidthsFor(4000)).toEqual([320, 640, 1280, 2560]);
    // Ο server κανονικοποιεί ΣΤΗΝ κορυφή της ίδιας κλίμακας — ποτέ κάτω από το αίτημα όταν αυτό χρειάζεται.
    expect(effectivePreviewWidth(2560, 1183)).toBe(1280);
    expect(effectivePreviewWidth(1280, 1183)).toBe(1280);
    expect(effectivePreviewWidth(640, 1183)).toBe(640);
    expect(effectivePreviewWidth(2560, null)).toBe(2560);
    expect(effectivePreviewWidth(2560, 739)).toBe(1280);
  });

  it('🔴 Λ6 zoom πάνω από το πρωτότυπο ⇒ το πρωτότυπο · κάτω ⇒ η μικρότερη επαρκής της κομμένης κλίμακας', () => {
    expect(filePreviewWidthFor(1000, 1183)).toBe(1280);
    expect(filePreviewWidthFor(1183, 1183)).toBe(1280);
    expect(filePreviewWidthFor(1184, 1183)).toBe('original');
    expect(filePreviewWidthFor(2000, 4000)).toBe(2560);
    expect(filePreviewWidthFor(3000, 4000)).toBe('original');
    expect(filePreviewWidthFor(300, 200)).toBe('original');
    expect(filePreviewWidthFor(100, 200)).toBe(320);
  });
});
