/**
 * 🔐 SESSION — DEVICE DETECTION
 *
 * Browser/OS/device detection from the user agent — **pure** functions, run by the **server** on the
 * request's own `user-agent` header (ADR-894). The browser contributes only what the server cannot
 * see (screen, language), via `getClientDeviceHints()`.
 *
 * ⛔ Η τοποθεσία **δεν** ζει πια εδώ: μέχρι τις 2026-09-29 ο browser ρωτούσε το `ipapi.co` και έκανε
 * hash της IP με αλάτι γραμμένο στον κώδικα (αντιστρέψιμο). Πλέον: `lib/geo/ip-geolocation.ts`, στον server.
 *
 * @module services/session/session-device-detection
 * @see session-server.service.ts
 * @gdpr-compliant true
 */

import type {
  ClientDeviceHints,
  SessionDeviceInfo,
  DeviceType,
  BrowserType,
  OperatingSystem,
} from './session.types';

// ============================================================================
// DEVICE DETECTION
// ============================================================================

/** Detect device type from user agent */
export function detectDeviceType(userAgent: string): DeviceType {
  const ua = userAgent.toLowerCase();

  if (/mobile|android|iphone|ipod|blackberry|windows phone/i.test(ua)) {
    return 'mobile';
  }
  if (/ipad|tablet|playbook|silk/i.test(ua)) {
    return 'tablet';
  }
  if (/windows|macintosh|linux|cros/i.test(ua)) {
    return 'desktop';
  }

  return 'unknown';
}

/** Detect browser type from user agent */
export function detectBrowser(userAgent: string): { type: BrowserType; version: string } {
  const ua = userAgent;

  if (/Edg/i.test(ua)) {
    const match = ua.match(/Edg\/(\d+)/);
    return { type: 'Edge', version: match?.[1] || 'Unknown' };
  }
  if (/Chrome/i.test(ua) && !/Chromium/i.test(ua)) {
    const match = ua.match(/Chrome\/(\d+)/);
    return { type: 'Chrome', version: match?.[1] || 'Unknown' };
  }
  if (/Firefox/i.test(ua)) {
    const match = ua.match(/Firefox\/(\d+)/);
    return { type: 'Firefox', version: match?.[1] || 'Unknown' };
  }
  if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) {
    const match = ua.match(/Version\/(\d+)/);
    return { type: 'Safari', version: match?.[1] || 'Unknown' };
  }
  if (/OPR|Opera/i.test(ua)) {
    const match = ua.match(/(?:OPR|Opera)\/(\d+)/);
    return { type: 'Opera', version: match?.[1] || 'Unknown' };
  }

  return { type: 'Unknown', version: 'Unknown' };
}

/** Detect operating system from user agent */
export function detectOS(userAgent: string): { os: OperatingSystem; version: string } {
  const ua = userAgent;

  if (/Windows NT 10/i.test(ua)) return { os: 'Windows', version: '10/11' };
  if (/Windows/i.test(ua)) return { os: 'Windows', version: 'Unknown' };
  if (/Mac OS X/i.test(ua)) {
    const match = ua.match(/Mac OS X (\d+[._]\d+)/);
    return { os: 'macOS', version: match?.[1]?.replace('_', '.') || 'Unknown' };
  }
  if (/iPhone|iPad|iPod/i.test(ua)) {
    const match = ua.match(/OS (\d+[._]\d+)/);
    return { os: 'iOS', version: match?.[1]?.replace('_', '.') || 'Unknown' };
  }
  if (/Android/i.test(ua)) {
    const match = ua.match(/Android (\d+\.?\d*)/);
    return { os: 'Android', version: match?.[1] || 'Unknown' };
  }
  if (/CrOS/i.test(ua)) return { os: 'ChromeOS', version: 'Unknown' };
  if (/Linux/i.test(ua)) return { os: 'Linux', version: 'Unknown' };

  return { os: 'Unknown', version: 'Unknown' };
}

/** Αρκετό για κάθε πραγματικό UA· ένα τεράστιο header δεν γίνεται τεράστιο έγγραφο. */
const MAX_STORED_USER_AGENT_LENGTH = 512;

/**
 * **Server**: η συσκευή από το `user-agent` του **ίδιου** του αιτήματος + τις ενδείξεις του browser.
 * Ο client δεν δηλώνει πια «είμαι Chrome σε Windows» — το λέει η κεφαλίδα που έστειλε.
 */
export function deviceInfoFromUserAgent(userAgent: string, hints: ClientDeviceHints): SessionDeviceInfo {
  const browser = detectBrowser(userAgent);
  const osInfo = detectOS(userAgent);
  return {
    type: detectDeviceType(userAgent),
    browser: `${browser.type} ${browser.version}`,
    browserType: browser.type,
    os: osInfo.os,
    osVersion: osInfo.version,
    userAgent: userAgent.slice(0, MAX_STORED_USER_AGENT_LENGTH),
    ...(hints.screenResolution ? { screenResolution: hints.screenResolution } : {}),
    // BCP 47 «und» = απροσδιόριστη — καλύτερο από ένα επινοημένο 'en'.
    language: hints.language ?? 'und',
  };
}

/** **Browser**: μόνο ό,τι ο server δεν μπορεί να δει. */
export function getClientDeviceHints(): ClientDeviceHints {
  if (typeof navigator === 'undefined') return {};
  return {
    ...(typeof screen !== 'undefined' ? { screenResolution: `${screen.width}x${screen.height}` } : {}),
    ...(navigator.language ? { language: navigator.language } : {}),
  };
}

