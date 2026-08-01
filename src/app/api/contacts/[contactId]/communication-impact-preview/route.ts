/**
 * GET /api/contacts/[contactId]/communication-impact-preview
 *
 * Read-only preview: how many records reference this contact.
 * Used for confirmation dialog before communication field changes.
 *
 * Supports ALL contact types (individual, company, service).
 * The engine filters applicable dependencies per contact type.
 *
 * ⚠️ Βλ. `address-impact-preview` — ίδια ιστορία: καμία άδεια, κανένας φύλακας,
 * κανένας tenant στη μηχανή (ADR-742 §7octies). 💡 Ο τύπος επαφής έρχεται πλέον
 * από το φορτίο του φύλακα· η διαδρομή έκανε **δεύτερο** `.get()` μόνο γι' αυτό.
 *
 * @module api/contacts/[contactId]/communication-impact-preview
 * @enterprise ADR-280, ADR-145 — Contact Dependency SSoT · ADR-742 §7octies
 */

import { previewCommunicationImpact } from '@/lib/firestore/communication-impact-preview.service';
import type { CommunicationImpactPreview } from '@/lib/firestore/communication-impact-preview.service';
import { contactPreviewRoute } from '../../_shared/contact-preview-route';

export const GET = contactPreviewRoute<CommunicationImpactPreview>({
  action: 'communication-impact-preview',
  fallbackType: 'company',
  preview: ({ contactId, companyId, contactType }) =>
    previewCommunicationImpact(contactId, companyId, contactType),
});
