/**
 * ADR-835 §22 (Στάδιο Γ) — **η οθόνη των καναλιών.**
 *
 * Τι ελέγχεται: (α) η **βαθμίδα λέγεται με λέξη**, όχι μόνο με χρώμα (WCAG 1.4.1)·
 * (β) το **URL της πηγής δεν φτάνει ποτέ** στην οθόνη — μόνο ο host· (γ) η σύγκρουση
 * **ονομάζεται** με ημερομηνίες· (δ) η ανάκληση συνδέσμου **ζητά επιβεβαίωση**.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { StayChannelsView } from '@/lib/stay/stay-channel-command';
import StayChannelSync from '../StayChannelSync';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string, params?: Record<string, unknown>) =>
    params === undefined ? key : `${key} ${JSON.stringify(params)}` }),
}));

const mockFetch = jest.fn();
const mockSend = jest.fn();
jest.mock('@/services/stay-calendar/stay-channels.client', () => ({
  fetchStayChannels: (...args: unknown[]) => mockFetch(...args),
  sendStayChannelCommand: (...args: unknown[]) => mockSend(...args),
}));

const VIEW: StayChannelsView = {
  kind: 'readable',
  exportConfigured: true,
  exportUrl: 'https://nestorconstruct.gr/api/stay-ical/TOKEN.ics',
  feeds: [{
    id: 'schf_1',
    label: 'Airbnb',
    host: 'www.airbnb.com',
    channel: 'airbnb',
    acceptsImport: true,
    freshness: 'stale',
    lastSuccessAt: '2026-09-17T06:00:00.000Z',
    lastFailureAt: '2026-09-17T11:00:00.000Z',
    lastFailure: 'timeout',
    eventCount: 4,
    exportUrl: 'https://nestorconstruct.gr/api/stay-ical/FEEDTOKEN.ics',
  }],
  conflicts: [{
    kind: 'overbooking',
    feedId: 'schf_1',
    blockId: 'sblk_1',
    from: '2026-10-14',
    to: '2026-10-18',
    party: { entryKind: 'booking', entryId: 'stay_1', from: '2026-10-12', to: '2026-10-16' },
  }],
};

beforeEach(() => {
  mockFetch.mockReset().mockResolvedValue({ kind: 'loaded', view: VIEW });
  mockSend.mockReset().mockResolvedValue({ kind: 'ok' });
});

describe('StayChannelSync', () => {
  it('🔑 η βαθμίδα λέγεται με ΛΕΞΗ, και το σφάλμα ονομάζεται', async () => {
    render(<StayChannelSync ownerPropertyId="ownp_a" />);

    await waitFor(() => expect(screen.getByText(/freshness\.stale/)).toBeInTheDocument());
    expect(screen.getByText(/lastFailure.*timeout/)).toBeInTheDocument();
  });

  it('🔴 το URL της πηγής ΔΕΝ φτάνει στην οθόνη — μόνο ο host', async () => {
    render(<StayChannelSync ownerPropertyId="ownp_a" />);

    await waitFor(() => expect(screen.getByText('www.airbnb.com')).toBeInTheDocument());
    // Ο σύνδεσμος **εξαγωγής** είναι δικός μας και φαίνεται· ο σύνδεσμος **της πηγής** όχι.
    expect(document.body.textContent).not.toContain('airbnb.com/calendar');
    expect(screen.getByDisplayValue(VIEW.kind === 'readable' ? VIEW.exportUrl ?? '' : '')).toBeInTheDocument();
  });

  it('η σύγκρουση ονομάζεται ΜΕ ΗΜΕΡΟΜΗΝΙΕΣ και με διέξοδο', async () => {
    render(<StayChannelSync ownerPropertyId="ownp_a" />);

    await waitFor(() => expect(screen.getByText(/conflicts\.overbooking /)).toBeInTheDocument());
    expect(screen.getByText(/conflicts\.overbookingRemedy/)).toBeInTheDocument();
  });

  it('🔑 η ανάκληση συνδέσμου ζητά ΕΠΙΒΕΒΑΙΩΣΗ — ποτέ με ένα κλικ', async () => {
    const user = userEvent.setup();
    render(<StayChannelSync ownerPropertyId="ownp_a" />);

    await waitFor(() => expect(screen.getByText(/export\.rotate$/)).toBeInTheDocument());
    await user.click(screen.getByText(/export\.rotate$/));
    expect(mockSend).not.toHaveBeenCalled();

    await user.click(screen.getByText(/export\.rotateYes/));
    expect(mockSend).toHaveBeenCalledWith('ownp_a', { action: 'rotate-export' });
  });

  it('«συγχρονισμός τώρα» και «αφαίρεση» στέλνουν την πηγή', async () => {
    const user = userEvent.setup();
    render(<StayChannelSync ownerPropertyId="ownp_a" />);

    await waitFor(() => expect(screen.getByText(/syncNow/)).toBeInTheDocument());
    await user.click(screen.getByText(/syncNow/));
    expect(mockSend).toHaveBeenCalledWith('ownp_a', { action: 'sync-feed', feedId: 'schf_1' });

    await user.click(screen.getByText(/stayChannels\.remove/));
    expect(mockSend).toHaveBeenCalledWith('ownp_a', { action: 'remove-feed', feedId: 'schf_1' });
  });

  it('🔴 αδιάβαστο ημερολόγιο ⇒ το λέει, και ΔΕΝ δείχνει φόρμες', async () => {
    mockFetch.mockResolvedValue({ kind: 'loaded', view: { kind: 'unreadable' } });
    render(<StayChannelSync ownerPropertyId="ownp_a" />);

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.queryByText(/add\.submit/)).not.toBeInTheDocument();
  });

  it('χωρίς ρυθμισμένο μυστικό ⇒ «δική μας εκκρεμότητα», κανένας σύνδεσμος', async () => {
    mockFetch.mockResolvedValue({
      kind: 'loaded',
      view: { ...VIEW, exportConfigured: false, exportUrl: null },
    });
    render(<StayChannelSync ownerPropertyId="ownp_a" />);

    await waitFor(() => expect(screen.getByText(/export\.unconfigured/)).toBeInTheDocument());
    expect(screen.queryByText(/export\.rotate$/)).not.toBeInTheDocument();
  });
});
