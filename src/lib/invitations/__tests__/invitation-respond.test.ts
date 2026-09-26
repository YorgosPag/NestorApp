/**
 * `invitation-respond` — κοινή στένωση της έκβασης `preview` για τις σελίδες πρόσκλησης
 * (`/invite/[token]` · `/tour-invite/[token]`).
 */

import { invitationPreviewViewOf, invitationRespondOf } from '../invitation-respond';
import { loginHref } from '@/lib/routes/return-path';

const HREF = '/tour-invite/tok-1';

describe('invitationRespondOf', () => {
  it('anonymous ⇒ sign-in with the given return href', () => {
    expect(invitationRespondOf(true, null, 'x')).toEqual({ kind: 'sign-in', href: 'x' });
  });
  it('signed in as someone else ⇒ other-account', () => {
    expect(invitationRespondOf(false, 'a@b.gr', 'x')).toEqual({ kind: 'other-account', signedInAs: 'a@b.gr' });
  });
  it('addressed to viewer (or unknown) ⇒ ready', () => {
    expect(invitationRespondOf(true, 'a@b.gr', 'x')).toEqual({ kind: 'ready' });
    expect(invitationRespondOf(null, 'a@b.gr', 'x')).toEqual({ kind: 'ready' });
  });
});

describe('invitationPreviewViewOf', () => {
  const preview = { hostName: 'Host' };

  it('returns to the SAME invitation after sign-in, for both sign-in and switch-account', () => {
    const view = invitationPreviewViewOf({
      preview, addressedToViewer: null, token: 'tok-1', viewerEmail: null, invitationHref: HREF,
    });
    const returnHere = loginHref(HREF);
    expect(view).toEqual({
      kind: 'preview',
      preview,
      token: 'tok-1',
      respond: { kind: 'sign-in', href: returnHere },
      switchAccountHref: returnHere,
    });
  });

  it('never carries anything beyond the declared view fields', () => {
    const view = invitationPreviewViewOf({
      preview, addressedToViewer: false, token: 'tok-1', viewerEmail: 'a@b.gr', invitationHref: HREF,
    });
    expect(Object.keys(view).sort()).toEqual(['kind', 'preview', 'respond', 'switchAccountHref', 'token']);
    expect(view.respond).toEqual({ kind: 'other-account', signedInAs: 'a@b.gr' });
  });
});
