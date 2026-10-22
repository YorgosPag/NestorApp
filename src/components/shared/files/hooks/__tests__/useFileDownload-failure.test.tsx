/**
 * ADR-916 §5.13 — η αποτυχία λήψης **δεν** είναι σιωπηλή: μία ειδοποίηση από το SSoT των ειδοποιήσεων αρχείων,
 * για **κάθε** καλούντα του `useFileDownload` (κάρτα Πρωτοκόλλου, λίστα αρχείων, εκδόσεις, εισερχόμενα…).
 */
import { act, renderHook } from '@testing-library/react';

import { useFileDownload } from '../useFileDownload';

const mockDownloadError = jest.fn();
const mockDownloadById = jest.fn();

jest.mock('@/hooks/notifications/useFilesNotifications', () => ({
  useFilesNotifications: () => ({ list: { downloadError: mockDownloadError } }),
}));
jest.mock('@/services/filesystem/file-mutation-gateway', () => ({
  downloadFileByIdWithPolicy: (...args: unknown[]) => mockDownloadById(...args),
  downloadFileFromProxyWithPolicy: jest.fn(),
}));

describe('useFileDownload — αποτυχία', () => {
  beforeEach(() => {
    mockDownloadError.mockReset();
    mockDownloadById.mockReset();
  });

  it('ο διακομιστής απαντά «File not found» ⇒ μία ειδοποίηση αποτυχίας', async () => {
    mockDownloadById.mockRejectedValue(new Error('File not found'));
    const { result } = renderHook(() => useFileDownload());
    await act(() => result.current.handleDownload({ id: 'file_missing', custody: 'personal', displayName: 'x', ext: 'pdf' }));
    expect(mockDownloadById).toHaveBeenCalledWith('file_missing', 'personal');
    expect(mockDownloadError).toHaveBeenCalledTimes(1);
  });

  it('επιτυχής λήψη ⇒ καμία ειδοποίηση αποτυχίας', async () => {
    mockDownloadById.mockResolvedValue(new Blob(['%PDF'], { type: 'application/pdf' }));
    const createObjectURL = jest.fn(() => 'blob:ok');
    Object.assign(URL, { createObjectURL, revokeObjectURL: jest.fn() });
    const { result } = renderHook(() => useFileDownload());
    await act(() => result.current.handleDownload({ id: 'file_ok', custody: 'personal', displayName: 'x', ext: 'pdf' }));
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(mockDownloadError).not.toHaveBeenCalled();
  });
});
