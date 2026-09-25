import 'server-only';

/**
 * =============================================================================
 * SHARE REQUEST BODY — το σώμα των δημόσιων διαδρομών κοινοποίησης (ADR-884 Φ0.12)
 * =============================================================================
 *
 * Ένα σώμα, δύο πόρτες (`/api/shares/resolve`, `/api/shares/download`). Άκυρο σώμα ⇒
 * `null`, και η διαδρομή απαντά όπως σε άγνωστο διακριτικό: ο ανώνυμος δεν μαθαίνει
 * **τι** ήταν λάθος στο αίτημά του.
 *
 * ⚠️ Όριο μήκους κωδικού **πριν** το scrypt: ένας κωδικός ενός megabyte θα ήταν
 * εργαλείο άρνησης υπηρεσίας.
 *
 * @module server/sharing/share-request-body
 */

import type { NextRequest } from 'next/server';

import { isPlausibleShareToken } from '@/lib/sharing/share-token';
import {
  SHARE_PASSWORD_MAX_LENGTH,
  type ShareResolveRequestBody,
} from '@/services/sharing/share-resolve-contract';

export async function readShareRequestBody(request: NextRequest): Promise<ShareResolveRequestBody | null> {
  const raw: unknown = await request.json().catch(() => null);
  if (raw === null || typeof raw !== 'object') return null;
  const { token, password } = raw as { token?: unknown; password?: unknown };
  if (!isPlausibleShareToken(token)) return null;
  if (password === undefined) return { token };
  if (typeof password !== 'string' || password.length === 0 || password.length > SHARE_PASSWORD_MAX_LENGTH) {
    return null;
  }
  return { token, password };
}
