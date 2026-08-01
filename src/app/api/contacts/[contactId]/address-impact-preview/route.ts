/**
 * GET /api/contacts/[contactId]/address-impact-preview
 *
 * Read-only preview: how many records reference this contact.
 * Used for confirmation dialog before HQ address changes.
 *
 * ⚠️ Μέχρι τις 2026-08-01 η διαδρομή έτρεχε **χωρίς δικαίωμα και χωρίς φύλακα
 * ιδιοκτησίας**, και περνούσε στη μηχανή **κανέναν** tenant — δηλαδή επέστρεφε
 * πλήθη από **όλους** τους πελάτες. Και τα τρία τα επιβάλλει πλέον ο κοινός
 * εκτελεστής, δομικά (ADR-742 §7octies).
 *
 * @module api/contacts/[contactId]/address-impact-preview
 * @enterprise ADR-277 — Address Impact Guard · ADR-742 §7octies
 */

import { previewAddressImpact } from '@/lib/firestore/address-impact-preview.service';
import type { AddressImpactPreview } from '@/lib/firestore/address-impact-preview.service';
import { contactPreviewRoute } from '../../_shared/contact-preview-route';

export const GET = contactPreviewRoute<AddressImpactPreview>({
  action: 'address-impact-preview',
  preview: ({ contactId, companyId }) => previewAddressImpact(contactId, companyId),
});
