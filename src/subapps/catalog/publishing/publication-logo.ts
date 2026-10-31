/**
 * **Ποιο μέσο μπαίνει ως λογότυπο σε έκδοση** (ADR-923 §5.6.1): μία κρίση για τον επιλογέα και για τον γραφέα, ώστε η φόρμα
 * να μην προσφέρει ποτέ κάτι που ο γραφέας θα απέρριπτε.
 *
 * 🔑 **Ρόλος `logo`**: ο ρόλος λέει τι **είναι** το μέσο, άρα το λογότυπο ξεχωρίζει από τις φωτογραφίες προϊόντων.
 * ⚠️ **Όχι SVG**: η έκδοση τυπώνει μόνο αποδόσεις, και το SVG δεν έχει (`needsCatalogRenditions`, ADR-899). Χωρίς αυτή την
 *    κρίση, το πιο συνηθισμένο αρχείο λογότυπου θα έριχνε κάθε έκδοση σε `renditionMissing`.
 * @module subapps/catalog/publishing/publication-logo
 */

import { needsCatalogRenditions } from '../renditions/catalog-renditions';
import type { CatalogAssetDefinition } from '../types/asset';
import type { AssetFileTypeFacts } from '../vocabulary/asset-files';

type LogoCandidate = Pick<CatalogAssetDefinition, 'role' | 'kind' | 'fileId'>;

/** `file` = τα στοιχεία του τρέχοντος αρχείου του μέσου· `null` όταν δεν υπάρχει αρχείο. */
export function isPublicationLogo(asset: LogoCandidate, file: AssetFileTypeFacts | null): boolean {
  return asset.role === 'logo' && asset.fileId !== null && file !== null && needsCatalogRenditions(asset.kind, file);
}
