/**
 * POST /api/contacts/[contactId]/communication-impact-preview
 *
 * Read-only preview: how many records reference this contact, and (ADR-944 §3.7) which of the email keys the form
 * removes are **identity anchors** of an accepted account. Used before saving communication field changes.
 *
 * Supports ALL contact types (individual, company, service).
 * The engine filters applicable dependencies per contact type.
 *
 * ⚠️ Βλ. `address-impact-preview` — ίδια ιστορία: καμία άδεια, κανένας φύλακας,
 * κανένας tenant στη μηχανή (ADR-742 §7octies). 💡 Ο τύπος επαφής έρχεται πλέον
 * από το φορτίο του φύλακα· η διαδρομή έκανε **δεύτερο** `.get()` μόνο γι' αυτό.
 *
 * 🔁 2026-11-17: `GET` → `POST`. Το σώμα φέρει τα αφαιρούμενα κλειδιά email — προσωπικά δεδομένα, άρα **ποτέ** σε
 * query string. Μοναδικός καταναλωτής: `utils/contactForm/submission-guard-chain.ts`.
 *
 * @module api/contacts/[contactId]/communication-impact-preview
 * @enterprise ADR-280, ADR-145 — Contact Dependency SSoT · ADR-742 §7octies · ADR-944 §3.7
 */

import { z } from 'zod';
import { previewCommunicationImpact } from '@/lib/firestore/communication-impact-preview.service';
import type { CommunicationImpactPreview } from '@/types/communication-impact-preview';
import { contactPreviewRouteWithBody } from '../../_shared/contact-preview-route';

/** RFC 5321: διεύθυνση ≤ 320 χαρακτήρες· 50 = πολύ πάνω από κάθε ρεαλιστική φόρμα, φράχτης κατάχρησης. */
const CommunicationImpactRequestSchema = z.object({
  removedEmailKeys: z.array(z.string().max(320)).max(50),
});

export const POST = contactPreviewRouteWithBody<typeof CommunicationImpactRequestSchema, CommunicationImpactPreview>({
  schema: CommunicationImpactRequestSchema,
  action: 'communication-impact-preview',
  fallbackType: 'company',
  preview: ({ contactId, companyId, contactType, input }) =>
    previewCommunicationImpact(contactId, companyId, contactType, input.removedEmailKeys),
});
