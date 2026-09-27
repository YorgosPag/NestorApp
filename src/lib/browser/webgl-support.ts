/**
 * @fileoverview **ΜΠΟΡΕΙ ΑΥΤΟΣ Ο BROWSER ΝΑ ΖΩΓΡΑΦΙΣΕΙ WebGL;** — ερώτηση **πριν** από τη μηχανή (ADR-884 Φ1 · §4.8).
 * @module lib/browser/webgl-support
 *
 * 🔑 **Ρωτά, δεν υποθέτει**: οι 54 χρήσεις WebGL του `dxf-viewer` υποθέτουν ότι υπάρχει (εργαλείο γραφείου)· ο θεατής
 * περιήγησης τρέχει στη **δημόσια** αγγελία, σε ό,τι συσκευή έχει ο αγοραστής — με WebGL απενεργοποιημένο (πολιτική
 * εταιρείας, «λειτουργία εξοικονόμησης», χαμένο πλαίσιο GPU) ο επισκέπτης βλέπει **εξήγηση + λίστα σημείων**, ποτέ μαύρο.
 * ⚠️ **`false` στον διακομιστή και στο jsdom** — δεν υπάρχει GPU να ρωτηθεί. Το προσωρινό πλαίσιο απελευθερώνεται αμέσως
 * (`WEBGL_lose_context`), ώστε να μην πιάνει μία από τις ~16 θέσεις πλαισίου του browser.
 */

export function isWebGLAvailable(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    if (gl === null) return false;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
}
