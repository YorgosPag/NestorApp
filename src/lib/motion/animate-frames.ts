/**
 * @fileoverview **ΚΙΝΗΣΗ ΓΙΑ ΣΥΓΚΕΚΡΙΜΕΝΟ ΧΡΟΝΟ, ΜΕ ΑΚΥΡΩΣΗ** — `requestAnimationFrame` ως `Promise` (ADR-884 Φ1 · §4.8).
 * @related `lib/motion/easing.ts` (η καμπύλη την εφαρμόζει ο καλών) · `lib/a11y/reduced-motion.ts`
 * @module lib/motion/animate-frames
 *
 * 🔑 **Ακύρωση με `AbortSignal`**: ο καλών που αποπροσαρτάται ή αλλάζει γνώμη σταματά την κίνηση **και** την υπόσχεση·
 * κανένα `onFrame` μετά την ακύρωση (καμία εγγραφή σε μηχανή που έχει ήδη απελευθερωθεί).
 * 🔑 **Το τελευταίο καρέ είναι πάντα ακριβώς `durationMs`**: ο καλών βλέπει την τελική τιμή, όχι το 0,97 του τελευταίου
 * καρέ που έτυχε. Διάρκεια ≤ 0 ⇒ ένα καρέ στο τέλος, συγχρόνως.
 */

export function animateFrames(
  durationMs: number,
  onFrame: (elapsedMs: number) => void,
  signal: AbortSignal,
): Promise<void> {
  if (signal.aborted) return Promise.reject(signal.reason);
  if (!(durationMs > 0)) {
    onFrame(0);
    return Promise.resolve();
  }
  return new Promise<void>((resolve, reject) => {
    let start: number | null = null;
    let handle = 0;
    const abort = () => {
      cancelAnimationFrame(handle);
      reject(signal.reason);
    };
    const step = (now: number) => {
      start ??= now;
      const elapsed = Math.min(durationMs, now - start);
      onFrame(elapsed);
      if (elapsed >= durationMs) {
        signal.removeEventListener('abort', abort);
        resolve();
      } else {
        handle = requestAnimationFrame(step);
      }
    };
    signal.addEventListener('abort', abort, { once: true });
    handle = requestAnimationFrame(step);
  });
}
