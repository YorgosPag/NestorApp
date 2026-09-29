import 'server-only';

/**
 * @fileoverview **ΑΠΟ ΤΙΣ ΘΟΛΩΜΕΝΕΣ ΠΕΡΙΟΧΕΣ ΣΤΑ ΠΛΑΚΙΔΙΑ** — τι γράφεται στη λήψη όταν αλλάζει το θόλωμα: οι περιοχές, το hash
 * του πρωτοτύπου, και (αν άλλαξαν τα pixel) νέο κλειδί πλακιδίων σε `pending` με τα παλιά **αποσυρμένα** (ADR-884 Φ2ζ · §4.15).
 * @related `lib/spatial-tour/tour-redaction-edit.ts` (οι καθαρές + το υλικό του κλειδιού) · `tour-graph-write.ts` (ο ΕΝΑΣ
 *   γραφέας — γράφει ό,τι επιστρέφει αυτό στην ίδια συναλλαγή) · `tour-tileset-baker.ts` (διαγράφει τα αποσυρμένα, ψήνει το νέο)
 * @module server/spatial-tour/tour-redaction-apply
 *
 * 🔒 **Fail-closed ανά σημείο, όχι ανά περιήγηση** (η Matterport κλείνει όλο τον χώρο ως την επανεπεξεργασία): αλλαγή θολώματος
 *   ⇒ **αυτή** η λήψη `pending` ⇒ ο κριτής του θεατή δεν τη σερβίρει (`isCaptureViewable`) ως να ψηθούν τα θολωμένα. Ποτέ δεν
 *   σερβίρεται pixel που ζητήθηκε να κρυφτεί· τα υπόλοιπα σημεία δεν αγγίζονται.
 * 🔒 **Τα παλιά πλακίδια αποσύρονται**, δεν ξεχνιούνται: η διεύθυνσή τους είναι γνωστή σε όποιον τα είδε — μένουν στο
 *   `retiredKeys` ως να τα διαγράψει ο ψήστης. Επιστροφή σε **προηγούμενο** σύνολο περιοχών ⇒ ίδιο κλειδί με παλιότερο: δεν
 *   αποσύρεται ποτέ το κλειδί που γίνεται τρέχον.
 */

import { createHash } from 'node:crypto';

import { originalHashOf, redactionKeyMaterial } from '@/lib/spatial-tour/tour-redaction-edit';
import type { TourCapture, TourCaptureTileset, TourRedaction } from '@/types/spatial-tour';

/** Τα πεδία της λήψης μετά από αλλαγή θολώματος, και αν χρειάζεται ψήσιμο. */
export interface RedactedCaptureChange {
  readonly fields: {
    readonly redactions: readonly TourRedaction[];
    readonly originalHash: string;
    readonly tileset?: TourCaptureTileset;
  };
  readonly rebake: boolean;
}

/** **Το κλειδί των πλακιδίων** για αυτό το πρωτότυπο με αυτές τις περιοχές — χωρίς περιοχές, το ίδιο το hash του πρωτοτύπου. */
export function tilesetKeyOf(originalHash: string, redactions: readonly TourRedaction[]): string {
  const material = redactionKeyMaterial(originalHash, redactions);
  return material === null ? originalHash : createHash('sha256').update(material).digest('hex');
}

function retire(tileset: TourCaptureTileset, nextKey: string): readonly string[] {
  const previous = tileset.contentHash === null ? [] : [tileset.contentHash];
  return [...new Set([...(tileset.retiredKeys ?? []), ...previous])].filter((key) => key !== nextKey);
}

/**
 * **Η αλλαγή της λήψης** για νέες περιοχές. Ίδιο κλειδί (π.χ. ίδια pixel με άλλα id) ⇒ μόνο οι περιοχές, κανένα ψήσιμο.
 * Λήψη χωρίς hash πρωτοτύπου δεν γεννιέται ποτέ από την ολοκλήρωση — εδώ θα ήταν βλάβη ⇒ `throw`, ποτέ ψήσιμο στα τυφλά.
 */
export function redactedCaptureChange(
  capture: Pick<TourCapture, 'id' | 'originalHash' | 'tileset'>,
  redactions: readonly TourRedaction[],
): RedactedCaptureChange {
  const originalHash = originalHashOf(capture);
  if (originalHash === null) throw new Error(`Tour capture without original hash: ${capture.id}`);
  const key = tilesetKeyOf(originalHash, redactions);
  if (key === capture.tileset.contentHash) return { fields: { redactions, originalHash }, rebake: false };
  const retiredKeys = retire(capture.tileset, key);
  const tileset: TourCaptureTileset = { state: 'pending', contentHash: key, faceSize: null, ...(retiredKeys.length > 0 ? { retiredKeys } : {}) };
  return { fields: { redactions, originalHash, tileset }, rebake: true };
}
