/**
 * @fileoverview **Ο ΑΝΙΧΝΕΥΤΗΣ ΧΩΡΩΝ ΠΙΣΩ ΑΠΟ ΤΟ RPC** — ό,τι τρέχει μέσα στον Web Worker (και στο δίχτυ του κύριου νήματος):
 * φόρτωση κάτοψης με κρυφή μνήμη, ανίχνευση σε μέτρα (ADR-884 Φ2στ-γ Γ3γ-2α · §4.14). Καθαρό — ο αποκωδικοποιητής εισάγεται.
 * @related `space-detect-plan.ts` (μέτρα ⇄ pixel) · `space-detect.ts` (`prepareSpaceRaster`) · `space-detect.worker.ts` (λεπτό
 *   περιτύλιγμα) · `space-detect-client.ts` (η άλλη πλευρά) · `lib/media/image-pixels.ts` (ο πραγματικός αποκωδικοποιητής)
 * @module lib/spatial-tour/space-detect/space-detect-host
 *
 * 🔑 **Μία κάτοψη στη μνήμη**, με κλειδί το URL του παραγώγου: κάθε κλικ και κάθε βήμα του ρυθμιστικού πόρτας ξαναχρησιμοποιεί
 *   την **ίδια** λήψη, αποκωδικοποίηση και μάσκα μελανιού. Νέος όροφος ⇒ η παλιά φεύγει (η μνήμη ενός Worker δεν είναι αποθήκη).
 * 🔑 **Ταυτόχρονες φορτώσεις του ίδιου URL μοιράζονται ΜΙΑ υπόσχεση** (προθέρμανση + πρώτο κλικ πριν τελειώσει)· αποτυχία ⇒ η
 *   μνήμη αδειάζει, ώστε η επόμενη ερώτηση να ξαναδοκιμάσει αντί να κληρονομεί το σφάλμα για πάντα.
 */

import { prepareSpaceRaster } from './space-detect';
import { detectPlanSpace, type PlanDetectRequest, type PlanDetectResult } from './space-detect-plan';
import type { PlanRaster, PreparedPlanRaster } from './space-detect-types';

/** Τα αιτήματα του επεξεργαστή: προθέρμανση μιας κάτοψης, ή ανίχνευση πάνω της. */
export type SpaceDetectMessage =
  | { readonly kind: 'load'; readonly url: string }
  | { readonly kind: 'detect'; readonly url: string; readonly request: PlanDetectRequest };

export type SpaceDetectReply =
  | { readonly kind: 'loaded'; readonly width: number; readonly height: number }
  | { readonly kind: 'detected'; readonly result: PlanDetectResult };

export type PlanRasterDecoder = (url: string) => Promise<PlanRaster>;

/** **Ο χειριστής** — μία κλήση ανά μήνυμα· πετά μόνο όταν η εικόνα δεν φορτώνεται (ο πελάτης το λαμβάνει ως `failed`). */
export function createSpaceDetectHost(decode: PlanRasterDecoder): (message: SpaceDetectMessage) => Promise<SpaceDetectReply> {
  let cached: { readonly url: string; readonly prepared: Promise<PreparedPlanRaster> } | null = null;

  const prepared = (url: string): Promise<PreparedPlanRaster> => {
    if (cached !== null && cached.url === url) return cached.prepared;
    const entry = { url, prepared: decode(url).then(prepareSpaceRaster) };
    cached = entry;
    entry.prepared.catch(() => { if (cached === entry) cached = null; });
    return entry.prepared;
  };

  return async (message) => {
    const plan = await prepared(message.url);
    if (message.kind === 'load') return { kind: 'loaded', width: plan.width, height: plan.height };
    return { kind: 'detected', result: detectPlanSpace(plan, message.request) };
  };
}
