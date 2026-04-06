/**
 * 🔐 SESSION — DEVICE DETECTION & LOCATION UTILITIES
 *
 * Device fingerprinting, browser/OS detection, and GDPR-compliant
 * location approximation for session management.
 *
 * @module services/session/session-device-detection
 * @see EnterpriseSessionService.ts
 * @gdpr-compliant true
 */

import type {
  SessionDeviceInfo,
  SessionLocation,
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

/** Get aggregated device information from browser */
export function getDeviceInfo(): SessionDeviceInfo {
  if (typeof navigator === 'undefined') {
    return {
      type: 'unknown',
      browser: 'Server',
      browserType: 'Unknown',
      os: 'Unknown',
      osVersion: 'Unknown',
      userAgent: 'Server-side',
      language: 'en'
    };
  }

  const userAgent = navigator.userAgent;
  const browser = detectBrowser(userAgent);
  const osInfo = detectOS(userAgent);

  return {
    type: detectDeviceType(userAgent),
    browser: `${browser.type} ${browser.version}`,
    browserType: browser.type,
    os: osInfo.os,
    osVersion: osInfo.version,
    userAgent,
    screenResolution: typeof screen !== 'undefined'
      ? `${screen.width}x${screen.height}`
      : undefined,
    language: navigator.language || 'en'
  };
}

// ============================================================================
// LOCATION UTILITIES (GDPR COMPLIANT)
// ============================================================================

/** Hash IP address for GDPR compliance (SHA-256, first 8 chars) */
async function hashIP(ip: string): Promise<string> {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    return ip.split('.').slice(0, 2).join('.') + '.x.x';
  }

  const encoder = new TextEncoder();
  const data = encoder.encode(ip + 'enterprise-salt-2024');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  return hashHex.substring(0, 8);
}

/** Get approximate location from IP (GDPR compliant, timezone fallback) */
export async function getApproximateLocation(): Promise<SessionLocation> {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const defaultLocation: SessionLocation = {
    ipHash: 'unknown',
    countryCode: 'GR',
    countryName: 'Ελλάδα',
    city: 'Unknown',
    timezone,
    isApproximate: true
  };

  try {
    const response = await fetch('https://ipapi.co/json/', {
      signal: AbortSignal.timeout(3000)
    });

    if (!response.ok) return defaultLocation;

    const data = await response.json();

    return {
      ipHash: await hashIP(data.ip || 'unknown'),
      countryCode: data.country_code || 'GR',
      countryName: data.country_name || 'Unknown',
      city: data.city || 'Unknown',
      region: data.region || undefined,
      timezone: data.timezone || timezone,
      isApproximate: true
    };
  } catch {
    return defaultLocation;
  }
}
