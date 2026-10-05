/**
 * ADR-898 §21.6 Ε6-β — **η αποτυχία φόρτωσης επιλογών ΔΕΝ είναι «άδεια λίστα»**. Ως τις 2026-10-05 το `useEntityLink`
 * είχε `.catch(() => {})` και οι φορτωτές `catch { return [] }`: ο επιλογέας έδειχνε «κανένα κτίριο» ενώ απλώς δεν
 * φόρτωσε. Η κάρτα τρέχει **αληθινή** — ελέγχεται τι βλέπει ο άνθρωπος, όχι μόνο η κατάσταση του hook.
 */

import React from 'react';
import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Building } from 'lucide-react';

const mockRealtimeHandlers = new Map<string, () => void>();
jest.mock('@/services/realtime', () => ({
  RealtimeService: {
    subscribe: (event: string, handler: () => void) => {
      mockRealtimeHandlers.set(event, handler);
      return () => mockRealtimeHandlers.delete(event);
    },
  },
}));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

import { EntityLinkCard, type EntityLinkOption } from '@/components/shared/EntityLinkCard';
import { useEntityLink, type UseEntityLinkConfig } from '../useEntityLink';

const LABELS = {
  title: 'Σύνδεση κτιρίου', label: 'Κτίριο', placeholder: 'Επιλέξτε', noSelection: 'Κανένα', loading: 'Φόρτωση…',
  save: 'Αποθήκευση', saving: 'Αποθήκευση…', success: 'ΟΚ', error: 'Σφάλμα', currentLabel: 'Τρέχον',
};
const OPTIONS: EntityLinkOption[] = [{ id: 'bld_A', name: 'Κτήριο Α' }];

function configWith(loadOptions: () => Promise<EntityLinkOption[]>): UseEntityLinkConfig {
  return {
    relation: 'parking-building', entityId: 'park_1', initialParentId: 'bld_A', loadOptions,
    saveMode: 'form', labels: LABELS, icon: Building, cardId: 'card',
  };
}

function Card({ loadOptions }: { loadOptions: () => Promise<EntityLinkOption[]> }) {
  const link = useEntityLink(configWith(loadOptions), true);
  return <EntityLinkCard key={link.linkCardKey} {...link.linkCardProps} />;
}

beforeEach(() => mockRealtimeHandlers.clear());

describe('useEntityLink — κατάσταση φόρτωσης επιλογών', () => {
  it('επιτυχία ⇒ επιλογές, ούτε φόρτωση ούτε αποτυχία', async () => {
    const load = jest.fn(async () => OPTIONS);
    const { result } = renderHook(() => useEntityLink(configWith(load), true));
    expect(result.current.optionsLoading).toBe(true);
    await waitFor(() => expect(result.current.options).toEqual(OPTIONS));
    expect(result.current).toMatchObject({ optionsLoading: false, optionsFailed: false });
  });

  it('🔴 αποτυχία ⇒ `optionsFailed`, ΟΧΙ «φόρτωσε και είναι άδεια»', async () => {
    const load = jest.fn(async (): Promise<EntityLinkOption[]> => { throw new Error('503'); });
    const { result } = renderHook(() => useEntityLink(configWith(load), true));
    await waitFor(() => expect(result.current.optionsFailed).toBe(true));
    expect(result.current.optionsLoading).toBe(false);
    expect(result.current.linkCardProps.optionsFailure).toBeDefined();
  });

  it('επανάληψη μετά από αποτυχία ⇒ οι επιλογές έρχονται και το σφάλμα φεύγει', async () => {
    const load = jest.fn<Promise<EntityLinkOption[]>, []>().mockRejectedValueOnce(new Error('503')).mockResolvedValue(OPTIONS);
    const { result } = renderHook(() => useEntityLink(configWith(load), true));
    await waitFor(() => expect(result.current.optionsFailed).toBe(true));
    act(() => result.current.retryOptions());
    await waitFor(() => expect(result.current.options).toEqual(OPTIONS));
    expect(result.current.optionsFailed).toBe(false);
  });

  it('🔴 άλλος φορτωτής (άλλο έργο/οντότητα) ⇒ οι επιλογές του προηγούμενου ΔΕΝ δείχνονται ως δικές του', async () => {
    let release: (options: EntityLinkOption[]) => void = () => undefined;
    const first = jest.fn(async () => OPTIONS);
    const second = jest.fn(() => new Promise<EntityLinkOption[]>((resolve) => { release = resolve; }));
    const { result, rerender } = renderHook(({ load }) => useEntityLink(configWith(load), true), { initialProps: { load: first } });
    await waitFor(() => expect(result.current.options).toEqual(OPTIONS));

    rerender({ load: second });
    expect(result.current.options).toEqual([]);
    expect(result.current.optionsLoading).toBe(true);

    await act(async () => release([{ id: 'bld_B', name: 'Κτήριο Β' }]));
    expect(result.current.options).toEqual([{ id: 'bld_B', name: 'Κτήριο Β' }]);
  });

  it('ανανέωση από realtime που αποτυγχάνει ⇒ μένει η τελευταία γνωστή λίστα ΜΑΖΙ με το σφάλμα', async () => {
    const load = jest.fn<Promise<EntityLinkOption[]>, []>().mockResolvedValueOnce(OPTIONS).mockRejectedValue(new Error('503'));
    const { result } = renderHook(() => useEntityLink(configWith(load), true));
    await waitFor(() => expect(result.current.options).toEqual(OPTIONS));
    act(() => mockRealtimeHandlers.get('BUILDING_UPDATED')?.());
    await waitFor(() => expect(result.current.optionsFailed).toBe(true));
    expect(result.current.options).toEqual(OPTIONS);
  });
});

describe('EntityLinkCard — τι βλέπει ο άνθρωπος', () => {
  it('🔴 αποτυχία χωρίς γνωστή λίστα ⇒ σφάλμα + «Δοκιμάστε ξανά», και ΚΑΝΕΝΑΣ επιλογέας', async () => {
    const load = jest.fn<Promise<EntityLinkOption[]>, []>().mockRejectedValueOnce(new Error('503')).mockResolvedValue(OPTIONS);
    render(<Card loadOptions={load} />);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('entityLink.optionsError');
    expect(screen.queryByRole('combobox')).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'entityLink.retry' }));
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('επιτυχία ⇒ επιλογέας, κανένα σφάλμα', async () => {
    const load = jest.fn(async () => OPTIONS);
    render(<Card loadOptions={load} />);
    expect(await screen.findByRole('combobox')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
