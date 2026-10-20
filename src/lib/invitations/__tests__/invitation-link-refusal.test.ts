/**
 * `invitation-link-refusal` — ο ΕΝΑΣ αναγνώστης του 422 `LINK_REFUSED` (ADR-916 Φ-Β2 · ADR-853 §20).
 * Κάθε πόρτα εξαργύρωσης (χώρος · φωτογράφος · υπόθεση · αγοραστής) τον ρωτά με το **δικό της** κλειστό λεξιλόγιο.
 */

import { ApiClientError } from '@/lib/api/api-client-types';
import { CORE_INVITATION_REFUSALS } from '@/types/invitation-core';
import { PROPERTY_HANDOVER_INVITATION_REFUSALS } from '@/types/property-handover-invitation';

import { invitationLinkRefusalOf } from '../invitation-link-refusal';

const refusedWith = (body: unknown) => new ApiClientError('refused', 422, 'HTTP_422', undefined, undefined, undefined, body);

describe('invitationLinkRefusalOf', () => {
  it('a reason of the kind’s vocabulary ⇒ that reason', () => {
    expect(invitationLinkRefusalOf(refusedWith({ error: 'LINK_REFUSED', reason: 'handover-closed' }), PROPERTY_HANDOVER_INVITATION_REFUSALS))
      .toBe('handover-closed');
  });

  it('🔴 a reason of ANOTHER kind is not read as ours ⇒ null (the screen says the generic message)', () => {
    expect(invitationLinkRefusalOf(refusedWith({ error: 'LINK_REFUSED', reason: 'handover-closed' }), CORE_INVITATION_REFUSALS)).toBeNull();
  });

  it('🔴 the discriminator is checked FIRST: a known reason behind another error ⇒ null', () => {
    expect(invitationLinkRefusalOf(refusedWith({ error: 'TOUR_REFUSED', reason: 'expired' }), CORE_INVITATION_REFUSALS)).toBeNull();
  });

  it('not our client’s error (network, 503 without body, plain Error) ⇒ null', () => {
    expect(invitationLinkRefusalOf(new Error('offline'), CORE_INVITATION_REFUSALS)).toBeNull();
    expect(invitationLinkRefusalOf(refusedWith(null), CORE_INVITATION_REFUSALS)).toBeNull();
    expect(invitationLinkRefusalOf(refusedWith({ error: 'REDEEM_UNAVAILABLE' }), CORE_INVITATION_REFUSALS)).toBeNull();
  });
});
