/**
 * =============================================================================
 * ΜΕΣΑ ΑΠΟ ΔΙΕΥΘΥΝΣΗ — ΤΑΥΤΟΤΗΤΑ ΔΙΕΥΘΥΝΣΗΣ ΚΑΙ ΠΕΡΙΕΧΟΜΕΝΟΥ (ADR-934 §5.2.2 Μ-β3)
 * =============================================================================
 *
 * Δύο ταυτότητες, **ποτέ μία** (ο Stibo κρατά μόνο το URL· εμείς και τα δύο):
 *   • **διεύθυνση** (`catalog_media_sources`, id από το κανονικό URI): τι έδωσε τελευταία φορά (validators για conditional
 *     GET · sha256 · ιστορικό εκδόσεων) ⇒ «νέα έκδοση» όταν αλλάζει το sha256 πίσω από την ίδια διεύθυνση (Μ5).
 *   • **περιεχόμενο** (αρχείο καραντίνας, κάτοχος `catalog_media_content` = sha256): ίδιο αρχείο από δύο διευθύνσεις ή δύο
 *     παρτίδες = **ένα** αρχείο.
 *
 * @module subapps/catalog/types/catalog-media
 */

import type { OutboundTransport } from '@/lib/security/outbound-fetch';
import type { AssetFetchFailure, AssetFetchStatus, StoredAssetFetchStatus } from '../vocabulary/asset-fetch';
import type { CatalogAssetRole } from '../vocabulary/asset-roles';
import type { AssetKind } from '../vocabulary/attribute-types';

/** Πόσα παλιά sha256 κρατά μια διεύθυνση — αρκετά για να ξεχωρίσει «επέστρεψε σε παλιά έκδοση» από «νέα». */
export const MEDIA_SOURCE_HISTORY_LIMIT = 10;

/** Το έγγραφο `catalog_media_sources/{cmsrc_…}` — ένα ανά (χώρος, κανονικό URI). */
export interface CatalogMediaSourceDefinition {
  readonly companyId: string;
  /** Το **κανονικό** URI (`canonicalAssetUri`) — το ίδιο που έδωσε το id. */
  readonly uri: string;
  /** Validators της τελευταίας απάντησης 200 — για το conditional GET της επόμενης λήψης. */
  readonly etag: string | null;
  readonly lastModified: string | null;
  /** Το περιεχόμενο που δίνει **τώρα** η διεύθυνση. */
  readonly contentSha256: string;
  /** Το αρχείο καραντίνας αυτού του περιεχομένου. */
  readonly contentFileId: string;
  /** `insecure` ⇒ κατέβηκε με http, μετά από αποτυχημένη αναβάθμιση σε https (φαίνεται στον έλεγχο, Μ-γ). */
  readonly transport: OutboundTransport;
  /** Τελευταίος έλεγχος (200 **ή** 304). */
  readonly checkedAt: string;
  /** Τα προηγούμενα sha256 της διεύθυνσης, νεότερο πρώτο, ως {@link MEDIA_SOURCE_HISTORY_LIMIT}. */
  readonly previousSha256: readonly string[];
}

/**
 * **Τι βρήκε η λήψη** για μια διεύθυνση (Μ5):
 *   • `new` — πρώτη φορά αυτή η διεύθυνση **και** αυτό το περιεχόμενο·
 *   • `sameContent` — πρώτη φορά η διεύθυνση, αλλά το περιεχόμενο το έχουμε ήδη (από άλλη διεύθυνση ή παρτίδα)·
 *   • `unchanged` — ίδια διεύθυνση, ίδιο περιεχόμενο (304 ή ίδιο sha256)·
 *   • `newVersion` — ίδια διεύθυνση, **άλλο** περιεχόμενο.
 */
export type MediaSourceVerdict = 'new' | 'sameContent' | 'unchanged' | 'newVersion';

// ── Η λήψη μέσα σε μια παρτίδα (ADR-934 §5.2.2 Μ-β4) ───────────────────────────────────────────────────────────────────

/** Το περιεχόμενο σε καραντίνα, όπως το βλέπει όποιος το χρησιμοποιεί: ταυτότητα, μέγεθος και τύπος από τα **bytes**. */
export interface MediaContentFacts {
  readonly fileId: string;
  readonly sha256: string;
  readonly sizeBytes: number;
  readonly kind: AssetKind;
  readonly ext: string;
  readonly contentType: string;
}

/** Γιατί δεν κατέβηκε· `httpStatus` μόνο όταν ο server του προμηθευτή απάντησε. */
export interface ImportAssetFetchFailure {
  readonly code: AssetFetchFailure;
  readonly httpStatus: number | null;
}

/**
 * Το έγγραφο `catalog_import_asset_fetches/{ciafx_…}` — **μία** λήψη ανά (παρτίδα, κανονικό URI), όσοι ρόλοι ή γραμμές κι αν
 * τη ζητούν. Αποτέλεσμα μηχανής: κανένα ίχνος οντότητας (η προέλευση του αρχείου γράφεται στο ίχνος του αρχείου).
 */
export interface ImportAssetFetchDefinition {
  readonly companyId: string;
  readonly batchId: string;
  readonly uri: string;
  /** Οι ρόλοι που ζητούσαν τη διεύθυνση τη στιγμή της λήψης — ο πρώτος έκρινε το περιεχόμενο. */
  readonly roles: readonly CatalogAssetRole[];
  readonly status: StoredAssetFetchStatus;
  /** Ζωντανή μόνο σε `fetching`: μετά τη λήξη η διεύθυνση ξαναδιεκδικείται. */
  readonly leaseUntil: number | null;
  /** Ο αριθμός της τρέχουσας προσπάθειας — και **σφραγίδα**: μόνο ο κάτοχός της κλείνει τη λήψη. */
  readonly attempts: number;
  readonly failure: ImportAssetFetchFailure | null;
  readonly verdict: MediaSourceVerdict | null;
  readonly content: MediaContentFacts | null;
  readonly transport: OutboundTransport | null;
  readonly updatedAt: string;
  readonly updatedBy: string;
}

/** Μία γραμμή της ουράς στην οθόνη: η διεύθυνση όπως τη ζητούν οι προτάσεις, και ό,τι ξέρουμε για τη λήψη της. */
export interface ImportAssetView {
  readonly uri: string;
  readonly roles: readonly CatalogAssetRole[];
  readonly filename: string | null;
  readonly status: AssetFetchStatus;
  readonly attempts: number;
  readonly failure: ImportAssetFetchFailure | null;
  readonly verdict: MediaSourceVerdict | null;
  readonly content: MediaContentFacts | null;
  readonly transport: OutboundTransport | null;
}
