/**
 * ADR-898 §20 · ADR-184 — **δίπλα στη λίστα θέσεων/αποθηκών**: αναφορά σε χώρο άλλου κτιρίου (σύνδεσμος, κανένα ποσό)
 * και χώρος χωρίς κτίριο (επιδιόρθωση ενός κλικ, από την ΙΔΙΑ πόρτα σύνδεσης). Μόνο το είδος της καρτέλας.
 */

import { act, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';

import type { BuildingSpaceRelations } from '@/lib/building-spaces/building-space-contract';

import { BuildingSpaceRelationsPanel } from '../BuildingSpaceRelationsPanel';

jest.mock('@/i18n/hooks/useTranslation', () => {
  // Τα κλειδιά πολιτικής «μεταφράζονται» (ο μεταφραστής θεωρεί ελλιπές ό,τι επιστρέφει το ίδιο το κλειδί).
  const t = (key: string, params?: Record<string, unknown>) =>
    params ? `${key}::${JSON.stringify(params)}` : key.startsWith('policyErrors.') ? `«${key}»` : key;
  const stable = { t, i18n: { language: 'el' }, ready: true, currentLanguage: 'el' };
  return { useTranslation: () => stable };
});

let response: BuildingSpaceRelations;
const get = jest.fn(() => Promise.resolve(response));
jest.mock('@/lib/api/enterprise-api-client', () => ({ apiClient: { get: (...args: unknown[]) => get(...(args as [])) } }));

const subscribed: string[] = [];
jest.mock('@/services/realtime/RealtimeService', () => ({
  RealtimeService: {
    subscribe: (event: string) => {
      subscribed.push(event);
      return () => undefined;
    },
  },
}));

const notifyError = jest.fn();
jest.mock('@/providers/NotificationProvider', () => ({ useNotifications: () => ({ error: notifyError }) }));

jest.mock('@/lib/workspace/navigation', () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));

const RELATIONS: BuildingSpaceRelations = {
  references: [
    { id: 'p5', kind: 'parking', name: 'Π-5', ownerUnitId: 'a3', ownerUnitName: 'Α3', locatedIn: { buildingId: 'bld_B', label: 'Β — Κτίριο Β' } },
    { id: 's9', kind: 'storage', name: 'Α-9', ownerUnitId: 'a3', ownerUnitName: 'Α3', locatedIn: { buildingId: 'bld_B', label: null } },
  ],
  unplaced: [{ id: 'p7', kind: 'parking', name: 'Π-7', ownerUnitId: 'a1', ownerUnitName: 'Α1' }],
};

async function renderPanel(onPlace: (spaceId: string) => Promise<void> = jest.fn(async () => undefined)) {
  render(<BuildingSpaceRelationsPanel buildingId="bld_A" kind="parking" onPlace={onPlace} />);
  await act(async () => { await Promise.resolve(); });
  return onPlace;
}

beforeEach(() => {
  response = RELATIONS;
  subscribed.length = 0;
  notifyError.mockClear();
});

describe('BuildingSpaceRelationsPanel', () => {
  it('αναφορά ⇒ σύνδεσμος προς το κτίριο όπου βρίσκεται · ΜΟΝΟ το είδος της καρτέλας · ζωντανό στις αλλαγές μονάδας', async () => {
    await renderPanel();
    expect(screen.getByText(/spaceRelations\.item::.*"space":"Π-5".*"unit":"Α3"/)).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /elsewhere\.locatedIn::.*"building":"Β — Κτίριο Β"/ });
    expect(link).toHaveAttribute('href', '/buildings?buildingId=bld_B');
    expect(screen.queryByText(/Α-9/)).not.toBeInTheDocument();
    expect(subscribed).toEqual(['PARKING_UPDATED', 'PARKING_DELETED', 'UNIT_UPDATED']);
  });

  it('χωρίς κτίριο ⇒ «Σύνδεση με αυτό το κτίριο» από την ΙΔΙΑ πόρτα σύνδεσης', async () => {
    const onPlace = await renderPanel();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'spaceRelations.place' })); });
    expect(onPlace).toHaveBeenCalledWith('p7');
  });

  it('άρνηση πολιτικής ⇒ το μεταφρασμένο «τι να κάνεις», όχι σιωπή', async () => {
    const refused = Object.assign(new Error('conflict'), { errorCode: 'POLICY_SPACE_LINKED_TO_UNIT' });
    await renderPanel(jest.fn(async () => { throw refused; }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'spaceRelations.place' })); });
    expect(notifyError).toHaveBeenCalledWith('«policyErrors.spaceLinkedToUnit»');
  });

  it('τίποτα να δείξει ⇒ τίποτα στην οθόνη', async () => {
    response = { references: [], unplaced: [] };
    const { container } = render(<BuildingSpaceRelationsPanel buildingId="bld_A" kind="parking" onPlace={jest.fn()} />);
    await act(async () => { await Promise.resolve(); });
    expect(container).toBeEmptyDOMElement();
  });
});
