/**
 * 🧪 useCameraCapture / useVideoRecorder — bindings over the shared session (ADR-584)
 *
 * Both hooks were untested before the de-duplication despite shipping to the
 * camera dialog. This suite pins the behaviour each hook owns on top of
 * `useMediaStreamSession` — the parts a test of the session alone cannot see:
 * the constraint each one asks for, the camera's device bookkeeping, and the
 * recorder's lifecycle.
 */

import { act, renderHook, waitFor } from '@testing-library/react';

import { useCameraCapture } from '../../useCameraCapture';
import { useVideoRecorder } from '../../useVideoRecorder';

// ---------------------------------------------------------------------------
// FIXTURES
// ---------------------------------------------------------------------------

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

const originalMediaDevices = navigator.mediaDevices;
const originalMediaRecorder = (globalThis as { MediaRecorder?: unknown })
  .MediaRecorder;

afterEach(() => {
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    writable: true,
    value: originalMediaDevices,
  });
  (globalThis as { MediaRecorder?: unknown }).MediaRecorder =
    originalMediaRecorder;
  jest.useRealTimers();
});

// ---------------------------------------------------------------------------
// useCameraCapture
// ---------------------------------------------------------------------------

describe('useCameraCapture', () => {
  it('never asks for a microphone', async () => {
    const getUserMedia = jest.fn().mockResolvedValue(fakeStream().stream);
    mockMediaDevices(getUserMedia);

    const { result } = renderHook(() => useCameraCapture());
    await act(async () => {
      await result.current.startCamera();
    });

    expect(getUserMedia).toHaveBeenCalledWith(
      expect.objectContaining({ audio: false }),
    );
  });

  it('resolves activeDeviceId from the track the browser actually gave us', async () => {
    // Asked for cam-9, browser hands back cam-real — the track wins.
    mockMediaDevices(jest.fn().mockResolvedValue(fakeStream('cam-real').stream));

    const { result } = renderHook(() => useCameraCapture());
    await act(async () => {
      await result.current.startCamera('cam-9');
    });

    expect(result.current.activeDeviceId).toBe('cam-real');
  });

  it('falls back to the requested id when the track reports no deviceId', async () => {
    const tracks = [{ stop: jest.fn(), getSettings: () => ({}) as MediaTrackSettings }];
    const stream = {
      getTracks: () => tracks,
      getVideoTracks: () => tracks,
    } as unknown as MediaStream;
    mockMediaDevices(jest.fn().mockResolvedValue(stream));

    const { result } = renderHook(() => useCameraCapture());
    await act(async () => {
      await result.current.startCamera('cam-asked');
    });

    expect(result.current.activeDeviceId).toBe('cam-asked');
  });

  it('lists only video inputs, labelling the unlabelled', async () => {
    const enumerateDevices = jest.fn().mockResolvedValue([
      { kind: 'videoinput', deviceId: 'v1', label: 'FaceTime HD' },
      { kind: 'audioinput', deviceId: 'a1', label: 'Microphone' },
      { kind: 'videoinput', deviceId: 'v2', label: '' },
    ]);
    mockMediaDevices(jest.fn().mockResolvedValue(fakeStream().stream), enumerateDevices);

    const { result } = renderHook(() => useCameraCapture());
    await act(async () => {
      await result.current.startCamera();
    });

    // The fallback number counts cameras, not raw devices — the audioinput
    // between them does not shift v2 to "Camera 3".
    expect(result.current.devices).toEqual([
      { deviceId: 'v1', label: 'FaceTime HD' },
      { deviceId: 'v2', label: 'Camera 2' },
    ]);
  });

  it('clears activeDeviceId when the camera stops', async () => {
    mockMediaDevices(jest.fn().mockResolvedValue(fakeStream().stream));

    const { result } = renderHook(() => useCameraCapture());
    await act(async () => {
      await result.current.startCamera();
    });
    expect(result.current.activeDeviceId).toBe('cam-1');

    act(() => {
      result.current.stopCamera();
    });

    expect(result.current.activeDeviceId).toBeNull();
    expect(result.current.status).toBe('idle');
  });

  it('switchDevice re-requests the exact device', async () => {
    const getUserMedia = jest.fn().mockResolvedValue(fakeStream('cam-2').stream);
    mockMediaDevices(getUserMedia);

    const { result } = renderHook(() => useCameraCapture());
    await act(async () => {
      await result.current.switchDevice('cam-2');
    });

    expect(getUserMedia).toHaveBeenCalledWith(
      expect.objectContaining({ video: { deviceId: { exact: 'cam-2' } } }),
    );
    expect(result.current.status).toBe('ready');
  });

  it('capturePhoto returns null before the camera is started', async () => {
    mockMediaDevices(jest.fn());
    const { result } = renderHook(() => useCameraCapture());

    let file: File | null = null;
    await act(async () => {
      file = await result.current.capturePhoto();
    });

    expect(file).toBeNull();
  });

  it('capturePhoto returns null while the first frame has no dimensions', async () => {
    mockMediaDevices(jest.fn().mockResolvedValue(fakeStream().stream));
    const { result } = renderHook(() => useCameraCapture());

    await act(async () => {
      await result.current.startCamera();
    });

    // A <video> that has not decoded a frame reports 0×0 — grabbing it would
    // produce a blank image.
    result.current.videoRef.current = {
      videoWidth: 0,
      videoHeight: 0,
    } as HTMLVideoElement;

    let file: File | null = null;
    await act(async () => {
      file = await result.current.capturePhoto();
    });

    expect(file).toBeNull();
    expect(result.current.status).toBe('ready');
  });
});

