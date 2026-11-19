/**
 * ============================================================================
 * useClearCompanyHqAddress — Unit tests (SSoT safety net for ADR-297)
 * ============================================================================
 *
 * Pins the contract of the HQ Clear + Undo pattern. If a future refactor
 * forgets a cleared field, drops the snapshot ref, or rewires notify(), this
 * suite fails — blocking silent regression of the Gmail-style UX.
 *
 * Strategy:
 *   - Mock @/providers/NotificationProvider → notify spy
 *   - Mock react-i18next → identity t() (returns the key verbatim)
 *   - Assert setFormData updater clears every field of the HQ entry (position 0 — the ONE
 *     container since ADR-332 §D30 Φάση 2; there are no flat HQ fields any more),
 *     notify called with info/5000ms/undo action, undo restores exact snapshot
 *
 * @see src/components/contacts/dynamic/useClearCompanyHqAddress.ts
 * @see docs/centralized-systems/reference/adrs/ADR-297-hq-clear-undo-pattern.md
 */
import { renderHook, act } from '@testing-library/react';
import type { CompanyAddress, ContactFormData } from '@/types/ContactFormTypes';
import { useClearCompanyHqAddress } from '../useClearCompanyHqAddress';

const notify = jest.fn();

jest.mock('@/providers/NotificationProvider', () => ({
  useNotifications: () => ({ notify }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

/** Το πλήρες περιεχόμενο της έδρας πριν τον καθαρισμό — κάθε πεδίο του λεξιλογίου `companyAddress`. */
const FULL_HQ: CompanyAddress = {
  id: 'addr_hq', type: 'headquarters', street: 'Ακαδημίας', number: '15', postalCode: '10671', city: 'Αθήνα',
  settlementId: 'settlement-123', communityName: 'Δημοτική Κοινότητα Αθηναίων', municipalUnitName: 'Δ.Ε. Αθηναίων',
  municipalityName: 'Δήμος Αθηναίων', municipalityId: 'municipality-456', regionalUnitName: 'Π.Ε. Κεντρικού Τομέα Αθηνών',
  regionName: 'Αττική', region: 'Αττική', decentAdminName: 'Αποκ. Διοίκηση Αττικής', majorGeoName: 'Αττική',
  neighborhood: 'Κολωνάκι', country: 'GR', coordinates: { lat: 37.98, lng: 23.73 }, source: 'dragged',
};

function buildFormData(overrides: Partial<ContactFormData> = {}): ContactFormData {
  return {
    type: 'company',
    firstName: '',
    lastName: 'Preserved',
    email: 'preserved@example.com',
    companyAddresses: [
      FULL_HQ,
      { type: 'branch', street: 'Ερμού', number: '1', postalCode: '10557', city: 'Αθήνα' },
    ],
    ...overrides,
  } as ContactFormData;
}

beforeEach(() => {
  notify.mockClear();
});

describe('useClearCompanyHqAddress', () => {
  it('no-op when setFormData is undefined (read-only mode)', () => {
    const { result } = renderHook(() =>
      useClearCompanyHqAddress(buildFormData(), undefined),
    );
    act(() => { result.current.clearHq(); });
    expect(notify).not.toHaveBeenCalled();
  });

  it('clearHq invokes setFormData with updater that blanks every field of the HQ entry', () => {
    const setFormData = jest.fn();
    const initial = buildFormData();
    const { result } = renderHook(() => useClearCompanyHqAddress(initial, setFormData));

    act(() => { result.current.clearHq(); });

    expect(setFormData).toHaveBeenCalledTimes(1);
    const updater = setFormData.mock.calls[0][0];
    const hq = (updater(initial) as ContactFormData).companyAddresses?.[0] as unknown as Record<string, unknown>;

    // Κάθε πεδίο κειμένου που είχε η έδρα είναι πλέον κενό ή απόν· οι ταυτότητες `null`.
    for (const key of Object.keys(FULL_HQ).filter((k) => k !== 'type')) {
      const value = hq[key];
      const ids = key === 'settlementId' || key === 'municipalityId';
      expect({ key, cleared: ids ? value === null : (value === undefined || value === '') }).toEqual({ key, cleared: true });
    }
    expect(hq.type).toBe('headquarters');
  });

  it('clearHq preserves non-address formData fields (firstName, lastName, email, type)', () => {
    const setFormData = jest.fn();
    const initial = buildFormData({ firstName: 'Keep', lastName: 'Me', email: 'keep@x.gr' });
    const { result } = renderHook(() => useClearCompanyHqAddress(initial, setFormData));

    act(() => { result.current.clearHq(); });
    const next = setFormData.mock.calls[0][0](initial);

    expect(next.firstName).toBe('Keep');
    expect(next.lastName).toBe('Me');
    expect(next.email).toBe('keep@x.gr');
    expect(next.type).toBe('company');
  });

  it('clearHq replaces the HQ entry in companyAddresses and keeps branches intact', () => {
    const setFormData = jest.fn();
    const initial = buildFormData();
    const { result } = renderHook(() => useClearCompanyHqAddress(initial, setFormData));

    act(() => { result.current.clearHq(); });
    const next = setFormData.mock.calls[0][0](initial);

    const hq = next.companyAddresses?.find((a) => a.type === 'headquarters');
    expect(hq).toBeDefined();
    expect(hq?.street).toBe('');
    expect(hq?.number).toBe('');
    expect(hq?.postalCode).toBe('');
    expect(hq?.city).toBe('');
    expect(hq?.settlementId).toBeNull();
    expect(hq?.municipalityId).toBeNull();

    const branch = next.companyAddresses?.find((a) => a.type === 'branch');
    expect(branch?.street).toBe('Ερμού');
    expect(branch?.number).toBe('1');
  });

  it('clearHq inserts a cleared HQ entry when companyAddresses is empty/undefined', () => {
    const setFormData = jest.fn();
    const initial = buildFormData({ companyAddresses: undefined });
    const { result } = renderHook(() => useClearCompanyHqAddress(initial, setFormData));

    act(() => { result.current.clearHq(); });
    const next = setFormData.mock.calls[0][0](initial);

    expect(next.companyAddresses).toHaveLength(1);
    expect(next.companyAddresses?.[0].type).toBe('headquarters');
  });

  it('clearHq fires notify with info type, 5000ms duration, and an Undo action', () => {
    const setFormData = jest.fn();
    const { result } = renderHook(() =>
      useClearCompanyHqAddress(buildFormData(), setFormData),
    );

    act(() => { result.current.clearHq(); });

    expect(notify).toHaveBeenCalledTimes(1);
    const [message, opts] = notify.mock.calls[0];
    expect(message).toBe('contacts-form:addressesSection.addressCleared');
    expect(opts.type).toBe('info');
    expect(opts.duration).toBe(5000);
    expect(Array.isArray(opts.actions)).toBe(true);
    expect(opts.actions).toHaveLength(1);
    expect(opts.actions[0].label).toBe('contacts-form:addressesSection.undo');
    expect(typeof opts.actions[0].onClick).toBe('function');
  });

  it('Undo action restores the exact snapshot captured before clear', () => {
    const setFormData = jest.fn();
    const snapshot = buildFormData({ companyAddresses: [{ ...FULL_HQ, street: 'Πατησίων', number: '42' }] });
    const { result } = renderHook(() =>
      useClearCompanyHqAddress(snapshot, setFormData),
    );

    act(() => { result.current.clearHq(); });
    setFormData.mockClear();

    const undo = notify.mock.calls[0][1].actions[0].onClick;
    act(() => { undo(); });

    expect(setFormData).toHaveBeenCalledTimes(1);
    expect(setFormData).toHaveBeenCalledWith(snapshot);
  });

  it('hasPendingUndo is false initially, true after clear, false after undo', () => {
    const setFormData = jest.fn();
    const { result } = renderHook(() =>
      useClearCompanyHqAddress(buildFormData(), setFormData),
    );

    expect(result.current.hasPendingUndo()).toBe(false);

    act(() => { result.current.clearHq(); });
    expect(result.current.hasPendingUndo()).toBe(true);

    const undo = notify.mock.calls[0][1].actions[0].onClick;
    act(() => { undo(); });
    expect(result.current.hasPendingUndo()).toBe(false);
  });

  it('Undo is idempotent — calling twice does not double-dispatch setFormData', () => {
    const setFormData = jest.fn();
    const { result } = renderHook(() =>
      useClearCompanyHqAddress(buildFormData(), setFormData),
    );

    act(() => { result.current.clearHq(); });
    setFormData.mockClear();

    const undo = notify.mock.calls[0][1].actions[0].onClick;
    act(() => { undo(); });
    act(() => { undo(); });

    expect(setFormData).toHaveBeenCalledTimes(1);
  });
});
