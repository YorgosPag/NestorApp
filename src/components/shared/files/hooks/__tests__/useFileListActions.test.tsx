import '@testing-library/jest-dom';
import { act, renderHook } from '@testing-library/react';
import { useFileListActions } from '../useFileListActions';

const successMock = jest.fn();
const errorMock = jest.fn();

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'trash.cannotTrashWithHold': 'Cannot delete file with active hold',
        'list.deleteError': 'Failed to move to Trash',
        'list.deleteSuccess': 'File moved to Trash',
        'list.unlinkSuccess': 'File unlinked successfully',
        'list.unlinkError': 'Failed to unlink file',
        'list.renameSuccess': 'File renamed successfully',
        'list.renameError': 'Failed to rename file',
      };
      return translations[key] ?? key;
    },
  }),
}));

jest.mock('@/providers/NotificationProvider', () => ({
  useNotifications: () => ({
    success: successMock,
    error: errorMock,
  }),
}));

describe('useFileListActions', () => {
  beforeEach(() => {
    successMock.mockReset();
    errorMock.mockReset();
  });

  it('opens blocked dialog when delete fails because the file has an active hold', async () => {
    const onDelete = jest.fn(async () => {
      throw new Error('Cannot trash file file_001: Active hold (legal) prevents deletion. Contact administrator.');
    });

    const { result } = renderHook(() => useFileListActions({
      onDelete,
      currentUserId: 'user_001',
    }));

    act(() => {
      result.current.handleDeleteClick('file_001', { stopPropagation: jest.fn() } as unknown as React.MouseEvent);
    });

    await act(async () => {
      await result.current.handleDeleteConfirm();
    });

    expect(onDelete).toHaveBeenCalledWith('file_001');
    expect(result.current.deleteBlockedOpen).toBe(true);
    expect(result.current.deleteBlockedMessage).toBe('Cannot delete file with active hold');
    expect(errorMock).not.toHaveBeenCalled();
  });

  it('keeps generic error notification for non-hold delete failures', async () => {
    const onDelete = jest.fn(async () => {
      throw new Error('Network failure');
    });

    const { result } = renderHook(() => useFileListActions({
      onDelete,
      currentUserId: 'user_001',
    }));

    act(() => {
      result.current.handleDeleteClick('file_002', { stopPropagation: jest.fn() } as unknown as React.MouseEvent);
    });

    await act(async () => {
      await result.current.handleDeleteConfirm();
    });

    expect(result.current.deleteBlockedOpen).toBe(false);
    expect(errorMock).toHaveBeenCalledWith('Failed to move to Trash');
  });
});
