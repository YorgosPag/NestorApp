/**
 * GET /api/contacts/[contactId]/company-identity-impact-preview
 *
 * Read-only preview: how many records reference this contact.
 * Used for confirmation dialog before company identity field changes.
 *
 * ⚠️ Βλ. `address-impact-preview` — ίδια ιστορία: καμία άδεια, κανένας φύλακας,
 * κανένας tenant στη μηχανή (ADR-742 §7octies).
 *
 * @module api/contacts/[contactId]/company-identity-impact-preview
 * @enterprise ADR-278 — Company Identity Field Guard · ADR-742 §7octies
 */

import { previewCompanyIdentityImpact } from '@/lib/firestore/company-identity-impact-preview.service';
import type { CompanyIdentityImpactPreview } from '@/lib/firestore/company-identity-impact-preview.service';
import { contactPreviewRoute } from '../../_shared/contact-preview-route';

export const GET = contactPreviewRoute<CompanyIdentityImpactPreview>({
  action: 'company-identity-impact-preview',
  preview: ({ contactId, companyId }) => previewCompanyIdentityImpact(contactId, companyId),
});
