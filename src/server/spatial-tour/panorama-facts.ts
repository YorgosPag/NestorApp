import 'server-only';

/**
 * @fileoverview **ΤΑ ΓΕΓΟΝΟΤΑ ΕΝΟΣ ΠΑΝΟΡΑΜΑΤΟΣ, ΑΠΟ ΤΑ BYTES** — τύπος/διαστάσεις (`sharp`) + XMP GPano (`exifr`).
 * @related ADR-884 Φ0.8 · `lib/spatial-tour/panorama-policy.ts` (η κρίση)
 * @module server/spatial-tour/panorama-facts
 *
 * 🔑 Εδώ **μόνο εξάγουμε**· κρίνει το `judgePanorama`. Κάθε αποτυχία ανάγνωσης γίνεται **απουσία** γεγονότος
 * (`null`), και η κρίση την απορρίπτει με όνομα — ποτέ εξαίρεση που θα γινόταν 500 για κατεστραμμένο αρχείο.
 * ⚠️ **SERVER-ONLY**: το `sharp` είναι εγγενές module (ίδιο με το `public-shelf-sanitise.ts`).
 * ⚠️ Διαβάζεται **μόνο η κεφαλίδα** — καμία αποκωδικοποίηση pixel για 40 MB σφαίρα.
 */

import exifr from 'exifr';
import sharp from 'sharp';

import type { PanoramaFacts } from '@/lib/spatial-tour/panorama-policy';
import { isRecord } from '@/lib/type-guards';

type EmbeddedFacts = Pick<PanoramaFacts, 'projectionType' | 'poseHeadingDegrees' | 'takenAt'>;

const NO_EMBEDDED_FACTS: EmbeddedFacts = { projectionType: null, poseHeadingDegrees: null, takenAt: null };

/** Η στιγμή λήψης — το `exifr` δίνει `Date`· ό,τι άλλο (ή άκυρη ημερομηνία) ⇒ άγνωστη. */
function takenAtOf(value: unknown): string | null {
  return value instanceof Date && Number.isFinite(value.getTime()) ? value.toISOString() : null;
}

/** XMP GPano + EXIF — το `exifr` δίνει το GPano είτε επίπεδο είτε κάτω από `GPano`, ανάλογα με την έκδοση. */
function embeddedFactsOf(parsed: unknown): EmbeddedFacts {
  const root = isRecord(parsed) ? parsed : {};
  const gpano = isRecord(root.GPano) ? root.GPano : root;
  const projection = gpano.ProjectionType;
  const heading = Number(gpano.PoseHeadingDegrees);
  return {
    projectionType: typeof projection === 'string' ? projection : null,
    poseHeadingDegrees: Number.isFinite(heading) ? heading : null,
    takenAt: takenAtOf(root.DateTimeOriginal),
  };
}

async function readEmbeddedFacts(bytes: Buffer): Promise<EmbeddedFacts> {
  try {
    return embeddedFactsOf(await exifr.parse(bytes, { xmp: true, exif: true, tiff: true, gps: false, icc: false, iptc: false }));
  } catch {
    // Χωρίς (αναγνώσιμα) μεταδεδομένα ⇒ καμία δήλωση — η αναλογία κρίνει μόνη της.
    return NO_EMBEDDED_FACTS;
  }
}

/** **Bytes → γεγονότα.** Ποτέ δεν πετά για «κακό αρχείο»· μόνο για ό,τι δεν είναι αρχείο καθόλου. */
export async function readPanoramaFacts(bytes: Buffer): Promise<PanoramaFacts> {
  const metadata = await sharp(bytes).metadata().catch(() => null);
  const embedded = await readEmbeddedFacts(bytes);
  return {
    format: metadata?.format ?? null,
    widthPx: metadata?.width ?? null,
    heightPx: metadata?.height ?? null,
    byteLength: bytes.byteLength,
    ...embedded,
  };
}
