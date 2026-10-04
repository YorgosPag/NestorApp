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
  const t = (key: string, params?: Record<string, unknown>) => {
    if (key.startsWith('policyErrors.')) return params ? `«${key}» → ${String(params.section)}` : `«${key}»`;
    return params ? `${key}::${JSON.stringify(params)}` : key;
  };
  const stable = { t, i18n: { language: 'el' }, ready: true, currentLanguage: 'el' };
  return { useTranslation: () => stable };
});

let response: BuildingSpaceRelations;
const get = jest.fn(() => Promise.resolve(response));
jest.mock('@/lib/api/enterprise-api-client', () => ({ apiClient: { get: (...args: unknown[]) => get(...(args as [])) } }));

const subscribed: string[] = [];
const listeners: Array<() => void> = [];
jest.mock('@/services/realtime/RealtimeService', () => ({
  RealtimeService: {
    subscribe: (event: string, listener: () => void) => {
      subscribed.push(event);
      listeners.push(listener);
      return () => undefined;
    },
  },
}));

const mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
jest.mock('@/lib/telemetry', () => ({ ...jest.requireActual('@/lib/telemetry'), 
  // Οι module-level loggers φτιάχνονται στο import, ΠΡΙΝ αρχικοποιηθεί το `mockLogger` ⇒ η ανάγνωσή του γίνεται στην κλήση.
  createModuleLogger: () => ({
    info: (...args: unknown[]) => mockLogger.info(...args),
    warn: (...args: unknown[]) => mockLogger.warn(...args),
    error: (...args: unknown[]) => mockLogger.error(...args),
    debug: (...args: unknown[]) => mockLogger.debug(...args),
  }),
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

/** Η ανάγνωση περνά από περισσότερα του ενός microtask (αρίθμηση αναγνώσεων) — άδειασε ολόκληρη την ουρά. */
const settle = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });

async function renderPanel(onPlace: (spaceId: string) => Promise<void> = jest.fn(async () => undefined)) {
  const view = render(<BuildingSpaceRelationsPanel buildingId="bld_A" kind="parking" onPlace={onPlace} />);
  await settle();
  return { onPlace, ...view };
}

beforeEach(() => {
  response = RELATIONS;
  subscribed.length = 0;
  listeners.length = 0;
  get.mockClear();
  notifyError.mockClear();
  Object.values(mockLogger).forEach((fn) => fn.mockClear());
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
    const { onPlace } = await renderPanel();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'spaceRelations.place' })); });
    expect(onPlace).toHaveBeenCalledWith('p7');
  });

  it('άρνηση πολιτικής ⇒ το μεταφρασμένο «τι να κάνεις», όχι σιωπή', async () => {
    const refused = Object.assign(new Error('conflict'), { errorCode: 'POLICY_SPACE_LINKED_TO_UNIT' });
    await renderPanel(jest.fn(async () => { throw refused; }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'spaceRelations.place' })); });
    // Ε4 — το όνομα της ενότητας έρχεται από το κλειδί της ΙΔΙΑΣ της ενότητας· Ε3 — άρνηση πολιτικής δεν είναι σφάλμα.
    expect(notifyError).toHaveBeenCalledWith('«policyErrors.spaceLinkedToUnit» → properties:linkedSpaces.title');
    expect(mockLogger.error).not.toHaveBeenCalled();
    expect(mockLogger.info).toHaveBeenCalledTimes(1);
  });

  it('τίποτα να δείξει ⇒ τίποτα στην οθόνη', async () => {
    response = { references: [], unplaced: [] };
    const { container } = await renderPanel();
    expect(container).toBeEmptyDOMElement();
  });

  describe('ADR-898 §21.6 Ε2 — «δεν φόρτωσε» ≠ «τίποτα να δείξει»', () => {
    it('αποτυχία ανάγνωσης ⇒ ορατό σφάλμα + «Επανάληψη», ΟΧΙ άδεια οθόνη', async () => {
      get.mockRejectedValueOnce(new Error('503'));
      const { container } = await renderPanel();
      expect(container).not.toBeEmptyDOMElement();
      expect(screen.getByRole('alert')).toHaveTextContent('spaceRelations.loadError');
      expect(screen.getByRole('button', { name: 'objective-value:building.retry' })).toBeInTheDocument();
    });

    it('«Επανάληψη» ⇒ ξαναρωτά· σε επιτυχία το σφάλμα φεύγει και οι χώροι φαίνονται', async () => {
      get.mockRejectedValueOnce(new Error('503'));
      await renderPanel();
      fireEvent.click(screen.getByRole('button', { name: 'objective-value:building.retry' }));
      await settle();
      expect(get).toHaveBeenCalledTimes(2);
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.getByText(/"space":"Π-5"/)).toBeInTheDocument();
    });

    it('αποτυχία ΜΕΤΑ από επιτυχία ⇒ η τελευταία γνωστή εικόνα μένει, μαζί με το σφάλμα — ποτέ σιωπηλό άδειασμα', async () => {
      await renderPanel();
      get.mockRejectedValueOnce(new Error('503'));
      act(() => listeners[0]());
      await settle();
      expect(screen.getByRole('alert')).toHaveTextContent('spaceRelations.loadError');
      expect(screen.getByText(/"space":"Π-5"/)).toBeInTheDocument();
    });
  });
});
