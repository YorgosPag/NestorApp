/**
 * **ΜΠΟΡΕΙ ΑΥΤΟ ΤΟ ΜΕΣΟ ΝΑ ΦΥΓΕΙ ΣΤΟ ΚΟΙΝΟ;** (ADR-923 §5.13 Σ3 · Ε5): η μία κρίση, χωρίς I/O.
 *
 * 🔒 Κλειστή εξ ορισμού, με τέσσερις ανεξάρτητες ερωτήσεις: εικόνα · σκοπός άδειας που καλύπτει κατάλογο · άδεια σε ισχύ
 *    **τώρα** · έτοιμη απόδοση της τρέχουσας συνταγής. Ληγμένη άδεια πέφτει εδώ χωρίς να γράψει κανείς κάτι.
 * 🔒 Οι άδειες καταλόγου δεν έχουν διάρκεια «όσο ισχύει η εντολή» (`MEDIA_LICENSE_CONTEXTS`), άρα το `mandateActive` είναι
 *    πάντα `false`: εντολή που έφτασε ως εδώ δεν ανοίγει.
 *
 * **Layering**: καθαρή. @module subapps/catalog/public/public-asset-eligibility
 */

import { isMediaLicensePurposeIn } from '@/constants/media-rights-vocabulary';
import { mediaLicenseStanding } from '@/lib/media-rights/media-license-standing';
import { catalogRenditionsStanding, type CatalogRenditions } from '../renditions/catalog-renditions';
import type { CatalogAssetDefinition } from '../types/asset';

export function isPublicAsset(
  asset: Pick<CatalogAssetDefinition, 'kind' | 'rights'>,
  renditions: CatalogRenditions | undefined,
  nowMs: number,
): boolean {
  if (asset.kind !== 'image') return false;
  if (!isMediaLicensePurposeIn('catalog', asset.rights.license.purpose)) return false;
  if (mediaLicenseStanding(asset.rights, nowMs, false) !== 'active') return false;
  return catalogRenditionsStanding(renditions) === 'ready';
}
