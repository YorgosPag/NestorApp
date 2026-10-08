/**
 * 🔗 Η ΑΓΚΥΡΑ ΤΗΣ ΔΙΕΥΘΥΝΣΗΣ ΕΠΙΠΕΔΟΥ ΤΟΥ DXF VIEWER (ADR-400, 2026-10-08).
 *
 * Μεταλλάξεις που πρέπει να πιάσει:
 * - Δ1: η διεύθυνση αλλάζει μορφή / παύει να κωδικοποιεί το id ⇒ το κουμπί «Άνοιγμα στο DXF» ανοίγει λάθος επίπεδο.
 *
 * ⚠️ Η Δ2 («ό,τι γράφει ο κατασκευαστής το διαβάζει ο ΙΔΙΟΣ ο αναγνώστης του viewer») ζει στο
 * `subapps/dxf-viewer/services/__tests__/viewport-persistence.test.ts` — εκεί όπου ο αναγνώστης είναι εσωτερικό σύμβολο.
 */

import { DXF_VIEWER_LEVEL_PARAM, dxfViewerLevelHref } from '../dxf-viewer-routes';

describe('dxfViewerLevelHref', () => {
  test('🔴 Δ1 `/dxf/viewer?lvl=<id>` — χωρίς πρόθεμα χώρου, με κωδικοποιημένο id', () => {
    expect(DXF_VIEWER_LEVEL_PARAM).toBe('lvl');
    expect(dxfViewerLevelHref('lvl_2a7ff5cc')).toBe('/dxf/viewer?lvl=lvl_2a7ff5cc');
    expect(dxfViewerLevelHref('a b&c=d')).toBe('/dxf/viewer?lvl=a%20b%26c%3Dd');
  });
});
