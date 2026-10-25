/**
 * =============================================================================
 * ΜΕΣΟ ΚΑΤΑΛΟΓΟΥ (Asset) — ορισμός (ADR-923 §5.10 Δ9)
 * =============================================================================
 *
 * Το μέσο είναι **οντότητα του καταλόγου** (Akeneo Asset Manager · Salsify DAM), όχι αρχείο:
 * κωδικός, ρόλος, είδος, δικαιώματα και ένας δείκτης στο τρέχον `FileRecord` (τα bytes, μέσω
 * του υπάρχοντος `uploadEntityFile`, κάτοχος `catalog_asset:{assetId}` — ADR-709).
 *
 * 🔑 Νέα έκδοση αρχείου = νέο `FileRecord` κάτω από **το ίδιο** μέσο ⇒ τα προϊόντα δείχνουν
 * πάντα το `assetId` και ποτέ δεν χρειάζεται να ξαναγραφτούν. Το «πού χρησιμοποιείται» είναι
 * **αντίστροφο** (`products.assetIds[]` + `array-contains`), όχι πίνακας που φουσκώνει εδώ.
 *
 * Τα δικαιώματα είναι ο **ένας** τύπος IPTC της πλατφόρμας (`MediaRights`, ADR-884) — όχι δεύτερος.
 *
 * @module subapps/catalog/types/asset
 */

import type { LocalizedText } from '@/i18n/localized-text';
import type { MediaRights } from '@/types/media-rights';
import type { CatalogAssetRole } from '../vocabulary/asset-roles';
import type { AssetKind } from '../vocabulary/attribute-types';

export interface CatalogAssetDefinition {
  /** Αμετάβλητος από τη δημιουργία (ταυτότητα για εισαγωγή/εξαγωγή). */
  readonly code: string;
  /** Τι **είναι** (όχι πού χρησιμοποιείται — αυτό το λέει η ιδιότητα που δείχνει εδώ). */
  readonly role: CatalogAssetRole;
  /** Τι bytes είναι· ο γραφέας το επαληθεύει απέναντι στο MIME του αρχείου (2γ). */
  readonly kind: AssetKind;
  readonly labels: LocalizedText;
  readonly description: LocalizedText;
  readonly rights: MediaRights;
  /** Το τρέχον `FileRecord`· `null` όσο το ανέβασμα δεν έχει ολοκληρωθεί. */
  readonly fileId: string | null;
}
