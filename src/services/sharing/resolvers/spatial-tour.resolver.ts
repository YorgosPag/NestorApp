/**
 * =============================================================================
 * SPATIAL TOUR SHARE RESOLVER — ο προσωπικός σύνδεσμος θέασης (ADR-884 Φ0.12 · Κ3β · ADR-315)
 * =============================================================================
 *
 * Ένας σύνδεσμος = **ένας** παραλήπτης με **όνομα** («κ. Παπαδόπουλος — τράπεζα»), **λήξη** και ίχνος
 * ανοιγμάτων (`accessCount` / `lastAccessedAt`, ήδη του ADR-315). Ο κοινός σύνδεσμος του Matterport (Unlisted)
 * και ο κοινός κωδικός (Figma/Matterport) δεν μπορούν να πουν **ποιος** από τους δέκα που τον πήραν τον προώθησε.
 *
 * 🔑 **Υποχρεωτικό όνομα, κανένας κωδικός**: ο κωδικός είναι κοινό μυστικό που δεν ανακαλείται ανά άνθρωπο —
 * τον αντικαθιστά ο σύνδεσμος ανά παραλήπτη (απόφαση Ε9).
 *
 * 🔑 **Τι ταξιδεύει στον παραλήπτη**: μόνο η **ρίζα** της περιήγησης (είδος + id αγγελίας). Η κρίση θέασης και
 * τα μέσα έρχονται από την **πύλη θέασης** (`POST …/view-session`, βάση `link`) — ο resolver δεν δίνει τίποτα
 * που η πύλη δεν έκρινε.
 *
 * 🔐 **Ποιος δημιουργεί**: μόνο ο **υπεύθυνος** της περιήγησης — το κρίνει ο διακομιστής
 * (`server/sharing/share-create-authority.ts` → `mayManageTour`), όχι ο μισθωτής σκέτος.
 *
 * @module services/sharing/resolvers/spatial-tour.resolver
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import { isPlaceSource, type PlaceSource } from '@/constants/place-sources';
import {
  buildSafePublicProjection,
  validateAgainstLinkPolicy,
  validateShareBaseInput,
} from '@/services/sharing/resolver-core/share-resolver-primitives';
import type {
  CreateShareInput,
  ShareEntityDefinition,
  ShareProjectionInput,
  ValidationResult,
} from '@/types/sharing';

export interface SpatialTourShareResolvedData {
  readonly shareId: string;
  readonly tourId: string;
  /** `null` ⇒ η περιήγηση δεν υπάρχει πια (ή δεν διαβάζεται) — η οθόνη λέει «μη διαθέσιμη». */
  readonly subject: { readonly kind: PlaceSource; readonly id: string } | null;
}

function subjectOf(entity: Record<string, unknown> | null): SpatialTourShareResolvedData['subject'] {
  const raw = entity?.subject;
  if (raw === null || typeof raw !== 'object') return null;
  const { kind, id } = raw as Record<string, unknown>;
  return isPlaceSource(kind) && typeof id === 'string' && id !== '' ? { kind, id } : null;
}

function projectSpatialTour({ share, entity }: ShareProjectionInput): SpatialTourShareResolvedData {
  return { shareId: share.id, tourId: share.entityId, subject: subjectOf(entity) };
}

function validateCreateInput(input: CreateShareInput): ValidationResult {
  const base = validateShareBaseInput(input, { entityType: 'spatial_tour', entityIdLabel: 'tourId' });
  if (!base.valid) return base;
  return validateAgainstLinkPolicy(input);
}

export const spatialTourShareResolver: ShareEntityDefinition<SpatialTourShareResolvedData> = {
  /** Μόνο το εταιρικό διαμέρισμα: οι κοινοποιήσεις ADR-315 είναι εμβέλειας μισθωτή. */
  entityCollection: COLLECTIONS.SPATIAL_TOURS,
  project: projectSpatialTour,
  safePublicProjection: (share) => buildSafePublicProjection(share, null),
  validateCreateInput,
  renderPublic: () => null,
};