// ---------------------------------------------------------------------------
// useVideoRecorder
// ---------------------------------------------------------------------------

describe('useVideoRecorder', () => {
  function mockRecorderClass(state = 'recording') {
    const instances: Array<Record<string, unknown>> = [];
    class FakeRecorder {
      static isTypeSupported = () => true;
      state = state;
      mimeType = 'video/webm;codecs=vp9,opus';
      ondataavailable: ((e: { data: Blob }) => void) | null = null;
      onstop: (() => void) | null = null;
      start = jest.fn();
      stop = jest.fn(() => {
        this.state = 'inactive';
        this.onstop?.();
      });
      constructor() {
        instances.push(this as unknown as Record<string, unknown>);
      }
    }
    (globalThis as { MediaRecorder?: unknown }).MediaRecorder = FakeRecorder;
    return instances;
  }

  it('asks for a microphone — the constraint that separates it from the camera hook', async () => {
    const getUserMedia = jest.fn().mockResolvedValue(fakeStream().stream);
    mockMediaDevices(getUserMedia);

    const { result } = renderHook(() => useVideoRecorder());
    await act(async () => {
      await result.current.startCamera();
    });

    expect(getUserMedia).toHaveBeenCalledWith(
      expect.objectContaining({ audio: true }),
    );
  });

  it('does not enumerate devices — that is the camera hook\'s job', async () => {
    const enumerateDevices = jest.fn().mockResolvedValue([]);
    mockMediaDevices(jest.fn().mockResolvedValue(fakeStream().stream), enumerateDevices);

    const { result } = renderHook(() => useVideoRecorder());
    await act(async () => {
      await result.current.startCamera();
    });

    expect(enumerateDevices).not.toHaveBeenCalled();
  });

  it('ignores startRecording before the camera is started', () => {
    mockMediaDevices(jest.fn());
    mockRecorderClass();

    const { result } = renderHook(() => useVideoRecorder());
    act(() => {
      result.current.startRecording();
    });

    expect(result.current.status).toBe('idle');
  });

  it('enters the recording status and ticks the duration', async () => {
    jest.useFakeTimers();
    mockMediaDevices(jest.fn().mockResolvedValue(fakeStream().stream));
    mockRecorderClass();

    const { result } = renderHook(() => useVideoRecorder());
    await act(async () => {
      await result.current.startCamera();
    });
    act(() => {
      result.current.startRecording();
    });

    expect(result.current.status).toBe('recording');
    expect(result.current.durationMs).toBe(0);

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(result.current.durationMs).toBeGreaterThan(0);
  });

  it('stopRecording returns null when nothing was recorded', async () => {
    mockMediaDevices(jest.fn());
    const { result } = renderHook(() => useVideoRecorder());

    let file: File | null = null;
    await act(async () => {
      file = await result.current.stopRecording();
    });

    expect(file).toBeNull();
  });

  it('reports an empty recording as an error rather than a zero-byte file', async () => {
    mockMediaDevices(jest.fn().mockResolvedValue(fakeStream().stream));
    mockRecorderClass();

    const { result } = renderHook(() => useVideoRecorder());
    await act(async () => {
      await result.current.startCamera();
    });
    act(() => {
      result.current.startRecording();
    });

    // No ondataavailable fired → chunks empty → zero-byte blob.
    let file: File | null = null;
    await act(async () => {
      file = await result.current.stopRecording();
    });

    expect(file).toBeNull();
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.errorCode).toBe('UNKNOWN');
    expect(result.current.errorMessage).toBe('Empty recording');
  });

  it('names the file from the negotiated mime type', async () => {
    mockMediaDevices(jest.fn().mockResolvedValue(fakeStream().stream));
    const instances = mockRecorderClass();

    const { result } = renderHook(() => useVideoRecorder());
    await act(async () => {
      await result.current.startCamera();
    });
    act(() => {
      result.current.startRecording();
    });

    const recorder = instances[0] as unknown as {
      ondataavailable: (e: { data: Blob }) => void;
    };
    act(() => {
      recorder.ondataavailable({ data: new Blob(['xxxx']) });
    });

    let file: File | null = null;
    await act(async () => {
      file = await result.current.stopRecording();
    });

    expect(file).not.toBeNull();
    expect(file!.name).toMatch(/^video-\d+\.webm$/);
    expect(file!.type).toBe('video/webm;codecs=vp9,opus');
    await waitFor(() => expect(result.current.status).toBe('ready'));
  });
});
