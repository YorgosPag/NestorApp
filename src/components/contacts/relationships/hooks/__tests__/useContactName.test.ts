import { renderHook, waitFor } from '@testing-library/react';
import { useContactName } from '../useContactName';
import { ContactsService } from '@/services/contacts.service';

jest.mock('@/services/contacts.service', () => ({
  ContactsService: { getContact: jest.fn() },
}));

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }),
}));

const mockGetContact = ContactsService.getContact as jest.Mock;

describe('useContactName — contactStatus', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns contactStatus active when contact.status is active', async () => {
    mockGetContact.mockResolvedValue({ status: 'active', name: 'Test Contact' });
    const { result } = renderHook(() => useContactName('cont_123'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.contactStatus).toBe('active');
    expect(result.current.contactName).toBe('Test Contact');
  });

  it('returns contactStatus deleted when contact.status is deleted', async () => {
    mockGetContact.mockResolvedValue({ status: 'deleted', companyName: 'ACME Ltd' });
    const { result } = renderHook(() => useContactName('cont_456'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.contactStatus).toBe('deleted');
    expect(result.current.contactName).toBe('ACME Ltd');
  });

  it('returns null contactStatus when contact not found', async () => {
    mockGetContact.mockResolvedValue(null);
    const { result } = renderHook(() => useContactName('cont_ghost'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.contactStatus).toBeNull();
  });

  it('returns null contactStatus on fetch error', async () => {
    mockGetContact.mockRejectedValue(new Error('Network error'));
    const { result } = renderHook(() => useContactName('cont_error'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.contactStatus).toBeNull();
  });

  it('returns empty name and null status when contactId is undefined', async () => {
    const { result } = renderHook(() => useContactName(undefined));
    expect(result.current.contactName).toBe('');
    expect(result.current.contactStatus).toBeNull();
    expect(mockGetContact).not.toHaveBeenCalled();
  });

  it('prefers contact.name over firstName+lastName', async () => {
    mockGetContact.mockResolvedValue({ status: 'active', name: 'Full Name', firstName: 'First', lastName: 'Last' });
    const { result } = renderHook(() => useContactName('cont_123'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.contactName).toBe('Full Name');
  });

  it('falls back to firstName+lastName when name absent', async () => {
    mockGetContact.mockResolvedValue({ status: 'active', firstName: 'John', lastName: 'Doe' });
    const { result } = renderHook(() => useContactName('cont_123'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.contactName).toBe('John Doe');
  });

  it('falls back to companyName when no personal name fields', async () => {
    mockGetContact.mockResolvedValue({ status: 'active', companyName: 'Corp SA' });
    const { result } = renderHook(() => useContactName('cont_123'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.contactName).toBe('Corp SA');
  });

  it('falls back to serviceName when no other name fields', async () => {
    mockGetContact.mockResolvedValue({ status: 'active', serviceName: 'My Service' });
    const { result } = renderHook(() => useContactName('cont_123'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.contactName).toBe('My Service');
  });

  it('defaults status to active when contact.status is missing', async () => {
    mockGetContact.mockResolvedValue({ name: 'No Status Field' });
    const { result } = renderHook(() => useContactName('cont_123'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.contactStatus).toBe('active');
  });
});
