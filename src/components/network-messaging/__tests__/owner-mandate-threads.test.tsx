/**
 * @jest-environment jsdom
 *
 * ADR-867 Β7 — ΑΓΚΥΡΕΣ της οθόνης του ιδιοκτήτη: **ποια νήματα** δείχνει η αγγελία του — Ι-1…Ι-3.
 * Το πάνελ αντικαθίσταται με στέλεχος: εδώ κρίνεται **μόνο** η επιλογή (ο ίδιος κριτής ακμής με τον διακομιστή).
 */

import React from 'react';
import { render } from '@testing-library/react';

import { mandateActSeed } from '@/lib/network-edge/edge-sources';
import { actNetworkRefs } from '@/lib/network-messaging/act-network-refs';
import { brokeredMandate } from '@/lib/owner-property/__tests__/owner-property-fixtures';

import { OwnerMandateThreads } from '../OwnerMandateThreads';

const OWNER = 'uid_owner';

jest.mock('@/auth/hooks/useAuth', () => ({
  useAuth: () => ({ user: { uid: 'uid_owner' }, loading: false }),
}));

const panelProps = jest.fn();
jest.mock('../NetworkThreadPanel', () => ({
  NetworkThreadPanel: (props: Record<string, unknown>) => {
    panelProps(props);
    return null;
  },
}));

beforeEach(() => panelProps.mockReset());

describe('Ι — ποια νήματα δείχνει η αγγελία του ιδιοκτήτη', () => {
  it('Ι-1 αποδεκτή εντολή με ΕΜΕΝΑ ⇒ ένα νήμα, ως ιδιοκτήτης, με το id από τον σπόρο της (μετάλλαξη: χωρίς κριτή ακμής)', () => {
    render(
      <OwnerMandateThreads
        record={{
          propertyId: 'ownp_1',
          mandates: [
            brokeredMandate({ agencyCompanyId: 'comp_alfa', confirmation: 'confirmed', confirmedByUserId: OWNER }),
            brokeredMandate({ agencyCompanyId: 'comp_beta', confirmedByUserId: OWNER }),
          ],
        }}
      />,
    );
    expect(panelProps).toHaveBeenCalledTimes(1);
    expect(panelProps).toHaveBeenCalledWith({
      threadId: actNetworkRefs(mandateActSeed('ownp_1', 'comp_alfa')).threadId,
      teamId: null,
      variant: 'owner',
    });
  });

  it('Ι-2 εντολή που επιβεβαίωσε ΑΛΛΟΣ λογαριασμός ⇒ κανένα νήμα (μετάλλαξη: χωρίς φίλτρο αντισυμβαλλόμενου)', () => {
    render(
      <OwnerMandateThreads
        record={{
          propertyId: 'ownp_1',
          mandates: [brokeredMandate({ agencyCompanyId: 'comp_alfa', confirmation: 'confirmed', confirmedByUserId: 'uid_other' })],
        }}
      />,
    );
    expect(panelProps).not.toHaveBeenCalled();
  });

  it('Ι-3 δύο γραφεία ⇒ δύο νήματα, με διαφορετικό id (ένα ανά εντολή)', () => {
    render(
      <OwnerMandateThreads
        record={{
          propertyId: 'ownp_1',
          mandates: [
            brokeredMandate({ agencyCompanyId: 'comp_alfa', confirmation: 'confirmed', confirmedByUserId: OWNER }),
            brokeredMandate({ agencyCompanyId: 'comp_beta', confirmation: 'confirmed', confirmedByUserId: OWNER }),
          ],
        }}
      />,
    );
    const ids = panelProps.mock.calls.map(([props]) => (props as { threadId: string }).threadId);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
  });
});
