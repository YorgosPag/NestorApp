/**
 * dxf-scene-path — ο ΕΝΑΣ κανόνας «πού ζει το `.scene.json` ενός FileRecord» (ADR-293).
 *
 * Pure + dependency-free (κανένα Firebase import), ώστε να τον μοιράζονται η υπηρεσία
 * (`DxfFirestoreService.deriveScenePath`) και οι pure επιλυτές στόχου
 * (`systems/levels/level-drawing-birth.ts`, ADR-913) χωρίς δεύτερο αντίγραφο του regex.
 *
 * @module subapps/dxf-viewer/services/dxf-scene-path
 */

/**
 * Δίνει `companies/.../files/file_xxx.scene.json` από `companies/.../files/file_xxx.dxf`.
 *
 * Αφαιρεί ΟΛΕΣ τις καταλήξεις στο τέλος (`.dxf`, `.scene.json`, `.scene.scene.json`, …)
 * με το ίδιο regex που χρησιμοποιεί το scene-API — έτσι γραφή και ανάγνωση καταλήγουν
 * πάντα στο ίδιο κανονικό path, ακόμη κι αν το `storagePath` είχε αλλοιωθεί παλιότερα.
 */
export function deriveScenePath(fileRecordStoragePath: string): string {
  const base = fileRecordStoragePath.replace(/(\.[a-zA-Z0-9]+)+$/, '');
  return `${base}.scene.json`;
}
