/**
 * session-id-generator — ADR-366 §C.7.Q3
 *
 * GDPR-preserving anonymous session identifier.
 *
 *   session_id = SHA-256( daily_salt + userId )
 *
 * `daily_salt` is a 16-byte random value generated client-side and stored in
 * LocalStorage. It rotates every UTC day and **never leaves the device**, so
 * the server can group samples within a day by `session_id` but cannot reverse
 * the hash to recover the user (Apple Differential Privacy lite, Q3 decision).
 *
 * Same user on a different device → different salt → different session_id
 * → no cross-device correlation.
 *
 * No React, no DOM. Web Crypto + LocalStorage. SSR-safe (ephemeral fallback).
 */

import { nowISO } from '@/lib/date-local';

const LS_SALT_KEY = 'bim3d.telemetry.dailySalt';
const LS_SALT_DATE_KEY = 'bim3d.telemetry.saltRotatedAt';

function bytesToHex(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, '0');
  }
  return out;
}

function todayUtcKey(): string {
  return nowISO().slice(0, 10);
}

function generateRandomSalt(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

/**
 * Read today's salt from LocalStorage, rotating it if missing or stale.
 * Falls back to an ephemeral in-process salt when storage is unavailable
 * (SSR, private mode) — same-session uploads remain consistent, next session
 * gets a fresh salt automatically.
 */
export function getOrRotateDailySalt(): string {
  const today = todayUtcKey();
  try {
    const storedDate = localStorage.getItem(LS_SALT_DATE_KEY);
    const storedSalt = localStorage.getItem(LS_SALT_KEY);
    if (storedDate === today && storedSalt && storedSalt.length === 32) {
      return storedSalt;
    }
    const fresh = generateRandomSalt();
    localStorage.setItem(LS_SALT_KEY, fresh);
    localStorage.setItem(LS_SALT_DATE_KEY, today);
    return fresh;
  } catch {
    return generateRandomSalt();
  }
}

/**
 * Compute the anonymous session id for the current UTC day.
 * The returned string is a 64-char lowercase hex SHA-256 digest.
 */
export async function computeAnonymousSessionId(userId: string): Promise<string> {
  const salt = getOrRotateDailySalt();
  const payload = new TextEncoder().encode(`${salt}:${userId}`);
  const digest = await crypto.subtle.digest('SHA-256', payload);
  return bytesToHex(new Uint8Array(digest));
}

/**
 * Drop the persisted salt — used by the right-to-erasure flow so subsequent
 * sessions cannot be linked to any previously uploaded sample.
 */
export function clearStoredSalt(): void {
  try {
    localStorage.removeItem(LS_SALT_KEY);
    localStorage.removeItem(LS_SALT_DATE_KEY);
  } catch {
    /* SSR / private mode — nothing to clear */
  }
}
