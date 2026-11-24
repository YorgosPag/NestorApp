import 'server-only';

/**
 * @fileoverview **Κανονικοποίηση του λογοτύπου εταιρείας** — bytes του χρήστη ⇒ PNG/JPEG sRGB, χωρίς μεταδεδομένα,
 *   στραμμένο, με ανώτατη πλευρά (ADR-ACC-018 §17).
 * @module server/company/brand-logo-normalize.server
 * @related lib/company/brand-logo-policy (τα όρια) · server/images/raster-encoder (ο ΕΝΑΣ κωδικοποιητής)
 *
 * 🔑 **Δεν αποθηκεύεται ΠΟΤΕ το αρχείο του χρήστη** — αποθηκεύεται ό,τι παρήγαγε ο κωδικοποιητής μας. Έτσι γίνονται
 *    αδύνατα *by construction*: διαρροή EXIF/GPS, ενσωματωμένο ωφέλιμο φορτίο, CMYK που βγαίνει λάθος (γνωστό πρόβλημα
 *    του QuickBooks), WebP που δεν ενσωματώνει το jsPDF, φωτογραφία κινητού γυρισμένη στο πλάι.
 * 🔑 Διαφάνεια ⇒ PNG · αδιαφανές ⇒ JPEG (η απόφαση του `encodeRasterRendition`, όχι δεύτερη εδώ).
 */

import { createHash } from 'node:crypto';

import type { BrandLogoContentType } from '@/types/company-brand';
import {
  BRAND_LOGO_JPEG_QUALITY,
  BRAND_LOGO_MAX_EDGE_PX,
  isBrandLogoLargeEnough,
  judgeBrandLogoInput,
  type BrandLogoRefusal,
} from '@/lib/company/brand-logo-policy';
import { CONTENT_SIGNATURE_HEAD_BYTES } from '@/lib/files/content-signature';
import { imageRasterFactsIn } from '@/lib/images/stored-image-dimensions';
import { readImageMetadata } from '@/server/images/image-metadata';
import { decodeOriented, encodeRasterRendition, type RasterRenditionSpec } from '@/server/images/raster-encoder';

/** Η συνταγή: όλα σε sRGB (οθόνη και PDF), επίπεδα χρώματα ⇒ υψηλή ποιότητα χωρίς υποδειγματοληψία χρώματος. */
const BRAND_LOGO_RENDITION: RasterRenditionSpec = {
  box: { fit: 'max-edge', px: BRAND_LOGO_MAX_EDGE_PX },
  colour: 'srgb',
  jpegQuality: BRAND_LOGO_JPEG_QUALITY,
  chromaSubsampling: '4:4:4',
};

/** Το κανονικοποιημένο λογότυπο, έτοιμο για αποθήκευση. */
export interface NormalizedBrandLogo {
  readonly bytes: Buffer;
  readonly contentType: BrandLogoContentType;
  readonly width: number;
  readonly height: number;
  readonly sha256: string;
}

type BrandLogoNormalization =
  | { readonly kind: 'normalized'; readonly logo: NormalizedBrandLogo }
  | { readonly kind: 'refused'; readonly refusal: BrandLogoRefusal };

/** sha256 (hex) — η ταυτότητα των bytes σε κάθε σημείο (αποθήκευση · στιγμιότυπο · ανάγνωση PDF). */
function brandLogoSha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

const refused = (refusal: BrandLogoRefusal): BrandLogoNormalization => ({ kind: 'refused', refusal });

/** Bytes του χρήστη ⇒ λογότυπο προς αποθήκευση, ή κατονομασμένη άρνηση. Δεν πετά για κακή είσοδο. */
export async function normalizeBrandLogo(input: Buffer): Promise<BrandLogoNormalization> {
  const early = judgeBrandLogoInput(input.subarray(0, CONTENT_SIGNATURE_HEAD_BYTES), input.length);
  if (early !== null) return refused(early);

  const facts = await imageRasterFactsIn(input, readImageMetadata);
  if (facts === null || facts.colour === null) return refused('undecodable');
  if (!isBrandLogoLargeEnough(facts.dimensions.width, facts.dimensions.height)) return refused('too-small');

  try {
    const rendition = await encodeRasterRendition(decodeOriented(input), facts.colour, BRAND_LOGO_RENDITION);
    const contentType: BrandLogoContentType = rendition.contentType === 'image/png' ? 'image/png' : 'image/jpeg';
    return {
      kind: 'normalized',
      logo: {
        bytes: rendition.bytes,
        contentType,
        width: rendition.width,
        height: rendition.height,
        sha256: brandLogoSha256(rendition.bytes),
      },
    };
  } catch {
    // Κεφαλίδα που διαβάστηκε αλλά pixel που δεν αποκωδικοποιούνται (κομμένο αρχείο).
    return refused('undecodable');
  }
}
