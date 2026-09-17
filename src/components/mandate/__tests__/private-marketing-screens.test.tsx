/**
 * @fileoverview 🏆 **ΑΓΚΥΡΕΣ Α22-Α26 του ADR-864** — οι οθόνες της συναίνεσης κλειστής διάθεσης (§18).
 *
 * | # | Άγκυρα | Μετάλλαξη που πιάνει |
 * |---|---|---|
 * | Α22 | το γραφείο **δεν** βλέπει «αίτημα» όταν η συναίνεση ισχύει | κουμπί πάντα ορατό |
 * | Α23 | το έντυπο **δεν** υποβάλλεται χωρίς ανεβασμένο αρχείο (διεπαφή) | κουμπί χωρίς έλεγχο αρχείου |
 * | Α24 | ο ιδιοκτήτης βλέπει φόρμα **μόνο** για γραφεία χωρίς ενεργή συναίνεση | φόρμα για κάθε εντολή |
 * | Α25 | οι τιμές της φόρμας είναι **του διακομιστή**, και αυτές ακριβώς φεύγουν | υπολογισμός στον πελάτη |
 * | Α26 | `outdated` λέγεται **με όνομα** | σύμπτυξη σε `absent` |
 *
 * Μοκάρονται: ο αναγνώστης (δίνει πάνελ), ο πελάτης δικτύου (μετρά κλήσεις), το πεδίο αρχείου (το ανέβασμα
 * είναι του συστήματος αρχείων — εδώ κρίνεται **ο καλών**). Το κείμενο είναι το **πραγματικό** παγωμένο v1.
 */
import React from 'react';
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, within } from '@testing-library/react';

import type { PrivateMarketingPanel, PrivateMarketingPanels } from '@/lib/mandate/private-marketing-panel';
import type { PrivateMarketingPanelsLoad } from '@/services/owner-property/private-marketing.client';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'el' } }),
}));
jest.mock('@/lib/workspace/navigation', () => ({
  Link: ({ href, children }: { href: string; children?: React.ReactNode }) => <a href={href}>{children}</a>,
}));

let currentLoad: PrivateMarketingPanelsLoad | null = null;
jest.mock('@/hooks/mandate/usePrivateMarketingPanels', () => ({
  usePrivateMarketingPanels: () => ({ load: currentLoad, reload: () => undefined }),
}));

const requestPrivateMarketing = jest.fn();
const attestPrivateMarketing = jest.fn();
const grantPrivateMarketing = jest.fn();
const revokePrivateMarketing = jest.fn();
jest.mock('@/services/owner-property/private-marketing.client', () => ({
  requestPrivateMarketing: (...args: unknown[]) => requestPrivateMarketing(...args),
  attestPrivateMarketing: (...args: unknown[]) => attestPrivateMarketing(...args),
  grantPrivateMarketing: (...args: unknown[]) => grantPrivateMarketing(...args),
  revokePrivateMarketing: (...args: unknown[]) => revokePrivateMarketing(...args),
}));

jest.mock('@/components/mandate/AttestationDocumentField', () => ({
  AttestationDocumentField: ({ onChange }: { onChange: (next: unknown) => void }) => (
    <button type="button" onClick={() => onChange({ kind: 'attached', fileId: 'file_pm', name: 'pm.pdf' })}>attach</button>
  ),
}));

/* eslint-disable @typescript-eslint/no-require-imports */
const { latestLegalDocumentVersion } = require('@/lib/legal/legal-document-versions') as typeof import('@/lib/legal/legal-document-versions');
const { clauseIdsOf } = require('@/lib/legal/legal-clauses') as typeof import('@/lib/legal/legal-clauses');
const { PrivateMarketingAgencySection } = require('../PrivateMarketingAgencySection') as typeof import('../PrivateMarketingAgencySection');
const { PrivateMarketingStandingLine } = require('../PrivateMarketingStandingLine') as typeof import('../PrivateMarketingStandingLine');
const { PrivateMarketingOwnerSection } = require('@/components/owner-property/PrivateMarketingOwnerSection') as typeof import('@/components/owner-property/PrivateMarketingOwnerSection');
/* eslint-enable @typescript-eslint/no-require-imports */

const latest = latestLegalDocumentVersion('private-marketing-disclosure');
if (latest.kind !== 'published') throw new Error('v1 must be frozen');
const DISCLOSURE = latest.version;
const CLAUSES = clauseIdsOf(DISCLOSURE.frozen).length;

/** Τιμές που **κανένας** υπολογισμός πελάτη δεν θα έβγαζε — μόνο ο διακομιστής τις ξέρει (Α25). */
const SERVER_VALUES = { agency: 'Επωνυμία-Μόνο-Του-Διακομιστή', expiresOn: '31/12/2099' };

function panel(agencyCompanyId: string, standing: PrivateMarketingPanel['standing']): PrivateMarketingPanel {
  return { agencyCompanyId, agencyName: SERVER_VALUES.agency, standing, values: SERVER_VALUES };
}

function found(viewer: PrivateMarketingPanels['viewer'], panels: readonly PrivateMarketingPanel[]): PrivateMarketingPanelsLoad {
  return { kind: 'found', panels: { viewer, marketingAudience: 'public', disclosure: DISCLOSURE, panels } };
}

const GRANTED: PrivateMarketingPanel['standing'] = { kind: 'granted', version: 1, at: '2026-09-16T10:00:00.000Z', channel: 'link', audience: 'custodians' };
const REQUESTED: PrivateMarketingPanel['standing'] = { kind: 'requested', requestId: 'pmev_req', at: '2026-09-16T10:00:00.000Z', audience: 'custodians' };

