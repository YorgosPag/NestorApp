/**
 * @fileoverview **Η μικρογραφία της κάρτας του κατόχου** — ο ένας μετατροπέας και ο ένας αναγνώστης.
 * @related ADR-777 §8.70 · types/owner-property.ts (`OwnerListingThumbnail`) · lib/listings/listing-images
 * @module lib/owner-property/owner-listing-thumbnail
 *
 * 🔑 **Δύο πλευρές, ένα αρχείο.** Ο **γραφέας** (διακομιστής) μετατρέπει την κεντρική εικόνα που
 * δημοσιεύτηκε σε μικρογραφία· η **κάρτα** (πελάτης) τη διαβάζει από το έγγραφο. Αν ζούσαν χωριστά,
 * το «τι σχήμα έχει» θα γραφόταν δύο φορές, ελεύθερο να αποκλίνει.
 *
 * ⚠️ **Ο αναγνώστης ΕΛΕΓΧΕΙ το σχήμα**: το `readStoredOwnerProperty` απλώνει το έγγραφο αυτούσιο,
 * άρα ό,τι βρίσκεται στον δίσκο φτάνει εδώ **χωρίς εγγύηση**. Ένα σπασμένο URL σε `<img>` είναι
 * σπασμένη εικόνα στην οθόνη — η δηλωμένη απουσία είναι πάντα προτιμότερη.
 */

import type { ListingImage, ListingImageSource } from '@/types/public-listing';
import type { OwnerListingThumbnail, OwnerProperty } from '@/types/owner-property';
import { readPhotoFocalPoint } from '@/lib/listings/photo-focal-point';

/** **Γραφέας** — η δημόσια κεντρική εικόνα χωρίς `altKey` (δες `OwnerListingThumbnail`). */
export function thumbnailFromLead(lead: ListingImage | null): OwnerListingThumbnail | null {
  if (lead === null) return null;
  // 🎯 ADR-880 — η κάρτα του κατόχου κόβει στο ΙΔΙΟ πλαίσιο με τη δημόσια: ίδιο σημείο εστίασης.
  return {
    url: lead.url,
    width: lead.width,
    height: lead.height,
    sources: lead.sources,
    focalPoint: readPhotoFocalPoint(lead.focalPoint),
  };
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isPositiveNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function isImageSource(value: unknown): value is ListingImageSource {
  if (typeof value !== 'object' || value === null) return false;
  const source = value as Record<string, unknown>;
  return isNonEmptyString(source.url) && isPositiveNumber(source.width);
}

/**
 * **Αναγνώστης** — η μικρογραφία της αγγελίας, ή `null`.
 *
 * `null` σημαίνει «δεν υπάρχει εικόνα να δειχθεί» σε **κάθε** περίπτωση: καμία δημοσίευση,
 * έγγραφο πριν το πεδίο, απόσυρση, αποτυχία, ή σχήμα που δεν στέκει.
 */
export function publicationThumbnailOf(
  property: Pick<OwnerProperty, 'publication'>,
): OwnerListingThumbnail | null {
  const raw: unknown = property.publication?.thumbnail;
  if (typeof raw !== 'object' || raw === null) return null;

  const candidate = raw as Record<string, unknown>;
  if (!isNonEmptyString(candidate.url)) return null;
  if (!isPositiveNumber(candidate.width) || !isPositiveNumber(candidate.height)) return null;

  const sources = Array.isArray(candidate.sources) ? candidate.sources.filter(isImageSource) : [];
  return {
    url: candidate.url,
    width: candidate.width,
    height: candidate.height,
    sources,
    focalPoint: readPhotoFocalPoint(candidate.focalPoint),
  };
}
