/**
 * 🔴 ΑΓΚΥΡΑ Γ38 — **η οθόνη λέει για το Πρωτόκολλο ό,τι λέει και το PDF** (ADR-916 Φ-Γ2 Σ5).
 * @related lib/property-handover/handover-protocol-presentation.ts · handover-protocol-terms.ts
 *
 * Μεταλλάξεις που πρέπει να ρίξουν αυτό το αρχείο: «αντικαθιστά» και στην αναθ. 1 · η **τελευταία** έκδοση αντί για την
 * έκδοση σε ισχύ · η μέρα κατά UTC αντί για την ελληνική · σύνδεσμος ακόμη κι όταν καμία έκδοση δεν ισχύει.
 */

import { latestLegalDocumentVersion } from '@/lib/legal/legal-document-versions';
import { legalDocumentVersionHref } from '@/lib/routes/legalRoutes';
import type { PropertyHandoverProtocolSummary } from '@/types/property-handover-protocol';

import { handoverProtocolPresentationOf } from '../handover-protocol-presentation';
import { HANDOVER_PROTOCOL_LEGAL_DOCUMENT } from '../handover-protocol-terms';

const summary = (revision: number, issuedAt = '2026-10-22T12:00:00.000Z'): PropertyHandoverProtocolSummary => ({
  revision, issuedAt, fileId: 'file_buyer_copy',
});

describe('Γ38 — όψη του Πρωτοκόλλου', () => {
  it('αναθ. 1 ⇒ δεν αντικαθιστά τίποτα · αναθ. 3 ⇒ αντικαθιστά την 2', () => {
    expect(handoverProtocolPresentationOf(summary(1)).supersedesRevision).toBeNull();
    expect(handoverProtocolPresentationOf(summary(3))).toMatchObject({ revision: 3, supersedesRevision: 2 });
  });

  it('σύνδεσμος = η δημόσια σελίδα της έκδοσης σε ισχύ την ημέρα έκδοσης (v1 από 2026-10-22)', () => {
    expect(handoverProtocolPresentationOf(summary(1)).legalText).toEqual({
      version: 1,
      href: legalDocumentVersionHref(HANDOVER_PROTOCOL_LEGAL_DOCUMENT, 1),
    });
  });

  it('🔴 πριν ισχύσει κείμενο ⇒ ΚΑΝΕΝΑΣ σύνδεσμος — ούτε στην πιο πρόσφατη έκδοση', () => {
    expect(latestLegalDocumentVersion(HANDOVER_PROTOCOL_LEGAL_DOCUMENT).kind).toBe('published'); // μάρτυρας: υπάρχει «τελευταία»
    expect(handoverProtocolPresentationOf(summary(1, '2026-10-21T12:00:00.000Z')).legalText).toBeNull();
  });

  it('🔴 η ΕΛΛΗΝΙΚΗ μέρα, όχι η UTC: 21/10 21:30Z = 22/10 00:30 Αθήνα ⇒ v1 · 21/10 20:30Z = 23:30 Αθήνα ⇒ καμία', () => {
    expect(handoverProtocolPresentationOf(summary(1, '2026-10-21T21:30:00.000Z')).legalText?.version).toBe(1);
    expect(handoverProtocolPresentationOf(summary(1, '2026-10-21T20:30:00.000Z')).legalText).toBeNull();
  });
});