/** Η φόρμα ζει πίσω από όριο `next/dynamic` (CHECK 3.34) ⇒ **περιμένει** το chunk, ποτέ σύγχρονο `getAllByRole`. */
const tickAll = async (): Promise<void> => (await screen.findAllByRole('checkbox')).forEach((box) => fireEvent.click(box));

beforeEach(() => {
  jest.clearAllMocks();
  currentLoad = null;
  requestPrivateMarketing.mockResolvedValue({ kind: 'requested', notify: 'sent' });
  attestPrivateMarketing.mockResolvedValue({ kind: 'saved' });
  grantPrivateMarketing.mockResolvedValue({ kind: 'saved' });
});

describe('🏆 Α22 — κανένα «αίτημα» όταν η συναίνεση ισχύει', () => {
  it('🔑 παρονομαστής: χωρίς συναίνεση το αίτημα προσφέρεται', () => {
    currentLoad = found('agency', [panel('comp_alfa', { kind: 'absent' })]);
    render(<PrivateMarketingAgencySection ownerPropertyId="ownp_a" />);
    expect(screen.getByText('property-market:mandate.privateMarketing.agency.request')).toBeInTheDocument();
  });

  it('🔴 με ενεργή συναίνεση ⇒ ούτε αίτημα ούτε έντυπο', () => {
    currentLoad = found('agency', [panel('comp_alfa', GRANTED)]);
    render(<PrivateMarketingAgencySection ownerPropertyId="ownp_a" />);
    expect(screen.queryByText(/agency\.request/)).toBeNull();
    expect(screen.queryByText('property-market:mandate.privateMarketing.agency.attestOpen')).toBeNull();
  });
});

describe('🏆 Α23 — έντυπο χωρίς ανεβασμένο αρχείο δεν υποβάλλεται (διεπαφή)', () => {
  it('🔴 όλες οι δηλώσεις επιβεβαιωμένες αλλά χωρίς αρχείο ⇒ κουμπί ανενεργό· με αρχείο ⇒ υποβολή με `documentFileId`', async () => {
    currentLoad = found('agency', [panel('comp_alfa', { kind: 'absent' })]);
    render(<PrivateMarketingAgencySection ownerPropertyId="ownp_a" />);
    const submit = screen.getByText('property-market:mandate.privateMarketing.agency.attestSubmit').closest('button');

    await tickAll();
    expect(submit).toBeDisabled();

    fireEvent.click(screen.getByText('attach'));
    expect(submit).toBeEnabled();
    await act(async () => {
      fireEvent.click(submit as HTMLButtonElement);
    });
    expect(attestPrivateMarketing).toHaveBeenCalledWith('ownp_a', expect.objectContaining({ documentFileId: 'file_pm', audience: 'custodians' }));
  });
});

describe('🏆 Α24 · Α25 — ο ιδιοκτήτης συναινεί μόνο όπου λείπει, με τις τιμές του διακομιστή', () => {
  it('🔴 Α24 — ένα γραφείο καλυμμένο, ένα με αίτημα ⇒ φόρμα ΜΟΝΟ για το δεύτερο', async () => {
    currentLoad = found('owner', [panel('comp_alfa', GRANTED), panel('comp_beta', REQUESTED)]);
    render(<PrivateMarketingOwnerSection ownerPropertyId="ownp_a" marketingAudience="public" revision={null} />);
    expect(await screen.findAllByRole('checkbox')).toHaveLength(CLAUSES);
  });

  it('🔴 Α25 — το κείμενο δείχνει τις τιμές του διακομιστή, και ΑΥΤΕΣ φεύγουν με την υποβολή', async () => {
    currentLoad = found('owner', [panel('comp_beta', REQUESTED)]);
    render(<PrivateMarketingOwnerSection ownerPropertyId="ownp_a" marketingAudience="public" revision={null} />);

    expect(screen.getAllByText(new RegExp(SERVER_VALUES.agency)).length).toBeGreaterThan(0);
    await tickAll();
    await act(async () => {
      fireEvent.click(screen.getByText('property-market:mandate.privateMarketing.submit'));
    });

    expect(grantPrivateMarketing).toHaveBeenCalledWith('ownp_a', null, [
      expect.objectContaining({ agencyCompanyId: 'comp_beta', requestId: 'pmev_req', submission: expect.objectContaining({ values: SERVER_VALUES }) }),
    ]);
  });

  it('🔑 χωρίς αίτημα η φόρμα ΔΕΝ ανοίγει μόνη της — μόνο με ρητή πράξη', async () => {
    currentLoad = found('owner', [panel('comp_alfa', { kind: 'absent' })]);
    render(<PrivateMarketingOwnerSection ownerPropertyId="ownp_a" marketingAudience="public" revision={null} />);
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
    fireEvent.click(screen.getByText('property-market:mandate.privateMarketing.owner.start'));
    expect(await screen.findAllByRole('checkbox')).toHaveLength(CLAUSES);
  });
});

describe('🏆 Α26 — `outdated` με όνομα', () => {
  it('🔴 οι όροι άλλαξαν ⇒ «outdated», όχι «absent»', () => {
    const { container } = render(<PrivateMarketingStandingLine standing={{ kind: 'outdated' }} />);
    expect(within(container).getByText('property-market:mandate.privateMarketing.standing.outdated')).toBeInTheDocument();
    expect(within(container).queryByText('property-market:mandate.privateMarketing.standing.absent')).toBeNull();
  });
});
