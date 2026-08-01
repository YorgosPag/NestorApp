/**
 * GET /api/contacts/[contactId]/name-cascade-preview
 *
 * Dry-run preview: how many records would be affected by a name change.
 * Read-only — no Firestore writes. Used for confirmation dialogs.
 *
 * ⚠️ Βλ. `address-impact-preview` — ίδια ιστορία: καμία άδεια, κανένας φύλακας,
 * κανένας tenant στη μηχανή (ADR-742 §7octies). 💡 Ο τύπος επαφής έρχεται πλέον
 * από το φορτίο του φύλακα· η διαδρομή έκανε **δεύτερο** `.get()` μόνο γι' αυτό.
 *
 * ⚠️ Το `fallbackType` είναι `'individual'` — **όχι** το `'company'` των
 * αδελφών της. Ήταν η υπάρχουσα τιμή αυτής της διαδρομής και αλλάζει **ποιες**
 * εξαρτήσεις μετρά η μηχανή, οπότε μένει ρητή.
 *
 * @module api/contacts/[contactId]/name-cascade-preview
 * @enterprise ADR-249 — Name Cascade Safety, ADR-145 · ADR-742 §7octies
 */

import { previewContactNameCascade } from '@/lib/firestore/cascade-contact-name.service';
import type { NameCascadePreview } from '@/lib/firestore/cascade-contact-name.service';
import { contactPreviewRoute } from '../../_shared/contact-preview-route';

export const GET = contactPreviewRoute<NameCascadePreview>({
  action: 'name-cascade-preview',
  fallbackType: 'individual',
  preview: ({ contactId, companyId, contactType }) =>
    previewContactNameCascade(contactId, companyId, contactType),
});
