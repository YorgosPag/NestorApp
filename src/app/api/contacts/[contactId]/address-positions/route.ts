/**
 * POST /api/contacts/[contactId]/address-positions — **λύνει** τις θέσεις των διευθύνσεων
 * μιας υπάρχουσας επαφής, **χωρίς να γράψει** (ADR-332 D27 Βήμα Β-ΙΙ).
 *
 * Ρυθμός + `crm:contacts:update` + φύλακας ιδιοκτησίας (`loadOwnedContact`) — από τον κοινό
 * εκτελεστή, **δομικά** (ADR-742 §7octies). Οι αποθηκευμένες διαβάζονται από το **ίδιο**
 * φορτίο που έλεγξε ο φύλακας· ο πελάτης στέλνει μόνο τις εισερχόμενες όψεις.
 *
 * @module api/contacts/[contactId]/address-positions
 */

import { contactPreviewRouteWithBody } from '../../_shared/contact-preview-route';
import {
  contactAddressPositionsRequestSchema,
  resolveContactAddressPositions,
} from '../../_shared/contact-address-positions';
import { resolveContactAddresses } from '@/utils/contacts/contact-addresses-reader';
import type { ContactAddressPositionsResponse } from '@/utils/contacts/contact-address-position-view';

export const POST = contactPreviewRouteWithBody<
  typeof contactAddressPositionsRequestSchema,
  ContactAddressPositionsResponse
>({
  schema: contactAddressPositionsRequestSchema,
  action: 'address-positions',
  preview: ({ contact, contactType, input }) =>
    resolveContactAddressPositions(resolveContactAddresses(contact, contactType), input),
});
