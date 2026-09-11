/**
 * @fileoverview **ΑΓΚΥΡΕΣ: ο χώρος του φύλακα φτάνει στον πελάτη ΠΡΙΝ ξεκινήσει οποιοσδήποτε ακροατής** (ADR-849 Β1).
 * @related components/workspace/WorkspaceScopeBridge · services/firestore/super-admin-active-company
 */

import React, { useEffect } from 'react';
import { render } from '@testing-library/react';

import { WorkspaceScopeBridge } from '../WorkspaceScopeBridge';
import {
  onSuperAdminActiveCompanyChange,
  requestedWorkspaceKey,
  setSuperAdminActiveCompanyId,
  setUrlWorkspaceScope,
} from '@/services/firestore/super-admin-active-company';
import { orgWorkspace, personalWorkspace } from '@/types/workspace-membership';

/** Ένα «παιδί» που ξεκινά ακροατή στο πρώτο του `useEffect` — όπως κάθε σελίδα. */
function FirstEffectProbe({ seen }: { readonly seen: string[] }) {
  useEffect(() => {
    seen.push(requestedWorkspaceKey());
  }, [seen]);
  return null;
}

beforeEach(() => {
  setUrlWorkspaceScope(null);
  setSuperAdminActiveCompanyId(null);
});

describe('WorkspaceScopeBridge', () => {
  it('Γ1 🔴 το πρώτο `useEffect` του παιδιού βλέπει ΗΔΗ τον χώρο — όχι τον επιλογέα', () => {
    setSuperAdminActiveCompanyId('comp_switcher');
    const seen: string[] = [];

    render(
      <WorkspaceScopeBridge scope={orgWorkspace('comp_url')}>
        <FirstEffectProbe seen={seen} />
      </WorkspaceScopeBridge>,
    );

    expect(seen).toEqual(['org:comp_url']);
  });

  it('Γ2: ιδιωτικός χώρος φτάνει ως personal', () => {
    const seen: string[] = [];
    render(
      <WorkspaceScopeBridge scope={personalWorkspace('uid_1')}>
        <FirstEffectProbe seen={seen} />
      </WorkspaceScopeBridge>,
    );
    expect(seen).toEqual(['personal']);
  });

  it('Γ3 🔴 αλλαγή χώρου Α → Β: ΚΑΜΙΑ ενδιάμεση κατάσταση (θα ξανάστηνε κάθε ακροατή με τον επιλογέα)', () => {
    const { rerender } = render(
      <WorkspaceScopeBridge scope={orgWorkspace('comp_a')}>{null}</WorkspaceScopeBridge>,
    );
    const notified: string[] = [];
    const unsubscribe = onSuperAdminActiveCompanyChange(() => notified.push(requestedWorkspaceKey()));

    rerender(<WorkspaceScopeBridge scope={orgWorkspace('comp_b')}>{null}</WorkspaceScopeBridge>);

    expect(notified).toEqual(['org:comp_b']);
    unsubscribe();
  });

  it('Γ4: ίδιος χώρος, νέο αντικείμενο ⇒ καμία ειδοποίηση', () => {
    const { rerender } = render(
      <WorkspaceScopeBridge scope={orgWorkspace('comp_a')}>{null}</WorkspaceScopeBridge>,
    );
    const listener = jest.fn();
    const unsubscribe = onSuperAdminActiveCompanyChange(listener);

    rerender(<WorkspaceScopeBridge scope={orgWorkspace('comp_a')}>{null}</WorkspaceScopeBridge>);

    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });

  it('Γ5: έξοδος από τον χώρο ⇒ ο χώρος καθαρίζει', () => {
    const { unmount } = render(
      <WorkspaceScopeBridge scope={orgWorkspace('comp_a')}>{null}</WorkspaceScopeBridge>,
    );
    unmount();
    expect(requestedWorkspaceKey()).toBe('default');
  });
});
