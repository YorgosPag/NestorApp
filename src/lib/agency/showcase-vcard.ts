/**
 * @fileoverview **Ένα κατάστημα της βιτρίνας → μία επαφή** (ADR-841 §7 Α21.17).
 * @related lib/contact/vcard.ts (η μορφή) · app/api/pro/[companyId]/locations/[locationId]/vcard/route.ts
 * @module lib/agency/showcase-vcard
 *
 * 🔑 **Μία επαφή ανά κατάστημα, όχι όλη η κάρτα** — ο επισκέπτης πάτησε «Αποθήκευση» **κάτω από ένα
 * κατάστημα**· και ένα `.vcf` με πολλές επαφές το iOS το δείχνει ως λίστα που πρέπει να τη διαχειριστεί.
 *
 * ⚠️ **Η διεύθυνση μπαίνει ΜΟΝΟ με δημοσιευμένη οδό** — ίδιος κανόνας με τις οδηγίες μετάβασης στη σελίδα:
 * η επαφή δεν μεταφέρει ποτέ περισσότερα από όσα δείχνει η βιτρίνα.
 *
 * 🔑 **Δύο URL, με σειρά**: πρώτα η ιστοσελίδα του οργανισμού (αυτό περιμένει ο άνθρωπος στις Επαφές του),
 * μετά η ζωντανή βιτρίνα (ωράριο, υποκαταστήματα — πάντα επίκαιρα).
 *
 * **Layering**: leaf — καθαρή αντιστοίχιση.
 */

import type { VCardOrganisation } from '@/lib/contact/vcard';
import { formatContactAddressLine } from '@/utils/address/address-line';
import type { PublicShowcase } from '@/types/agency-profile';
import type { ShowcaseLocation, ShowcaseLocationChannels } from '@/types/showcase-card';

export function showcaseLocationVCard(
  showcase: Pick<PublicShowcase, 'displayName' | 'website'>,
  location: Pick<ShowcaseLocation, 'label' | 'street'>,
  channels: ShowcaseLocationChannels,
  profileUrl: string | null,
): VCardOrganisation {
  return {
    organisation: showcase.displayName,
    unit: location.label,
    phones: channels.phones,
    emails: channels.emails,
    address:
      location.street === null
        ? null
        : {
            streetLine: formatContactAddressLine({ street: location.street.street, number: location.street.number }),
            postalCode: location.street.postalCode,
          },
    urls: [showcase.website, profileUrl].filter((url): url is string => url !== null),
  };
}
