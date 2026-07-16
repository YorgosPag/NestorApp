/**
 * 🧪 media-mime — shared MediaRecorder MIME plumbing (ADR-584)
 *
 * Locks the behaviour `useVideoRecorder` and `useVoiceRecorder` each used to
 * own a private copy of. The extension cases are the ones that matter: both
 * recorders name their file from a MIME string that still carries its codec
 * parameters.
 */

import { getExtensionFromMime, pickSupportedMime } from '../media-mime';

describe('pickSupportedMime', () => {
  const ORIGINAL = (globalThis as { MediaRecorder?: unknown }).MediaRecorder;

  function mockMediaRecorder(supported: readonly string[]): void {
    (globalThis as { MediaRecorder?: unknown }).MediaRecorder = {
      isTypeSupported: (mime: string) => supported.includes(mime),
    };
  }

  afterEach(() => {
    (globalThis as { MediaRecorder?: unknown }).MediaRecorder = ORIGINAL;
  });

  it('returns the first candidate the browser accepts', () => {
    mockMediaRecorder(['video/webm', 'video/mp4']);
    expect(
      pickSupportedMime(
        ['video/webm;codecs=vp9,opus', 'video/webm', 'video/mp4'],
        'video/webm',
      ),
    ).toBe('video/webm');
  });

  it('honours candidate order over browser order', () => {
    mockMediaRecorder(['video/mp4', 'video/webm']);
    expect(pickSupportedMime(['video/mp4', 'video/webm'], 'video/webm')).toBe(
      'video/mp4',
    );
    expect(pickSupportedMime(['video/webm', 'video/mp4'], 'video/webm')).toBe(
      'video/webm',
    );
  });

  it('falls back when the browser accepts nothing on the list', () => {
    mockMediaRecorder([]);
    expect(pickSupportedMime(['video/mp4'], 'video/webm')).toBe('video/webm');
  });

  it('falls back when MediaRecorder does not exist at all', () => {
    delete (globalThis as { MediaRecorder?: unknown }).MediaRecorder;
    expect(pickSupportedMime(['audio/webm;codecs=opus'], 'audio/webm')).toBe(
      'audio/webm',
    );
  });
});

describe('getExtensionFromMime', () => {
  it('reads through codec parameters', () => {
    expect(getExtensionFromMime('video/webm;codecs=vp9,opus')).toBe('webm');
    expect(getExtensionFromMime('audio/webm;codecs=opus')).toBe('webm');
    expect(getExtensionFromMime('audio/ogg;codecs=opus')).toBe('ogg');
  });

  it('maps the Safari containers', () => {
    expect(getExtensionFromMime('video/mp4')).toBe('mp4');
    expect(getExtensionFromMime('audio/mp4')).toBe('mp4');
  });

  it('defaults unknown types to webm', () => {
    expect(getExtensionFromMime('video/x-matroska')).toBe('webm');
    expect(getExtensionFromMime('')).toBe('webm');
  });
});
