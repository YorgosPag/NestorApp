/**
 * 🧪 useMediaStreamSession — the shared getUserMedia session (ADR-584)
 *
 * Covers the contract the two public hooks delegate to it and can no longer
 * express themselves: the error-name → code mapping that was previously
 * copy-pasted, the constraint each hook asks for, and the teardown guarantee
 * (no camera light left on).
 */

import { act, renderHook, waitFor } from '@testing-library/react';

import type { Logger } from '@/lib/telemetry';

import {
  mapMediaErrorToCode,
  useMediaStreamSession,
} from '../useMediaStreamSession';

// ---------------------------------------------------------------------------
// FIXTURES
// ---------------------------------------------------------------------------

function fakeLogger(): Logger {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  } as unknown as Logger;
}

interface FakeTrack {
  stop: jest.Mock;
  getSettings: () => MediaTrackSettings;
}

function fakeStream(deviceId = 'cam-1'): {
  stream: MediaStream;
  tracks: FakeTrack[];
} {
  const tracks: FakeTrack[] = [
    { stop: jest.fn(), getSettings: () => ({ deviceId }) as MediaTrackSettings },
  ];
  const stream = {
    getTracks: () => tracks,
    getVideoTracks: () => tracks,
  } as unknown as MediaStream;
  return { stream, tracks };
}

function mockMediaDevices(
  getUserMedia: jest.Mock,
  enumerateDevices: jest.Mock = jest.fn().mockResolvedValue([]),
): void {
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    writable: true,
    value: { getUserMedia, enumerateDevices },
  });
}

function domError(name: string): Error {
  const err = new Error(name);
  err.name = name;
  return err;
}

const originalMediaDevices = navigator.mediaDevices;

afterEach(() => {
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    writable: true,
    value: originalMediaDevices,
  });
});

// ---------------------------------------------------------------------------
// TESTS
// ---------------------------------------------------------------------------

describe('mapMediaErrorToCode', () => {
  it.each([
    ['NotAllowedError', 'PERMISSION_DENIED'],
    ['SecurityError', 'PERMISSION_DENIED'],
    ['NotFoundError', 'NO_DEVICE'],
    ['OverconstrainedError', 'NO_DEVICE'],
    ['NotReadableError', 'DEVICE_BUSY'],
    ['AbortError', 'DEVICE_BUSY'],
    ['TypeError', 'NOT_SUPPORTED'],
  ])('maps %s to %s', (name, expected) => {
    expect(mapMediaErrorToCode(domError(name))).toBe(expected);
  });

  it('falls back to UNKNOWN for unrecognised error names', () => {
    expect(mapMediaErrorToCode(domError('WeirdVendorError'))).toBe('UNKNOWN');
  });

  it('falls back to UNKNOWN for non-Error rejections', () => {
    expect(mapMediaErrorToCode('just a string')).toBe('UNKNOWN');
    expect(mapMediaErrorToCode(null)).toBe('UNKNOWN');
    expect(mapMediaErrorToCode(undefined)).toBe('UNKNOWN');
  });
});

