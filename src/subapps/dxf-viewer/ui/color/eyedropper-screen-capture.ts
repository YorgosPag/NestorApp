/**
 * Eyedropper screen-capture source.
 *
 * Reads rendered pixels via `getDisplayMedia()` so the eyedropper fallback
 * works even when the underlying canvas is CORS-tainted (e.g. user-loaded
 * image drawn into a `<canvas>` without cross-origin headers).
 *
 * Coordinate mapping is ratio-based: viewport CSS coords → buffer pixels.
 * Works for any shared surface (monitor/window/tab) since the user normally
 * picks the option that contains the current page.
 */

export interface ScreenCapture {
  /** Buffer canvas holding the latest video frame. Use as zoom source. */
  buffer: HTMLCanvasElement;
  /** Refresh buffer with the current video frame (call once per RAF tick). */
  refresh(): void;
  /** Map a viewport (clientX/Y, screenX/Y) point to buffer pixel coords. */
  mapToBuffer(clientX: number, clientY: number, screenX: number, screenY: number): { bx: number; by: number };
  /** Stop the stream and detach the video element. */
  destroy(): void;
}

interface DisplaySurfaceSettings extends MediaTrackSettings {
  displaySurface?: 'monitor' | 'window' | 'browser' | 'application';
}

interface GetDisplayMediaOptions extends DisplayMediaStreamOptions {
  preferCurrentTab?: boolean;
  selfBrowserSurface?: 'include' | 'exclude';
}

/**
 * Request screen capture from the user. Returns null on denial or unsupported.
 * Must be called inside a user gesture (e.g. click handler).
 */
export async function setupScreenCapture(): Promise<ScreenCapture | null> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getDisplayMedia) {
    return null;
  }

  let stream: MediaStream;
  try {
    const opts: GetDisplayMediaOptions = {
      video: true,
      audio: false,
      preferCurrentTab: true, // Chrome hint, ignored elsewhere
      selfBrowserSurface: 'include',
    };
    stream = await navigator.mediaDevices.getDisplayMedia(opts);
  } catch {
    return null; // user denied or capture failed
  }

  const track = stream.getVideoTracks()[0];
  if (!track) {
    stream.getTracks().forEach((t) => t.stop());
    return null;
  }

  const settings = track.getSettings() as DisplaySurfaceSettings;
  const surface = settings.displaySurface ?? 'monitor';

  const video = document.createElement('video');
  video.srcObject = stream;
  video.muted = true;
  video.playsInline = true;
  video.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;opacity:0;pointer-events:none;';
  document.body.appendChild(video);

  try {
    await new Promise<void>((res, rej) => {
      video.onloadedmetadata = () => res();
      video.onerror = () => rej(new Error('video load failed'));
    });
    await video.play();
  } catch {
    stream.getTracks().forEach((t) => t.stop());
    video.remove();
    return null;
  }

  const buffer = document.createElement('canvas');
  buffer.width = video.videoWidth || 1920;
  buffer.height = video.videoHeight || 1080;
  const bufferCtx = buffer.getContext('2d', { willReadFrequently: true });
  if (!bufferCtx) {
    stream.getTracks().forEach((t) => t.stop());
    video.remove();
    return null;
  }

  // Stream may end if user clicks "Stop sharing" — cleanup gracefully
  track.addEventListener('ended', () => {
    stream.getTracks().forEach((t) => t.stop());
  });

  return {
    buffer,
    refresh: () => {
      try {
        bufferCtx.drawImage(video, 0, 0, buffer.width, buffer.height);
      } catch {
        // Stream might have ended; skip silently
      }
    },
    mapToBuffer: (clientX, clientY, screenX, screenY) => mapToBuffer(buffer, surface, clientX, clientY, screenX, screenY),
    destroy: () => {
      stream.getTracks().forEach((t) => t.stop());
      video.srcObject = null;
      video.remove();
    },
  };
}

/**
 * Viewport → buffer pixel mapping based on shared surface.
 *
 * - `monitor`: cursor's screen position (screenX/Y) ratioed to screen.width/height
 * - `browser`/`window`/`application`: cursor's viewport position ratioed to innerWidth/Height
 *
 * Both produce buffer pixel coords. The buffer is the captured frame at its
 * native resolution (typically physical pixels regardless of DPR).
 */
function mapToBuffer(
  buffer: HTMLCanvasElement,
  surface: string,
  clientX: number,
  clientY: number,
  screenX: number,
  screenY: number
): { bx: number; by: number } {
  if (surface === 'monitor') {
    const sw = window.screen.width || window.innerWidth;
    const sh = window.screen.height || window.innerHeight;
    return {
      bx: (screenX / sw) * buffer.width,
      by: (screenY / sh) * buffer.height,
    };
  }
  return {
    bx: (clientX / window.innerWidth) * buffer.width,
    by: (clientY / window.innerHeight) * buffer.height,
  };
}
