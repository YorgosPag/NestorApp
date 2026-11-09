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