describe('useMediaStreamSession — startCamera', () => {
  it('starts idle', () => {
    mockMediaDevices(jest.fn());
    const { result } = renderHook(() =>
      useMediaStreamSession({ audio: false, logger: fakeLogger() }),
    );
    expect(result.current.status).toBe('idle');
    expect(result.current.stream).toBeNull();
    expect(result.current.errorCode).toBeNull();
  });

  it('reaches ready and exposes the stream', async () => {
    const { stream } = fakeStream();
    mockMediaDevices(jest.fn().mockResolvedValue(stream));

    const { result } = renderHook(() =>
      useMediaStreamSession({ audio: false, logger: fakeLogger() }),
    );

    await act(async () => {
      await result.current.startCamera();
    });

    expect(result.current.status).toBe('ready');
    expect(result.current.stream).toBe(stream);
    expect(result.current.errorCode).toBeNull();
  });

  it('requests audio only when asked — the sole constraint difference between the two hooks', async () => {
    const { stream } = fakeStream();
    const getUserMedia = jest.fn().mockResolvedValue(stream);
    mockMediaDevices(getUserMedia);

    const { result: photo } = renderHook(() =>
      useMediaStreamSession({ audio: false, logger: fakeLogger() }),
    );
    await act(async () => {
      await photo.current.startCamera();
    });
    expect(getUserMedia).toHaveBeenLastCalledWith(
      expect.objectContaining({ audio: false }),
    );

    const { result: video } = renderHook(() =>
      useMediaStreamSession({ audio: true, logger: fakeLogger() }),
    );
    await act(async () => {
      await video.current.startCamera();
    });
    expect(getUserMedia).toHaveBeenLastCalledWith(
      expect.objectContaining({ audio: true }),
    );
  });

  it('asks for an exact device when given one, else facingMode', async () => {
    const { stream } = fakeStream();
    const getUserMedia = jest.fn().mockResolvedValue(stream);
    mockMediaDevices(getUserMedia);

    const { result } = renderHook(() =>
      useMediaStreamSession({ audio: false, logger: fakeLogger() }),
    );

    await act(async () => {
      await result.current.startCamera('cam-7');
    });
    expect(getUserMedia).toHaveBeenLastCalledWith(
      expect.objectContaining({ video: { deviceId: { exact: 'cam-7' } } }),
    );

    await act(async () => {
      await result.current.startCamera();
    });
    expect(getUserMedia).toHaveBeenLastCalledWith(
      expect.objectContaining({ video: { facingMode: 'environment' } }),
    );
  });

  it('releases the previous device before requesting the next', async () => {
    const first = fakeStream('cam-1');
    const second = fakeStream('cam-2');
    const getUserMedia = jest
      .fn()
      .mockResolvedValueOnce(first.stream)
      .mockResolvedValueOnce(second.stream);
    mockMediaDevices(getUserMedia);

    const { result } = renderHook(() =>
      useMediaStreamSession({ audio: false, logger: fakeLogger() }),
    );

    await act(async () => {
      await result.current.startCamera('cam-1');
    });
    expect(first.tracks[0].stop).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.startCamera('cam-2');
    });
    expect(first.tracks[0].stop).toHaveBeenCalled();
    expect(result.current.stream).toBe(second.stream);
  });

  it('reports NOT_SUPPORTED when the MediaDevices API is absent', async () => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      writable: true,
      value: undefined,
    });

    const { result } = renderHook(() =>
      useMediaStreamSession({ audio: false, logger: fakeLogger() }),
    );

    await act(async () => {
      await result.current.startCamera();
    });

    expect(result.current.status).toBe('error');
    expect(result.current.errorCode).toBe('NOT_SUPPORTED');
    expect(result.current.errorMessage).toBe('MediaDevices API not available');
  });

  it('maps a rejection to a code and flips to error', async () => {
    mockMediaDevices(jest.fn().mockRejectedValue(domError('NotReadableError')));

    const { result } = renderHook(() =>
      useMediaStreamSession({ audio: false, logger: fakeLogger() }),
    );

    await act(async () => {
      await result.current.startCamera();
    });

    expect(result.current.status).toBe('error');
    expect(result.current.errorCode).toBe('DEVICE_BUSY');
  });

  it('logs a declined prompt as a warning, not an error', async () => {
    const logger = fakeLogger();
    mockMediaDevices(jest.fn().mockRejectedValue(domError('NotAllowedError')));

    const { result } = renderHook(() =>
      useMediaStreamSession({ audio: false, logger }),
    );

    await act(async () => {
      await result.current.startCamera();
    });

    expect(logger.warn).toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('logs a genuine failure as an error', async () => {
    const logger = fakeLogger();
    mockMediaDevices(jest.fn().mockRejectedValue(domError('NotFoundError')));

    const { result } = renderHook(() =>
      useMediaStreamSession({ audio: false, logger }),
    );

    await act(async () => {
      await result.current.startCamera();
    });

    expect(logger.error).toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('clears a previous error on a fresh attempt', async () => {
    const { stream } = fakeStream();
    const getUserMedia = jest
      .fn()
      .mockRejectedValueOnce(domError('NotAllowedError'))
      .mockResolvedValueOnce(stream);
    mockMediaDevices(getUserMedia);

    const { result } = renderHook(() =>
      useMediaStreamSession({ audio: false, logger: fakeLogger() }),
    );

    await act(async () => {
      await result.current.startCamera();
    });
    expect(result.current.errorCode).toBe('PERMISSION_DENIED');

    await act(async () => {
      await result.current.startCamera();
    });
    expect(result.current.status).toBe('ready');
    expect(result.current.errorCode).toBeNull();
    expect(result.current.errorMessage).toBeNull();
  });
});

describe('useMediaStreamSession — callbacks', () => {
  it('runs onStreamReady with the live stream before flipping to ready', async () => {
    const { stream } = fakeStream();
    mockMediaDevices(jest.fn().mockResolvedValue(stream));

    const seenStatus: string[] = [];
    const onStreamReady = jest.fn(async () => {
      seenStatus.push('called');
    });

    const { result } = renderHook(() =>
      useMediaStreamSession({ audio: false, logger: fakeLogger(), onStreamReady }),
    );

    await act(async () => {
      await result.current.startCamera('cam-9');
    });

    expect(onStreamReady).toHaveBeenCalledWith(stream, 'cam-9');
    expect(seenStatus).toEqual(['called']);
    expect(result.current.status).toBe('ready');
  });

  it('surfaces an onStreamReady failure as a session error', async () => {
    const { stream } = fakeStream();
    mockMediaDevices(jest.fn().mockResolvedValue(stream));

    const { result } = renderHook(() =>
      useMediaStreamSession({
        audio: false,
        logger: fakeLogger(),
        onStreamReady: () => {
          throw domError('NotFoundError');
        },
      }),
    );

    await act(async () => {
      await result.current.startCamera();
    });

    expect(result.current.status).toBe('error');
    expect(result.current.errorCode).toBe('NO_DEVICE');
  });

  it('runs onStopped when the camera stops', async () => {
    const { stream } = fakeStream();
    mockMediaDevices(jest.fn().mockResolvedValue(stream));
    const onStopped = jest.fn();

    const { result } = renderHook(() =>
      useMediaStreamSession({ audio: false, logger: fakeLogger(), onStopped }),
    );

    await act(async () => {
      await result.current.startCamera();
    });
    act(() => {
      result.current.stopCamera();
    });

    expect(onStopped).toHaveBeenCalledTimes(1);
  });
});

describe('useMediaStreamSession — teardown', () => {
  it('stops every track and returns to idle on stopCamera', async () => {
    const { stream, tracks } = fakeStream();
    mockMediaDevices(jest.fn().mockResolvedValue(stream));

    const { result } = renderHook(() =>
      useMediaStreamSession({ audio: false, logger: fakeLogger() }),
    );

    await act(async () => {
      await result.current.startCamera();
    });
    act(() => {
      result.current.stopCamera();
    });

    expect(tracks[0].stop).toHaveBeenCalled();
    expect(result.current.status).toBe('idle');
    expect(result.current.stream).toBeNull();
  });

  it('stops every track on unmount — no camera light left on', async () => {
    const { stream, tracks } = fakeStream();
    mockMediaDevices(jest.fn().mockResolvedValue(stream));

    const { result, unmount } = renderHook(() =>
      useMediaStreamSession({ audio: false, logger: fakeLogger() }),
    );

    await act(async () => {
      await result.current.startCamera();
    });
    expect(tracks[0].stop).not.toHaveBeenCalled();

    unmount();

    expect(tracks[0].stop).toHaveBeenCalled();
  });

  it('tolerates stopCamera before any stream exists', () => {
    mockMediaDevices(jest.fn());
    const { result } = renderHook(() =>
      useMediaStreamSession({ audio: false, logger: fakeLogger() }),
    );

    expect(() => act(() => result.current.stopCamera())).not.toThrow();
    expect(result.current.status).toBe('idle');
  });
});

describe('useMediaStreamSession — extended status', () => {
  it('lets the owning hook drive its own statuses', async () => {
    const { stream } = fakeStream();
    mockMediaDevices(jest.fn().mockResolvedValue(stream));

    const { result } = renderHook(() =>
      useMediaStreamSession<'recording'>({ audio: true, logger: fakeLogger() }),
    );

    await act(async () => {
      await result.current.startCamera();
    });
    act(() => {
      result.current.setStatus('recording');
    });

    expect(result.current.status).toBe('recording');
  });

  it('fail() records the code and message verbatim', async () => {
    mockMediaDevices(jest.fn());
    const { result } = renderHook(() =>
      useMediaStreamSession({ audio: false, logger: fakeLogger() }),
    );

    act(() => {
      result.current.fail('UNKNOWN', 'Empty recording');
    });

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.errorCode).toBe('UNKNOWN');
    expect(result.current.errorMessage).toBe('Empty recording');
  });
});
