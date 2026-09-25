/**
 * =============================================================================
 * SHARE RESOLVE CONTRACT — τι απαντά ο διακομιστής στον επισκέπτη ενός συνδέσμου (ADR-884 Φ0.12)
 * =============================================================================
 *
 * Το σύρμα ανάμεσα στο `POST /api/shares/resolve` (+ `/download`) και στη σελίδα
 * `/shared/[token]`. Ζει εδώ — ούτε στον διακομιστή ούτε στη σελίδα — γιατί το εισάγουν
 * **και οι δύο**.
 *
 * 🔑 **Ονομασμένες αρνήσεις, ποτέ boolean** (πρότυπο ADR-853): «έληξε», «εξαντλήθηκε»,
 * «κλειδώθηκε» και «δεν υπάρχει» στέλνουν τον παραλήπτη σε **διαφορετική** ενέργεια.
 * ⚠️ Όμως `not-found` καλύπτει **και** «ανακλήθηκε» **και** «ποτέ δεν υπήρξε»: η διάκριση
 * θα έλεγε σε όποιον μαντεύει διακριτικά ποια **υπήρξαν** κάποτε.
 *
 * @module services/sharing/share-resolve-contract
 */

import type { FileShareResolvedData } from './resolvers/file.resolver';
import type { ContactShareResolvedData } from './resolvers/contact.resolver';
import type {
  BuildingShowcaseResolvedData,
  ParkingShowcaseResolvedData,
  ProjectShowcaseResolvedData,
  PropertyShowcaseResolvedData,
  StorageShowcaseResolvedData,
} from './resolvers/showcase-surfaces.resolvers';

/** Τι επιλύεται ανά είδος — `vendor_rfq_invite` λείπει επίτηδες (δικό του HMAC URL). */
export interface ResolvedShareDataByKind {
  file: FileShareResolvedData;
  contact: ContactShareResolvedData;
  property_showcase: PropertyShowcaseResolvedData;
  project_showcase: ProjectShowcaseResolvedData;
  building_showcase: BuildingShowcaseResolvedData;
  storage_showcase: StorageShowcaseResolvedData;
  parking_showcase: ParkingShowcaseResolvedData;
}

export type ResolvableShareKind = keyof ResolvedShareDataByKind;

/** Η προβολή μιας κοινοποίησης, διακριτή κατά είδος. */
export type ResolvedSharePayload = {
  [K in ResolvableShareKind]: { readonly kind: K; readonly data: ResolvedShareDataByKind[K] };
}[ResolvableShareKind];

/** Γιατί ο επισκέπτης δεν βλέπει τίποτα. */
export type ShareResolveRefusal =
  | 'not-found'
  | 'expired'
  | 'exhausted'
  | 'wrong-password'
  | 'locked'
  /** Βλάβη **δική μας** (π.χ. λείπει μυστικό) — ποτέ «λάθος κωδικός» σε όποιον έδωσε τον σωστό. */
  | 'unavailable';

export type ShareResolveOutcome =
  | { readonly status: 'password-required' }
  | { readonly status: 'resolved'; readonly share: ResolvedSharePayload; readonly expiresAt: string }
  | { readonly status: 'refused'; readonly reason: ShareResolveRefusal };

export type ShareDownloadOutcome =
  | { readonly status: 'signed'; readonly url: string }
  | { readonly status: 'refused'; readonly reason: ShareResolveRefusal | 'password-required' };

/** Το σώμα του `POST /api/shares/resolve` — το διακριτικό **σε σώμα**, ποτέ σε query (RFC 6819 §5.1.5). */
export interface ShareResolveRequestBody {
  readonly token: string;
  readonly password?: string;
}

/** Όριο μήκους κωδικού: το scrypt δεν πρέπει να γίνει εργαλείο άρνησης υπηρεσίας. */
export const SHARE_PASSWORD_MAX_LENGTH = 256;

/** ADR-315 Α14 — όριο της εσωτερικής ετικέτας «για ποιον». Ένας ορισμός για φόρμα **και** διακομιστή. */
export const SHARE_LABEL_MAX_LENGTH = 80;

/** Είναι το είδος επιλύσιμο μέσω συνδέσμου; */
export function isResolvableShareKind(kind: string): kind is ResolvableShareKind {
  return (RESOLVABLE_SHARE_KINDS as readonly string[]).includes(kind);
}

export const RESOLVABLE_SHARE_KINDS = [
  'file',
  'contact',
  'property_showcase',
  'project_showcase',
  'building_showcase',
  'storage_showcase',
  'parking_showcase',
] as const satisfies readonly ResolvableShareKind[];
